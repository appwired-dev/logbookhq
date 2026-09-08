/**
 * Localised prose for the import wizard's two English-only leftovers:
 *
 *   1. `ReconcileCheck.explanation` — the sentence under each check row in
 *      step 3. lib/import/reconcile.ts emits a stable `messageKey` + `vars`
 *      alongside the English sentence, so the client can rebuild it in the
 *      user's locale (`explanationFor`).
 *   2. `ColumnAssignment.reason` — the secondary line under each column in
 *      step 2. The library emits *no* id for these, so they are matched
 *      against an ordered pattern table (`reasonText`). See the note above
 *      REASON_PATTERNS.
 *
 * Both helpers fall back to the library's English whenever anything is
 * unfamiliar, so a new library message can never render as an empty string.
 *
 * How a check explanation is rebuilt
 * ----------------------------------
 * `compare()` in reconcile.ts appends context/note sentences to the sentence
 * a `messageKey` names ("Declared as 402 min.", "Compared with the sum of
 * …"), and several sentences have optional clauses that `vars` does not
 * discriminate (which convention got closer, singular vs. plural). Rather
 * than guess, `explanationFor` renders the ENGLISH template for every
 * variant and keeps the one that is a prefix of the library's own string:
 * that both proves we read the check correctly and hands us the trailing
 * context/note verbatim (localised separately via TAIL_PATTERNS). Anything
 * that fails to line up returns the library's English untouched, and
 * `locale === "en"` short-circuits to it, so English can never regress.
 */
import type { Locale } from "@/lib/i18n";
import type { ReconcileCheck } from "@/lib/import/types";
// Pure module — the same one StepMapping already reaches for its <select>.
import { CANONICAL_OPTIONS } from "@/lib/import/mapping";
import { pick, targetLabel, type Entry, type ImportStrings } from "./import-strings";

// ---------------------------------------------------------------------------
// Rendering primitives
// ---------------------------------------------------------------------------

/** Values a template can splice in: `text` is what is printed, `num` drives the plural form. */
interface Bag {
  text: Record<string, string>;
  num: Record<string, number>;
}

/**
 * `{name}` prints a value; `{name|one|many}` prints it followed by the
 * singular or plural word (mirrors the library's `plural()` helper). Locales
 * without number agreement simply repeat the same word, or use `{name}`.
 */
const PLACEHOLDER_RE = /\{(\w+)(?:\|([^|{}]*)\|([^|{}]*))?\}/g;

/** Placeholder names a template references, for the parity test. */
export function placeholdersOf(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1]).sort();
}

/** Fills a template, or null when the bag has no value for a placeholder (→ caller falls back). */
function render(text: string, bag: Bag): string | null {
  let missing = false;
  const out = text.replace(PLACEHOLDER_RE, (_all, name: string, one?: string, many?: string) => {
    const value = bag.text[name];
    if (value === undefined) { missing = true; return ""; }
    if (one === undefined || many === undefined) return value;
    return `${value} ${bag.num[name] === 1 ? one : many}`;
  });
  return missing ? null : out;
}

const LOCALE_TAG: Record<Locale, string> = { en: "en-US", ko: "ko-KR", zh: "zh-CN", es: "es-ES" };
/** Sentences are joined by a space, except in Chinese where full stops already separate them. */
const JOIN: Record<Locale, string> = { en: " ", ko: " ", zh: "", es: " " };

const r1 = (n: number): number => Math.round(n * 10) / 10;
/** Same shape as the library's `fmt()`: one decimal at most, locale grouping. */
const fmtNum = (locale: Locale, n: number): string =>
  r1(n).toLocaleString(LOCALE_TAG[locale], { maximumFractionDigits: 1 });

// ---------------------------------------------------------------------------
// Message keys
// ---------------------------------------------------------------------------

/**
 * Every `messageKey` lib/import/reconcile.ts emits. scripts/import-i18n.test.ts
 * re-derives this list from the library source, so a new key fails the test
 * rather than silently rendering English.
 */
export const MESSAGE_KEYS = [
  "cumulative_total", "date_order_backfilled", "date_order_ok", "date_order_reversed", "date_rows_above_header",
  "day_first_default", "day_first_prior", "declared_aug_column", "declared_aug_full", "declared_aug_half",
  "declared_match", "declared_minutes", "declared_mismatch", "declared_not_compared", "declared_off_rows",
  "declared_sim_included", "declared_skipped_rows", "declared_small_gap", "declared_text_cells",
  "declared_xc_whole_flight", "future_dates_none", "future_dates_some", "grand_total_none", "hours_gt_24_none",
  "hours_gt_24_some", "instrument_clamped", "instrument_gt_flight", "instrument_ok", "negative_hours",
  "night_gt_total", "night_le_total", "other_dated_sheet", "row_totals_halved", "row_totals_off", "row_totals_ok",
  "sibling_sheets", "skipped_rows", "split_rows", "unknown_roles",
] as const;

/** Keys the library emits with no English explanation — nothing is rendered for them. */
export const SILENT_KEYS = ["date_order_ok", "skipped_rows"] as const;

export type MessageKey = (typeof MESSAGE_KEYS)[number];
type SilentKey = (typeof SILENT_KEYS)[number];

// ---------------------------------------------------------------------------
// Fragments — optional clauses spliced into a template
// ---------------------------------------------------------------------------

const HALVED_NOTE: Entry = {
  en: "{halved|AUG row|AUG rows} carry a Total cell at 50 % of their logged time — the sheet credits augmenting time at 50 % in its row totals.",
  ko: "AUG 행 {halved}개의 Total 셀이 기록된 시간의 50 %입니다 — 이 시트는 행 합계에서 증강 시간을 50 %로 인정합니다.",
  zh: "有 {halved} 个 AUG 行的合计单元格为其记录时间的 50 %——该表在行合计中按 50 % 计入增援时间。",
  es: "{halved|fila AUG lleva|filas AUG llevan} una celda de Total al 50 % del tiempo registrado — la hoja acredita el tiempo de refuerzo al 50 % en sus totales de fila.",
};

/** The same sentence spliced onto the end of another one. */
const spaced = (e: Entry): Entry => ({ en: ` ${e.en}`, ko: ` ${e.ko}`, zh: e.zh, es: ` ${e.es}` });

