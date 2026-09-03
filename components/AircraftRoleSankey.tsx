"use client";

import { useMemo } from "react";
import FlowSankey, { ROLE_COLORS, type FlowLink, type FlowNode } from "./FlowSankey";
import type { Role } from "@/lib/types";

const ROLE_ORDER: Role[] = ["PIC", "FO", "DUAL", "SIC", "CHECK"];
type TypeRole = { PIC: number; DUAL: number; FO: number; SIC: number; CHECK: number; total: number };

// Aircraft type → role, one ribbon per (type, role) pair. Types are listed by
// hours descending; anything under `minShare` of total time rolls into a single
// "other" row so a 20-type career stays readable.
export default function AircraftRoleSankey({
  byTypeRole, roleLabels, minShare = 0.01, otherLabel = "Other types",
}: {
  byTypeRole: Record<string, TypeRole>;
  roleLabels: Partial<Record<Role, string>>;
  minShare?: number;
  otherLabel?: string;
}) {
  const { nodes, links, rows } = useMemo(() => {
    const entries = Object.entries(byTypeRole)
      .filter(([, v]) => v.total > 0)
      .sort((a, b) => b[1].total - a[1].total);
    const grand = entries.reduce((s, [, v]) => s + v.total, 0);
    const rowsOut: [string, TypeRole][] = [];
    const other: TypeRole = { PIC: 0, DUAL: 0, FO: 0, SIC: 0, CHECK: 0, total: 0 };
    let otherCount = 0;
    for (const [name, v] of entries) {
      if (v.total >= grand * minShare) { rowsOut.push([name, v]); continue; }
      otherCount++;
      for (const r of ROLE_ORDER) other[r] += v[r];
      other.total += v.total;
    }
    if (otherCount > 0) rowsOut.push([otherCount === 1 ? entries[entries.length - 1][0] : otherLabel, other]);

    const roles = ROLE_ORDER.filter((r) => rowsOut.some(([, v]) => v[r] > 0.05));
    const nodes: FlowNode[] = [
      ...rowsOut.map(([name]) => ({ name, color: "#64748b", kind: "aircraft" })),
      ...roles.map((r) => ({ name: roleLabels[r] ?? r, color: ROLE_COLORS[r], kind: "role" })),
    ];
    const links: FlowLink[] = [];
    rowsOut.forEach(([, v], i) => {
      roles.forEach((r, j) => {
        if (v[r] > 0.05) links.push({ source: i, target: rowsOut.length + j, value: Math.round(v[r] * 10) / 10 });
      });
    });
    return { nodes, links, rows: rowsOut.length };
  }, [byTypeRole, roleLabels, minShare, otherLabel]);

  return <FlowSankey nodes={nodes} links={links} height={Math.max(440, rows * 42)} />;
}
