/**
 * AI-assisted column-mapping fallback for logbook imports.
 *
 * Triggered when the regex-based smart parser (`parseSmartLogbook` in
 * `import-formats.ts`) can't find a recognizable header row — usually because
 * the logbook uses unusual column names, an exotic layout, or column names
 * the heuristic patterns don't cover yet.
 *
 * Sends the first ~25 CSV rows to Claude Haiku 4.5 with a JSON-schema-
 * constrained output config, then converts Claude's response into a
 * `SmartHeaderInfo` that feeds back into the same parse pipeline as the
 * regex-based detector — so the downstream parsing logic is identical.
 *
 * The system prompt (which contains the canonical field list and instructions)
 * is prompt-cached so repeated invocations only pay full price once per
 * 5-minute window.
 *
 * Server-side only. Requires the `ANTHROPIC_API_KEY` env var; gracefully
 * returns `null` if unset so the import flow can show the user a sensible
 * error rather than a crash.
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  ALL_SMART_FIELDS,
  type SmartField,
  type SmartHeaderInfo,
  parseCSVGrid,
} from "./import-formats";

// Cap how many rows we send to Claude. Headers + ~20 data rows is enough to
// confidently identify columns; sending more burns tokens without improving
// mapping quality. Empirically Haiku gets it right with 15-25 rows.
const SAMPLE_ROWS = 25;
// Hard cap on CSV bytes we send. Defends against a giant pasted CSV running up
// the input token bill — Haiku 4.5 is $1/M input but unbounded sample size
// still adds up.
const MAX_SAMPLE_BYTES = 40_000;

// System prompt is sent as the first content block of every call. Marking it
// `cache_control: ephemeral` means the second-and-later calls within 5 minutes
// pay ~0.1× for this portion instead of full price.
const SYSTEM_PROMPT = `You are a pilot-logbook column-mapping expert. Given the first ~25 rows of a CSV-converted pilot logbook, identify which columns map to which canonical fields.

Canonical fields:
- date — flight date (must have a parseable date column or no flights can be extracted)
- make_model — aircraft type or model (e.g. "C172", "B737", "PA-28")
- registration — tail number / aircraft id (e.g. "N12345", "C-GXYZ", "D-EABC")
- from — departure airport
- to — arrival airport
- route — full route as one cell (use when from/to aren't separate columns)
- pic — pilot-in-command time (hours)
- sic — second-in-command time (hours)
- fo — first-officer time (hours)
- dual — dual-instruction-received time (hours)
- solo — solo time (hours)
- day — day-flight time (hours)
- night — night-flight time (hours)
- sel / mel / ses / mes / heli — category-specific time (single/multi engine land/sea, helicopter)
- instrument — actual instrument time (IMC, hours)
- hood — simulated instrument time / hood time (hours)
- sim — simulator time (hours)
- cross_country — cross-country indicator or time
- total — total flight time per row (hours)
- approaches — number of IFR approaches
- remarks — free-text notes/comments
- block_off — block-off clock time (gate-out HH:MM), used to compute duration
- block_on — block-on clock time (gate-in HH:MM), used to compute duration

Rules:
1. Headers may be split across multiple rows (top-level group + sub-headers). Map by understanding what each COLUMN ultimately represents.
2. Column indexing is 0-based.
3. Only include columns you're confident about. Skip ambiguous columns rather than guess.
4. \`splitTime\` should be true if hours and tenths are in adjacent columns (e.g. col 5 = "1", col 6 = "0" meaning 1.0 hours).
5. \`yearOverride\` should be a 4-digit year string ONLY if individual date cells lack a year (e.g. "MAY.7" cells with year stored elsewhere). Otherwise null.
6. \`dataStartIdx\` is the 0-based row index where flight data BEGINS (one past the last header row).
7. If no parseable header can be found OR there's no date column, return all-nulls — don't invent a mapping.`;

// JSON schema for Claude's response. The Messages API enforces this with
// `output_config.format` — invalid responses get retried by the API rather
// than handed back to us as malformed text.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    confidence: {
      type: "string",
      enum: ["high", "medium", "low", "none"],
      description: "How confident the model is in this mapping",
    },
    dataStartIdx: {
      type: ["integer", "null"],
      description: "0-based row index where data begins (null if unparseable)",
    },
    yearOverride: {
      type: ["string", "null"],
      description: "4-digit year if dates lack year; otherwise null",
    },
    splitTime: {
      type: "boolean",
      description: "True if time columns span 2 cells (hours, tenths)",
    },
    columnMap: {
      type: "array",
      description: "List of column-to-field mappings",
      items: {
        type: "object",
        properties: {
          col: { type: "integer", description: "0-based column index" },
          field: {
            type: "string",
            enum: ALL_SMART_FIELDS as unknown as string[],
            description: "Canonical field name",
          },
        },
        required: ["col", "field"],
        additionalProperties: false,
      },
    },
    notes: {
      type: "string",
      description: "Brief explanation of the mapping or why none was found",
    },
  },
  required: ["confidence", "dataStartIdx", "yearOverride", "splitTime", "columnMap", "notes"],
  additionalProperties: false,
} as const;

interface AIMappingResponse {
  confidence: "high" | "medium" | "low" | "none";
  dataStartIdx: number | null;
  yearOverride: string | null;
  splitTime: boolean;
  columnMap: Array<{ col: number; field: SmartField }>;
  notes: string;
}

export interface AIInferResult {
  /** SmartHeaderInfo ready to feed back into parseSmartLogbook. Null when AI couldn't find a mapping. */
  headerInfo: SmartHeaderInfo | null;
  /** "high" | "medium" | "low" | "none" — useful for warning the user when the mapping is shaky. */
  confidence: "high" | "medium" | "low" | "none";
  /** Brief plain-English note from Claude — surfaced to the user when import fails. */
  notes: string;
  /** Raw token usage so we can log/bill if needed. */
  usage?: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
}