const FRAGMENT = {
  none: { en: "", ko: "", zh: "", es: "" },

  // …matches / comes within X h of…
  matchesExact: { en: "matches", ko: "일치합니다", zh: "一致", es: "coincide con" },
  matchesWithin: {
    en: "comes within {residue} h of",
    ko: "{residue}시간 이내로 근접합니다",
    zh: "相差在 {residue} 小时以内",
    es: "queda a menos de {residue} h de",
  },

  // row_totals_off: the halved note is appended only when AUG rows were found.
  halvedNote: spaced(HALVED_NOTE),

  // declared_skipped_rows: where the skipped rows' values sit.
  whereTotalColumn: { en: "the Total column", ko: "Total 열", zh: "合计列", es: "la columna Total" },
  whereThoseColumns: { en: "those columns", ko: "해당 열들", zh: "这些列", es: "esas columnas" },

  // declared_aug_column: how many source columns carry AUG time.
  augColumnOne: { en: "AUG column", ko: "AUG 열", zh: "AUG 列", es: "la columna AUG" },
  augColumnMany: { en: "AUG columns", ko: "AUG 열", zh: "AUG 列", es: "las columnas AUG" },

  // declared_mismatch: which alternative total got closer.
  closerAug: {
    en: " The other AUG convention gets closer ({alternative}) but does not match either.",
    ko: " 다른 AUG 계산 방식이 더 가깝지만({alternative}) 그래도 일치하지는 않습니다.",
    zh: "另一种 AUG 计入方式更接近（{alternative}），但同样不一致。",
    es: " El otro criterio de AUG se acerca más ({alternative}) pero tampoco coincide.",
  },
  closerSim: {
    en: " Adding the simulator sessions gets closer ({alternative}) but does not match either.",
    ko: " 시뮬레이터 세션을 더하면 더 가깝지만({alternative}) 그래도 일치하지는 않습니다.",
    zh: "加上模拟机训练后更接近（{alternative}），但同样不一致。",
    es: " Sumar las sesiones de simulador se acerca más ({alternative}) pero tampoco coincide.",
  },

  // day_first_*: the day/month order, why it was chosen, and the worked example.
  orderDayFirst: {
    en: "day-first (day/month/year)",
    ko: "일-우선(일/월/년)",
    zh: "日在前（日/月/年）",
    es: "día primero (día/mes/año)",
  },
  orderMonthFirst: {
    en: "month-first (month/day/year)",
    ko: "월-우선(월/일/년)",
    zh: "月在前（月/日/年）",
    es: "mes primero (mes/día/año)",
  },
  // `reason` is a phrase analyze.ts builds in English; it is spliced in verbatim.
  whyReason: { en: "because of {reason}", ko: "{reason} 때문에", zh: "依据 {reason}", es: "por {reason}" },
  whyPriors: {
    en: "because of the sheet's language, registrations or airports",
    ko: "시트의 언어, 등록기호 또는 공항을 근거로",
    zh: "依据该表的语言、注册号或机场",
    es: "por el idioma, las matrículas o los aeropuertos de la hoja",
  },
  whyDefault: {
    en: "by default — the file gives no clue either way",
    ko: "기본값으로 — 파일에 판단 근거가 없습니다",
    zh: "按默认设置——文件中没有任何线索",
    es: "por defecto — el archivo no da ninguna pista",
  },
  exPlain: {
    en: ' "{example}" was read as {readAs}.',
    ko: ' "{example}"은(는) {readAs}(으)로 읽었습니다.',
    zh: "“{example}”被读作 {readAs}。",
    es: ' "{example}" se leyó como {readAs}.',
  },
  exOther: {
    en: ' "{example}" was read as {readAs} (not {other}).',
    ko: ' "{example}"은(는) {other}이(가) 아니라 {readAs}(으)로 읽었습니다.',
    zh: "“{example}”被读作 {readAs}（而非 {other}）。",
    es: ' "{example}" se leyó como {readAs} (no {other}).',
  },
} satisfies Record<string, Entry>;

type FragmentKey = keyof typeof FRAGMENT;

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

interface Template {
  /** The sentence in each locale. */
  text: Entry;
  /**
   * Placeholder → the fragments tried for it, in order. The combination whose
   * English rendering matches the library's sentence wins. List the fuller
   * variants first: for a clause at the very end of a sentence, "none" would
   * otherwise match and leave the clause behind as an untranslated tail.
   */
  choices?: Readonly<Record<string, readonly FragmentKey[]>>;
}

const MATCHES = { matches: ["matchesExact", "matchesWithin"] } as const;

const DAY_FIRST_TEXT: Entry = {
  en: "Ambiguous dates were read {order} {why}.{ex} Flip the day-first switch if that is wrong.",
  ko: "{why} 모호한 날짜를 {order} 형식으로 읽었습니다.{ex} 잘못되었다면 일-우선 스위치를 전환하세요.",
  zh: "{why}，模糊日期按{order}读取。{ex}如果不对，请切换“日在前”开关。",
  es: "Las fechas ambiguas se leyeron {order} {why}.{ex} Cambia el interruptor de día-primero si no es correcto.",
};
const DAY_FIRST_ORDER = ["orderDayFirst", "orderMonthFirst"] as const;
const DAY_FIRST_EX = ["exOther", "exPlain", "none"] as const;

/**
 * One entry per messageKey that carries an English explanation. The English
 * text is copied verbatim from lib/import/reconcile.ts — it is what the
 * variant matching compares against, so it must not drift.
 */
