import type { Locale } from "@/lib/i18n";

/**
 * Strings introduced by the Phase 3 export page and the Import & Export hub.
 * Kept local (same pattern as app/app/flights/form-strings.ts) so lib/i18n.ts
 * doesn't churn; fold them in later. Field labels and the in-range summary
 * still come from lib/i18n via makeT() (`export.*`).
 *
 * Safe to import from both Server and Client Components (no server imports).
 */
const en = {
  title: "Export logbook",
  subtitle: "Download your flights as a PDF logbook or a CSV spreadsheet.",
  format: "Format",
  formatPdf: "PDF logbook",
  formatPdfBody: "Cover · 18-column flight pages · grand totals. For ATPL verification, job applications and recurrent paperwork.",
  formatCsv: "CSV spreadsheet",
  formatCsvBody: "Every flight with all fields, one row per flight. Round-trips through Import without loss.",
  options: "Options",
  rangeHint: "Leave blank to include everything.",
  pdfIncludes: "Includes a cover page with your name and licence, 18-column flight pages and a grand-totals summary.",
  csvIncludes: "Includes date, aircraft, crew, route, category, role, day/night, instrument, approaches, take-offs and landings, duty and CFI time.",
  generatePdf: "Generate PDF",
  downloadCsv: "Download CSV",
  opensNewTab: "Opens in a new tab",
  pdfReady: "PDF ready",
  pdfReadyBody: "{n} flights · opened in a new tab.",
  csvReady: "CSV downloaded",
  csvReadyBody: "{file} · {n} flights",
  popupBlocked: "Your browser blocked the new tab. Allow pop-ups for this site and try again.",
  noFlights: "No flights in this range.",
  failed: "Export failed",
  errUnexpected: "Something went wrong while generating the file.",
  hubSubtitle: "Bring flights in from another logbook, or take them out as PDF or CSV.",
  hubImport: "Import flights",
  hubImportBody: "CSV, Excel or a Numbers export — any layout; we detect the columns.",
  hubExport: "Export logbook",
  hubExportBody: "PDF logbook for paperwork, or CSV for spreadsheets and backups.",
  hubFormats: "Formats",
  hubOpen: "Open",
  hubImportHere: "Or import right here",
} as const;

export type ExportStringKey = keyof typeof en;
type Table = Record<ExportStringKey, string>;

const ko: Table = {
  title: "로그북 내보내기",
  subtitle: "비행 기록을 PDF 로그북 또는 CSV 스프레드시트로 다운로드합니다.",
  format: "형식",
  formatPdf: "PDF 로그북",
  formatPdfBody: "표지 · 18칸 비행 페이지 · 총계. ATPL 검증, 취업 지원, 정기 교육 서류용.",
  formatCsv: "CSV 스프레드시트",
  formatCsvBody: "모든 필드를 포함한 비행당 한 줄. 가져오기로 손실 없이 되돌릴 수 있습니다.",
  options: "옵션",
  rangeHint: "비워 두면 전체가 포함됩니다.",
  pdfIncludes: "이름과 면허가 적힌 표지, 18칸 비행 페이지, 총계 요약이 포함됩니다.",
  csvIncludes: "날짜, 기종, 승무원, 경로, 구분, 역할, 주간/야간, 계기, 접근, 이착륙, 근무 및 교관 시간이 포함됩니다.",
  generatePdf: "PDF 생성",
  downloadCsv: "CSV 다운로드",
  opensNewTab: "새 탭에서 열립니다",
  pdfReady: "PDF 준비 완료",
  pdfReadyBody: "비행 {n}회 · 새 탭에서 열렸습니다.",
  csvReady: "CSV 다운로드됨",
  csvReadyBody: "{file} · 비행 {n}회",
  popupBlocked: "브라우저가 새 탭을 차단했습니다. 이 사이트의 팝업을 허용한 뒤 다시 시도하세요.",
  noFlights: "이 범위에 비행이 없습니다.",
  failed: "내보내기 실패",
  errUnexpected: "파일을 생성하는 중 문제가 발생했습니다.",
  hubSubtitle: "다른 로그북에서 비행을 가져오거나 PDF 또는 CSV로 내보내세요.",
  hubImport: "비행 가져오기",
  hubImportBody: "CSV, Excel 또는 Numbers 내보내기 — 어떤 레이아웃이든 열을 자동으로 인식합니다.",
  hubExport: "로그북 내보내기",
  hubExportBody: "서류용 PDF 로그북 또는 스프레드시트·백업용 CSV.",
  hubFormats: "형식",
  hubOpen: "열기",
  hubImportHere: "또는 여기서 바로 가져오기",
};

