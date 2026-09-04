import type { ElementType, ReactNode } from "react";

const PAD = { none: "", sm: "p-3", md: "p-4", lg: "p-5" } as const;

export function Card({
  children, className = "", padding = "md", interactive = false, as: Tag = "div", ...rest
}: {
  children: ReactNode;
  className?: string;
  padding?: keyof typeof PAD;
  /** Only link-like cards lift on hover — never decorative ones. */
  interactive?: boolean;
  as?: ElementType;
} & Record<string, unknown>) {
  return (
    <Tag className={`card ${PAD[padding]} ${interactive ? "card-interactive" : ""} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  eyebrow, title, meta, actions, className = "", flush = false,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** No bottom margin — for headers that carry their own border inside a padding="none" card. */
  flush?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 flex-wrap ${flush ? "" : "mb-3"} ${className}`}>
      <div className="min-w-0">
        {eyebrow && <div className="text-2xs font-semibold uppercase tracking-[0.12em] text-brand-deep mb-0.5">{eyebrow}</div>}
        <h2 className="text-sm font-semibold text-ink-1 tracking-tight">{title}</h2>
        {meta && <div className="text-xs text-ink-3 mt-0.5">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function CardFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mt-4 pt-3 border-t border-border flex items-center gap-3 flex-wrap ${className}`}>{children}</div>;
}