export const EXPLANATION = {
  // ---- grand total ----
  grand_total_none: {
    text: {
      en: "The file does not declare a grand total to compare against.",
      ko: "파일에 비교할 총 비행 시간이 명시되어 있지 않습니다.",
      zh: "文件未声明可用于比较的总时间。",
      es: "El archivo no declara un total general con el que comparar.",
    },
  },

  // ---- invariants ----
  hours_gt_24_some: {
    text: {
      en: "{count|row|rows} add up to more than 24 hours — usually a time column mapped to the wrong bucket or a clock-time column read as hours.",
      ko: "{count}개 행의 합계가 24시간을 넘습니다 — 대개 시간 열이 잘못된 항목에 매핑되었거나 시각 열을 시간으로 읽은 경우입니다.",
      zh: "有 {count} 行的合计超过 24 小时——通常是时间列映射到了错误的分项，或把时刻列当作小时读取。",
      es: "{count|fila suma|filas suman} más de 24 horas — normalmente una columna de tiempo asignada a la casilla equivocada o una columna de hora de reloj leída como horas.",
    },
  },
  hours_gt_24_none: {
    text: {
      en: "No row adds up to more than 24 h.",
      ko: "24시간을 넘는 행이 없습니다.",
      zh: "没有任何一行的合计超过 24 小时。",
      es: "Ninguna fila suma más de 24 h.",
    },
  },
  date_rows_above_header: {
    text: {
      en: "{count|dated row|dated rows} above the detected header were not imported — the header may have been detected too far down.",
      ko: "감지된 머리글 위에 있는 날짜 행 {count}개는 가져오지 않았습니다 — 머리글이 너무 아래에서 감지되었을 수 있습니다.",
      zh: "检测到的表头上方有 {count} 行带日期的数据未被导入——表头可能被识别得太靠下。",
      es: "No se importaron {count|fila con fecha|filas con fecha} por encima del encabezado detectado — puede que el encabezado se haya detectado demasiado abajo.",
    },
  },
  row_totals_off: {
    text: {
      en: "{off} of {compared} rows have a Total cell that differs from the sum of their time buckets by more than 0.1 h ({dates}).{halvedNote}",
      ko: "{compared}개 행 중 {off}개의 Total 셀이 시간 항목의 합계와 0.1시간 넘게 차이 납니다 ({dates}).{halvedNote}",
      zh: "{compared} 行中有 {off} 行的合计单元格与其时间分项之和相差超过 0.1 小时（{dates}）。{halvedNote}",
      es: "{off} de {compared} filas tienen una celda de Total que difiere de la suma de sus casillas de tiempo en más de 0,1 h ({dates}).{halvedNote}",
    },
    choices: { halvedNote: ["halvedNote", "none"] },
  },
  row_totals_halved: { text: HALVED_NOTE },
  row_totals_ok: {
    text: {
      en: "Every row's Total cell equals the sum of its time buckets (within 0.1 h).",
      ko: "모든 행의 Total 셀이 시간 항목의 합계와 일치합니다 (0.1시간 이내).",
      zh: "每一行的合计单元格都等于其时间分项之和（误差在 0.1 小时以内）。",
      es: "La celda de Total de cada fila coincide con la suma de sus casillas de tiempo (dentro de 0,1 h).",
    },
  },
  cumulative_total: {
    text: {
      en: "The Total column looks cumulative (running total) and was not used for row hours.",
      ko: "Total 열이 누적 합계로 보여 행별 시간에는 사용하지 않았습니다.",
      zh: "合计列看起来是累计（滚动合计）值，未用于逐行小时数。",
      es: "La columna Total parece acumulativa (total corrido) y no se usó para las horas de cada fila.",
    },
  },
  split_rows: {
    text: {
      en: "{count|row carries|rows carry} time in more than one role; each was imported as one flight per role so no hours are lost.",
      ko: "{count}개 행이 두 개 이상의 역할에 시간을 기록하고 있어 역할별로 한 편씩 나누어 가져왔습니다. 손실되는 시간은 없습니다.",
      zh: "有 {count} 行在多个角色下记录了时间；每行按角色各导入为一次飞行，因此不会丢失小时数。",
      es: "{count|fila registra|filas registran} tiempo en más de un rol; cada una se importó como un vuelo por rol, así que no se pierde ninguna hora.",
    },
  },
  instrument_gt_flight: {
    text: {
      en: "{count|row|rows} log more instrument time (actual + hood) than flight time ({dates}) — an instrument column may be mapped twice or to the wrong field.",
      ko: "{count}개 행의 계기 시간(실제 + 후드)이 비행 시간보다 많습니다 ({dates}) — 계기 열이 두 번 매핑되었거나 잘못된 항목에 매핑되었을 수 있습니다.",
      zh: "有 {count} 行记录的仪表时间（实际 + 遮蔽）多于飞行时间（{dates}）——某个仪表列可能被映射了两次或映射到了错误的字段。",
      es: "{count|fila registra|filas registran} más tiempo de instrumentos (real + capucha) que tiempo de vuelo ({dates}) — puede que una columna de instrumentos esté asignada dos veces o al campo equivocado.",
    },
  },
  instrument_clamped: {
    text: {
      en: "{count|row|rows} had instrument time above flight time; clamped to the flight time.",
      ko: "{count}개 행의 계기 시간이 비행 시간보다 많아 비행 시간에 맞추어 줄였습니다.",
      zh: "有 {count} 行的仪表时间超过飞行时间，已限制为飞行时间。",
      es: "{count|fila tenía|filas tenían} más tiempo de instrumentos que de vuelo; se ajustó al tiempo de vuelo.",
    },
  },
  instrument_ok: {
    text: {
      en: "No row logs more instrument time than flight time.",
      ko: "계기 시간이 비행 시간을 초과하는 행이 없습니다.",
      zh: "没有任何一行的仪表时间超过飞行时间。",
      es: "Ninguna fila registra más tiempo de instrumentos que de vuelo.",
    },
  },
  date_order_reversed: {
    text: {
      en: "The sheet is in reverse-chronological order; flights are sorted by date once imported.",
      ko: "시트가 최신순으로 정렬되어 있습니다. 가져온 뒤에는 날짜순으로 정렬됩니다.",
      zh: "该表按时间倒序排列；导入后飞行记录会按日期排序。",
      es: "La hoja está en orden cronológico inverso; los vuelos se ordenan por fecha una vez importados.",
    },
  },
  date_order_backfilled: {
    text: {
      en: "{count|row|rows} are dated earlier than the row above them. Usually fine (back-filled entries) — worth a glance if the count is large.",
      ko: "{count}개 행의 날짜가 바로 위 행보다 이릅니다. 보통은 문제가 없지만(나중에 채워 넣은 기록) 수가 많다면 확인해 보세요.",
      zh: "有 {count} 行的日期早于其上一行。通常没问题（补录的记录）——数量较多时值得看一眼。",
      es: "{count|fila tiene|filas tienen} una fecha anterior a la de la fila superior. Suele ser normal (entradas añadidas después) — conviene revisarlo si son muchas.",
    },
  },
  future_dates_some: {
    text: {
      en: "{count|flight|flights} are dated after today — check the day/month order of the date column.",
      ko: "{count}편의 비행 날짜가 오늘 이후입니다 — 날짜 열의 일/월 순서를 확인하세요.",
      zh: "有 {count} 次飞行的日期晚于今天——请检查日期列的日/月顺序。",
      es: "{count|vuelo tiene|vuelos tienen} fecha posterior a hoy — revisa el orden día/mes de la columna de fecha.",
    },
  },
  future_dates_none: {
    text: {
      en: "No flight is dated after today ({today}).",
      ko: "오늘({today}) 이후 날짜의 비행이 없습니다.",
      zh: "没有飞行的日期晚于今天（{today}）。",
      es: "Ningún vuelo tiene fecha posterior a hoy ({today}).",
    },
  },
  night_gt_total: {
    text: {
      en: "The night columns add up to {night} h, more than the Total column's {total} h — a night column may be mis-mapped.",
      ko: "야간 열의 합계가 {night}시간으로 Total 열의 {total}시간보다 많습니다 — 야간 열이 잘못 매핑되었을 수 있습니다.",
      zh: "夜间列合计为 {night} 小时，超过合计列的 {total} 小时——某个夜间列可能映射有误。",
      es: "Las columnas de noche suman {night} h, más que las {total} h de la columna Total — puede que una columna de noche esté mal asignada.",
    },
  },
  night_le_total: {
    text: {
      en: "{night} night h ≤ {total} total h",
      ko: "야간 {night}시간 ≤ 총 {total}시간",
      zh: "夜间 {night} 小时 ≤ 合计 {total} 小时",
      es: "{night} h nocturnas ≤ {total} h totales",
    },
  },
  unknown_roles: {
    text: {
      en: "{count|row|rows} with unrecognised role text ({samples}) were imported as PIC — review the Role column.",
      ko: "인식되지 않은 역할 텍스트({samples})가 있는 {count}개 행을 PIC로 가져왔습니다 — 역할 열을 확인하세요.",
      zh: "有 {count} 行的角色文本无法识别（{samples}），已按 PIC 导入——请检查角色列。",
      es: "Se importaron como PIC {count|fila con texto de rol no reconocido|filas con texto de rol no reconocido} ({samples}) — revisa la columna de rol.",
    },
  },
  negative_hours: {
    text: {
      en: "{count|cell|cells} with negative hours were treated as 0.",
      ko: "음수 시간이 있는 셀 {count}개는 0으로 처리했습니다.",
      zh: "有 {count} 个单元格的小时数为负，已按 0 处理。",
      es: "{count|celda con horas negativas se trató|celdas con horas negativas se trataron} como 0.",
    },
  },
  day_first_prior: {
    text: DAY_FIRST_TEXT,
    choices: { order: DAY_FIRST_ORDER, why: ["whyReason", "whyPriors"], ex: DAY_FIRST_EX },
  },
  day_first_default: {
    text: DAY_FIRST_TEXT,
    choices: { order: DAY_FIRST_ORDER, why: ["whyDefault"], ex: DAY_FIRST_EX },
  },
  sibling_sheets: {
    text: {
      en: "Also importing {count|sheet|sheets} with the same layout ({names}).",
      ko: "같은 레이아웃의 시트 {count}개도 함께 가져옵니다 ({names}).",
      zh: "同时导入 {count} 个布局相同的工作表（{names}）。",
      es: "También se importan {count|hoja|hojas} con la misma disposición ({names}).",
    },
  },
  other_dated_sheet: {
    text: {
      en: 'Sheet "{sheet}" has {rows|dated row|dated rows} in a different layout and was not imported.',
      ko: '"{sheet}" 시트에는 다른 레이아웃의 날짜 행이 {rows}개 있어 가져오지 않았습니다.',
      zh: "工作表“{sheet}”有 {rows} 行带日期的数据，但布局不同，未被导入。",
      es: 'La hoja "{sheet}" tiene {rows|fila con fecha|filas con fecha} en otra disposición y no se importó.',
    },
  },

  // ---- declared totals ----
  // A plain match carries only the context/note sentences, which the tail
  // localiser handles — the template itself is empty.
  declared_match: { text: { en: "", ko: "", zh: "", es: "" } },
  declared_mismatch: {
    text: {
      en: "Computed {computed} vs. declared {declared} (difference {delta}).{closer} A column may be mapped to the wrong bucket, or the sheet's total includes rows that were skipped.",
      ko: "계산값 {computed}, 명시값 {declared} (차이 {delta}).{closer} 열이 잘못된 항목에 매핑되었거나, 시트의 합계에 건너뛴 행이 포함되어 있을 수 있습니다.",
      zh: "计算值 {computed}，声明值 {declared}（相差 {delta}）。{closer}可能有列映射到了错误的分项，或该表的合计包含了被跳过的行。",
      es: "Calculado {computed} frente a {declared} declarado (diferencia {delta}).{closer} Puede que una columna esté asignada a la casilla equivocada o que el total de la hoja incluya filas omitidas.",
    },
    choices: { closer: ["closerAug", "closerSim", "none"] },
  },
  declared_off_rows: {
    text: {
      en: "Computed {computed} vs. declared {declared} (difference {delta}). {offRows|row differs|rows differ} from their own Total cell: {offDates} — fix those rows first.",
      ko: "계산값 {computed}, 명시값 {declared} (차이 {delta}). {offRows}개 행이 자체 Total 셀과 다릅니다: {offDates} — 해당 행을 먼저 수정하세요.",
      zh: "计算值 {computed}，声明值 {declared}（相差 {delta}）。有 {offRows} 行与其自身的合计单元格不一致：{offDates}——请先修正这些行。",
      es: "Calculado {computed} frente a {declared} declarado (diferencia {delta}). {offRows|fila difiere|filas difieren} de su propia celda de Total: {offDates} — corrige primero esas filas.",
    },
  },
  declared_small_gap: {
    text: {
      en: "Differs by {absDelta} on {declared}. This small a gap is almost always the spreadsheet's own totals formula (a range that stops short of the newest rows, or rounding), not a mapping problem.",
      ko: "{declared} 중 {absDelta} 차이입니다. 이 정도의 작은 차이는 대부분 스프레드시트 자체의 합계 수식(최신 행까지 미치지 못하는 범위나 반올림) 때문이며 매핑 문제가 아닙니다.",
      zh: "在 {declared} 中相差 {absDelta}。这么小的差距几乎总是表格自身的合计公式所致（范围没有覆盖最新的行，或是四舍五入），而不是映射问题。",
      es: "Difiere en {absDelta} sobre {declared}. Una diferencia tan pequeña casi siempre se debe a la propia fórmula de totales de la hoja (un rango que no llega a las filas más recientes, o redondeo), no a un problema de asignación.",
    },
  },
  declared_minutes: {
    text: {
      en: "The declared figure looks like minutes: {minutes} min = {hours} h, which matches the computed {computedNum} h.",
      ko: "명시된 수치가 분 단위로 보입니다: {minutes}분 = {hours}시간이며, 계산값 {computedNum}시간과 일치합니다.",
      zh: "声明的数值看起来是分钟：{minutes} 分钟 = {hours} 小时，与计算值 {computedNum} 小时一致。",
      es: "La cifra declarada parece estar en minutos: {minutes} min = {hours} h, que coincide con las {computedNum} h calculadas.",
    },
  },
  declared_not_compared: {
    text: {
      en: "No single column in the file corresponds to this line (declared {declared}), so it wasn't compared.",
      ko: "파일에서 이 항목에 해당하는 단일 열이 없어 비교하지 않았습니다 (명시값 {declared}).",
      zh: "文件中没有单独的列与这一行对应（声明值 {declared}），因此未进行比较。",
      es: "Ninguna columna del archivo corresponde a esta línea (declarado {declared}), así que no se comparó.",
    },
  },
  declared_skipped_rows: {
    text: {
      en: "The {skippedRows|skipped row|skipped rows} (no date) carry {skippedSum} in {skippedWhere} — that is the whole difference.",
      ko: "건너뛴 행 {skippedRows}개(날짜 없음)가 {skippedWhere}에서 {skippedSum}을 차지합니다 — 이것이 차이의 전부입니다.",
      zh: "被跳过的 {skippedRows} 行（无日期）在{skippedWhere}中共计 {skippedSum}——这正是全部差额。",
      es: "Las {skippedRows|fila omitida|filas omitidas} (sin fecha) suman {skippedSum} en {skippedWhere} — esa es toda la diferencia.",
    },
    choices: { skippedWhere: ["whereTotalColumn", "whereThoseColumns"] },
  },
  declared_text_cells: {
    text: {
      en: "The sheet's total skips {textCells|cell|cells} stored as text ({textCellsSum}) in {columnList} — spreadsheet SUM formulas ignore text, the import reads it. That accounts for the whole difference.",
      ko: "시트의 합계는 {columnList}에서 텍스트로 저장된 셀 {textCells}개({textCellsSum})를 건너뜁니다 — 스프레드시트의 SUM 수식은 텍스트를 무시하지만 가져오기는 읽습니다. 이것으로 차이가 모두 설명됩니다.",
      zh: "该表的合计跳过了{columnList}中以文本形式存储的 {textCells} 个单元格（{textCellsSum}）——电子表格的 SUM 公式会忽略文本，而导入会读取它们。这正好解释了全部差额。",
      es: "El total de la hoja omite {textCells|celda guardada|celdas guardadas} como texto ({textCellsSum}) en {columnList} — las fórmulas SUM de las hojas de cálculo ignoran el texto, pero la importación sí lo lee. Eso explica toda la diferencia.",
    },
  },
  declared_aug_half: {
    text: {
      en: "Your spreadsheet credits augmenting (AUG/SIC) time at 50 % — the SIC-halved total ({alternativeNum} h) {matches} the declared {declaredNum} h. Turn on the 50 % AUG credit setting so LogbookHQ's totals agree with your sheet.",
      ko: "스프레드시트가 증강(AUG/SIC) 시간을 50 %로 인정합니다 — SIC를 절반으로 계산한 합계({alternativeNum}시간)가 명시된 {declaredNum}시간과 {matches}. 50 % AUG 인정 설정을 켜면 LogbookHQ의 합계가 시트와 일치합니다.",
      zh: "您的表格将增援（AUG/SIC）时间按 50 % 计入——SIC 减半后的合计（{alternativeNum} 小时）与声明的 {declaredNum} 小时{matches}。请打开 50 % AUG 计入设置，使 LogbookHQ 的合计与您的表格一致。",
      es: "Tu hoja acredita el tiempo de refuerzo (AUG/SIC) al 50 % — el total con el SIC a la mitad ({alternativeNum} h) {matches} las {declaredNum} h declaradas. Activa el ajuste de crédito AUG al 50 % para que los totales de LogbookHQ coincidan con tu hoja.",
    },
    choices: MATCHES,
  },
  declared_aug_full: {
    text: {
      en: "Your spreadsheet counts augmenting (AUG/SIC) time in full — {alternativeNum} h {matches} the declared {declaredNum} h. Your account's 50 % AUG credit setting is what decides how that time is credited in LogbookHQ.",
      ko: "스프레드시트가 증강(AUG/SIC) 시간을 전부 인정합니다 — {alternativeNum}시간이 명시된 {declaredNum}시간과 {matches}. LogbookHQ에서 이 시간을 어떻게 인정할지는 계정의 50 % AUG 인정 설정이 결정합니다.",
      zh: "您的表格将增援（AUG/SIC）时间全额计入——{alternativeNum} 小时与声明的 {declaredNum} 小时{matches}。这部分时间在 LogbookHQ 中如何计入，由您账户的 50 % AUG 计入设置决定。",
      es: "Tu hoja cuenta el tiempo de refuerzo (AUG/SIC) completo — {alternativeNum} h {matches} las {declaredNum} h declaradas. El ajuste de crédito AUG al 50 % de tu cuenta es el que decide cómo se acredita ese tiempo en LogbookHQ.",
    },
    choices: MATCHES,
  },
  declared_aug_column: {
    text: {
      en: "Your spreadsheet credits the {augColumns} at 50 % in this line — {alternativeNum} h {matches} the declared {declaredNum} h. LogbookHQ counts {fieldWord} in full.",
      ko: "이 항목에서는 스프레드시트가 {augColumns}을 50 %로 인정합니다 — {alternativeNum}시간이 명시된 {declaredNum}시간과 {matches}. LogbookHQ는 {fieldWord}을 전부 계산합니다.",
      zh: "在这一行中，您的表格将{augColumns}按 50 % 计入——{alternativeNum} 小时与声明的 {declaredNum} 小时{matches}。LogbookHQ 全额计入{fieldWord}。",
      es: "En esta línea tu hoja acredita {augColumns} al 50 % — {alternativeNum} h {matches} las {declaredNum} h declaradas. LogbookHQ cuenta {fieldWord} completo.",
    },
    choices: { ...MATCHES, augColumns: ["augColumnOne", "augColumnMany"] },
  },
  declared_sim_included: {
    text: {
      en: "This figure includes {simSessions|simulator session|simulator sessions} ({simGap} h) — {alternativeNum} h {matches} the declared {declaredNum} h. LogbookHQ keeps simulator time out of total flight time.",
      ko: "이 수치에는 시뮬레이터 세션 {simSessions}회({simGap}시간)가 포함되어 있습니다 — {alternativeNum}시간이 명시된 {declaredNum}시간과 {matches}. LogbookHQ는 시뮬레이터 시간을 총 비행 시간에서 제외합니다.",
      zh: "该数值包含 {simSessions} 次模拟机训练（{simGap} 小时）——{alternativeNum} 小时与声明的 {declaredNum} 小时{matches}。LogbookHQ 不把模拟机时间计入总飞行时间。",
      es: "Esta cifra incluye {simSessions|sesión de simulador|sesiones de simulador} ({simGap} h) — {alternativeNum} h {matches} las {declaredNum} h declaradas. LogbookHQ deja el tiempo de simulador fuera del tiempo total de vuelo.",
    },
    choices: MATCHES,
  },
  declared_xc_whole_flight: {
    text: {
      en: "LogbookHQ credits whole flights as cross-country ({gapSigned} h vs. your sheet's cross-country column).",
      ko: "LogbookHQ는 비행 전체를 장거리로 인정합니다 (시트의 장거리 열 대비 {gapSigned}시간).",
      zh: "LogbookHQ 将整次飞行计为越野（相对于表格的越野列为 {gapSigned} 小时）。",
      es: "LogbookHQ acredita vuelos completos como travesía ({gapSigned} h frente a la columna de travesía de tu hoja).",
    },
  },
} satisfies Record<Exclude<MessageKey, SilentKey>, Template>;

