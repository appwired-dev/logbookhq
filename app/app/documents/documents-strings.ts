import type { Locale } from "@/lib/i18n";
import type { DocumentType } from "@/lib/types";

/**
 * Strings introduced by the Phase 3 documents rebuild. Kept local (same
 * pattern as app/app/flights/form-strings.ts) so lib/i18n.ts doesn't churn;
 * fold them in later. Field labels, type names and the empty-state copy still
 * come from lib/i18n via makeT() (`docs.*`).
 *
 * Safe to import from both Server and Client Components (no server imports).
 */
const en = {
  addDocument: "Add document",
  editDocument: "Edit document",
  newDocumentDesc: "Upload a PDF or image and set its expiry to get reminders on the dashboard.",
  editDocumentDesc: "Update the details. The uploaded file is kept as is.",
  typeHint: "Medical, IPC, recurrent, passport and visa need an expiry date.",
  fileHint: "PDF or image · up to 10 MB",
  fileKept: "Current file is kept",
  summary: "{n} documents",
  summaryOne: "1 document",
  summaryExpiring: "{n} expiring within 30 days",
  summaryExpired: "{n} expired",
  noExpiry: "No expiry",
  expiresToday: "Expires today",
  errRequired: "Required",
  errExpiryRequired: "This document type needs an expiry date",
  errExpiryBeforeIssue: "Expiry must be after the issue date",
  errFileRequired: "Choose a file",
  errFileTooLarge: "Max 10 MB",
  errUnexpected: "Something went wrong. Please try again.",
  saved: "Document saved",
  savedBody: "{name} was added to your vault.",
  updated: "Document updated",
  updatedBody: "Changes to {name} were saved.",
  deleted: "Document deleted",
  deletedBody: "{name} was removed.",
  deleteTitle: "Delete this document?",
  deleteBody: "“{name}” and its file are removed permanently. This can't be undone.",
  deleteConfirm: "Delete document",
  deleteFailed: "Couldn't delete the document",
  openFailed: "Couldn't open the file",
  popupBlocked: "Your browser blocked the new tab. Allow pop-ups for this site and try again.",
  opening: "Opening…",
  edit: "Edit",
  view: "View",
} as const;

export type DocStringKey = keyof typeof en;
type Table = Record<DocStringKey, string>;

const ko: Table = {
  addDocument: "문서 추가",
  editDocument: "문서 편집",
  newDocumentDesc: "PDF 또는 이미지를 업로드하고 만료일을 설정하면 대시보드에서 알림을 받을 수 있습니다.",
  editDocumentDesc: "세부 정보를 수정하세요. 업로드한 파일은 그대로 유지됩니다.",
  typeHint: "신체검사, IPC, 정기 교육, 여권, 비자는 만료일이 필요합니다.",
  fileHint: "PDF 또는 이미지 · 최대 10 MB",
  fileKept: "현재 파일이 유지됩니다",
  summary: "문서 {n}개",
  summaryOne: "문서 1개",
  summaryExpiring: "30일 이내 만료 {n}개",
  summaryExpired: "만료됨 {n}개",
  noExpiry: "만료 없음",
  expiresToday: "오늘 만료",
  errRequired: "필수 항목",
  errExpiryRequired: "이 문서 유형에는 만료일이 필요합니다",
  errExpiryBeforeIssue: "만료일은 발급일 이후여야 합니다",
  errFileRequired: "파일을 선택하세요",
  errFileTooLarge: "최대 10 MB",
  errUnexpected: "문제가 발생했습니다. 다시 시도해 주세요.",
  saved: "문서 저장됨",
  savedBody: "{name}이(가) 보관함에 추가되었습니다.",
  updated: "문서 업데이트됨",
  updatedBody: "{name}의 변경사항이 저장되었습니다.",
  deleted: "문서 삭제됨",
  deletedBody: "{name}이(가) 삭제되었습니다.",
  deleteTitle: "이 문서를 삭제할까요?",
  deleteBody: "“{name}”과(와) 파일이 영구적으로 삭제됩니다. 되돌릴 수 없습니다.",
  deleteConfirm: "문서 삭제",
  deleteFailed: "문서를 삭제할 수 없습니다",
  openFailed: "파일을 열 수 없습니다",
  popupBlocked: "브라우저가 새 탭을 차단했습니다. 이 사이트의 팝업을 허용한 뒤 다시 시도하세요.",
  opening: "여는 중…",
  edit: "편집",
  view: "보기",
};

