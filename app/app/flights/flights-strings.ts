import { translate, type Locale } from "@/lib/i18n";
import type { Role } from "@/lib/types";

/**
 * Strings for the flights list page.
 *
 * Existing keys are pulled from lib/i18n.ts via `translate()` so the page
 * keeps sharing labels with the form and dashboard. Strings introduced by the
 * Phase 2 table live in the local map below (all four locales) and should be
 * folded into lib/i18n.ts in a later pass.
 */

type LocalStrings = {
  /** Toolbar subtitle. `{count}` and `{hours}` are interpolated. */
  summary: string;
  hoursUnit: string;
  searchLabel: string;
  yearLabel: string;
  allYears: string;
  all: string;
  filters: string;
  clearFilters: string;
  groupCrew: string;
  groupTol: string;
  colCat: string;
  colSo: string;
  colXc: string;
  colActual: string;
  colHood: string;
  colSim: string;
  colIfr: string;
  colTakeoffs: string;
  colLandings: string;
  colActions: string;
  xcYes: string;
  /** `{date}` is interpolated. */
  editFlight: string;
  totals: string;
  noMatchTitle: string;
  noMatchBody: string;
  /** `{d}` / `{n}` are interpolated. */
  tolSplit: string;
  /** Toast title after a create/update redirect (`?saved=<id>`). */
  flightSaved: string;
  roleShort: Record<Role, string>;
};

const LOCAL: Record<Locale, LocalStrings> = {
  en: {
    summary: "{count} flights · {hours} h",
    hoursUnit: "h",
    searchLabel: "Search flights",
    yearLabel: "Year",
    allYears: "All years",
    all: "All",
    filters: "Filters",
    clearFilters: "Clear filters",
    groupCrew: "Crew",
    groupTol: "T/O & Ldg",
    colCat: "Cat",
    colSo: "SO",
    colXc: "XC",
    colActual: "Actual",
    colHood: "Hood",
    colSim: "Sim",
    colIfr: "IFR",
    colTakeoffs: "T/O",
    colLandings: "Ldg",
    colActions: "Actions",
    xcYes: "Cross-country",
    editFlight: "Edit flight {date}",
    totals: "Totals",
    noMatchTitle: "No flights match",
    noMatchBody: "Try a different search or clear the filters.",
    tolSplit: "Day {d} · Night {n}",
    flightSaved: "Flight saved",
    roleShort: { PIC: "PIC", DUAL: "Dual", FO: "FO", SIC: "SO", CHECK: "Check" },
  },
  ko: {
    summary: "비행 {count}회 · {hours}시간",
    hoursUnit: "시간",
    searchLabel: "비행 검색",
    yearLabel: "연도",
    allYears: "전체 연도",
    all: "전체",
    filters: "필터",
    clearFilters: "필터 지우기",
    groupCrew: "승무원",
    groupTol: "이착륙",
    colCat: "구분",
    colSo: "보조",
    colXc: "장거리",
    colActual: "실제",
    colHood: "후드",
    colSim: "모의",
    colIfr: "계기",
    colTakeoffs: "이륙",
    colLandings: "착륙",
    colActions: "작업",
    xcYes: "장거리 비행",
    editFlight: "{date} 비행 편집",
    totals: "합계",
    noMatchTitle: "일치하는 비행이 없습니다",
    noMatchBody: "다른 검색어를 입력하거나 필터를 지워 보세요.",
    tolSplit: "주간 {d} · 야간 {n}",
    flightSaved: "비행이 저장되었습니다",
    roleShort: { PIC: "기장", DUAL: "교육", FO: "부기장", SIC: "보조", CHECK: "검열" },
  },
  zh: {
    summary: "{count} 次飞行 · {hours} 小时",
    hoursUnit: "小时",
    searchLabel: "搜索飞行",
    yearLabel: "年份",
    allYears: "所有年份",
    all: "全部",
    filters: "筛选",
    clearFilters: "清除筛选",
    groupCrew: "机组",
    groupTol: "起降",
    colCat: "类别",
    colSo: "辅助",
    colXc: "越野",
    colActual: "实际",
    colHood: "盲飞罩",
    colSim: "模拟",
    colIfr: "仪表",
    colTakeoffs: "起飞",
    colLandings: "着陆",
    colActions: "操作",
    xcYes: "越野飞行",
    editFlight: "编辑 {date} 的飞行",
    totals: "总计",
    noMatchTitle: "没有匹配的飞行记录",
    noMatchBody: "请尝试其他搜索词或清除筛选。",
    tolSplit: "白天 {d} · 夜间 {n}",
    flightSaved: "飞行记录已保存",
    roleShort: { PIC: "机长", DUAL: "教学", FO: "副驾驶", SIC: "辅助", CHECK: "检查" },
  },
  es: {
    summary: "{count} vuelos · {hours} h",
    hoursUnit: "h",
    searchLabel: "Buscar vuelos",
    yearLabel: "Año",
    allYears: "Todos los años",
    all: "Todos",
    filters: "Filtros",
    clearFilters: "Limpiar filtros",
    groupCrew: "Tripulación",
    groupTol: "Desp. y aterr.",
    colCat: "Cat.",
    colSo: "SO",
    colXc: "XC",
    colActual: "Real",
    colHood: "Capucha",
    colSim: "Sim",
    colIfr: "IFR",
    colTakeoffs: "Desp.",
    colLandings: "Aterr.",
    colActions: "Acciones",
    xcYes: "Travesía",
    editFlight: "Editar vuelo {date}",
    totals: "Totales",
    noMatchTitle: "Ningún vuelo coincide",
    noMatchBody: "Prueba otra búsqueda o limpia los filtros.",
    tolSplit: "Día {d} · Noche {n}",
    flightSaved: "Vuelo guardado",
    roleShort: { PIC: "PIC", DUAL: "Doble", FO: "FO", SIC: "SO", CHECK: "Check" },
  },
};