// ---------------------------------------------------------------------------
// Trailing context / note sentences
// ---------------------------------------------------------------------------

/**
 * `compare()` appends up to two extra sentences to an explanation (the
 * declared figure's unit, the columns it was compared against). They are not
 * in `vars`, so they are matched on their invariant English and re-rendered.
 */
const TAIL_PATTERNS: { re: RegExp; entry: Entry; vars: readonly string[]; nums?: readonly string[] }[] = [
  {
    re: /^Declared as "(.+)"\.$/,
    vars: ["label"],
    entry: {
      en: 'Declared as "{label}".',
      ko: '"{label}"(으)로 명시되어 있습니다.',
      zh: "声明为“{label}”。",
      es: 'Declarado como "{label}".',
    },
  },
  {
    re: /^Declared as ([\d,.]+) min\.$/,
    vars: ["n"],
    entry: {
      en: "Declared as {n} min.",
      ko: "{n}분으로 명시되어 있습니다.",
      zh: "声明为 {n} 分钟。",
      es: "Declarado como {n} min.",
    },
  },
  {
    re: /^Includes (\d+) sim sessions? \(([\d,.]+) h\) logged in the Total column\.$/,
    vars: ["n", "h"],
    nums: ["n"],
    entry: {
      en: "Includes {n|sim session|sim sessions} ({h} h) logged in the Total column.",
      ko: "Total 열에 기록된 시뮬레이터 세션 {n}회({h}시간)를 포함합니다.",
      zh: "包含合计列中记录的 {n} 次模拟机训练（{h} 小时）。",
      es: "Incluye {n|sesión de simulador registrada|sesiones de simulador registradas} ({h} h) en la columna Total.",
    },
  },
  {
    re: /^Compared with the sum of (.+)\.$/,
    vars: ["cols"],
    entry: {
      en: "Compared with the sum of {cols}.",
      ko: "{cols}의 합계와 비교했습니다.",
      zh: "与{cols}的合计进行比较。",
      es: "Comparado con la suma de {cols}.",
    },
  },
];

