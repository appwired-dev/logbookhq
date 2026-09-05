"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { CountUp } from "@/components/CountUp";
import { Icon, buttonClass } from "@/components/ui";
import type { Locale } from "@/lib/i18n";
import type { Category, Role } from "@/lib/types";
import { fmt, type FlightsStrings } from "./flights-strings";
import type { FlightFilters } from "./use-flight-filters";

export type FlightsToolbarProps = {
  s: FlightsStrings;
  locale: Locale;
  /** Filtered count / credited hours shown live in the subtitle. */
  count: number;
  hours: number;
  augHalfCredit: boolean;
  filters: FlightFilters;
  years: readonly string[];
  categories: readonly Category[];
  roles: readonly Role[];
  active: boolean;
  onQ: (q: string) => void;
  onYear: (year: string) => void;
  onCat: (cat: string) => void;
  onRole: (role: string) => void;
  onClear: () => void;
};

/**
 * Sticky filter bar. Layout:
 *   < xl : [title ........ New]  /  [search (full width on phones)]  /  [year · cat · role · clear] (scrolls sideways)
 *   ≥ xl : [title] [search · year · cat · role · clear] [New]
 * One set of controls — the breakpoints only rearrange the grid.
 */
export function FlightsToolbar({
  s, locale, count, hours, augHalfCredit, filters, years, categories, roles, active,
  onQ, onYear, onCat, onRole, onClear,
}: FlightsToolbarProps) {
  return (
    <div className="toolbar">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-ink-1 tracking-tight leading-6 truncate">{s.title}</h1>
          {/* The visible line tweens the hours (CountUp re-renders every frame),
              so the live region is a static, visually-hidden copy: one
              announcement per change instead of one per frame. */}
          <p className="text-xs text-ink-3 truncate" aria-hidden>
            <Summary template={s.summary} count={count} hours={hours} locale={locale} />
            {augHalfCredit && <span className="hidden sm:inline"> · {s.augNote}</span>}
          </p>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {fmt(s.summary, { count: count.toLocaleString(locale), hours: hours.toFixed(1) })}
            {augHalfCredit ? ` · ${s.augNote}` : ""}
          </p>
        </div>

        <Link
          href="/app/flights/new"
          className={buttonClass("primary", "md", "justify-self-end shrink-0 h-11 md:h-10 xl:col-start-3")}
        >
          <Icon.Plus size={16} strokeWidth={2} aria-hidden />
          <span>{s.newFlight}</span>
        </Link>

        <div className="col-span-2 min-w-0 flex flex-col gap-2 md:flex-row md:items-center xl:col-span-1 xl:col-start-2 xl:row-start-1">
          <div className="relative w-full md:w-60 lg:w-72 md:shrink-0">
            <Icon.Search
              size={14}
              strokeWidth={2}
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              className="input h-11 md:h-9 pl-8 text-sm"
              aria-label={s.searchLabel}
              placeholder={s.searchPh}
              value={filters.q}
              onChange={(e) => onQ(e.target.value)}
            />
          </div>

          {/* Phones: bleed to the screen edges and scroll sideways; the page never scrolls horizontally. */}
          <div
            role="group"
            aria-label={s.filters}
            className="flex items-center gap-2 min-w-0 overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-1 md:px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <select
              className="input h-11 md:h-9 w-auto shrink-0 text-sm"
              aria-label={s.yearLabel}
              value={filters.year}
              onChange={(e) => onYear(e.target.value)}
            >
              <option value="">{s.allYears}</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>

            <Segmented
              label={s.category}
              allLabel={s.all}
              value={filters.cat}
              options={categories.map((c) => ({ value: c, label: c }))}
              onChange={onCat}
            />
            <Segmented
              label={s.role}
              allLabel={s.all}
              value={filters.role}
              options={roles.map((r) => ({ value: r, label: s.roleShort[r] }))}
              onChange={onRole}
            />

            {active && (
              <button type="button" onClick={onClear} className={buttonClass("ghost", "sm", "h-11 md:h-9 shrink-0")}>
                <Icon.X size={14} strokeWidth={2} aria-hidden />
                {s.clearFilters}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** "{count} flights · {hours} h" with the hours tweened by CountUp. */
function Summary({ template, count, hours, locale }: { template: string; count: number; hours: number; locale: Locale }) {
  const parts = template.split(/(\{count\}|\{hours\})/).filter(Boolean);
  return (
    <>
      {parts.map((p, i): ReactNode => {
        if (p === "{count}") return <span key={i} className="num">{count.toLocaleString(locale)}</span>;
        if (p === "{hours}") return <CountUp key={i} value={hours} decimals={1} />;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

/**
 * Radio-group style segmented control. Roving tabindex: only the checked
 * option is in the tab order; arrow keys move the selection (like native
 * radios), Home/End jump to the ends.
 */
function Segmented({ label, allLabel, value, options, onChange }: {
  label: string;
  allLabel: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const opts = [{ value: "", label: allLabel }, ...options];
  const checkedIdx = Math.max(0, opts.findIndex((o) => o.value === value));

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (checkedIdx + 1) % opts.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (checkedIdx - 1 + opts.length) % opts.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = opts.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(opts[next].value);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="inline-flex h-11 md:h-9 shrink-0 items-stretch rounded-control border border-border bg-surface p-0.5 shadow-sm"
    >
      {opts.map((o, i) => {
        const checked = i === checkedIdx;
        return (
          <button
            key={o.value || "__all"}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`relative min-w-[2.75rem] px-2.5 rounded-[calc(var(--r-control)_-_3px)] text-xs font-medium whitespace-nowrap cursor-pointer select-none
              transition-colors duration-fast motion-reduce:transition-none
              focus-visible:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand/60
              ${checked ? "bg-surface-inverse text-ink-inverse shadow-sm" : "text-ink-2 hover:text-ink-1 hover:bg-surface-2"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
