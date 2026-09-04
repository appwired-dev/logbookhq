import type { ReactNode } from "react";

/** Page-level block: one header style for every dashboard/chart section. */
export function Section({
  eyebrow, title, meta, actions, children, className = "",
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {(title || actions) && (
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <div className="min-w-0">
            {eyebrow && <div className="text-2xs font-semibold uppercase tracking-[0.12em] text-brand-deep mb-0.5">{eyebrow}</div>}
            {title && <h2 className="text-sm font-semibold text-ink-1 tracking-tight">{title}</h2>}
            {meta && <div className="text-xs text-ink-3 mt-0.5">{meta}</div>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title, subtitle, actions, className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-3 flex-wrap ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink-1 tracking-tight">{title}</h1>
        {subtitle && <div className="text-sm text-ink-3 mt-1 flex items-center gap-2 flex-wrap">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
