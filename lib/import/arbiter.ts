/**
 * AI arbiter for the columns the heuristics were unsure about.
 *
 * Server-side only in practice (needs ANTHROPIC_API_KEY); the module itself
 * stays importable from the client bundle because the wizard's client
 * components import the `@/lib/import` barrel — hence the dynamic SDK import
 * and no `server-only` marker. Without a key the mapping is returned
 * unchanged.
 *
 * Structured output is forced with a single tool (`set_column_mapping`) whose
 * `target_key` is an enum of every legal targetKey, so the response can only
 * ever be a valid mapping.
 */
import type { Analysis, ColumnAssignment, ColumnMapping } from "./types";
import { allTargetKeys, parseTargetKey, targetKey, SUMMABLE_FIELDS, describeTarget, CONFIDENCE_THRESHOLD } from "./mapping";

const MODEL = "claude-haiku-4-5";
const TOOL_NAME = "set_column_mapping";
const MAX_SAMPLE_ROWS = 8;

const SYSTEM_PROMPT = `You map columns of pilot-logbook spreadsheets to canonical targets.

Target keys:
- "field:<name>" — a single fact per row: date, make_model (aircraft type), registration (tail number), pic/copilot/third_pilot/check_pilot (crew NAMES, text), route, from, to, remarks, category (text SE/ME/SIM), role (text PIC/FO/DUAL), xc_time (cross-country hours), xc_flag (Y/N cross-country), actual_inst (actual IMC hours), hood_inst (simulated instrument / hood hours), sim_inst (simulator hours), ifr_approaches / precision_approaches / non_precision_approaches (counts), holds, cfi_time (instruction given), takeoffs_day/night, landings_day/night (counts), total_time (the row's own total), block_off / block_on (clock times).
- "time:<category>:<condition>:<role>" — flight HOURS in a bucket. category: any|se|me|ses|mes|heli|sim (single/multi-engine land, sea, helicopter, simulator); condition: any|day|night; role: any|dual|pic|fo|sic|check|solo. AUG / augmenting / cruise-relief crew is role "sic". Use "any" for whatever the header does not specify, e.g. a bare "Night" column is time:any:night:any and "PIC" hours are time:any:any:pic.
- "ignore" — not a logbook fact (distance, Hobbs, fuel, duty, flags such as IPC/Checkride, blank).

Rules:
1. Read the WHOLE header path (group › sub-group › leaf) and the sample values. Numeric hours under "Multi-Engine › Night › FO" are time:me:night:fo. Anything under a Cross-Country group is field:xc_time.
2. A "PIC" or "Co-pilot" column holding names is field:pic / field:copilot; holding hours it is time:any:any:pic / time:any:any:fo.
3. Only one column may be date, make_model, registration, route, from, to, remarks, category, role, total_time, block_off, block_on or a crew name; do not assign one of those to a second column.
4. Answer ONLY for the columns you are asked about. confidence is 0..1 — use below 0.6 when genuinely unsure.`;

interface ToolAssignment { col: number; target_key: string; confidence: number }

function isToolAssignment(v: unknown): v is ToolAssignment {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.col === "number" && typeof o.target_key === "string" && typeof o.confidence === "number";
}

export async function arbitrateWithClaude(analysis: Analysis, opts: { onlyCols?: number[] } = {}): Promise<ColumnMapping> {
  const mapping = analysis.mapping;
  if (!process.env.ANTHROPIC_API_KEY) return mapping;

  const byCol = new Map(mapping.columns.map((c) => [c.col, c]));
  const askable = (c: ColumnAssignment) => c.source !== "user" && c.source !== "template";
  const cols = (opts.onlyCols ?? analysis.lowConfidenceCols)
    .filter((c) => byCol.has(c) && askable(byCol.get(c) as ColumnAssignment));
  if (cols.length === 0) return mapping;

  const legalKeys = allTargetKeys();
  const headerLines = analysis.header.paths
    .map((p) => `col ${p.col}: ${p.path.length ? p.path.join(" › ") : "(no header)"} — current guess: ${targetKey(byCol.get(p.col)?.target ?? { kind: "ignore" })}${cols.includes(p.col) ? "  ← DECIDE" : ""}`)
    .join("\n");
  const sampleLines = analysis.sample.slice(0, MAX_SAMPLE_ROWS)
    .map((row, i) => `row ${i + 1}: ${JSON.stringify(row.map((v, c) => `${c}=${v}`).filter((_, c) => analysis.header.paths[c]?.path.length || cols.includes(c)))}`)
    .join("\n");
  const userPrompt = `File: ${analysis.filename} (sheet "${analysis.sheetName}", ${analysis.rowCount} data rows).

Columns (0-based index, header path, current heuristic guess):
${headerLines}

Sample rows (index=value):
${sampleLines}

Decide the target for these columns: ${cols.join(", ")}.
Legal target keys: ${legalKeys.join(", ")}.`;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [{
      name: TOOL_NAME,
      description: "Set the canonical target for each requested column.",
      input_schema: {
        type: "object",
        properties: {
          assignments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                col: { type: "integer", description: "0-based column index" },
                target_key: { type: "string", enum: legalKeys },
                confidence: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["col", "target_key", "confidence"],
              additionalProperties: false,
            },
          },
        },
        required: ["assignments"],
        additionalProperties: false,
      },
    }],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Claude returned no column mapping.");
  const input = block.input as { assignments?: unknown };
  const assignments = Array.isArray(input.assignments) ? input.assignments.filter(isToolAssignment) : [];
  return mergeAiAssignments(mapping, assignments, new Set(cols));
}

/**
 * Merge Claude's answers: only asked-about columns, never overriding a
 * template/user column, and never letting two columns claim the same
 * identity field (higher confidence keeps it, the other is ignored).
 */
export function mergeAiAssignments(mapping: ColumnMapping, assignments: ToolAssignment[], asked: Set<number>): ColumnMapping {
  const columns = mapping.columns.map((c) => ({ ...c }));
  const byCol = new Map(columns.map((c) => [c.col, c]));
  for (const a of assignments) {
    if (!asked.has(a.col)) continue;
    const existing = byCol.get(a.col);
    if (!existing || existing.source === "template" || existing.source === "user") continue;
    const target = parseTargetKey(a.target_key);
    const confidence = Math.max(0, Math.min(1, a.confidence));
    Object.assign(existing, { target, confidence: Math.round(confidence * 100) / 100, source: "ai", reason: `Claude: ${describeTarget(target)}` });
  }
  // Identity-field uniqueness.
  const owners = new Map<string, ColumnAssignment>();
  for (const c of columns) {
    if (c.target.kind !== "field" || SUMMABLE_FIELDS.has(c.target.field)) continue;
    const key = c.target.field;
    const prev = owners.get(key);
    if (!prev) { owners.set(key, c); continue; }
    const rank = (x: ColumnAssignment) => (x.source === "user" ? 3 : x.source === "template" ? 2 : 0) + x.confidence;
    const loser = rank(c) > rank(prev) ? prev : c;
    const winner = loser === c ? prev : c;
    if (loser.source === "user" || loser.source === "template") continue;
    owners.set(key, winner);
    Object.assign(loser, { target: { kind: "ignore" }, confidence: Math.max(loser.confidence, CONFIDENCE_THRESHOLD), reason: `${describeTarget(winner.target)} already comes from column ${winner.col + 1}` });
  }
  return { columns, conventions: mapping.conventions };
}
