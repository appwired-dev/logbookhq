"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

/** Intrinsic elements a <label for> can actually target. */
const LABELABLE = new Set(["input", "textarea", "select", "button", "meter", "output", "progress"]);

/**
 * Label + control + hint/error with the ids wired up (htmlFor, aria-describedby,
 * aria-invalid). Pass a single form control as the child.
 *
 * Labelable children (inputs, textareas, selects, buttons — and components,
 * which are assumed to render one) get a real <label htmlFor>. A non-labelable
 * child (a plain div, or a component flagged `composite` such as a radiogroup)
 * gets the label as a <span id> and `aria-labelledby` instead, since htmlFor
 * would be inert there.
 */
export function Field({
  label, hint, error, children, className = "", required, composite = false,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactElement<Record<string, unknown>>;
  className?: string;
  required?: boolean;
  /** The child is a composite widget (radiogroup, listbox…) rather than a labelable control. */
  composite?: boolean;
}) {
  const id = useId();
  const controlId = (children.props.id as string | undefined) ?? id;
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  const labelable = !composite && (typeof children.type !== "string" || LABELABLE.has(children.type));

  const injected: Record<string, unknown> = {
    id: controlId,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    required: required || (children.props.required as boolean | undefined),
  };
  if (!labelable) injected["aria-labelledby"] = labelId;
  const control = isValidElement(children) ? cloneElement(children, injected) : children;

  const labelContent = (
    <>
      {label}{required && <span aria-hidden className="text-bad-ink ml-0.5">*</span>}
    </>
  );
  return (
    <div className={className}>
      {labelable ? (
        <label htmlFor={controlId} className="label">{labelContent}</label>
      ) : (
        <span id={labelId} className="label">{labelContent}</span>
      )}
      {control}
      {hint && !error && <p id={hintId} className="mt-1 text-xs text-ink-3">{hint}</p>}
      {error && <p id={errId} role="alert" className="mt-1 text-xs text-bad-ink">{error}</p>}
    </div>
  );
}
