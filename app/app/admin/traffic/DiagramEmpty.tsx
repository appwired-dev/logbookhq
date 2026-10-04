import type { LucideIcon } from "@/components/ui/icons";

/**
 * Calm in-card empty state for a Traffic diagram (chart, Sankey, globe): the
 * same tinted icon tile as the Charts page's ChartEmpty, sized to the space
 * the diagram would take so the page keeps its rhythm with no data.
 */
export default function DiagramEmpty({ icon: Glyph, text, className = "" }: {
  icon: LucideIcon;
  text: string;
  className?: string;
}) {
  return (
    <div className={`grid place-items-center rounded-control bg-surface-2/40 px-4 py-10 text-center ${className}`}>
      <div>
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-control bg-brand/10 text-brand">
          <Glyph size={20} strokeWidth={1.75} aria-hidden />
        </div>
        <p className="mx-auto mt-3 max-w-sm text-sm text-ink-3">{text}</p>
      </div>
    </div>
  );
}
