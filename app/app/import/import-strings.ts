/**
 * Copy for the import wizard in the four app locales. Kept next to the
 * wizard (like the per-page LOCAL maps elsewhere) until it is folded into
 * lib/i18n.ts. `{name}`-style placeholders are interpolated by makeStrings.
 */
import type { Locale } from "@/lib/i18n";
import type { SkipReason } from "@/lib/import";

type Entry = Record<Locale, string>;

export const IMPORT_STRINGS = {
  // ---- shell ----
  title:        { en: "Import flights", ko: "비행 가져오기", zh: "导入飞行", es: "Importar vuelos" },
  subtitle:     { en: "CSV, Excel, or a Numbers export — any layout; we'll detect the columns.", ko: "CSV, Excel 또는 Numbers 내보내기 파일 — 어떤 레이아웃이든 열을 자동으로 인식합니다.", zh: "CSV、Excel 或 Numbers 导出文件——任意布局，我们会自动识别列。", es: "CSV, Excel o una exportación de Numbers — cualquier disposición; detectaremos las columnas." },
  step1:        { en: "Upload", ko: "업로드", zh: "上传", es: "Subir" },
  step2:        { en: "Review mapping", ko: "매핑 검토", zh: "检查映射", es: "Revisar asignación" },
  step3:        { en: "Reconcile & import", ko: "대조 후 가져오기", zh: "核对并导入", es: "Conciliar e importar" },
  stepsLabel:   { en: "Import steps", ko: "가져오기 단계", zh: "导入步骤", es: "Pasos de importación" },
  stepAnnounce: { en: "Step {n} of 3: {name}", ko: "3단계 중 {n}단계: {name}", zh: "第 {n} 步，共 3 步：{name}", es: "Paso {n} de 3: {name}" },
  stepDone:     { en: "completed", ko: "완료", zh: "已完成", es: "completado" },
  back:         { en: "Back", ko: "뒤로", zh: "返回", es: "Atrás" },
  continue:     { en: "Continue", ko: "계속", zh: "继续", es: "Continuar" },
  errGeneric:   { en: "Something went wrong. Try again.", ko: "문제가 발생했습니다. 다시 시도하세요.", zh: "出了点问题，请重试。", es: "Algo salió mal. Inténtalo de nuevo." },
  errNetwork:   { en: "Network error during upload — try again. (Often happens on flaky mobile connections; try Wi-Fi or a smaller file.)", ko: "업로드 중 네트워크 오류가 발생했습니다 — 다시 시도하세요. (불안정한 모바일 연결에서 자주 발생합니다. Wi-Fi 또는 더 작은 파일을 사용해 보세요.)", zh: "上传时发生网络错误——请重试。（在不稳定的移动网络上常见；请尝试 Wi-Fi 或更小的文件。）", es: "Error de red durante la subida — inténtalo de nuevo. (Suele ocurrir con conexiones móviles inestables; prueba con Wi-Fi o un archivo más pequeño.)" },

  // ---- step 1 · upload ----
  dropTitle:      { en: "Drop your logbook here", ko: "로그북 파일을 여기에 놓으세요", zh: "将日志本文件拖到这里", es: "Suelta tu bitácora aquí" },
  dropBody:       { en: "or click to choose a file", ko: "또는 클릭하여 파일 선택", zh: "或点击选择文件", es: "o haz clic para elegir un archivo" },
  dropHint:       { en: "CSV, TSV, TXT, XLSX or XLS · up to 25 MB", ko: "CSV, TSV, TXT, XLSX 또는 XLS · 최대 25 MB", zh: "CSV、TSV、TXT、XLSX 或 XLS · 最大 25 MB", es: "CSV, TSV, TXT, XLSX o XLS · hasta 25 MB" },
  fileInputLabel: { en: "Logbook file", ko: "로그북 파일", zh: "日志本文件", es: "Archivo de bitácora" },
  removeFile:     { en: "Remove file", ko: "파일 제거", zh: "移除文件", es: "Quitar archivo" },
  supported:      { en: "Supported out of the box", ko: "기본 지원 형식", zh: "开箱即用支持", es: "Compatibles de serie" },
  analyze:        { en: "Analyze", ko: "분석", zh: "分析", es: "Analizar" },
  analyzing:      { en: "Analyzing…", ko: "분석 중…", zh: "正在分析…", es: "Analizando…" },
  readingColumns: { en: "Reading columns…", ko: "열을 읽는 중…", zh: "正在读取列…", es: "Leyendo columnas…" },
  errNoFile:      { en: "Pick a file first.", ko: "먼저 파일을 선택하세요.", zh: "请先选择文件。", es: "Elige un archivo primero." },
  errTooLarge:    { en: "This file is {size} MB — the limit is 25 MB.", ko: "이 파일은 {size} MB입니다 — 최대 25 MB까지 가능합니다.", zh: "此文件为 {size} MB——上限为 25 MB。", es: "Este archivo pesa {size} MB — el límite es 25 MB." },
  errType:        { en: "That file type isn't supported. Use CSV, TSV, TXT, XLSX or XLS.", ko: "지원하지 않는 파일 형식입니다. CSV, TSV, TXT, XLSX 또는 XLS를 사용하세요.", zh: "不支持该文件类型。请使用 CSV、TSV、TXT、XLSX 或 XLS。", es: "Ese tipo de archivo no es compatible. Usa CSV, TSV, TXT, XLSX o XLS." },
  whereToExport:  { en: "Where to export from", ko: "각 앱에서 내보내는 방법", zh: "从各应用导出的方法", es: "Desde dónde exportar" },
  helpLogbookhq:  { en: "LogbookHQ — our own CSV export round-trips losslessly (duty time excepted).", ko: "LogbookHQ — 자체 CSV 내보내기는 무손실로 다시 가져올 수 있습니다 (근무시간 제외).", zh: "LogbookHQ——我们自己的 CSV 导出可无损往返（执勤时间除外）。", es: "LogbookHQ — nuestra propia exportación CSV se reimporta sin pérdidas (excepto el tiempo de servicio)." },
  helpForeflight: { en: "ForeFlight — the two-section CSV export (Aircraft Table + Flights Table).", ko: "ForeFlight — 두 섹션 CSV 내보내기 (Aircraft Table + Flights Table).", zh: "ForeFlight——双区段 CSV 导出（Aircraft Table + Flights Table）。", es: "ForeFlight — la exportación CSV de dos secciones (Aircraft Table + Flights Table)." },
  helpLogten:     { en: "LogTen Pro — the single-table CSV with flight_-prefixed columns.", ko: "LogTen Pro — flight_ 접두 열이 있는 단일 테이블 CSV.", zh: "LogTen Pro——带 flight_ 前缀列的单表 CSV。", es: "LogTen Pro — el CSV de una sola tabla con columnas con prefijo flight_." },
  helpMyflightbook: { en: "MyFlightbook — the CSV download with human-named columns (Date, Tail Number, Total Flight Time, …).", ko: "MyFlightbook — 사람이 읽기 쉬운 열 이름의 CSV (Date, Tail Number, Total Flight Time, …).", zh: "MyFlightbook——列名可读的 CSV 下载（Date、Tail Number、Total Flight Time 等）。", es: "MyFlightbook — la descarga CSV con columnas legibles (Date, Tail Number, Total Flight Time, …)." },
  helpNumbers:    { en: "Apple Numbers — File › Export To › CSV or Excel. Multi-row headers are fine.", ko: "Apple Numbers — 파일 › 내보내기 › CSV 또는 Excel. 여러 줄 머리글도 괜찮습니다.", zh: "Apple Numbers——文件 › 导出到 › CSV 或 Excel。支持多行表头。", es: "Apple Numbers — Archivo › Exportar a › CSV o Excel. Los encabezados de varias filas funcionan bien." },

  // ---- step 2 · mapping ----
  mappingMeta:    { en: "{rows} rows · sheet “{sheet}”", ko: "{rows}행 · 시트 “{sheet}”", zh: "{rows} 行 · 工作表“{sheet}”", es: "{rows} filas · hoja “{sheet}”" },
  mappedCount:    { en: "{mapped} mapped · {low} need review", ko: "{mapped}개 매핑됨 · {low}개 검토 필요", zh: "已映射 {mapped} 列 · {low} 列需检查", es: "{mapped} asignadas · {low} por revisar" },
  reviewHint:     { en: "Columns we weren't sure about are listed first.", ko: "확실하지 않은 열이 먼저 표시됩니다.", zh: "不确定的列会排在最前面。", es: "Las columnas dudosas aparecen primero." },
  askAi:          { en: "Ask AI to map the unclear ones", ko: "불명확한 열을 AI로 매핑", zh: "让 AI 映射不明确的列", es: "Pedir a la IA que asigne las dudosas" },
  askAiPending:   { en: "Asking…", ko: "요청 중…", zh: "正在询问…", es: "Consultando…" },
  aiUnavailable:  { en: "AI mapping isn't enabled on this server — map the remaining columns by hand.", ko: "이 서버에서는 AI 매핑이 활성화되어 있지 않습니다 — 나머지 열은 직접 매핑하세요.", zh: "此服务器未启用 AI 映射——请手动映射其余列。", es: "La asignación con IA no está habilitada en este servidor — asigna las columnas restantes a mano." },
  aiNoChange:     { en: "AI didn't change any columns.", ko: "AI가 변경한 열이 없습니다.", zh: "AI 未更改任何列。", es: "La IA no cambió ninguna columna." },
  aiApplied:      { en: "AI mapped {n} columns — check them below.", ko: "AI가 {n}개 열을 매핑했습니다 — 아래에서 확인하세요.", zh: "AI 已映射 {n} 列——请在下方核对。", es: "La IA asignó {n} columnas — revísalas abajo." },
  resetDetected:  { en: "Reset to detected", ko: "감지된 매핑으로 되돌리기", zh: "恢复为检测结果", es: "Restablecer a lo detectado" },
  conventions:    { en: "Conventions", ko: "표기 규칙", zh: "格式约定", es: "Convenciones" },
  convClock:      { en: "1:30 clock times", ko: "1:30 시계 형식 시간", zh: "1:30 时钟格式", es: "horas tipo 1:30" },
  convDecimalComma: { en: "decimal comma", ko: "소수점 쉼표", zh: "小数逗号", es: "coma decimal" },
  convDayFirst:   { en: "day-first dates", ko: "일-월-년 날짜", zh: "日在前的日期", es: "fechas día-primero" },
  convBlankSim:   { en: "blank aircraft = sim", ko: "항공기 공란 = 시뮬레이터", zh: "机型空白 = 模拟机", es: "aeronave en blanco = simulador" },
  convNone:       { en: "No special conventions detected", ko: "특별한 표기 규칙이 감지되지 않았습니다", zh: "未检测到特殊格式约定", es: "No se detectaron convenciones especiales" },
  colColumn:      { en: "Column", ko: "열", zh: "列", es: "Columna" },
  colSamples:     { en: "Sample values", ko: "샘플 값", zh: "示例值", es: "Valores de muestra" },
  colMapsTo:      { en: "Maps to", ko: "매핑 대상", zh: "映射到", es: "Se asigna a" },
  colConfidence:  { en: "Confidence", ko: "신뢰도", zh: "置信度", es: "Confianza" },
  confSure:       { en: "Sure", ko: "확실", zh: "确定", es: "Seguro" },
  confLikely:     { en: "Likely", ko: "유력", zh: "可能", es: "Probable" },
  confCheck:      { en: "Check", ko: "확인", zh: "请检查", es: "Revisar" },
  confSet:        { en: "Set", ko: "설정됨", zh: "已设置", es: "Fijado" },
  mapSelectLabel: { en: "Map column {col} to", ko: "{col} 열의 매핑 대상", zh: "将列 {col} 映射到", es: "Asignar la columna {col} a" },
  noSamples:      { en: "(empty)", ko: "(비어 있음)", zh: "（空）", es: "(vacío)" },
  showIgnored:    { en: "Show {n} ignored columns", ko: "무시된 열 {n}개 표시", zh: "显示 {n} 个已忽略的列", es: "Mostrar {n} columnas ignoradas" },
  hideIgnored:    { en: "Hide ignored columns", ko: "무시된 열 숨기기", zh: "隐藏已忽略的列", es: "Ocultar columnas ignoradas" },
  ignoreOption:   { en: "Ignore this column", ko: "이 열 무시", zh: "忽略此列", es: "Ignorar esta columna" },
  checking:       { en: "Checking…", ko: "확인 중…", zh: "正在核对…", es: "Comprobando…" },

  // ---- step 3 · reconcile & import ----
  recognisedAs:   { en: "Recognised as {name} — mapping applied automatically.", ko: "{name}(으)로 인식되어 매핑이 자동 적용되었습니다.", zh: "已识别为 {name}——已自动应用映射。", es: "Reconocido como {name} — asignación aplicada automáticamente." },
  reviewAnyway:   { en: "Review mapping anyway", ko: "그래도 매핑 검토", zh: "仍要检查映射", es: "Revisar la asignación de todos modos" },
  fromTemplate:   { en: "Mapping from template “{name}”", ko: "템플릿 “{name}”의 매핑", zh: "来自模板“{name}”的映射", es: "Asignación de la plantilla “{name}”" },
  checksTitle:    { en: "Checks", ko: "검사", zh: "核对项", es: "Comprobaciones" },
  checksBody:     { en: "We total the columns we'll import and compare them with anything the file declares.", ko: "가져올 열의 합계를 계산해 파일에 명시된 값과 비교합니다.", zh: "我们会汇总将导入的列，并与文件中声明的数值进行比较。", es: "Sumamos las columnas que importaremos y las comparamos con lo que declara el archivo." },
  checksNone:     { en: "The file doesn't declare any totals to compare against.", ko: "파일에 비교할 합계가 없습니다.", zh: "文件中没有可供比较的合计。", es: "El archivo no declara totales con los que comparar." },
  declared:       { en: "Declared", ko: "명시", zh: "声明值", es: "Declarado" },
  computed:       { en: "Computed", ko: "계산", zh: "计算值", es: "Calculado" },
  statusMatch:    { en: "Match", ko: "일치", zh: "一致", es: "Coincide" },
  statusExplained:{ en: "Explained", ko: "설명됨", zh: "已解释", es: "Explicado" },
  statusMismatch: { en: "Mismatch", ko: "불일치", zh: "不一致", es: "No coincide" },
  statusInfo:     { en: "Info", ko: "정보", zh: "信息", es: "Info" },
  augNote:        { en: "Your spreadsheet credits AUG time at 50 %. Your LogbookHQ setting is currently {state}.", ko: "스프레드시트는 AUG 시간을 50%로 인정합니다. 현재 LogbookHQ 설정은 {state}입니다.", zh: "您的表格将 AUG 时间按 50% 计入。您的 LogbookHQ 设置当前为{state}。", es: "Tu hoja acredita el tiempo AUG al 50 %. Tu ajuste de LogbookHQ está actualmente {state}." },
  stateOn:        { en: "on", ko: "켜짐", zh: "开启", es: "activado" },
  stateOff:       { en: "off", ko: "꺼짐", zh: "关闭", es: "desactivado" },
  openSettings:   { en: "Change in Settings", ko: "설정에서 변경", zh: "在设置中更改", es: "Cambiar en Ajustes" },
  previewTitle:   { en: "First flights", ko: "첫 비행 미리보기", zh: "前几条飞行", es: "Primeros vuelos" },
  summaryTitle:   { en: "Summary", ko: "요약", zh: "摘要", es: "Resumen" },
  tileFlights:    { en: "Flights to import", ko: "가져올 비행", zh: "待导入飞行", es: "Vuelos a importar" },
  tileSkipped:    { en: "Skipped rows", ko: "건너뛴 행", zh: "跳过的行", es: "Filas omitidas" },
  tileHours:      { en: "Total hours", ko: "총 시간", zh: "总小时", es: "Horas totales" },
  skipReasons:    { en: "Why rows were skipped", ko: "건너뛴 이유", zh: "跳过原因", es: "Por qué se omitieron" },
  "skip.no_date":   { en: "No date", ko: "날짜 없음", zh: "无日期", es: "Sin fecha" },
  "skip.bad_date":  { en: "Unreadable date", ko: "읽을 수 없는 날짜", zh: "无法解析的日期", es: "Fecha ilegible" },
  "skip.no_aircraft": { en: "No aircraft", ko: "항공기 없음", zh: "无机型", es: "Sin aeronave" },
  "skip.no_time":   { en: "No time logged", ko: "기록된 시간 없음", zh: "无飞行时间", es: "Sin tiempo registrado" },
  "skip.header_or_total_row": { en: "Header or totals row", ko: "머리글 또는 합계 행", zh: "表头或合计行", es: "Fila de encabezado o totales" },
  "skip.empty":     { en: "Empty row", ko: "빈 행", zh: "空行", es: "Fila vacía" },
  byRole:         { en: "By role", ko: "역할별", zh: "按角色", es: "Por rol" },
  byCategory:     { en: "By category", ko: "구분별", zh: "按类别", es: "Por categoría" },
  modeTitle:      { en: "How to import", ko: "가져오기 방식", zh: "导入方式", es: "Cómo importar" },
  modeAppend:     { en: "Append", ko: "추가", zh: "追加", es: "Añadir" },
  modeAppendBody: { en: "Add these flights alongside what's already in LogbookHQ.", ko: "기존 LogbookHQ 기록에 이 비행을 추가합니다.", zh: "将这些飞行添加到 LogbookHQ 中已有的记录旁。", es: "Añade estos vuelos junto a lo que ya hay en LogbookHQ." },
  modeReplace:    { en: "Replace all my flights", ko: "내 모든 비행 교체", zh: "替换我的全部飞行", es: "Reemplazar todos mis vuelos" },
  modeReplaceBody:{ en: "Delete everything currently in LogbookHQ, then keep only this file.", ko: "현재 LogbookHQ의 모든 기록을 삭제하고 이 파일만 남깁니다.", zh: "删除 LogbookHQ 中现有的全部记录，仅保留此文件。", es: "Borra todo lo que hay ahora en LogbookHQ y conserva solo este archivo." },
  replaceWarn:    { en: "{n} existing flights will be permanently deleted once the new ones are saved.", ko: "새 비행이 저장된 후 기존 비행 {n}건이 영구 삭제됩니다.", zh: "新记录保存后，现有的 {n} 条飞行将被永久删除。", es: "{n} vuelos existentes se eliminarán permanentemente una vez guardados los nuevos." },
  replaceWarnNone:{ en: "You have no flights yet — nothing will be deleted.", ko: "아직 비행 기록이 없어 삭제되는 항목이 없습니다.", zh: "您还没有飞行记录——不会删除任何内容。", es: "Aún no tienes vuelos — no se eliminará nada." },
  rememberTemplate: { en: "Remember this layout as a template", ko: "이 레이아웃을 템플릿으로 저장", zh: "将此布局保存为模板", es: "Recordar esta disposición como plantilla" },
  templateName:   { en: "Template name", ko: "템플릿 이름", zh: "模板名称", es: "Nombre de la plantilla" },
  templateHint:   { en: "Next time a file with these columns is uploaded, the mapping is applied automatically.", ko: "다음에 같은 열 구성의 파일을 올리면 매핑이 자동 적용됩니다.", zh: "下次上传具有相同列的文件时，将自动应用此映射。", es: "La próxima vez que subas un archivo con estas columnas, la asignación se aplicará automáticamente." },
  importN:        { en: "Import {n} flights", ko: "비행 {n}건 가져오기", zh: "导入 {n} 条飞行", es: "Importar {n} vuelos" },
  importing:      { en: "Importing…", ko: "가져오는 중…", zh: "正在导入…", es: "Importando…" },
  mismatchNote:   { en: "Some checks failed — import anyway?", ko: "일부 검사가 실패했습니다 — 그래도 가져올까요?", zh: "部分核对未通过——仍要导入吗？", es: "Algunas comprobaciones fallaron — ¿importar de todos modos?" },
  importAnyway:   { en: "Yes, import anyway", ko: "예, 그래도 가져오기", zh: "是，仍要导入", es: "Sí, importar de todos modos" },
  nothingToImport:{ en: "No flights to import — go back and check the mapping.", ko: "가져올 비행이 없습니다 — 돌아가서 매핑을 확인하세요.", zh: "没有可导入的飞行——请返回检查映射。", es: "No hay vuelos para importar — vuelve y revisa la asignación." },
  successTitle:   { en: "Imported {n} flights", ko: "비행 {n}건을 가져왔습니다", zh: "已导入 {n} 条飞行", es: "Se importaron {n} vuelos" },
  successReplaced:{ en: "Replaced {d} existing flights.", ko: "기존 비행 {d}건을 교체했습니다.", zh: "已替换 {d} 条现有飞行。", es: "Se reemplazaron {d} vuelos existentes." },
  successTemplate:{ en: "Layout saved as a template.", ko: "레이아웃이 템플릿으로 저장되었습니다.", zh: "布局已保存为模板。", es: "Disposición guardada como plantilla." },
  toDashboard:    { en: "Go to dashboard", ko: "대시보드로 이동", zh: "前往仪表板", es: "Ir al panel" },
  toFlights:      { en: "View flights", ko: "비행 보기", zh: "查看飞行", es: "Ver vuelos" },
  importAnother:  { en: "Import another file", ko: "다른 파일 가져오기", zh: "导入另一个文件", es: "Importar otro archivo" },
  ofRows:         { en: "of {total} rows", ko: "총 {total}행 중", zh: "共 {total} 行", es: "de {total} filas" },
  hrs:            { en: "hrs", ko: "시간", zh: "小时", es: "h" },
} satisfies Record<string, Entry>;

export type ImportStringKey = keyof typeof IMPORT_STRINGS;

/** Bind the copy to a locale: `const s = makeStrings(locale); s("importN", { n: 12 })`. */
export function makeStrings(locale: Locale) {
  return (key: ImportStringKey, vars?: Record<string, string | number>): string => {
    const entry: Entry = IMPORT_STRINGS[key];
    let str = entry[locale] ?? entry.en;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) str = str.split(`{${k}}`).join(String(v));
    }
    return str;
  };
}

export type ImportStrings = ReturnType<typeof makeStrings>;

/** Human label for an apply-stage skip reason. */
export function skipReasonLabel(s: ImportStrings, reason: SkipReason): string {
  return s(`skip.${reason}` as ImportStringKey);
}

/** Display names for the legacy exact-format detector's ids. */
export const LEGACY_FORMAT_NAMES: Record<string, string> = {
  foreflight: "ForeFlight",
  logten: "LogTen Pro",
  myflightbook: "MyFlightbook",
  logbookhq: "LogbookHQ",
  numbers: "Apple Numbers",
  "numbers-multihead": "Apple Numbers",
  "numbers-multihead-v2": "Apple Numbers",
};