/** Splits "A. B." into ["A.", "B."] without lookbehind (older Safari). */
function sentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "." || (i + 1 < text.length && text[i + 1] !== " ")) continue;
    out.push(text.slice(start, i + 1));
    start = i + 2;
    i++;
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

function localiseTail(locale: Locale, tail: string): string {
  return sentences(tail)
    .map((piece) => {
      for (const p of TAIL_PATTERNS) {
        const m = p.re.exec(piece);
        if (!m) continue;
        const bag: Bag = { text: {}, num: {} };
        p.vars.forEach((name, i) => {
          bag.text[name] = m[i + 1];
          if (p.nums?.includes(name)) bag.num[name] = Number(m[i + 1].replace(/,/g, ""));
        });
        return render(pick(p.entry, locale), bag) ?? piece;
      }
      return piece; // sheet-derived or unknown — left as the library wrote it
    })
    .join(JOIN[locale]);
}

// ---------------------------------------------------------------------------
// Variable formatting
// ---------------------------------------------------------------------------

/**
 * How each `vars` entry is printed. "unit" mirrors the library's `fmtU()`
 * (hours get " h", counts do not), "num" its `fmt()`, "plain" the bare
 * `${n}` its `plural()` helper uses, and anything unlisted is text.
 */
const VAR_KIND: Record<string, "unit" | "num" | "plain"> = {
  declared: "unit", computed: "unit", delta: "unit", alternative: "unit", skippedSum: "unit", textCellsSum: "unit",
  declaredNum: "num", computedNum: "num", alternativeNum: "num", absDelta: "unit",
  night: "num", total: "num", minutes: "num", hours: "num", simHours: "num", residue: "num", simGap: "num",
  count: "plain", rows: "plain", off: "plain", compared: "plain", halved: "plain",
  offRows: "plain", textCells: "plain", skippedRows: "plain", simSessions: "plain",
};

/** Localised words for FIELD_WORD in lib/import/reconcile.ts. */
const FIELD_WORD = {
  xc_time: { en: "cross-country time", ko: "장거리 시간", zh: "越野时间", es: "tiempo de travesía" },
  actual_inst: { en: "actual instrument time", ko: "실제 계기 시간", zh: "实际仪表时间", es: "tiempo de instrumentos real" },
  hood_inst: { en: "hood time", ko: "후드 시간", zh: "遮蔽飞行时间", es: "tiempo con capucha" },
  sim_inst: { en: "simulator time", ko: "시뮬레이터 시간", zh: "模拟机时间", es: "tiempo de simulador" },
  cfi_time: { en: "instruction given", ko: "교육 제공 시간", zh: "授课时间", es: "instrucción impartida" },
} satisfies Record<string, Entry>;

const MORE_COLUMNS: Entry = { en: " and {n} more", ko: " 외 {n}개", zh: " 等另外 {n} 个", es: " y {n} más" };