/**
 * Send the first ~25 rows of a CSV to Claude and ask it to identify columns.
 * Returns a SmartHeaderInfo that `parseSmartLogbook` can use directly, or
 * null when AI parsing isn't available or didn't find a mapping.
 *
 * Server-side only. Throws if called from a Client Component (the import
 * isn't actually here but `server-only` enforces the boundary).
 */
export async function aiInferColumnMapping(csvText: string): Promise<AIInferResult> {
  // Graceful degradation when the API key isn't configured. The host can
  // deploy without ANTHROPIC_API_KEY — the import flow will still work for
  // formats the regex parser handles; only the AI fallback is dark.
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      headerInfo: null,
      confidence: "none",
      notes: "AI parsing is unavailable — ANTHROPIC_API_KEY not configured on the server.",
    };
  }

  // Trim sample to first SAMPLE_ROWS rows AND MAX_SAMPLE_BYTES bytes. Either
  // cap is a safety net; both apply.
  const allRows = parseCSVGrid(csvText);
  const trimmedRows = allRows.slice(0, SAMPLE_ROWS);
  // Re-serialize as CSV-ish text for Claude (just the rows we picked). Using
  // newline-delimited JSON arrays keeps cell boundaries unambiguous and
  // avoids re-quoting headaches with embedded commas/newlines.
  let sampleText = trimmedRows
    .map((row, i) => `Row ${i}: ${JSON.stringify(row)}`)
    .join("\n");
  if (sampleText.length > MAX_SAMPLE_BYTES) {
    sampleText = sampleText.slice(0, MAX_SAMPLE_BYTES) + "\n…[truncated]";
  }

  const client = new Anthropic();
  const userPrompt = `Here are the first ${trimmedRows.length} rows of a pilot logbook. Identify the column mapping.

${sampleText}

Respond with the canonical column mapping. Only include columns you're confident about.`;

  let response;
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      // Prefix-match prompt caching: the system prompt is the only stable
      // prefix (user prompt varies per file), so we cache it. ~700 tokens of
      // field definitions × every call would otherwise repeat cost.
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
      // Constrain output to our schema — the API validates server-side.
      output_config: {
        format: {
          type: "json_schema",
          schema: RESPONSE_SCHEMA,
        },
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      headerInfo: null,
      confidence: "none",
      notes: `AI mapping failed: ${msg}`,
    };
  }

  // Extract the JSON text from the first text block.
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return {
      headerInfo: null,
      confidence: "none",
      notes: "AI returned no text response.",
    };
  }

  let parsed: AIMappingResponse;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return {
      headerInfo: null,
      confidence: "none",
      notes: "AI returned malformed JSON despite schema constraint.",
    };
  }

  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
  };

  // Confidence "none" or no usable mapping → bail.
  if (
    parsed.confidence === "none" ||
    parsed.dataStartIdx == null ||
    parsed.columnMap.length === 0
  ) {
    return {
      headerInfo: null,
      confidence: parsed.confidence,
      notes: parsed.notes || "AI couldn't identify a usable column mapping.",
      usage,
    };
  }

  // Require a `date` column — without one, no flight is parseable downstream.
  const hasDate = parsed.columnMap.some((m) => m.field === "date");
  if (!hasDate) {
    return {
      headerInfo: null,
      confidence: parsed.confidence,
      notes: `AI found columns but no date column. Notes: ${parsed.notes}`,
      usage,
    };
  }

  // Build the SmartHeaderInfo for parseSmartLogbook. First mapping wins per
  // column (Claude shouldn't duplicate but guard against it).
  const columnMap = new Map<number, SmartField>();
  for (const { col, field } of parsed.columnMap) {
    if (!columnMap.has(col)) columnMap.set(col, field);
  }

  return {
    headerInfo: {
      dataStartIdx: parsed.dataStartIdx,
      columnMap,
      yearOverride: parsed.yearOverride,
      splitTime: parsed.splitTime,
    },
    confidence: parsed.confidence,
    notes: parsed.notes,
    usage,
  };
}
