"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

/**
 * Label + control + hint/error with the ids wired up (htmlFor, aria-describedby,
 * aria-invalid). Pass a single form control as the child.
 */
export function Field({
  label, hint, error, children, className = "", required,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactElement<Record<string, unknown>>;
  className?: string;
  required?: boolean;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: (children.props.id as string | undefined) ?? id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required: required || (children.props.required as boolean | undefined),
      })
    : children;
  return (
    <div className={className}>
      <label htmlFor={(children.props.id as string | undefined) ?? id} className="label">
        {label}{required && <span aria-hidden className="text-bad ml-0.5">*</span>}
      </label>
      {control}
      {hint && !error && <p id={hintId} className="mt-1 text-xs text-ink-3">{hint}</p>}
      {error && <p id={errId} role="alert" className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}