/** The unit the library's `fmtU()` appends to an hours figure. English must stay " h" — the variant matching compares against it. */
const HOUR_UNIT: Record<Locale, string> = { en: " h", ko: "시간", zh: " 小时", es: " h" };

/** The library's `listColumns()`: at most three quoted names, then "and N more". */
function listColumns(locale: Locale, names: string[]): string {
  const quoted = names.map((c) => `"${c}"`);
  if (quoted.length <= 3) return quoted.join(", ");
  const more = pick(MORE_COLUMNS, locale).replace("{n}", String(quoted.length - 3));
  return quoted.slice(0, 3).join(", ") + more;
}

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/** Formatted values for one locale: the library's `vars` plus what the templates derive from them. */
function buildBag(locale: Locale, check: ReconcileCheck): Bag {
  const vars = check.vars ?? {};
  const bag: Bag = { text: {}, num: {} };
  const unit = vars.unit === "count" ? "" : HOUR_UNIT[locale];
  const put = (name: string, value: number, kind: "unit" | "num" | "plain") => {
    bag.num[name] = value;
    bag.text[name] = kind === "plain" ? String(value) : kind === "num" ? fmtNum(locale, value) : fmtNum(locale, value) + unit;
  };

  for (const [name, value] of Object.entries(vars)) {
    if (typeof value === "number") put(name, value, VAR_KIND[name] ?? "num");
    else bag.text[name] = value;
  }

  // Derived: the same figure printed the other way round.
  const numOf = (name: string): number | undefined => (typeof vars[name] === "number" ? (vars[name] as number) : undefined);
  for (const name of ["declared", "computed", "alternative"] as const) {
    const v = numOf(name);
    if (v !== undefined) put(`${name}Num`, v, "num");
  }
  const delta = numOf("delta");
  if (delta !== undefined) put("absDelta", Math.abs(delta), "unit");
  const gap = numOf("gap");
  if (gap !== undefined) bag.text.gapSigned = `${gap > 0 ? "+" : "−"}${fmtNum(locale, Math.abs(gap))}`;
  const declared = numOf("declared");
  const alternative = numOf("alternative");
  if (declared !== undefined && alternative !== undefined) put("residue", r1(Math.abs(alternative - declared)), "num");
  const computed = numOf("computed");
  if (computed !== undefined && alternative !== undefined) put("simGap", r1(alternative - computed), "num");
  const field = typeof vars.field === "string" ? vars.field : "";
  if (field) bag.text.fieldWord = hasOwn(FIELD_WORD, field) ? pick(FIELD_WORD[field as keyof typeof FIELD_WORD], locale) : field;
  if (typeof vars.textCellColumns === "string") bag.text.columnList = listColumns(locale, vars.textCellColumns.split(", "));
  return bag;
}

// ---------------------------------------------------------------------------
// explanationFor
// ---------------------------------------------------------------------------

/** Every combination of the template's optional clauses, in declaration order. */
function combinations(choices: Readonly<Record<string, readonly FragmentKey[]>> | undefined): Record<string, FragmentKey>[] {
  let out: Record<string, FragmentKey>[] = [{}];
  for (const [slot, options] of Object.entries(choices ?? {})) {
    out = out.flatMap((base) => options.map((option) => ({ ...base, [slot]: option })));
  }
  return out;
}

/** Renders one template + fragment combination in one locale; null when a value is missing. */
function renderCombo(locale: Locale, tpl: Template, combo: Record<string, FragmentKey>, bag: Bag): string | null {
  const withFragments: Bag = { text: { ...bag.text }, num: { ...bag.num } };
  for (const [slot, key] of Object.entries(combo)) {
    const fragment = render(pick(FRAGMENT[key], locale), bag);
    if (fragment == null) return null;
    withFragments.text[slot] = fragment;
  }
  return render(pick(tpl.text, locale), withFragments);
}

/**
 * The localised sentence under a check row. Returns the library's English
 * (and `undefined` when it has none) for anything this file does not know,
 * so a new reconcile message can never render blank.
 */
export function explanationFor(s: ImportStrings, check: ReconcileCheck): string | undefined {
  const english = check.explanation;
  if (!english || s.locale === "en") return english;
  const key = check.messageKey;
  if (!key || !hasOwn(EXPLANATION, key)) return english;
  const tpl: Template = EXPLANATION[key as keyof typeof EXPLANATION];

  const enBag = buildBag("en", check);
  for (const combo of combinations(tpl.choices)) {
    const enText = renderCombo("en", tpl, combo, enBag);
    if (enText == null) continue;
    let tail: string | null = null;
    if (enText === "") tail = english;
    else if (english === enText) tail = "";
    else if (english.startsWith(`${enText} `)) tail = english.slice(enText.length + 1);
    if (tail == null) continue;

    const main = renderCombo(s.locale, tpl, combo, buildBag(s.locale, check));
    if (main == null) break;
    const localisedTail = tail ? localiseTail(s.locale, tail) : "";
    if (!main) return localisedTail || english;
    return localisedTail ? main + JOIN[s.locale] + localisedTail : main;
  }
  return english;
}

// ---------------------------------------------------------------------------
// Step 2 — column mapping reasons
// ---------------------------------------------------------------------------

/**
 * Localised copies of every `reason:` string in lib/import/mapping.ts.
 * `{label}` / `{parents}` hold the sheet's own header text and are never
 * translated; `{target}` is a canonical target name, localised below.
 */
