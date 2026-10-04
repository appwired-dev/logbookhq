import { Icon } from "@/components/ui";

/**
 * "Showing {name}" + a "Show all" button for a diagram's focus. The wrapper is
 * always rendered and polite-live, so a screen reader hears the focus change
 * whether it came from the diagram or a list row.
 */
export default function FocusChip({ label, clearText, onClear }: {
  /** Already localised ("Showing Google"); null when nothing is focused. */
  label: string | null;
  clearText: string;
  onClear: () => void;
}) {
  return (
    <div aria-live="polite" aria-atomic="true" className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      {label && (
        <>
          <span className="inline-flex min-h-8 min-w-0 max-w-full items-center truncate rounded-pill bg-brand/10 px-2.5 text-xs font-medium text-brand-deep sm:max-w-[18rem]">
            <span className="truncate">{label}</span>
          </span>
          <button type="button" className="btn btn-sm shrink-0" onClick={onClear}>
            <Icon.X size={14} strokeWidth={2} aria-hidden />
            {clearText}
          </button>
        </>
      )}
    </div>
  );
}