/** Everything the flights page renders, resolved for one locale. */
export type FlightsStrings = LocalStrings & {
  title: string;
  newFlight: string;
  searchPh: string;
  category: string;
  role: string;
  groupFlight: string;
  groupTime: string;
  groupInstrument: string;
  groupApproaches: string;
  groupRemarks: string;
  colDate: string;
  colAircraft: string;
  colReg: string;
  colRoute: string;
  colPic: string;
  colFo: string;
  colCheck: string;
  colDay: string;
  colNight: string;
  colTotal: string;
  colCfi: string;
  colPrec: string;
  colNonPrec: string;
  colHolds: string;
  colRemarks: string;
  edit: string;
  emptyTitle: string;
  emptyBody: string;
  addFlight: string;
  importCsv: string;
  augNote: string;
};

/** `{name}`-style interpolation; unknown placeholders are left as-is. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function getFlightsStrings(locale: Locale): FlightsStrings {
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  return {
    ...(LOCAL[locale] ?? LOCAL.en),
    title: t("flights.title"),
    // Legacy label carries a leading "+ " in some locales; the button has its own icon.
    newFlight: t("flights.new").replace(/^\+\s*/, ""),
    searchPh: t("flights.searchPh"),
    category: t("form.category"),
    role: t("form.role"),
    groupFlight: t("form.section.flight"),
    groupTime: t("form.section.time"),
    groupInstrument: t("bd.instrument"),
    groupApproaches: t("bd.approaches"),
    groupRemarks: t("form.remarks"),
    colDate: t("flights.date"),
    colAircraft: t("flights.makeModel"),
    colReg: t("flights.reg"),
    colRoute: t("flights.route"),
    colPic: t("flights.pic"),
    colFo: t("role.fo"),
    colCheck: t("role.check"),
    colDay: t("flights.day"),
    colNight: t("flights.night"),
    colTotal: t("flights.total"),
    colCfi: t("col.cfi"),
    colPrec: t("col.prec"),
    colNonPrec: t("col.nonPrec"),
    colHolds: t("col.holds"),
    colRemarks: t("form.remarks"),
    edit: t("common.edit"),
    emptyTitle: t("dash.empty.title"),
    emptyBody: t("dash.empty.body"),
    addFlight: t("dash.empty.addFlight"),
    importCsv: t("dash.empty.importCsv"),
    augNote: t("dash.augCreditNote"),
  };
}