const zh: Table = {
  title: "导出飞行日志",
  subtitle: "将您的飞行记录下载为 PDF 日志或 CSV 表格。",
  format: "格式",
  formatPdf: "PDF 日志",
  formatPdfBody: "封面 · 18 列飞行页面 · 总计。适用于 ATPL 验证、求职申请和复训文档。",
  formatCsv: "CSV 表格",
  formatCsvBody: "每次飞行一行，包含全部字段。可通过导入无损往返。",
  options: "选项",
  rangeHint: "留空则包含全部。",
  pdfIncludes: "包含带姓名和执照的封面、18 列飞行页面和总计摘要。",
  csvIncludes: "包含日期、机型、机组、航线、类别、角色、昼/夜、仪表、进近、起降、执勤和教官时间。",
  generatePdf: "生成 PDF",
  downloadCsv: "下载 CSV",
  opensNewTab: "在新标签页中打开",
  pdfReady: "PDF 已就绪",
  pdfReadyBody: "{n} 次飞行 · 已在新标签页打开。",
  csvReady: "CSV 已下载",
  csvReadyBody: "{file} · {n} 次飞行",
  popupBlocked: "浏览器拦截了新标签页。请允许此网站的弹出窗口后重试。",
  noFlights: "此范围内没有飞行记录。",
  failed: "导出失败",
  errUnexpected: "生成文件时出了点问题。",
  hubSubtitle: "从其他日志本导入飞行记录，或导出为 PDF 或 CSV。",
  hubImport: "导入飞行",
  hubImportBody: "CSV、Excel 或 Numbers 导出文件——任意布局，我们会自动识别列。",
  hubExport: "导出飞行日志",
  hubExportBody: "用于文书的 PDF 日志，或用于表格和备份的 CSV。",
  hubFormats: "格式",
  hubOpen: "打开",
  hubImportHere: "或直接在此导入",
};

const es: Table = {
  title: "Exportar bitácora",
  subtitle: "Descarga tus vuelos como bitácora PDF o como hoja de cálculo CSV.",
  format: "Formato",
  formatPdf: "Bitácora PDF",
  formatPdfBody: "Portada · páginas de vuelo de 18 columnas · totales. Para verificación ATPL, solicitudes de empleo y papeleo recurrente.",
  formatCsv: "Hoja de cálculo CSV",
  formatCsvBody: "Cada vuelo con todos los campos, una fila por vuelo. Se reimporta sin pérdidas.",
  options: "Opciones",
  rangeHint: "Déjalo en blanco para incluir todo.",
  pdfIncludes: "Incluye una portada con tu nombre y licencia, páginas de vuelo de 18 columnas y un resumen de totales.",
  csvIncludes: "Incluye fecha, aeronave, tripulación, ruta, categoría, rol, día/noche, instrumentos, aproximaciones, despegues y aterrizajes, tiempo de servicio y CFI.",
  generatePdf: "Generar PDF",
  downloadCsv: "Descargar CSV",
  opensNewTab: "Se abre en una pestaña nueva",
  pdfReady: "PDF listo",
  pdfReadyBody: "{n} vuelos · abierto en una pestaña nueva.",
  csvReady: "CSV descargado",
  csvReadyBody: "{file} · {n} vuelos",
  popupBlocked: "Tu navegador bloqueó la nueva pestaña. Permite ventanas emergentes para este sitio e inténtalo de nuevo.",
  noFlights: "No hay vuelos en este rango.",
  failed: "La exportación falló",
  errUnexpected: "Algo salió mal al generar el archivo.",
  hubSubtitle: "Trae vuelos desde otra bitácora, o sácalos como PDF o CSV.",
  hubImport: "Importar vuelos",
  hubImportBody: "CSV, Excel o una exportación de Numbers — cualquier disposición; detectamos las columnas.",
  hubExport: "Exportar bitácora",
  hubExportBody: "Bitácora PDF para trámites, o CSV para hojas de cálculo y copias de seguridad.",
  hubFormats: "Formatos",
  hubOpen: "Abrir",
  hubImportHere: "O importa aquí mismo",
};

const STRINGS: Record<Locale, Table> = { en, ko, zh, es };

export type ExportT = (key: ExportStringKey, vars?: Record<string, string | number>) => string;

/** Bound translator for the export page and the transfer hub; falls back to English, never to the key. */
export function exportStrings(locale: Locale): ExportT {
  const table = STRINGS[locale] ?? STRINGS.en;
  return (key, vars) => {
    let str: string = table[key] ?? STRINGS.en[key];
    if (vars) {
      for (const [k, v] of Object.entries(vars)) str = str.split(`{${k}}`).join(String(v));
    }
    return str;
  };
}