const zh: Table = {
  addDocument: "添加文档",
  editDocument: "编辑文档",
  newDocumentDesc: "上传 PDF 或图片并设置到期日期，即可在仪表板收到提醒。",
  editDocumentDesc: "更新详细信息。已上传的文件保持不变。",
  typeHint: "体检、IPC、复训、护照和签证需要到期日期。",
  fileHint: "PDF 或图片 · 最大 10 MB",
  fileKept: "保留当前文件",
  summary: "{n} 份文档",
  summaryOne: "1 份文档",
  summaryExpiring: "{n} 份将在 30 天内到期",
  summaryExpired: "{n} 份已过期",
  noExpiry: "无到期日",
  expiresToday: "今天到期",
  errRequired: "必填",
  errExpiryRequired: "此文档类型需要到期日期",
  errExpiryBeforeIssue: "到期日期必须晚于签发日期",
  errFileRequired: "请选择文件",
  errFileTooLarge: "最大 10 MB",
  errUnexpected: "出了点问题，请重试。",
  saved: "文档已保存",
  savedBody: "{name} 已添加到您的保险库。",
  updated: "文档已更新",
  updatedBody: "{name} 的更改已保存。",
  deleted: "文档已删除",
  deletedBody: "{name} 已移除。",
  deleteTitle: "删除此文档？",
  deleteBody: "“{name}”及其文件将被永久删除，无法撤销。",
  deleteConfirm: "删除文档",
  deleteFailed: "无法删除文档",
  openFailed: "无法打开文件",
  popupBlocked: "浏览器拦截了新标签页。请允许此网站的弹出窗口后重试。",
  opening: "正在打开…",
  edit: "编辑",
  view: "查看",
};

const es: Table = {
  addDocument: "Agregar documento",
  editDocument: "Editar documento",
  newDocumentDesc: "Sube un PDF o una imagen y fija su vencimiento para recibir avisos en el panel.",
  editDocumentDesc: "Actualiza los datos. El archivo subido se conserva tal cual.",
  typeHint: "Médico, IPC, recurrente, pasaporte y visa necesitan fecha de vencimiento.",
  fileHint: "PDF o imagen · hasta 10 MB",
  fileKept: "Se conserva el archivo actual",
  summary: "{n} documentos",
  summaryOne: "1 documento",
  summaryExpiring: "{n} vencen en 30 días",
  summaryExpired: "{n} vencidos",
  noExpiry: "Sin vencimiento",
  expiresToday: "Vence hoy",
  errRequired: "Obligatorio",
  errExpiryRequired: "Este tipo de documento necesita fecha de vencimiento",
  errExpiryBeforeIssue: "El vencimiento debe ser posterior a la emisión",
  errFileRequired: "Elige un archivo",
  errFileTooLarge: "Máx. 10 MB",
  errUnexpected: "Algo salió mal. Inténtalo de nuevo.",
  saved: "Documento guardado",
  savedBody: "{name} se agregó a tu bóveda.",
  updated: "Documento actualizado",
  updatedBody: "Los cambios en {name} se guardaron.",
  deleted: "Documento eliminado",
  deletedBody: "{name} fue eliminado.",
  deleteTitle: "¿Eliminar este documento?",
  deleteBody: "“{name}” y su archivo se eliminan de forma permanente. No se puede deshacer.",
  deleteConfirm: "Eliminar documento",
  deleteFailed: "No se pudo eliminar el documento",
  openFailed: "No se pudo abrir el archivo",
  popupBlocked: "Tu navegador bloqueó la nueva pestaña. Permite ventanas emergentes para este sitio e inténtalo de nuevo.",
  opening: "Abriendo…",
  edit: "Editar",
  view: "Ver",
};

const STRINGS: Record<Locale, Table> = { en, ko, zh, es };

export type DocT = (key: DocStringKey, vars?: Record<string, string | number>) => string;

/** Bound translator for the documents page; falls back to English, never to the key. */
export function docStrings(locale: Locale): DocT {
  const table = STRINGS[locale] ?? STRINGS.en;
  return (key, vars) => {
    let str: string = table[key] ?? STRINGS.en[key];
    if (vars) {
      for (const [k, v] of Object.entries(vars)) str = str.split(`{${k}}`).join(String(v));
    }
    return str;
  };
}

/** Document types that must carry an expiry date (medical, IPC, recurrent, passport, visa). */
export const EXPIRY_REQUIRED: ReadonlySet<DocumentType> = new Set<DocumentType>([
  "MEDICAL", "IPC", "RECURRENT", "PASSPORT", "VISA",
]);