export const REASON = {
  notImported: { en: '"{label}" is not imported', ko: '"{label}"은(는) 가져오지 않습니다', zh: "“{label}”不会被导入", es: '"{label}" no se importa' },
  xcTime: { en: 'header "{label}" is cross-country time', ko: '머리글 "{label}"은(는) 장거리 시간입니다', zh: "表头“{label}”是越野时间", es: 'el encabezado "{label}" es tiempo de travesía' },
  xcFlag: { en: 'header "{label}" is a cross-country flag', ko: '머리글 "{label}"은(는) 장거리 표시입니다', zh: "表头“{label}”是越野标记", es: 'el encabezado "{label}" es una marca de travesía' },
  instructionGiven: { en: 'header "{label}" is instruction given', ko: '머리글 "{label}"은(는) 교육 제공 시간입니다', zh: "表头“{label}”是授课时间", es: 'el encabezado "{label}" es instrucción impartida' },
  countsApproaches: { en: 'header "{label}" counts approaches', ko: '머리글 "{label}"은(는) 접근 횟수입니다', zh: "表头“{label}”统计进近次数", es: 'el encabezado "{label}" cuenta aproximaciones' },
  countsHolds: { en: 'header "{label}" counts holds', ko: '머리글 "{label}"은(는) 홀딩 횟수입니다', zh: "表头“{label}”统计等待次数", es: 'el encabezado "{label}" cuenta esperas' },
  countsLandings: { en: 'header "{label}" counts landings', ko: '머리글 "{label}"은(는) 착륙 횟수입니다', zh: "表头“{label}”统计着陆次数", es: 'el encabezado "{label}" cuenta aterrizajes' },
  countsTakeoffs: { en: 'header "{label}" counts takeoffs', ko: '머리글 "{label}"은(는) 이륙 횟수입니다', zh: "表头“{label}”统计起飞次数", es: 'el encabezado "{label}" cuenta despegues' },
  matchedField: { en: 'header "{label}" matched {target}', ko: '머리글 "{label}"이(가) {target}에 해당합니다', zh: "表头“{label}”匹配到{target}", es: 'el encabezado "{label}" coincide con {target}' },
  couldBeIdentifier: { en: '"{label}" could be an identifier', ko: '"{label}"은(는) 식별자일 수 있습니다', zh: "“{label}”可能是标识符", es: '"{label}" podría ser un identificador' },
  holdsHours: { en: '"{label}" holds hours, not aircraft types', ko: '"{label}"에는 기종이 아니라 시간이 들어 있습니다', zh: "“{label}”里是小时数，不是机型", es: '"{label}" contiene horas, no tipos de aeronave' },
  couldBeType: { en: '"{label}" could be a type', ko: '"{label}"은(는) 기종일 수 있습니다', zh: "“{label}”可能是机型", es: '"{label}" podría ser un tipo de aeronave' },
  hoodInst: { en: 'header "{label}" is hood / simulated instrument', ko: '머리글 "{label}"은(는) 후드 / 모의 계기입니다', zh: "表头“{label}”是遮蔽 / 模拟仪表", es: 'el encabezado "{label}" es instrumento simulado (capucha)' },
  actualInst: { en: 'header "{label}" is actual instrument', ko: '머리글 "{label}"은(는) 실제 계기입니다', zh: "表头“{label}”是实际仪表", es: 'el encabezado "{label}" es instrumento real' },
  simByRole: { en: 'header "{label}" is simulator time by role', ko: '머리글 "{label}"은(는) 역할별 시뮬레이터 시간입니다', zh: "表头“{label}”是按角色划分的模拟机时间", es: 'el encabezado "{label}" es tiempo de simulador por rol' },
  simTime: { en: 'header "{label}" is simulator time', ko: '머리글 "{label}"은(는) 시뮬레이터 시간입니다', zh: "表头“{label}”是模拟机时间", es: 'el encabezado "{label}" es tiempo de simulador' },
  instSubtotal: { en: '"{label}" is an instrument subtotal (recomputed on import)', ko: '"{label}"은(는) 계기 소계입니다 (가져올 때 다시 계산됨)', zh: "“{label}”是仪表小计（导入时会重新计算）", es: '"{label}" es un subtotal de instrumentos (se recalcula al importar)' },
  mightBeRowTotal: { en: '"{label}" might be the row total', ko: '"{label}"은(는) 행 합계일 수 있습니다', zh: "“{label}”可能是行合计", es: '"{label}" podría ser el total de la fila' },
  instTime: { en: 'header "{label}" is instrument time', ko: '머리글 "{label}"은(는) 계기 시간입니다', zh: "表头“{label}”是仪表时间", es: 'el encabezado "{label}" es tiempo de instrumentos' },
  underParents: { en: '"{leaf}" under "{parents}"', ko: '"{parents}" 아래의 "{leaf}"', zh: "“{parents}”下的“{leaf}”", es: '"{leaf}" bajo "{parents}"' },
  isRowTotal: { en: 'header "{label}" is the row total', ko: '머리글 "{label}"은(는) 행 합계입니다', zh: "表头“{label}”是行合计", es: 'el encabezado "{label}" es el total de la fila' },
  couldBeFlightTime: { en: 'header "{label}" could be flight time', ko: '머리글 "{label}"은(는) 비행 시간일 수 있습니다', zh: "表头“{label}”可能是飞行时间", es: 'el encabezado "{label}" podría ser tiempo de vuelo' },
  mappedTo: { en: 'header "{label}" → {target}', ko: '머리글 "{label}" → {target}', zh: "表头“{label}” → {target}", es: 'encabezado "{label}" → {target}' },
  asCrewName: { en: 'header "{label}" as a crew name', ko: '머리글 "{label}"을(를) 승무원 이름으로 처리', zh: "表头“{label}”作为机组姓名", es: 'el encabezado "{label}" como nombre de tripulante' },
  isCrewName: { en: 'header "{label}" is a crew name', ko: '머리글 "{label}"은(는) 승무원 이름입니다', zh: "表头“{label}”是机组姓名", es: 'el encabezado "{label}" es un nombre de tripulante' },
  shapeDates: { en: "cells look like dates", ko: "셀 값이 날짜처럼 보입니다", zh: "单元格看起来是日期", es: "las celdas parecen fechas" },
  shapePairs: { en: "cells look like airport pairs", ko: "셀 값이 공항 쌍처럼 보입니다", zh: "单元格看起来是机场对", es: "las celdas parecen pares de aeropuertos" },
  shapeTail: { en: "cells look like tail numbers", ko: "셀 값이 등록기호처럼 보입니다", zh: "单元格看起来是注册号", es: "las celdas parecen matrículas" },
  shapeTypes: { en: "cells look like aircraft type codes", ko: "셀 값이 기종 코드처럼 보입니다", zh: "单元格看起来是机型代码", es: "las celdas parecen códigos de tipo de aeronave" },
  shapeAirports: { en: "cells look like airport codes", ko: "셀 값이 공항 코드처럼 보입니다", zh: "单元格看起来是机场代码", es: "las celdas parecen códigos de aeropuerto" },
  shapeFreeText: { en: "cells look like free text", ko: "셀 값이 자유 텍스트처럼 보입니다", zh: "单元格看起来是自由文本", es: "las celdas parecen texto libre" },
  shapeHours: { en: "cells look like hours", ko: "셀 값이 시간처럼 보입니다", zh: "单元格看起来是小时数", es: "las celdas parecen horas" },
  shapeSmallCounts: { en: "cells look like small counts", ko: "셀 값이 작은 개수처럼 보입니다", zh: "单元格看起来是较小的计数", es: "las celdas parecen recuentos pequeños" },
  shapeCategory: { en: "cells look like SE/ME/SIM", ko: "셀 값이 SE/ME/SIM처럼 보입니다", zh: "单元格看起来是 SE/ME/SIM", es: "las celdas parecen SE/ME/SIM" },
  shapeRole: { en: "cells look like PIC/FO/DUAL", ko: "셀 값이 PIC/FO/DUAL처럼 보입니다", zh: "单元格看起来是 PIC/FO/DUAL", es: "las celdas parecen PIC/FO/DUAL" },
  unrecognisedHeader: { en: 'unrecognised header "{label}"', ko: '인식되지 않은 머리글 "{label}"', zh: "无法识别的表头“{label}”", es: 'encabezado no reconocido "{label}"' },
  noHeaderNoShape: { en: "no header and no recognisable shape", ko: "머리글이 없고 인식할 수 있는 형태도 없습니다", zh: "没有表头，也没有可识别的数据形态", es: "sin encabezado y sin forma reconocible" },
  emptyColumn: { en: "empty column", ko: "빈 열", zh: "空列", es: "columna vacía" },
  alreadyFrom: { en: "{target} already comes from column {col}", ko: "{target}은(는) 이미 {col} 열에서 가져옵니다", zh: "{target}已经来自列 {col}", es: "{target} ya proviene de la columna {col}" },
  noSuitableTarget: { en: "no suitable target", ko: "적합한 매핑 대상이 없습니다", zh: "没有合适的映射目标", es: "sin destino adecuado" },
  hoursNoHeader: { en: "hours column without a header — flight time is taken from column {col}", ko: "머리글 없는 시간 열 — 비행 시간은 {col} 열에서 가져옵니다", zh: "没有表头的小时列——飞行时间取自列 {col}", es: "columna de horas sin encabezado — el tiempo de vuelo se toma de la columna {col}" },
  fullStopSubset: { en: 'full-stop subset of the "{label}" landings column', ko: '"{label}" 착륙 열의 풀스톱 부분집합', zh: "“{label}”着陆列中全停着陆的子集", es: 'subconjunto de paradas completas de la columna de aterrizajes "{label}"' },
  coveredLandings: { en: "covered by the day/night landings columns", ko: "주간/야간 착륙 열에 포함됨", zh: "已由昼间/夜间着陆列覆盖", es: "cubierta por las columnas de aterrizajes día/noche" },
  coveredTakeoffs: { en: "covered by the day/night takeoffs columns", ko: "주간/야간 이륙 열에 포함됨", zh: "已由昼间/夜间起飞列覆盖", es: "cubierta por las columnas de despegues día/noche" },
  coveredActualHood: { en: "covered by the actual/hood columns", ko: "실제/후드 열에 포함됨", zh: "已由实际/遮蔽列覆盖", es: "cubierta por las columnas real/capucha" },
  blockTime: { en: 'block time — flight time comes from "{label}"', ko: '블록 시간 — 비행 시간은 "{label}"에서 가져옵니다', zh: "轮挡时间——飞行时间来自“{label}”", es: 'tiempo de calzos — el tiempo de vuelo proviene de "{label}"' },
  duplicateHeader: { en: 'duplicate header "{label}" (also column {col})', ko: '중복 머리글 "{label}" ({col} 열에도 있음)', zh: "重复表头“{label}”（列 {col} 也是）", es: 'encabezado duplicado "{label}" (también la columna {col})' },
} satisfies Record<string, Entry>;

