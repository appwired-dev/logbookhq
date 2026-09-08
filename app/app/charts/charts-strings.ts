import { translate, type Locale } from "@/lib/i18n";

/**
 * Strings for the charts page.
 *
 * Existing keys are pulled from lib/i18n.ts via `translate()`. Strings
 * introduced by the Phase 3 charts redesign live in the local map below (all
 * four locales) and should be folded into lib/i18n.ts in a later pass.
 */

export type GlobeStrings = {
  /** aria-label of the focusable globe stage. */
  stageLabel: string;
  /** aria-describedby hint: keyboard controls. */
  stageHint: string;
  tapToExplore: string;
  done: string;
  pauseRotation: string;
  resumeRotation: string;
  resetView: string;
  topRoutes: string;
  allTimeFlights: string;
  /** `{routes}` / `{airports}` are interpolated. */
  routesAirports: string;
  /** `{n}` is interpolated. */
  flightOne: string;
  flightMany: string;
  /** `{flights}` (already pluralised) / `{km}` are interpolated. */
  greatCircle: string;
  /** `{n}` is interpolated. */
  km: string;
  /** Legend for mouse users. */
  legend: string;
  /** Legend on coarse pointers before the globe is armed. */
  legendTouch: string;
  /** Legend on coarse pointers once the globe is armed. */
  legendTouchArmed: string;
  loading: string;
};

type LocalStrings = {
  subtitle: string;
  hoursUnit: string;
  mapEyebrow: string;
  mapEmptyTitle: string;
  mapEmptyBody: string;
  flowEyebrow: string;
  flowTitle: string;
  /** `{years}` / `{aircraft}` / `{roles}` are interpolated. */
  flowMeta: string;
  /** `{n}` / `{other}` are interpolated. */
  flowMerged: string;
  otherTypes: string;
  flowHint: string;
  flowEmptyTitle: string;
  flowEmptyBody: string;
  typesEyebrow: string;
  /** `{n}` / `{hours}` are interpolated. */
  typesMeta: string;
  viewAsTable: string;
  viewAsChart: string;
  colType: string;
  colHours: string;
  colShare: string;
  rollingEyebrow: string;
  /** `{peak}` / `{ceiling}` / `{reference}` are interpolated. */
  rollingCaption: string;
  /** Label on the ceiling line: `{reference}` / `{ceiling}` are interpolated. */
  ceilingLabel: string;
  rollingEmptyTitle: string;
  rollingEmptyBody: string;
  globe: GlobeStrings;
};

