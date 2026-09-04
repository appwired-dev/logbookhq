"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { BUTTON_VARIANT as VARIANT, type ButtonVariant } from "./button-class";

/** Renders the shared `.btn` classes so CSS and React stay in sync. */
export function Button({
  variant = "default", size = "md", icon = false, loading = false, className = "", children, disabled, type = "button", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: boolean;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={`btn ${VARIANT[variant]} ${size === "sm" ? "btn-sm" : ""} ${icon ? "btn-icon" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
