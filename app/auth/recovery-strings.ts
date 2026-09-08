import type { Locale } from "@/lib/i18n";

/**
 * Strings for the self-serve password-recovery flow (/forgot-password,
 * /reset-password, /auth/auth-code-error, plus the "Forgot password?" link on
 * /login). Kept local — same pattern as app/app/flights/flights-strings.ts and
 * app/app/settings/settings-strings.ts — so lib/i18n.ts doesn't churn; fold
 * them in during the next i18n pass.
 *
 * Safe to import from both Server and Client Components (no server imports).
 */
const en = {
  // --- /forgot-password -----------------------------------------------
  forgotTitle: "Reset your password",
  forgotSubtitle: "We'll email you a link to choose a new one.",
  emailLabel: "Email",
  emailHint: "The address you sign in with.",
  sendLink: "Send reset link",
  sending: "Sending…",
  sentTitle: "Check your inbox",
  sentBody: "If an account exists for {email}, a link to set a new password is on its way. It works once and expires in an hour.",
  sentHint: "Nothing after a few minutes? Check your spam folder, then try again.",
  sendAnother: "Send another link",
  sameDeviceHint: "Open the link on this device and in this browser — that's where the request started.",
  cooldownTitle: "Just a moment",
  cooldownBody: "A link was already requested from this browser. Try again in a few minutes.",
  invalidEmail: "Enter a valid email address.",
  sendFailedTitle: "Couldn't send the link",
  sendFailedBody: "Something went wrong on our side. Please try again in a moment.",
  backToSignIn: "Back to sign in",
  forgotLink: "Forgot password?",

  // --- /reset-password ------------------------------------------------
  resetTitle: "Set a new password",
  resetSubtitle: "Choose a password you don't use anywhere else.",
  resetFor: "Signed in as {email}",
  newPassword: "New password",
  confirmPassword: "Confirm new password",
  lengthHint: "At least {n} characters.",
  tooShort: "Use at least {n} characters.",
  mismatch: "The two passwords don't match.",
  savePassword: "Save new password",
  saving: "Saving…",
  updateFailedTitle: "Couldn't change your password",
  samePassword: "That's already your password. Pick a different one.",
  weakPassword: "That password is too easy to guess. Try a longer one.",
  updateFailedBody: "Something went wrong. Please try again.",
  signOutNote: "Saving signs you out everywhere else.",

  // --- expired / broken link (both /reset-password and /auth/auth-code-error)
  expiredTitle: "This link has expired",
  expiredBody: "Password links can be used once and expire an hour after they're sent. Ask for a new one and it'll be in your inbox in a moment.",
  requestNewLink: "Send a new link",
} as const;

export type RecoveryStringKey = keyof typeof en;
type Table = Record<RecoveryStringKey, string>;

const ko: Table = {
  forgotTitle: "비밀번호 재설정",
  forgotSubtitle: "새 비밀번호를 설정할 수 있는 링크를 이메일로 보내드립니다.",
  emailLabel: "이메일",
  emailHint: "로그인에 사용하는 주소입니다.",
  sendLink: "재설정 링크 보내기",
  sending: "보내는 중…",
  sentTitle: "메일함을 확인하세요",
  sentBody: "{email} 계정이 있다면 새 비밀번호를 설정할 수 있는 링크가 발송됩니다. 링크는 한 번만 사용할 수 있고 1시간 후 만료됩니다.",
  sentHint: "몇 분이 지나도 오지 않으면 스팸함을 확인한 뒤 다시 시도하세요.",
  sendAnother: "링크 다시 보내기",
  sameDeviceHint: "요청을 시작한 이 기기, 이 브라우저에서 링크를 열어 주세요.",
  cooldownTitle: "잠시만 기다려 주세요",
  cooldownBody: "이 브라우저에서 이미 링크를 요청했습니다. 몇 분 후에 다시 시도하세요.",
  invalidEmail: "올바른 이메일 주소를 입력하세요.",
  sendFailedTitle: "링크를 보내지 못했습니다",
  sendFailedBody: "서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  backToSignIn: "로그인으로 돌아가기",
  forgotLink: "비밀번호를 잊으셨나요?",

  resetTitle: "새 비밀번호 설정",
  resetSubtitle: "다른 곳에서 쓰지 않는 비밀번호를 사용하세요.",
  resetFor: "{email} 계정으로 진행 중",
  newPassword: "새 비밀번호",
  confirmPassword: "새 비밀번호 확인",
  lengthHint: "{n}자 이상.",
  tooShort: "{n}자 이상 입력하세요.",
  mismatch: "두 비밀번호가 일치하지 않습니다.",
  savePassword: "새 비밀번호 저장",
  saving: "저장 중…",
  updateFailedTitle: "비밀번호를 변경하지 못했습니다",
  samePassword: "이미 사용 중인 비밀번호입니다. 다른 비밀번호를 선택하세요.",
  weakPassword: "너무 쉽게 추측되는 비밀번호입니다. 더 길게 만들어 보세요.",
  updateFailedBody: "문제가 발생했습니다. 다시 시도해 주세요.",
  signOutNote: "저장하면 다른 모든 기기에서 로그아웃됩니다.",

  expiredTitle: "링크가 만료되었습니다",
  expiredBody: "비밀번호 링크는 한 번만 사용할 수 있으며 발송 후 1시간이 지나면 만료됩니다. 새 링크를 요청하면 곧 메일함으로 도착합니다.",
  requestNewLink: "새 링크 보내기",
};

