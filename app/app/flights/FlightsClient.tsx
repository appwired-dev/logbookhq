"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useMemo } from "react";
import { EmptyState, Icon, buttonClass } from "@/components/ui";
import type { Locale } from "@/lib/i18n";
import type { Category, FlightDerived, Role } from "@/lib/types";
import { useIsDesktop } from "@/lib/use-media-query";
import { FlightsCards } from "./FlightsCards";
import { FlightsTable } from "./FlightsTable";
import { FlightsToolbar } from "./FlightsToolbar";
import { getFlightsStrings } from "./flights-strings";
import {
  CATEGORY_ORDER, ROLE_ORDER, aggregate, applyFilters, isCategory, isRole, searchText, sortFlights,
  useFlightFilters, useSavedFlightId,
} from "./use-flight-filters";

export type FlightsClientProps = {
  /** Every flight, already derived (page.tsx). Filtering/sorting is client-side. */
  flights: FlightDerived[];
  locale: Locale;
  /** profiles.aug_half_credit — SIC time counts 50 % in the credited totals. */
  augHalfCredit?: boolean;
  /**
   * Server-side device hint (lib/device-hint.ts): what SSR renders before
   * `matchMedia` takes over. Defaults to the table.
   */
  initialIsDesktop?: boolean;
};

/**
 * Flights list. URL contract: ?q=&y=&cat=&role=&sort=<key>:<asc|desc>
 * (+ one-shot ?saved=<id> to pulse a just-saved row).
 */
export default function FlightsClient({ flights, locale, augHalfCredit = false, initialIsDesktop = true }: FlightsClientProps) {
  const s = useMemo(() => getFlightsStrings(locale), [locale]);
  const router = useRouter();
  const isDesktop = useIsDesktop(initialIsDesktop);
  const { filters, setQ, setYear, setCat, setRole, toggleSort, clear, active } = useFlightFilters();
  const highlightId = useSavedFlightId();
  // Keep typing responsive: the input echoes `filters.q` immediately, the
  // (heavier) filter pass follows on the deferred value.
  const deferredQ = useDeferredValue(filters.q);

  // Option lists come from the data (plus whatever the URL currently selects,
  // so the controls always reflect the active filter). Years newest first.
  const years = useMemo(() => {
    const set = new Set<string>();
    for (const f of flights) set.add(f.date.slice(0, 4));
    if (filters.year) set.add(filters.year);
    return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }, [flights, filters.year]);
  const categories = useMemo<Category[]>(() => {
    const present = new Set<string>(flights.map((f) => f.category));
    if (isCategory(filters.cat)) present.add(filters.cat);
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [flights, filters.cat]);
  const roles = useMemo<Role[]>(() => {
    const present = new Set<string>(flights.map((f) => f.role));
    if (isRole(filters.role)) present.add(filters.role);
    return ROLE_ORDER.filter((r) => present.has(r));
  }, [flights, filters.role]);

  const haystack = useMemo(() => flights.map(searchText), [flights]);
  const filtered = useMemo(
    () => applyFilters(flights, haystack, { q: deferredQ, year: filters.year, cat: filters.cat, role: filters.role }),
    [flights, haystack, deferredQ, filters.year, filters.cat, filters.role],
  );
  const rows = useMemo(
    () => sortFlights(filtered, filters.sortKey, filters.sortDir, locale),
    [filtered, filters.sortKey, filters.sortDir, locale],
  );
  const agg = useMemo(() => aggregate(rows, augHalfCredit), [rows, augHalfCredit]);

  const open = useCallback((id: number) => router.push(`/app/flights/${id}`), [router]);

  if (flights.length === 0) {
    return (
      <EmptyState
        icon={Icon.Plane}
        headingLevel={1}
        title={s.emptyTitle}
        body={s.emptyBody}
        primary={
          <Link className={buttonClass("primary")} href="/app/flights/new">
            <Icon.Plus size={16} strokeWidth={2} aria-hidden />{s.addFlight}
          </Link>
        }
        secondary={<Link className={buttonClass()} href="/app/import">{s.importCsv}</Link>}
      />
    );
  }

  return (
    <div className="space-y-3">
      <FlightsToolbar
        s={s}
        locale={locale}
        count={agg.count}
        hours={agg.credited}
        augHalfCredit={augHalfCredit}
        filters={filters}
        years={years}
        categories={categories}
        roles={roles}
        active={active}
        onQ={setQ}
        onYear={setYear}
        onCat={setCat}
        onRole={setRole}
        onClear={clear}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Icon.Search}
          title={s.noMatchTitle}
          body={s.noMatchBody}
          primary={
            <button type="button" className={buttonClass("primary")} onClick={clear}>
              <Icon.X size={16} strokeWidth={2} aria-hidden />{s.clearFilters}
            </button>
          }
        />
      ) : isDesktop ? (
        <FlightsTable
          rows={rows}
          agg={agg}
          s={s}
          locale={locale}
          sortKey={filters.sortKey}
          sortDir={filters.sortDir}
          onSort={toggleSort}
          onOpen={open}
          augHalfCredit={augHalfCredit}
          highlightId={highlightId}
        />
      ) : (
        <FlightsCards rows={rows} s={s} augHalfCredit={augHalfCredit} highlightId={highlightId} />
      )}
    </div>
  );
}
