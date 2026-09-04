import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CircleAlert, Check, Info, TriangleAlert } from "./icons";

export function EmptyState({
  icon: Icon, title, body, primary, secondary, className = "", headingLevel = 2,
}: {
  icon: LucideIcon; title: ReactNode; body?: ReactNode; primary?: ReactNode; secondary?: ReactNode; className?: string;
  /** Use 1 when the empty state is the page's only heading (404, success pages). */
  headingLevel?: 1 | 2 | 3;
}) {
  const Heading = (`h${headingLevel}`) as "h1" | "h2" | "h3";
  return (
    <div className={`card p-10 text-center ${className}`}>
      <div className="mx-auto w-12 h-12 rounded-xl bg-brand/10 text-brand grid place-items-center">
        <Icon size={22} strokeWidth={1.75} aria-hidden />
      </div>
      <Heading className="mt-4 text-lg font-semibold text-ink-1">{title}</Heading>
      {body && <div className="mt-1.5 text-sm text-ink-2 max-w-md mx-auto">{body}</div>}
      {(primary || secondary) && (
        <div className="mt-5 flex gap-2 justify-center flex-wrap">{primary}{secondary}</div>
      )}
    </div>
  );
}

const ALERT = {
  info: { icon: Info, cls: "bg-brand/10 border-brand/25 text-ink-1", iconCls: "text-brand-deep" },
  good: { icon: Check, cls: "bg-good/10 border-good/30 text-ink-1", iconCls: "text-good-ink" },
  warn: { icon: TriangleAlert, cls: "bg-warn/10 border-warn/30 text-ink-1", iconCls: "text-warn-ink" },
  bad: { icon: CircleAlert, cls: "bg-bad/10 border-bad/30 text-ink-1", iconCls: "text-bad-ink" },
} as const;

export function Alert({
  variant = "info", title, children, className = "",
}: {
  variant?: keyof typeof ALERT; title?: ReactNode; children?: ReactNode; className?: string;
}) {
  const a = ALERT[variant];
  const Icon = a.icon;
  return (
    <div
      role={variant === "bad" ? "alert" : "status"}
      aria-live={variant === "bad" ? undefined : "polite"}
      className={`flex gap-3 rounded-control border px-3.5 py-3 text-sm ${a.cls} ${className}`}
    >
      <Icon size={16} strokeWidth={2} aria-hidden className={`mt-0.5 shrink-0 ${a.iconCls}`} />
      <div className="min-w-0">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={title ? "mt-0.5 text-ink-2" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className = "", ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={`skeleton ${className}`} {...rest} />;
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton h-3" style={{ width: `${i === lines - 1 ? 55 : 100 - i * 8}%` }} />
      ))}
    </div>
  );
}
