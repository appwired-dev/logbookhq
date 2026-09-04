/**
 * Class-string helper for <Link>/<a> elements that should look like buttons.
 * Lives in its own (server-safe) module: components/ui/Button.tsx is a client
 * module, and calling a function exported from a "use client" file inside a
 * Server Component is not allowed.
 */
export const BUTTON_VARIANT = { default: "", primary: "btn-primary", ghost: "btn-ghost", danger: "btn-danger" } as const;
export type ButtonVariant = keyof typeof BUTTON_VARIANT;

export function buttonClass(variant: ButtonVariant = "default", size: "md" | "sm" = "md", extra = "") {
  return `btn ${BUTTON_VARIANT[variant]} ${size === "sm" ? "btn-sm" : ""} ${extra}`.replace(/\s+/g, " ").trim();
}