const zh: Table = {
  forgotTitle: "重置密码",
  forgotSubtitle: "我们会给你发送一封邮件，里面有设置新密码的链接。",
  emailLabel: "邮箱",
  emailHint: "你登录时使用的邮箱地址。",
  sendLink: "发送重置链接",
  sending: "发送中…",
  sentTitle: "请查收邮件",
  sentBody: "如果 {email} 已注册，设置新密码的链接就在路上。链接仅可使用一次，一小时后失效。",
  sentHint: "几分钟后仍未收到？请检查垃圾邮件，然后重试。",
  sendAnother: "再发一封",
  sameDeviceHint: "请在发起请求的这台设备、这个浏览器中打开链接。",
  cooldownTitle: "请稍候",
  cooldownBody: "此浏览器刚刚已经请求过链接。请几分钟后再试。",
  invalidEmail: "请输入有效的邮箱地址。",
  sendFailedTitle: "无法发送链接",
  sendFailedBody: "我们这边出了点问题。请稍后再试。",
  backToSignIn: "返回登录",
  forgotLink: "忘记密码？",

  resetTitle: "设置新密码",
  resetSubtitle: "请使用一个你没有在别处用过的密码。",
  resetFor: "当前账号：{email}",
  newPassword: "新密码",
  confirmPassword: "确认新密码",
  lengthHint: "至少 {n} 个字符。",
  tooShort: "请至少输入 {n} 个字符。",
  mismatch: "两次输入的密码不一致。",
  savePassword: "保存新密码",
  saving: "保存中…",
  updateFailedTitle: "无法修改密码",
  samePassword: "这已经是你当前的密码。请换一个。",
  weakPassword: "这个密码太容易被猜到。请设置更长的密码。",
  updateFailedBody: "出了点问题。请重试。",
  signOutNote: "保存后，其他设备上的登录会全部退出。",

  expiredTitle: "链接已失效",
  expiredBody: "密码链接仅可使用一次，且在发送一小时后失效。重新申请一个，稍后即可在邮箱中收到。",
  requestNewLink: "发送新链接",
};

const es: Table = {
  forgotTitle: "Restablece tu contraseña",
  forgotSubtitle: "Te enviaremos un enlace por correo para elegir una nueva.",
  emailLabel: "Correo electrónico",
  emailHint: "La dirección con la que inicias sesión.",
  sendLink: "Enviar enlace",
  sending: "Enviando…",
  sentTitle: "Revisa tu correo",
  sentBody: "Si existe una cuenta para {email}, el enlace para crear una contraseña nueva va en camino. Solo funciona una vez y caduca en una hora.",
  sentHint: "¿No llega en unos minutos? Revisa la carpeta de spam y vuelve a intentarlo.",
  sendAnother: "Enviar otro enlace",
  sameDeviceHint: "Abre el enlace en este dispositivo y en este navegador, donde empezaste la solicitud.",
  cooldownTitle: "Un momento",
  cooldownBody: "Ya se pidió un enlace desde este navegador. Inténtalo de nuevo en unos minutos.",
  invalidEmail: "Introduce una dirección de correo válida.",
  sendFailedTitle: "No se pudo enviar el enlace",
  sendFailedBody: "Algo falló de nuestro lado. Inténtalo de nuevo en un momento.",
  backToSignIn: "Volver a iniciar sesión",
  forgotLink: "¿Olvidaste tu contraseña?",

  resetTitle: "Crea una contraseña nueva",
  resetSubtitle: "Elige una contraseña que no uses en ningún otro sitio.",
  resetFor: "Sesión de {email}",
  newPassword: "Contraseña nueva",
  confirmPassword: "Confirma la contraseña nueva",
  lengthHint: "Al menos {n} caracteres.",
  tooShort: "Usa al menos {n} caracteres.",
  mismatch: "Las dos contraseñas no coinciden.",
  savePassword: "Guardar contraseña",
  saving: "Guardando…",
  updateFailedTitle: "No se pudo cambiar la contraseña",
  samePassword: "Esa ya es tu contraseña. Elige otra distinta.",
  weakPassword: "Esa contraseña es demasiado fácil de adivinar. Prueba con una más larga.",
  updateFailedBody: "Algo salió mal. Inténtalo de nuevo.",
  signOutNote: "Al guardar se cierra la sesión en tus otros dispositivos.",

  expiredTitle: "Este enlace ha caducado",
  expiredBody: "Los enlaces de contraseña se usan una sola vez y caducan una hora después de enviarse. Pide uno nuevo y llegará a tu correo en un momento.",
  requestNewLink: "Enviar un enlace nuevo",
};

const STRINGS: Record<Locale, Table> = { en, ko, zh, es };

export type RecoveryT = (key: RecoveryStringKey, vars?: Record<string, string | number>) => string;

/** Bound translator for the recovery pages; falls back to English, never to the key. */
export function recoveryStrings(locale: Locale): RecoveryT {
  const table = STRINGS[locale] ?? STRINGS.en;
  return (key, vars) => {
    let str: string = table[key] ?? STRINGS.en[key];
    if (vars) {
      for (const [k, v] of Object.entries(vars)) str = str.split(`{${k}}`).join(String(v));
    }
    return str;
  };
}