const LOCAL: Record<Locale, LocalStrings> = {
  en: {
    subtitle: "Career-wide views of your logbook: routes, aircraft, roles and flight-time limits.",
    hoursUnit: "h",
    mapEyebrow: "Great-circle routes",
    mapEmptyTitle: "No routes to plot",
    mapEmptyBody: "Add ICAO or IATA codes to a flight's route and it will appear on the globe.",
    flowEyebrow: "Year → Aircraft → Role",
    flowTitle: "Career flow",
    flowMeta: "{years} years · {aircraft} aircraft · {roles} roles",
    flowMerged: "{n} minor types grouped as “{other}”",
    otherTypes: "Other types",
    flowHint: "Ribbon width is hours. Years run top to bottom in order; each aircraft sits beside the year it first appears. Hover a ribbon for the exact figure.",
    flowEmptyTitle: "Nothing to flow yet",
    flowEmptyBody: "Flights need an aircraft type and a crew role to appear here.",
    typesEyebrow: "Credited hours",
    typesMeta: "{n} types · {hours} h",
    viewAsTable: "View as table",
    viewAsChart: "View as chart",
    colType: "Aircraft type",
    colHours: "Hours",
    colShare: "Share",
    rollingEyebrow: "Flight-time limit",
    rollingCaption: "Peak {peak} h · ceiling {ceiling} h · {reference}",
    ceilingLabel: "{reference} · {ceiling} h",
    rollingEmptyTitle: "Not enough history yet",
    rollingEmptyBody: "The 365-day total starts one year after your first logged flight.",
    globe: {
      stageLabel: "Interactive flight globe",
      stageHint: "Use the arrow keys to rotate the globe. The buttons above pause rotation and reset the view.",
      tapToExplore: "Tap to explore the globe",
      done: "Done",
      pauseRotation: "Pause rotation",
      resumeRotation: "Resume rotation",
      resetView: "Reset view",
      topRoutes: "Top routes",
      allTimeFlights: "All-time flights",
      routesAirports: "{routes} routes · {airports} airports",
      flightOne: "{n} flight",
      flightMany: "{n} flights",
      greatCircle: "{flights} · {km} km great-circle",
      km: "{n} km",
      legend: "Arc width = flights · dot size = traffic · drag to spin · scroll to zoom",
      legendTouch: "Arc width = flights · dot size = traffic",
      legendTouchArmed: "Drag to spin · pinch to zoom",
      loading: "Loading globe…",
    },
  },
  ko: {
    subtitle: "항로, 기종, 역할, 비행시간 제한까지 경력 전체를 한눈에 봅니다.",
    hoursUnit: "시간",
    mapEyebrow: "대권 항로",
    mapEmptyTitle: "표시할 항로가 없습니다",
    mapEmptyBody: "비행 경로에 ICAO 또는 IATA 코드를 입력하면 지구본에 표시됩니다.",
    flowEyebrow: "연도 → 기종 → 역할",
    flowTitle: "경력 흐름",
    flowMeta: "{years}개 연도 · 기종 {aircraft}종 · 역할 {roles}개",
    flowMerged: "소수 기종 {n}종은 “{other}”로 묶음",
    otherTypes: "기타 기종",
    flowHint: "리본 너비는 비행시간입니다. 연도는 위에서 아래로 순서대로 배치되고, 각 기종은 처음 등장한 연도 옆에 놓입니다. 리본에 마우스를 올리면 정확한 값을 볼 수 있습니다.",
    flowEmptyTitle: "아직 표시할 흐름이 없습니다",
    flowEmptyBody: "기종과 승무원 역할이 입력된 비행만 여기에 표시됩니다.",
    typesEyebrow: "인정 시간",
    typesMeta: "기종 {n}종 · {hours}시간",
    viewAsTable: "표로 보기",
    viewAsChart: "차트로 보기",
    colType: "기종",
    colHours: "시간",
    colShare: "비율",
    rollingEyebrow: "비행시간 제한",
    rollingCaption: "최고 {peak}시간 · 상한 {ceiling}시간 · {reference}",
    ceilingLabel: "{reference} · {ceiling}시간",
    rollingEmptyTitle: "아직 기록이 충분하지 않습니다",
    rollingEmptyBody: "365일 누적 합계는 첫 비행 기록으로부터 1년 후부터 표시됩니다.",
    globe: {
      stageLabel: "인터랙티브 비행 지구본",
      stageHint: "화살표 키로 지구본을 회전할 수 있습니다. 위의 버튼으로 회전을 멈추거나 시점을 초기화합니다.",
      tapToExplore: "탭하여 지구본 탐색",
      done: "완료",
      pauseRotation: "회전 일시정지",
      resumeRotation: "회전 재개",
      resetView: "시점 초기화",
      topRoutes: "주요 항로",
      allTimeFlights: "전체 비행",
      routesAirports: "항로 {routes}개 · 공항 {airports}개",
      flightOne: "비행 {n}회",
      flightMany: "비행 {n}회",
      greatCircle: "{flights} · 대권거리 {km} km",
      km: "{n} km",
      legend: "호 두께 = 비행 횟수 · 점 크기 = 교통량 · 드래그로 회전 · 스크롤로 확대",
      legendTouch: "호 두께 = 비행 횟수 · 점 크기 = 교통량",
      legendTouchArmed: "드래그로 회전 · 핀치로 확대",
      loading: "지구본 불러오는 중…",
    },
  },
  zh: {
    subtitle: "从航线、机型、角色到飞行时间限制，纵览整个飞行生涯。",
    hoursUnit: "小时",
    mapEyebrow: "大圆航线",
    mapEmptyTitle: "没有可绘制的航线",
    mapEmptyBody: "在飞行航线中填写 ICAO 或 IATA 代码，即可在地球仪上显示。",
    flowEyebrow: "年份 → 机型 → 角色",
    flowTitle: "生涯流向",
    flowMeta: "{years} 个年份 · {aircraft} 种机型 · {roles} 种角色",
    flowMerged: "{n} 种次要机型归入“{other}”",
    otherTypes: "其他机型",
    flowHint: "色带宽度代表小时数。年份自上而下按顺序排列，每种机型位于其首次出现的年份旁。将鼠标悬停在色带上可查看精确数值。",
    flowEmptyTitle: "暂无可显示的流向",
    flowEmptyBody: "只有填写了机型和机组角色的飞行才会显示在这里。",
    typesEyebrow: "计入小时",
    typesMeta: "{n} 种机型 · {hours} 小时",
    viewAsTable: "以表格查看",
    viewAsChart: "以图表查看",
    colType: "机型",
    colHours: "小时",
    colShare: "占比",
    rollingEyebrow: "飞行时间限制",
    rollingCaption: "峰值 {peak} 小时 · 上限 {ceiling} 小时 · {reference}",
    ceilingLabel: "{reference} · {ceiling} 小时",
    rollingEmptyTitle: "记录还不够",
    rollingEmptyBody: "365 天滚动总计从首次记录飞行一年后开始显示。",
    globe: {
      stageLabel: "交互式飞行地球仪",
      stageHint: "使用方向键旋转地球仪。上方按钮可暂停旋转或重置视角。",
      tapToExplore: "点按以探索地球仪",
      done: "完成",
      pauseRotation: "暂停旋转",
      resumeRotation: "继续旋转",
      resetView: "重置视角",
      topRoutes: "热门航线",
      allTimeFlights: "全部飞行",
      routesAirports: "{routes} 条航线 · {airports} 个机场",
      flightOne: "{n} 次飞行",
      flightMany: "{n} 次飞行",
      greatCircle: "{flights} · 大圆距离 {km} 公里",
      km: "{n} 公里",
      legend: "弧线粗细 = 飞行次数 · 圆点大小 = 流量 · 拖动旋转 · 滚动缩放",
      legendTouch: "弧线粗细 = 飞行次数 · 圆点大小 = 流量",
      legendTouchArmed: "拖动旋转 · 双指缩放",
      loading: "正在加载地球仪…",
    },
  },
  es: {
    subtitle: "Vistas de toda tu carrera: rutas, aeronaves, funciones y límites de tiempo de vuelo.",
    hoursUnit: "h",
    mapEyebrow: "Rutas ortodrómicas",
    mapEmptyTitle: "No hay rutas que trazar",
    mapEmptyBody: "Añade códigos ICAO o IATA a la ruta de un vuelo y aparecerá en el globo.",
    flowEyebrow: "Año → Aeronave → Función",
    flowTitle: "Flujo de carrera",
    flowMeta: "{years} años · {aircraft} aeronaves · {roles} funciones",
    flowMerged: "{n} tipos menores agrupados como «{other}»",
    otherTypes: "Otros tipos",
    flowHint: "El ancho de la cinta son horas. Los años van de arriba abajo en orden; cada aeronave se sitúa junto al año en que aparece por primera vez. Pasa el cursor sobre una cinta para ver la cifra exacta.",
    flowEmptyTitle: "Aún no hay flujo que mostrar",
    flowEmptyBody: "Los vuelos necesitan un tipo de aeronave y una función de tripulación para aparecer aquí.",
    typesEyebrow: "Horas acreditadas",
    typesMeta: "{n} tipos · {hours} h",
    viewAsTable: "Ver como tabla",
    viewAsChart: "Ver como gráfico",
    colType: "Tipo de aeronave",
    colHours: "Horas",
    colShare: "Proporción",
    rollingEyebrow: "Límite de tiempo de vuelo",
    rollingCaption: "Pico {peak} h · techo {ceiling} h · {reference}",
    ceilingLabel: "{reference} · {ceiling} h",
    rollingEmptyTitle: "Aún no hay historial suficiente",
    rollingEmptyBody: "El total móvil de 365 días empieza un año después de tu primer vuelo registrado.",
    globe: {
      stageLabel: "Globo de vuelos interactivo",
      stageHint: "Usa las teclas de flecha para girar el globo. Los botones de arriba pausan la rotación y restablecen la vista.",
      tapToExplore: "Toca para explorar el globo",
      done: "Listo",
      pauseRotation: "Pausar rotación",
      resumeRotation: "Reanudar rotación",
      resetView: "Restablecer vista",
      topRoutes: "Rutas principales",
      allTimeFlights: "Vuelos de toda la carrera",
      routesAirports: "{routes} rutas · {airports} aeropuertos",
      flightOne: "{n} vuelo",
      flightMany: "{n} vuelos",
      greatCircle: "{flights} · {km} km ortodrómicos",
      km: "{n} km",
      legend: "Grosor del arco = vuelos · tamaño del punto = tráfico · arrastra para girar · desplaza para acercar",
      legendTouch: "Grosor del arco = vuelos · tamaño del punto = tráfico",
      legendTouchArmed: "Arrastra para girar · pellizca para acercar",
      loading: "Cargando globo…",
    },
  },
};

/** Everything the charts page renders, resolved for one locale. */
export type ChartsStrings = LocalStrings & {
  title: string;
  mapTitle: string;
  rollingTitle: string;
  typesTitle: string;
  augNote: string;
  emptyTitle: string;
  emptyBody: string;
  addFlight: string;
  importCsv: string;
};

/** `{name}`-style interpolation; unknown placeholders are left as-is. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function getChartsStrings(locale: Locale): ChartsStrings {
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  return {
    ...(LOCAL[locale] ?? LOCAL.en),
    title: t("charts.title"),
    mapTitle: t("charts.flightMap"),
    rollingTitle: t("charts.rolling"),
    typesTitle: t("charts.hoursPerType"),
    augNote: t("charts.augCreditNote"),
    emptyTitle: t("dash.empty.title"),
    emptyBody: t("charts.emptyState"),
    addFlight: t("dash.empty.addFlight"),
    importCsv: t("dash.empty.importCsv"),
  };
}