export type ReasonKey = keyof typeof REASON;

/**
 * mapping.ts assigns a plain English `reason` with no stable id, so the only
 * way to localise it client-side is to match the invariant part of the
 * sentence and recapture the sheet-derived bits. Patterns are anchored, so
 * order is not load-bearing; anything unmatched keeps the library's English.
 *
 * Adding a `reasonKey` (+ `reasonVars`) to ColumnAssignment in
 * lib/import/mapping.ts — the way reconcile.ts already emits `messageKey` —
 * would delete this table and remove the drift risk. scripts/import-i18n.test.ts
 * pins the library's current wording so a change there fails the test rather
 * than silently falling back to English.
 */
export const REASON_PATTERNS: { re: RegExp; key: ReasonKey; vars: readonly string[] }[] = [
  { re: /^"(.+)" is not imported$/, key: "notImported", vars: ["label"] },
  { re: /^header "(.+)" is cross-country time$/, key: "xcTime", vars: ["label"] },
  { re: /^header "(.+)" is a cross-country flag$/, key: "xcFlag", vars: ["label"] },
  { re: /^header "(.+)" is instruction given$/, key: "instructionGiven", vars: ["label"] },
  { re: /^header "(.+)" counts approaches$/, key: "countsApproaches", vars: ["label"] },
  { re: /^header "(.+)" counts holds$/, key: "countsHolds", vars: ["label"] },
  { re: /^header "(.+)" counts landings$/, key: "countsLandings", vars: ["label"] },
  { re: /^header "(.+)" counts takeoffs$/, key: "countsTakeoffs", vars: ["label"] },
  { re: /^header "(.+)" matched (.+)$/, key: "matchedField", vars: ["label", "target"] },
  { re: /^"(.+)" could be an identifier$/, key: "couldBeIdentifier", vars: ["label"] },
  { re: /^"(.+)" holds hours, not aircraft types$/, key: "holdsHours", vars: ["label"] },
  { re: /^"(.+)" could be a type$/, key: "couldBeType", vars: ["label"] },
  { re: /^header "(.+)" is hood \/ simulated instrument$/, key: "hoodInst", vars: ["label"] },
  { re: /^header "(.+)" is actual instrument$/, key: "actualInst", vars: ["label"] },
  { re: /^header "(.+)" is simulator time by role$/, key: "simByRole", vars: ["label"] },
  { re: /^header "(.+)" is simulator time$/, key: "simTime", vars: ["label"] },
  { re: /^"(.+)" is an instrument subtotal \(recomputed on import\)$/, key: "instSubtotal", vars: ["label"] },
  { re: /^"(.+)" might be the row total$/, key: "mightBeRowTotal", vars: ["label"] },
  { re: /^header "(.+)" is instrument time$/, key: "instTime", vars: ["label"] },
  { re: /^"(.+)" under "(.+)"$/, key: "underParents", vars: ["leaf", "parents"] },
  { re: /^header "(.+)" is the row total$/, key: "isRowTotal", vars: ["label"] },
  { re: /^header "(.+)" could be flight time$/, key: "couldBeFlightTime", vars: ["label"] },
  { re: /^header "(.+)" → (.+)$/, key: "mappedTo", vars: ["label", "target"] },
  { re: /^header "(.+)" as a crew name$/, key: "asCrewName", vars: ["label"] },
  { re: /^header "(.+)" is a crew name$/, key: "isCrewName", vars: ["label"] },
  { re: /^cells look like dates$/, key: "shapeDates", vars: [] },
  { re: /^cells look like airport pairs$/, key: "shapePairs", vars: [] },
  { re: /^cells look like tail numbers$/, key: "shapeTail", vars: [] },
  { re: /^cells look like aircraft type codes$/, key: "shapeTypes", vars: [] },
  { re: /^cells look like airport codes$/, key: "shapeAirports", vars: [] },
  { re: /^cells look like free text$/, key: "shapeFreeText", vars: [] },
  { re: /^cells look like hours$/, key: "shapeHours", vars: [] },
  { re: /^cells look like small counts$/, key: "shapeSmallCounts", vars: [] },
  { re: /^cells look like SE\/ME\/SIM$/, key: "shapeCategory", vars: [] },
  { re: /^cells look like PIC\/FO\/DUAL$/, key: "shapeRole", vars: [] },
  { re: /^unrecognised header "(.+)"$/, key: "unrecognisedHeader", vars: ["label"] },
  { re: /^no header and no recognisable shape$/, key: "noHeaderNoShape", vars: [] },
  { re: /^empty column$/, key: "emptyColumn", vars: [] },
  { re: /^(.+) already comes from column ([A-Z]+)$/, key: "alreadyFrom", vars: ["target", "col"] },
  { re: /^no suitable target$/, key: "noSuitableTarget", vars: [] },
  { re: /^hours column without a header — flight time is taken from column ([A-Z]+)$/, key: "hoursNoHeader", vars: ["col"] },
  { re: /^full-stop subset of the "(.+)" landings column$/, key: "fullStopSubset", vars: ["label"] },
  { re: /^covered by the day\/night landings columns$/, key: "coveredLandings", vars: [] },
  { re: /^covered by the day\/night takeoffs columns$/, key: "coveredTakeoffs", vars: [] },
  { re: /^covered by the actual\/hood columns$/, key: "coveredActualHood", vars: [] },
  { re: /^block time — flight time comes from "(.+)"$/, key: "blockTime", vars: ["label"] },
  { re: /^duplicate header "(.+)" \(also column ([A-Z]+)\)$/, key: "duplicateHeader", vars: ["label", "col"] },
];

/** English target name (describeTarget) → its stable target key, built once. */
let targetKeys: Map<string, string> | null = null;
function localiseTarget(s: ImportStrings, english: string): string {
  if (!targetKeys) {
    targetKeys = new Map();
    for (const group of CANONICAL_OPTIONS) {
      for (const option of group.options) if (!targetKeys.has(option.label)) targetKeys.set(option.label, option.key);
    }
  }
  const key = targetKeys.get(english);
  return (key && targetLabel(s, key)) || english;
}

/**
 * Localised version of a column's `assignment.reason`, or the library's
 * English when the wording is not one this file knows.
 */
export function reasonText(s: ImportStrings, reason: string | undefined): string | undefined {
  if (!reason || s.locale === "en") return reason;
  for (const p of REASON_PATTERNS) {
    const m = p.re.exec(reason);
    if (!m) continue;
    const bag: Bag = { text: {}, num: {} };
    p.vars.forEach((name, i) => {
      bag.text[name] = name === "target" ? localiseTarget(s, m[i + 1]) : m[i + 1];
    });
    return render(pick(REASON[p.key], s.locale), bag) ?? reason;
  }
  return reason;
}
