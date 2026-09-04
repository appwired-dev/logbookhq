import Link from "next/link";

/**
 * Single source for the brand lockup (plane mark + wordmark).
 * tone="light" for dark surfaces (app header), tone="dark" for light pages.
 */
export default function Brand({
  size = "md", tone = "light", href = "/app", subtitle,
}: {
  size?: "sm" | "md";
  tone?: "light" | "dark";
  href?: string;
  subtitle?: React.ReactNode;
}) {
  const box = size === "sm" ? "w-8 h-8 rounded-lg" : "w-9 h-9 rounded-xl";
  const word = size === "sm" ? "text-sm" : "text-[15px]";
  const text = tone === "light" ? "text-white" : "text-ink-1";
  return (
    <Link href={href} className="flex items-center gap-2.5 group shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
      <span className={`relative ${box} grid place-items-center bg-gradient-cyan shadow-glow group-hover:brightness-110 transition-[filter] duration-med`}>
        <PlaneMark />
      </span>
      <span className="leading-tight">
        <span className={`block font-semibold tracking-tight ${word} ${text}`}>
          Pilot Logbook <span className="text-brand-glow">HQ</span>
        </span>
        {subtitle}
      </span>
    </Link>
  );
}

export function PlaneMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}
