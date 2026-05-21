"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { makeT, type Locale } from "@/lib/i18n";
import type { FlightDerived } from "@/lib/types";

type SortKey =
  | "date" | "make_model" | "registration" | "route" | "pic" | "copilot" | "third_pilot" | "check_pilot"
  | "category" | "role" | "day_time" | "night_time" | "total_time"
  | "is_xcountry" | "ifr_approaches";
type SortDir = "asc" | "desc";
type RoleFilter = "" | "PIC" | "DUAL" | "FO" | "SIC" | "CHECK";

export default function FlightsClient({ flights, locale }: { flights: FlightDerived[]; locale: Locale }) {
  const t = makeT(locale);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"" | "SE" | "ME" | "SES" | "MES" | "HELI" | "SIM">("");
  const [role, setRole] = useState<RoleFilter>("");
  const [year, setYear] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const years = useMemo(() => {
    const s = new Set<string>();
    for (const f of flights) s.add(f.date.slice(0, 4));
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [flights]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let rows = flights.filter((f) => {
      if (category && f.category !== category) return false;
      if (role && f.role !== role) return false;
      if (year && !f.date.startsWith(year)) return false;
      if (!ql) return true;
      return [f.make_model, f.registration, f.pic, f.copilot, f.third_pilot, f.check_pilot, f.route, f.remarks]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(ql));
    });
    const dir = sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return rows;
  }, [flights, q, category, role, year, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "date" ? "desc" : "asc"); }
  }

  const totalTime = filtered.reduce((acc, f) => acc + f.total_time, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="label">{t("flights.search")}</label>
          <input className="input" placeholder={t("flights.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="w-[88px]">
          <label className="label">{t("flights.date")}</label>
          <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">{locale === "ko" ? "전체" : "All"}</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="w-[88px]">
          <label className="label">{t("form.category")}</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as any)}>
            <option value="">{locale === "ko" ? "전체" : "All"}</option>
            <option value="SE">SE</option>
            <option value="ME">ME</option>
            <option value="SES">SES</option>
            <option value="MES">MES</option>
            <option value="HELI">HELI</option>
            <option value="SIM">{t("bd.sim")}</option>
          </select>
        </div>
        <div className="w-[100px]">
          <label className="label">{t("form.role")}</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as RoleFilter)}>
            <option value="">{locale === "ko" ? "전체" : "All"}</option>
            <option value="PIC">PIC</option>
            <option value="DUAL">{t("role.dual")}</option>
            <option value="FO">{t("role.fo")}</option>
            <option value="SIC">{t("role.so")}</option>
            <option value="CHECK">{t("role.check")}</option>
          </select>
        </div>
        <div className="text-xs text-slate-500 self-center ml-auto tabular-nums whitespace-nowrap">
          {filtered.length.toLocaleString()} · {totalTime.toFixed(1)} {t("limits.hrs")}
        </div>
        <Link href="/app/flights/new" className="btn btn-primary self-end whitespace-nowrap">{t("flights.new")}</Link>
      </div>

      {/* MOBILE: card-per-flight list */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && (
          <div className="card p-8 text-center text-slate-400">{t("flights.empty")}</div>
        )}
        {filtered.map((f) => (
          <Link
            key={f.id}
            href={`/app/flights/${f.id}`}
            className="card card-hover block p-3 active:scale-[0.99] transition-transform"
          >
            <div className="flex justify-between items-baseline">
              <div className="font-mono text-xs text-slate-500">{f.date}</div>
              <div className="text-base font-bold tabular-nums text-slate-900">{f.total_time.toFixed(1)} hrs</div>
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900">{f.make_model}</span>
              {f.registration && <span className="text-xs text-slate-500 font-mono">{f.registration}</span>}
              <CatPill cat={f.category} />
              <RolePill role={f.role} />
              {f.is_xcountry && <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 rounded-md uppercase tracking-wider">XC</span>}
            </div>
            {f.route && <div className="mt-1 font-mono text-xs text-slate-600">{f.route}</div>}
            {(f.pic || f.copilot || f.third_pilot || f.check_pilot) && (
              <div className="mt-1.5 text-xs text-slate-500 grid grid-cols-2 gap-x-3 gap-y-0.5">
                {f.pic && <div><span className="text-slate-400">PIC</span> {f.pic}</div>}
                {f.copilot && <div><span className="text-slate-400">FO</span> {f.copilot}</div>}
                {f.third_pilot && <div><span className="text-slate-400">SO/Aug</span> {f.third_pilot}</div>}
                {f.check_pilot && <div><span className="text-slate-400">Check</span> {f.check_pilot}</div>}
              </div>
            )}
            <div className="mt-1.5 flex gap-3 text-xs text-slate-500 tabular-nums">
              {f.day_time > 0 && <span>Day {f.day_time}</span>}
              {f.night_time > 0 && <span>Night {f.night_time}</span>}
              {f.ifr_approaches > 0 && <span>{f.ifr_approaches} app</span>}
            </div>
          </Link>
        ))}
      </div>

      {/* DESKTOP: full table — `min-w-max` lets the table grow to its natural
          column width, so the parent `overflow-x-auto` actually kicks in on
          narrower viewports instead of just squeezing the columns.
          `scrollbar-always` forces a visible scrollbar (macOS hides them by
          default), so users see the affordance. */}
      <div className="hidden md:block card overflow-x-auto scrollbar-always">
        <table className="min-w-max w-full text-sm">
          <thead className="bg-gradient-to-b from-slate-100 to-slate-50 text-[10px] uppercase tracking-wider text-slate-600 sticky top-0 z-10 backdrop-blur">
            <tr>
              <Th k="date" cur={sortKey} dir={sortDir} onClick={toggleSort}>{t("flights.date")}</Th>
              <Th k="make_model" cur={sortKey} dir={sortDir} onClick={toggleSort}>{t("flights.makeModel")}</Th>
              <Th k="registration" cur={sortKey} dir={sortDir} onClick={toggleSort}>{t("flights.reg")}</Th>
              <Th k="route" cur={sortKey} dir={sortDir} onClick={toggleSort}>{t("flights.route")}</Th>
              <Th k="pic" cur={sortKey} dir={sortDir} onClick={toggleSort}>{t("flights.pic")}</Th>
              <Th k="copilot" cur={sortKey} dir={sortDir} onClick={toggleSort}>{t("role.fo")}</Th>
              <Th k="third_pilot" cur={sortKey} dir={sortDir} onClick={toggleSort}>{t("role.so")}</Th>
              <Th k="check_pilot" cur={sortKey} dir={sortDir} onClick={toggleSort}>{t("role.check")}</Th>
              <Th k="category" cur={sortKey} dir={sortDir} onClick={toggleSort}>{t("form.category")}</Th>
              <Th k="role" cur={sortKey} dir={sortDir} onClick={toggleSort}>{t("form.role")}</Th>
              <Th k="day_time" cur={sortKey} dir={sortDir} onClick={toggleSort} align="right">{t("flights.day")}</Th>
              <Th k="night_time" cur={sortKey} dir={sortDir} onClick={toggleSort} align="right">{t("flights.night")}</Th>
              <Th k="total_time" cur={sortKey} dir={sortDir} onClick={toggleSort} align="right">{t("flights.total")}</Th>
              <Th k="is_xcountry" cur={sortKey} dir={sortDir} onClick={toggleSort} align="right">XC</Th>
              <Th k="ifr_approaches" cur={sortKey} dir={sortDir} onClick={toggleSort} align="right">{t("bd.approaches")}</Th>
              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-slate-600">{t("col.prec")}</th>
              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-slate-600">{t("col.nonPrec")}</th>
              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-slate-600">{t("col.holds")}</th>
              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-slate-600">{t("col.cfi")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, idx) => (
              <tr key={f.id} className={`border-t border-slate-100/70 hover:bg-sky-50/60 ${idx % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                <td className="px-3 py-1.5 whitespace-nowrap font-mono text-xs text-slate-700">{f.date}</td>
                <td className="px-3 py-1.5 whitespace-nowrap font-medium text-slate-800">{f.make_model}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-500 font-mono text-xs">{f.registration}</td>
                <td className="px-3 py-1.5 whitespace-nowrap font-mono text-xs text-slate-700">{f.route}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-700">{f.pic}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-500 text-xs">{f.copilot}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-500 text-xs">{f.third_pilot}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-500 text-xs">{f.check_pilot}</td>
                <td className="px-3 py-1.5"><CatPill cat={f.category} /></td>
                <td className="px-3 py-1.5"><RolePill role={f.role} /></td>
                <td className="px-3 py-1.5 text-right tabular-nums">{f.day_time || ""}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{f.night_time || ""}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-bold">{f.total_time}</td>
                <td className="px-3 py-1.5 text-right text-emerald-600">{f.is_xcountry ? "✓" : ""}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{f.ifr_approaches || ""}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{f.precision_approaches || ""}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{f.non_precision_approaches || ""}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{f.holds || ""}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{f.cfi_time || ""}</td>
                <td className="px-3 py-1.5 text-right">
                  <Link href={`/app/flights/${f.id}`} className="text-sky-600 hover:text-sky-800 font-medium text-xs">{t("common.edit")} →</Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={20} className="px-3 py-12 text-center text-slate-400">{t("flights.empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ k, cur, dir, onClick, children, align = "left" }: {
  k: SortKey; cur: SortKey; dir: SortDir;
  onClick: (k: SortKey) => void;
  children: React.ReactNode; align?: "left" | "right";
}) {
  const active = cur === k;
  const arrow = active ? (dir === "asc" ? "▲" : "▼") : "";
  return (
    <th className={`px-3 py-2.5 cursor-pointer select-none transition-colors ${active ? "bg-sky-100/60 text-slate-900" : "hover:bg-slate-200/60"} ${align === "right" ? "text-right" : "text-left"}`}
        onClick={() => onClick(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <span className={`text-[9px] ${active ? "text-sky-600" : "text-slate-300"}`}>{arrow || "▾"}</span>
      </span>
    </th>
  );
}

function CatPill({ cat }: { cat: string }) {
  // SE/ME land use their dedicated pill colors. Sea variants reuse the
  // land equivalents (blue/violet) with a subtle outline to hint "sea"
  // without inventing new pill CSS. HELI gets an amber accent. SIM stays gray.
  const cls =
    cat === "SE"   ? "pill-se" :
    cat === "ME"   ? "pill-me" :
    cat === "SES"  ? "pill-se ring-1 ring-cyan-300/60" :
    cat === "MES"  ? "pill-me ring-1 ring-cyan-300/60" :
    cat === "HELI" ? "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200" :
    "pill-sim";
  return <span className={cls}>{cat}</span>;
}
function RolePill({ role }: { role: string }) {
  const cls = role === "PIC" ? "pill-pic"
    : role === "DUAL" ? "pill-dual"
    : role === "FO"   ? "pill-fo"
    : role === "SIC"  ? "pill-sic-role"
    : role === "CHECK" ? "pill-check"
    : "pill-aug";
  const label = role === "SIC" ? "SO" : role === "CHECK" ? "CHK" : role;
  return <span className={cls}>{label}</span>;
}
