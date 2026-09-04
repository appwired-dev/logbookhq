/**
 * Custom i18n: zero-dependency translation system.
 *
 * Why custom over next-intl/react-i18next: this app's translation surface is
 * modest (~170 strings), the locale doesn't change per-page (cookie-scoped,
 * not URL-scoped), and we want server-components to use the same helper
 * without extra context plumbing.
 *
 * This file is safe to import from Client Components — it has no server-only
 * dependencies. For the server-side `getT()` / `getLocale()` helpers (which
 * read cookies), import from `lib/i18n-server.ts`.
 */

export type Locale = "en" | "ko" | "zh" | "es";
export const LOCALES: Locale[] = ["en", "ko", "zh", "es"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "logbookhq.locale";

/** Display labels for each locale, shown in the locale switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ko: "한국어",
  zh: "简体中文",
  es: "Español",
};

const TRANSLATIONS = {
  // Navigation
  "nav.dashboard":  { en: "Dashboard",  ko: "대시보드", zh: "仪表板",     es: "Panel" },
  "nav.flights":    { en: "Flights",    ko: "비행",     zh: "飞行",       es: "Vuelos" },
  "nav.charts":     { en: "Charts",     ko: "차트",     zh: "图表",       es: "Gráficos" },
  "nav.badges":     { en: "Badges",     ko: "배지",     zh: "徽章",       es: "Insignias" },
  "nav.documents":  { en: "Documents",  ko: "문서",     zh: "文档",       es: "Documentos" },
  "nav.export":     { en: "Export",     ko: "내보내기", zh: "导出",       es: "Exportar" },
  "nav.import":     { en: "Import",     ko: "가져오기", zh: "导入",       es: "Importar" },
  "nav.transfer":   { en: "Import & Export", ko: "가져오기 및 내보내기", zh: "导入与导出", es: "Importar y Exportar" },
  "nav.settings":   { en: "Settings",   ko: "설정",     zh: "设置",       es: "Ajustes" },
  "nav.admin":      { en: "Admin",      ko: "관리자",   zh: "管理员",     es: "Admin" },
  "nav.signOut":    { en: "Sign out",   ko: "로그아웃", zh: "退出登录",   es: "Cerrar sesión" },

  // Dashboard
  "dash.welcome":          { en: "Welcome back, {name}.",  ko: "다시 오신 것을 환영합니다, {name}님.", zh: "欢迎回来,{name}。", es: "Bienvenido de vuelta, {name}." },
  "dash.title":            { en: "Dashboard",              ko: "대시보드",   zh: "仪表板",      es: "Panel" },
  "dash.flightsAndHours":  { en: "{flights} flights · {hours} hours flown", ko: "비행 {flights}회 · 비행시간 {hours}시간", zh: "{flights} 次飞行 · {hours} 飞行小时", es: "{flights} vuelos · {hours} horas voladas" },
  "dash.totalTime":        { en: "Total Time",             ko: "총 비행시간", zh: "总飞行时间",  es: "Tiempo Total" },
  "dash.pic":              { en: "PIC",                    ko: "기장 (PIC)", zh: "机长 (PIC)",  es: "Piloto al Mando (PIC)" },
  "dash.fo":               { en: "FO",                     ko: "부기장 (FO)", zh: "副驾驶 (FO)", es: "Copiloto (FO)" },
  // Secondary-stat tiles for migration 0009 additions.
  "dash.holds":            { en: "Holds",                  ko: "홀딩",       zh: "等待航线",    es: "Esperas" },
  "dash.cfiTime":          { en: "CFI Time",               ko: "교관 시간",  zh: "教官时间",    es: "Tiempo CFI" },
  "dash.ses":              { en: "SES",                    ko: "SES",        zh: "SES",         es: "SES" },
  "dash.mes":              { en: "MES",                    ko: "MES",        zh: "MES",         es: "MES" },
  "dash.heli":             { en: "Helicopter",             ko: "헬리콥터",   zh: "直升机",      es: "Helicóptero" },
  "role.fo":               { en: "FO",                     ko: "부기장",     zh: "副驾驶",      es: "Copiloto" },
  // Used in the role dropdown — keeps the name-field label "Co-Pilot" intact
  // while making clear in the dropdown that FO = first officer = co-pilot.
  "role.foCopilot":        { en: "FO / Co-Pilot",          ko: "부기장 (FO/Co-Pilot)", zh: "副驾驶 (FO/Co-Pilot)", es: "Copiloto (FO/Co-Pilot)" },
  "role.dual":             { en: "Dual",                   ko: "교육",       zh: "教学",        es: "Doble Mando" },
  "role.so":               { en: "SO / Aug",               ko: "보조",       zh: "辅助驾驶",    es: "SO / Aux" },
  "role.check":            { en: "Check",                  ko: "검열",       zh: "检查",        es: "Examinador" },
  "dash.crossCountry":     { en: "Cross-Country",          ko: "장거리",     zh: "越野",        es: "Travesía" },
  "dash.instrument":       { en: "Instrument",             ko: "계기",       zh: "仪表",        es: "Instrumentos" },
  "dash.singleEngine":     { en: "Single Engine",          ko: "단발",       zh: "单发",        es: "Monomotor" },
  "dash.multiEngine":      { en: "Multi-Engine",           ko: "쌍발",       zh: "多发",        es: "Multimotor" },
  "dash.ifrApproaches":    { en: "IFR Approaches",         ko: "계기 접근",  zh: "仪表进近",    es: "Aproximaciones IFR" },
  "dash.sim":              { en: "Sim",                    ko: "시뮬레이터", zh: "模拟器",      es: "Simulador" },
  "dash.timeByAircraft":   { en: "Time by Aircraft Type",  ko: "기종별 비행시간", zh: "按机型分类时间", es: "Tiempo por Tipo de Aeronave" },
  "dash.sortedByHours":    { en: "sorted by hours",        ko: "비행시간 순", zh: "按小时排序",  es: "ordenado por horas" },
  "dash.upcomingExpiries": { en: "Upcoming document expiries", ko: "문서 만료 예정", zh: "即将到期的文档", es: "Documentos por vencer" },
  "dash.manage":           { en: "Manage",               ko: "관리",     zh: "管理",      es: "Gestionar" },
  "dash.expiredAgo":       { en: "EXP {days}d ago",        ko: "{days}일 전 만료", zh: "{days} 天前过期", es: "Vencido hace {days}d" },
  "dash.daysLeft":         { en: "{days}d",                ko: "{days}일",   zh: "{days}天",    es: "{days}d" },
  "dash.empty.title":      { en: "No flights yet",         ko: "비행 기록 없음", zh: "暂无飞行记录", es: "Aún no hay vuelos" },
  "dash.empty.body":       { en: "Add your first flight, or import a CSV from your existing logbook to get started.", ko: "첫 비행을 추가하거나 기존 로그북 CSV를 가져와서 시작하세요.", zh: "添加您的第一次飞行,或从现有日志本导入 CSV 开始使用。", es: "Agregue su primer vuelo, o importe un CSV de su bitácora existente para comenzar." },
  "dash.empty.addFlight":  { en: "Add a flight",           ko: "비행 추가",  zh: "添加飞行",    es: "Agregar vuelo" },
  "dash.empty.importCsv":  { en: "Import CSV",             ko: "CSV 가져오기", zh: "导入 CSV",    es: "Importar CSV" },

  // Flight-time limits (CARs / FAA / ICAO / EASA)
  "regime.canada":         { en: "Canada",                 ko: "캐나다",     zh: "加拿大",      es: "Canadá" },
  "regime.icao":           { en: "ICAO",                   ko: "ICAO",       zh: "ICAO",        es: "OACI" },
  "regime.usa":            { en: "United States",          ko: "미국",       zh: "美国",        es: "Estados Unidos" },
  "regime.europe":         { en: "Europe",                 ko: "유럽",       zh: "欧洲",        es: "Europa" },
  "regime.uk":             { en: "United Kingdom",         ko: "영국",       zh: "英国",        es: "Reino Unido" },
  "regime.uae":            { en: "United Arab Emirates",   ko: "아랍에미리트", zh: "阿联酋",      es: "Emiratos Árabes Unidos" },
  "regime.saudi":          { en: "Saudi Arabia",           ko: "사우디아라비아", zh: "沙特阿拉伯", es: "Arabia Saudita" },
  "regime.qatar":          { en: "Qatar",                  ko: "카타르",     zh: "卡塔尔",      es: "Catar" },
  "regime.hk":             { en: "Hong Kong",              ko: "홍콩",       zh: "香港",        es: "Hong Kong" },
  "regime.china":          { en: "China",                  ko: "중국",       zh: "中国",        es: "China" },

  // Recency (IFR + PAX) panels
  "recency.title":         { en: "Recency",                ko: "최근 비행",  zh: "近期记录",    es: "Recencia" },
  "recency.ifr":           { en: "IFR Currency",           ko: "계기 비행 자격", zh: "仪表飞行资格", es: "Vigencia IFR" },
  "recency.paxDay":        { en: "Day Passengers",         ko: "주간 승객",  zh: "白天载客",    es: "Pasajeros (Día)" },
  "recency.paxNight":      { en: "Night Passengers",       ko: "야간 승객",  zh: "夜间载客",    es: "Pasajeros (Noche)" },
  "recency.current":       { en: "Current",                ko: "유효",       zh: "有效",        es: "Vigente" },
  "recency.notCurrent":    { en: "Not current",            ko: "만료됨",     zh: "已失效",      es: "No vigente" },
  "recency.progress":      { en: "{achieved} / {required} in {days} days", ko: "{days}일 내 {achieved} / {required}", zh: "{days} 天内 {achieved} / {required}", es: "{achieved} / {required} en {days} días" },
  "recency.expiresIn":     { en: "Expires in {days}d",     ko: "{days}일 후 만료", zh: "{days} 天后到期", es: "Vence en {days}d" },
  "limits.title":          { en: "{regime} Flight Time Limits", ko: "{regime} 비행시간 제한", zh: "{regime}飞行时间限制", es: "Límites de Tiempo de Vuelo de {regime}" },
  "limits.lastDays":       { en: "Last {n} Days",          ko: "최근 {n}일", zh: "最近 {n} 天", es: "Últimos {n} días" },
  "limits.since":          { en: "since {date}",           ko: "{date} 이후", zh: "自 {date}",   es: "desde {date}" },
  "limits.hrs":            { en: "hrs",                    ko: "시간",       zh: "小时",        es: "h" },

  // Breakdown tables
  "bd.crossCountry":       { en: "Cross-Country",          ko: "장거리",     zh: "越野",        es: "Travesía" },
  "bd.instrument":         { en: "Instrument",             ko: "계기",       zh: "仪表",        es: "Instrumentos" },
  "bd.dualDay":            { en: "Dual (Day)",             ko: "교육 (주간)", zh: "教学 (白天)", es: "Doble (Día)" },
  "bd.picDay":             { en: "PIC (Day)",              ko: "기장 (주간)", zh: "机长 (白天)", es: "PIC (Día)" },
  "bd.foDay":              { en: "FO (Day)",               ko: "부기장 (주간)", zh: "副驾驶 (白天)", es: "Copiloto (Día)" },
  "bd.soDay":              { en: "SO / Aug (Day)",         ko: "보조 (주간)", zh: "辅助驾驶 (白天)", es: "SO / Aux (Día)" },
  "bd.checkDay":           { en: "Check (Day)",            ko: "검열 (주간)", zh: "检查 (白天)", es: "Examinador (Día)" },
  "bd.dayTotal":           { en: "Day Total",              ko: "주간 합계",  zh: "白天总计",    es: "Total Día" },
  "bd.dualNight":          { en: "Dual (Night)",           ko: "교육 (야간)", zh: "教学 (夜间)", es: "Doble (Noche)" },
  "bd.picNight":           { en: "PIC (Night)",            ko: "기장 (야간)", zh: "机长 (夜间)", es: "PIC (Noche)" },
  "bd.foNight":            { en: "FO (Night)",             ko: "부기장 (야간)", zh: "副驾驶 (夜间)", es: "Copiloto (Noche)" },
  "bd.soNight":            { en: "SO / Aug (Night)",       ko: "보조 (야간)", zh: "辅助驾驶 (夜间)", es: "SO / Aux (Noche)" },
  "bd.checkNight":         { en: "Check (Night)",          ko: "검열 (야간)", zh: "检查 (夜间)", es: "Examinador (Noche)" },
  "bd.nightTotal":         { en: "Night Total",            ko: "야간 합계",  zh: "夜间总计",    es: "Total Noche" },
  "bd.seTotal":            { en: "SE Total",               ko: "단발 합계",  zh: "单发总计",    es: "Total Monomotor" },
  "bd.meTotal":            { en: "ME Total",               ko: "쌍발 합계",  zh: "多发总计",    es: "Total Multimotor" },
  "bd.xcTotal":            { en: "XC Total",               ko: "장거리 합계", zh: "越野总计",    es: "Total Travesía" },
  "bd.instTotal":          { en: "Inst Total",             ko: "계기 합계",  zh: "仪表总计",    es: "Total Instr." },
  "bd.day":                { en: "Day",                    ko: "주간",       zh: "白天",        es: "Día" },
  "bd.night":              { en: "Night",                  ko: "야간",       zh: "夜间",        es: "Noche" },
  "bd.actual":             { en: "Actual",                 ko: "실제",       zh: "实际",        es: "Real" },
  "bd.hood":               { en: "Hood",                   ko: "후드",       zh: "盲飞罩",      es: "Capucha" },
  "bd.sim":                { en: "Sim",                    ko: "시뮬레이터", zh: "模拟器",      es: "Simulador" },
  "bd.approaches":         { en: "Approaches",             ko: "접근",       zh: "进近",        es: "Aproximaciones" },
  "bd.byRoleDual":         { en: "By Role: Dual",          ko: "역할별: 교육", zh: "按角色: 教学", es: "Por rol: Doble" },
  "bd.byRolePic":          { en: "By Role: PIC",           ko: "역할별: 기장", zh: "按角色: 机长", es: "Por rol: PIC" },
  "bd.byRoleFo":           { en: "By Role: FO",            ko: "역할별: 부기장", zh: "按角色: 副驾驶", es: "Por rol: Copiloto" },
  "bd.byRoleSo":           { en: "By Role: SO/Aug",        ko: "역할별: 보조", zh: "按角色: 辅助", es: "Por rol: SO/Aux" },
  "bd.byRoleCheck":        { en: "By Role: Check",         ko: "역할별: 검열", zh: "按角色: 检查", es: "Por rol: Examinador" },

  // Export PDF page
  "export.title":          { en: "Export PDF",             ko: "PDF 내보내기", zh: "导出 PDF",    es: "Exportar PDF" },
  "export.subtitle":       { en: "Cover · 18-column flight pages · grand-totals summary. For ATPL verification, job applications, medical, recurrent paperwork.", ko: "표지 · 18칸 비행 페이지 · 총계 요약. ATPL 검증, 취업 지원, 신체검사, 정기 교육 서류용.", zh: "封面 · 18 列飞行页面 · 总计摘要。适用于 ATPL 验证、求职申请、体检、复训文档。", es: "Portada · páginas de vuelo de 18 columnas · resumen de totales. Para verificación ATPL, solicitudes de empleo, médico, papeleo recurrente." },
  "export.pilotName":      { en: "Pilot Name",             ko: "조종사 이름", zh: "飞行员姓名",  es: "Nombre del Piloto" },
  "export.licenseOpt":     { en: "License # (optional)",   ko: "면허 번호 (선택)", zh: "执照号 (可选)", es: "N.º de Licencia (opcional)" },
  "export.fromDate":       { en: "From Date",              ko: "시작 날짜",  zh: "起始日期",    es: "Fecha Desde" },
  "export.toDate":         { en: "To Date",                ko: "종료 날짜",  zh: "结束日期",    es: "Fecha Hasta" },
  "export.inRange":        { en: "{flights} flights in range · {hours} hrs total", ko: "범위 내 {flights}회 비행 · 총 {hours}시간", zh: "范围内 {flights} 次飞行 · 共 {hours} 小时", es: "{flights} vuelos en el rango · {hours} h en total" },
  "export.generate":       { en: "Generate PDF (opens in new tab)", ko: "PDF 생성 (새 탭에서 열림)", zh: "生成 PDF (在新标签页中打开)", es: "Generar PDF (se abre en nueva pestaña)" },
  "export.generating":     { en: "Generating…",            ko: "생성 중…",   zh: "正在生成…",   es: "Generando…" },
  "export.licensePh":      { en: "ATPL #...",              ko: "ATPL 번호...", zh: "ATPL 编号...", es: "N.º ATPL..." },

  // Import page
  "import.title":          { en: "Import flights",         ko: "비행 가져오기", zh: "导入飞行",    es: "Importar vuelos" },
  "import.subtitle":       { en: "Auto-detects the export format. Supported: Pilot Logbook HQ (round-trip), ForeFlight, LogTen Pro, MyFlightbook, and Numbers-exported logbooks (both the legacy and the multi-header layout). Role / category / day-night split are derived from whatever columns the source file provides.", ko: "내보내기 형식을 자동 감지합니다. 지원: Pilot Logbook HQ (왕복), ForeFlight, LogTen Pro, MyFlightbook, 그리고 Numbers 형식 로그북 (구형 및 다중 헤더 형식 모두). 역할, 구분, 주간/야간 구분은 소스 파일의 컬럼에서 자동으로 도출됩니다.", zh: "自动检测导出格式。支持: Pilot Logbook HQ(往返)、ForeFlight、LogTen Pro、MyFlightbook 和 Numbers 导出的日志本(包括旧版与多行表头版)。角色、类别、白天/夜间划分根据源文件提供的列自动推断。", es: "Detecta automáticamente el formato de exportación. Compatible: Pilot Logbook HQ (ida y vuelta), ForeFlight, LogTen Pro, MyFlightbook y bitácoras exportadas desde Numbers (versión antigua y con encabezado de varias filas). Rol / categoría / división día-noche se derivan de las columnas que proporcione el archivo origen." },
  "import.csvFile":        { en: "CSV File",               ko: "CSV 파일",   zh: "CSV 文件",    es: "Archivo CSV" },
  "import.selected":       { en: "Selected: {name} · {size} KB", ko: "선택됨: {name} · {size} KB", zh: "已选择: {name} · {size} KB", es: "Seleccionado: {name} · {size} KB" },
  "import.replace":        { en: "Replace existing data",  ko: "기존 데이터 교체", zh: "替换现有数据", es: "Reemplazar datos existentes" },
  "import.replaceHint":    { en: " — deletes all my flights before importing. Leave unchecked to append.", ko: " — 가져오기 전에 모든 비행을 삭제합니다. 해제하면 추가됩니다.", zh: " — 导入前删除所有飞行记录。取消勾选则追加。", es: " — elimina todos los vuelos antes de importar. Desactive para añadir." },
  "import.pickFirst":      { en: "Pick a CSV file first.", ko: "먼저 CSV 파일을 선택하세요.", zh: "请先选择 CSV 文件。", es: "Seleccione primero un archivo CSV." },
  "import.button":         { en: "Import",                 ko: "가져오기",   zh: "导入",        es: "Importar" },
  "import.importing":      { en: "Importing…",             ko: "가져오는 중…", zh: "正在导入…",   es: "Importando…" },
  "import.logbookhq":      { en: "Pilot Logbook HQ: a CSV we exported ourselves. Lossless round-trip (except duty_time, which isn't tracked by the importer).", ko: "Pilot Logbook HQ: 자체 내보낸 CSV. 무손실 왕복 (단, duty_time은 가져오지 않음).", zh: "Pilot Logbook HQ: 我们自己导出的 CSV。无损往返(duty_time 字段不会被导入)。", es: "Pilot Logbook HQ: CSV exportado por nosotros mismos. Ida y vuelta sin pérdida (excepto duty_time, que el importador no rastrea)." },
  "import.foreflight":     { en: "ForeFlight: two-section export (Aircraft Table + Flights Table) — uses the AircraftID column to look up type.", ko: "ForeFlight: 두 섹션 내보내기 (Aircraft Table + Flights Table) — AircraftID 컬럼으로 기종 조회.", zh: "ForeFlight: 双区段导出 (Aircraft Table + Flights Table) — 通过 AircraftID 列查找机型。", es: "ForeFlight: exportación de dos secciones (Aircraft Table + Flights Table) — usa la columna AircraftID para buscar el tipo." },
  "import.logten":         { en: "LogTen Pro: single-table CSV with flight_*-prefixed columns.", ko: "LogTen Pro: flight_* 접두 컬럼이 있는 단일 테이블 CSV.", zh: "LogTen Pro: 单表 CSV,列名带有 flight_* 前缀。", es: "LogTen Pro: CSV de una sola tabla con columnas prefijadas con flight_*." },
  "import.myflightbook":   { en: "MyFlightbook: human-named columns (Date, Tail Number, Aircraft, Total Flight Time, PIC, SIC, Night, …).", ko: "MyFlightbook: 사람이 읽기 좋은 컬럼명 (Date, Tail Number, Aircraft, Total Flight Time, PIC, SIC, Night, …).", zh: "MyFlightbook: 人类可读的列名 (Date, Tail Number, Aircraft, Total Flight Time, PIC, SIC, Night, …)。", es: "MyFlightbook: columnas con nombres legibles (Date, Tail Number, Aircraft, Total Flight Time, PIC, SIC, Night, …)." },

  // Documents page
  "docs.title":            { en: "Document Vault",         ko: "문서 보관함", zh: "文档保险库",  es: "Bóveda de Documentos" },
  "docs.subtitle":         { en: "Medical, licenses, type ratings, recurrent. Expiry tracking on every file.", ko: "신체검사, 면허, 기종 한정, 정기 교육. 모든 파일에 만료일 추적.", zh: "体检、执照、机型等级、复训。每个文件都追踪到期日期。", es: "Médico, licencias, habilitaciones de tipo, recurrente. Seguimiento de vencimiento en cada archivo." },
  "docs.add":              { en: "+ Add Document",         ko: "+ 문서 추가", zh: "+ 添加文档",  es: "+ Agregar Documento" },
  "docs.cancel":           { en: "Cancel",                 ko: "취소",       zh: "取消",        es: "Cancelar" },
  "docs.new":              { en: "New document",           ko: "새 문서",    zh: "新文档",      es: "Nuevo documento" },
  "docs.type":             { en: "Type",                   ko: "유형",       zh: "类型",        es: "Tipo" },
  "docs.name":             { en: "Name / Description",     ko: "이름 / 설명", zh: "名称 / 描述", es: "Nombre / Descripción" },
  "docs.namePh":           { en: "Category 1 Medical, ATPL, EA32 Type Rating...", ko: "1종 신체검사, ATPL, EA32 기종 한정...", zh: "一类体检、ATPL、EA32 机型等级...", es: "Médico Clase 1, ATPL, Habilitación de Tipo EA32..." },
  "docs.reference":        { en: "Reference",              ko: "참조 번호",  zh: "参考编号",    es: "Referencia" },
  "docs.referencePh":      { en: "License # / medical # / etc.", ko: "면허 번호 / 신체검사 번호 등", zh: "执照号 / 体检号等", es: "N.º de licencia / N.º médico / etc." },
  "docs.issued":           { en: "Issued",                 ko: "발급일",     zh: "签发日期",    es: "Emitido" },
  "docs.expires":          { en: "Expires",                ko: "만료일",     zh: "到期日期",    es: "Vence" },
  "docs.notes":            { en: "Notes",                  ko: "메모",       zh: "备注",        es: "Notas" },
  "docs.notesPh":          { en: "Optional",               ko: "선택 사항",  zh: "可选",        es: "Opcional" },
  "docs.file":             { en: "File (PDF or image, max 10 MB)", ko: "파일 (PDF 또는 이미지, 최대 10 MB)", zh: "文件 (PDF 或图像,最大 10 MB)", es: "Archivo (PDF o imagen, máx. 10 MB)" },
  "docs.uploading":        { en: "Uploading…",             ko: "업로드 중…", zh: "正在上传…",   es: "Subiendo…" },
  "docs.save":             { en: "Save",                   ko: "저장",       zh: "保存",        es: "Guardar" },
  "docs.empty.title":      { en: "No documents yet",       ko: "아직 문서가 없습니다", zh: "暂无文档", es: "Aún no hay documentos" },
  "docs.empty.body":       { en: "Add your medical, licenses, type ratings, IPC, recurrent records.", ko: "신체검사, 면허, 기종 한정, IPC, 정기 교육 기록을 추가하세요.", zh: "添加您的体检、执照、机型等级、IPC、复训记录。", es: "Agregue su médico, licencias, habilitaciones de tipo, IPC, registros de recurrente." },
  "docs.delete":           { en: "Delete",                 ko: "삭제",       zh: "删除",        es: "Eliminar" },
  "docs.viewBtn":          { en: "View",                   ko: "보기",       zh: "查看",        es: "Ver" },
  "docs.deleteConfirm":    { en: "Delete \"{name}\"?",     ko: "\"{name}\" 삭제?", zh: "删除\"{name}\"?", es: "¿Eliminar \"{name}\"?" },
  "docs.expired":          { en: "Expired {days}d ago",    ko: "{days}일 전 만료", zh: "已过期 {days} 天", es: "Vencido hace {days}d" },
  "docs.daysLeft":         { en: "{days}d left",           ko: "{days}일 남음", zh: "剩余 {days} 天", es: "Quedan {days}d" },
  "docs.type.medical":     { en: "Medical Certificate",    ko: "신체 검사 증명서", zh: "体检证书",    es: "Certificado Médico" },
  "docs.type.license":     { en: "Pilot License",          ko: "조종사 면허", zh: "飞行员执照",  es: "Licencia de Piloto" },
  "docs.type.typeRating":  { en: "Type Rating",            ko: "기종 한정",  zh: "机型等级",    es: "Habilitación de Tipo" },
  "docs.type.ipc":         { en: "IPC",                    ko: "IPC",        zh: "IPC",         es: "IPC" },
  "docs.type.recurrent":   { en: "Recurrent Training",     ko: "정기 교육",  zh: "复训",        es: "Entrenamiento Recurrente" },
  "docs.type.passport":    { en: "Passport",               ko: "여권",       zh: "护照",        es: "Pasaporte" },
  "docs.type.visa":        { en: "Visa",                   ko: "비자",       zh: "签证",        es: "Visa" },
  "docs.type.other":       { en: "Other",                  ko: "기타",       zh: "其他",        es: "Otro" },

  // Flights table + form
  "flights.titleFull":     { en: "Flights",                ko: "비행 기록",  zh: "飞行记录",    es: "Vuelos" },
  "flights.searchPh":      { en: "Search make, reg, route, pilots, remarks…", ko: "기종, 등록번호, 항로, 조종사, 비고 검색…", zh: "搜索机型、注册号、航线、飞行员、备注…", es: "Buscar marca, matrícula, ruta, pilotos, observaciones…" },
  "flights.export":        { en: "Export PDF",             ko: "PDF 내보내기", zh: "导出 PDF",    es: "Exportar PDF" },
  "flights.import":        { en: "Import CSV",             ko: "CSV 가져오기", zh: "导入 CSV",    es: "Importar CSV" },
  "flights.totalCol":      { en: "Total",                  ko: "총합",       zh: "总计",        es: "Total" },
  "flights.makeModel":     { en: "Aircraft",               ko: "기종",       zh: "机型",        es: "Aeronave" },
  "flights.pic":           { en: "PIC",                    ko: "기장",       zh: "机长",        es: "PIC" },
  "flights.cop":           { en: "Co-Pilot",               ko: "부기장",     zh: "副驾驶",      es: "Copiloto" },
  "flights.empty":         { en: "No flights match.",      ko: "일치하는 비행이 없습니다.", zh: "无匹配的飞行记录。", es: "No hay vuelos que coincidan." },

  // Charts page
  "charts.flightMapSub":   { en: "{routes} unique routes · {airports} airports", ko: "고유 항로 {routes}개 · 공항 {airports}개", zh: "{routes} 条独特航线 · {airports} 个机场", es: "{routes} rutas únicas · {airports} aeropuertos" },
  "charts.years":          { en: "{years} years · peak {peak} hrs", ko: "{years}년 · 최고 {peak}시간", zh: "{years} 年 · 峰值 {peak} 小时", es: "{years} años · pico {peak} h" },
  "charts.types":          { en: "{n} types",              ko: "{n}개 기종", zh: "{n} 种机型",  es: "{n} tipos" },
  "charts.rollingPeak":    { en: "Peak {peak} hrs · CARs ceiling 1200", ko: "최고 {peak}시간 · CARs 상한 1200", zh: "峰值 {peak} 小时 · CARs 上限 1200", es: "Pico {peak} h · techo CARs 1200" },
  "charts.calDays":        { en: "{year} · {days} flying days", ko: "{year} · 비행일 {days}일", zh: "{year} · {days} 个飞行日", es: "{year} · {days} días de vuelo" },
  "charts.emptyState":     { en: "No flights yet. Import a CSV to see charts.", ko: "비행 기록이 없습니다. CSV를 가져와서 차트를 확인하세요.", zh: "暂无飞行记录。导入 CSV 以查看图表。", es: "Aún no hay vuelos. Importe un CSV para ver los gráficos." },

  // Settings page
  "settings.title":        { en: "Settings",               ko: "설정",       zh: "设置",        es: "Ajustes" },
  "settings.profile":      { en: "Profile",                ko: "프로필",     zh: "个人资料",    es: "Perfil" },
  "settings.fullName":     { en: "Full Name",              ko: "이름",       zh: "姓名",        es: "Nombre Completo" },
  "settings.licenseNum":   { en: "License Number",         ko: "면허 번호",  zh: "执照号",      es: "Número de Licencia" },
  "settings.primaryRegime": { en: "Primary Regulatory Regime", ko: "주 규제 체계", zh: "主要监管体系", es: "Régimen Regulatorio Principal" },
  "settings.avatar":       { en: "Profile Photo",          ko: "프로필 사진", zh: "头像",        es: "Foto de Perfil" },
  "settings.replacePhoto": { en: "Replace photo",          ko: "사진 교체",  zh: "更换头像",    es: "Reemplazar foto" },
  "settings.uploadPhoto":  { en: "Upload photo",           ko: "사진 업로드", zh: "上传头像",    es: "Subir foto" },
  "settings.account":      { en: "Account",                ko: "계정",       zh: "账户",        es: "Cuenta" },
  "settings.email":        { en: "Email",                  ko: "이메일",     zh: "电子邮箱",    es: "Correo electrónico" },
  "settings.tier":         { en: "Tier",                   ko: "등급",       zh: "级别",        es: "Nivel" },
  "settings.saved":        { en: "Saved",                  ko: "저장됨",     zh: "已保存",      es: "Guardado" },
  "settings.augCredit":     { en: "Credit augmenting (SO / cruise-relief) time at 50%", ko: "증원 조종사(SO / 순항 교대) 시간을 50%로 인정", zh: "增援机组（SO / 巡航接替）时间按 50% 计入", es: "Acreditar el tiempo de refuerzo (SO / relevo en crucero) al 50%" },
  "settings.augCreditHint": { en: "Applies to total, multi-engine and per-type totals and the Sankey charts. Flights keep their full logged time; flight-time limits, cross-country and instrument totals are unchanged.", ko: "총 시간, 다발 및 기종별 합계, Sankey 차트에 적용됩니다. 비행 기록은 전체 시간을 유지하며 비행시간 제한·야외 비행·계기 합계는 변경되지 않습니다.", zh: "影响总时间、多发与各机型合计以及 Sankey 图。飞行记录保留完整时间；飞行时间限制、转场和仪表合计不变。", es: "Afecta al total, multimotor, totales por tipo y los diagramas Sankey. Los vuelos conservan su tiempo completo; los límites de tiempo de vuelo, travesía e instrumentos no cambian." },
  "dash.augCreditNote":     { en: "augmenting time credited at 50%", ko: "증원 시간 50% 인정", zh: "增援时间按 50% 计入", es: "tiempo de refuerzo acreditado al 50%" },
  "charts.augCreditNote":   { en: "augmenting time at 50%", ko: "증원 시간 50%", zh: "增援时间 50%", es: "refuerzo al 50%" },

  // Flights page
  "flights.title":         { en: "Flights",                ko: "비행 기록",  zh: "飞行记录",    es: "Vuelos" },
  "flights.new":           { en: "New Flight",           ko: "새 비행",  zh: "新飞行",    es: "Nuevo Vuelo" },
  "flights.search":        { en: "Search…",                ko: "검색…",      zh: "搜索…",       es: "Buscar…" },
  "flights.date":          { en: "Date",                   ko: "날짜",       zh: "日期",        es: "Fecha" },
  "flights.aircraft":      { en: "Aircraft",               ko: "항공기",     zh: "航空器",      es: "Aeronave" },
  "flights.reg":           { en: "Reg",                    ko: "등록번호",   zh: "注册号",      es: "Matrícula" },
  "flights.route":         { en: "Route",                  ko: "항로",       zh: "航线",        es: "Ruta" },
  "flights.role":          { en: "Role",                   ko: "역할",       zh: "角色",        es: "Rol" },
  "flights.day":           { en: "Day",                    ko: "주간",       zh: "白天",        es: "Día" },
  "flights.night":         { en: "Night",                  ko: "야간",       zh: "夜间",        es: "Noche" },
  "flights.total":         { en: "Total",                  ko: "총합",       zh: "总计",        es: "Total" },

  // Flight form
  "form.editFlight":       { en: "Edit Flight",            ko: "비행 편집",  zh: "编辑飞行",    es: "Editar Vuelo" },
  "form.newFlight":        { en: "New Flight",             ko: "새 비행",    zh: "新飞行",      es: "Nuevo Vuelo" },
  "form.section.flight":   { en: "Flight",                 ko: "비행 정보",  zh: "飞行信息",    es: "Vuelo" },
  "form.section.time":     { en: "Time",                   ko: "시간",       zh: "时间",        es: "Tiempo" },
  "form.section.inst":     { en: "Instrument & Approaches", ko: "계기 및 접근", zh: "仪表与进近", es: "Instrumentos y Aproximaciones" },
  "form.section.tol":      { en: "Takeoffs / Landings",    ko: "이착륙",     zh: "起飞 / 着陆", es: "Despegues / Aterrizajes" },
  "form.makeModel":        { en: "Aircraft Make/Model",    ko: "항공기 제작사/모델", zh: "航空器制造商/型号", es: "Marca / Modelo de Aeronave" },
  "form.registration":     { en: "Registration",           ko: "등록번호",   zh: "注册号",      es: "Matrícula" },
  "form.regHint.new":      { en: "New tail #",             ko: "새 등록번호", zh: "新注册号",    es: "Matrícula nueva" },
  "form.pic":              { en: "PIC",                    ko: "기장 (PIC)", zh: "机长 (PIC)",  es: "PIC" },
  "form.copilot":          { en: "Co-Pilot",               ko: "부기장",     zh: "副驾驶",      es: "Copiloto" },
  "form.thirdPilot":       { en: "Second Officer / Aug",   ko: "보조 조종사", zh: "二副 / 辅助驾驶", es: "Segundo Oficial / Aux" },
  "form.checkPilot":       { en: "Check Pilot",            ko: "검열관",     zh: "检查员",      es: "Piloto Examinador" },
  "form.remarks":          { en: "Remarks",                ko: "비고",       zh: "备注",        es: "Observaciones" },
  "form.category":         { en: "Category",               ko: "구분",       zh: "类别",        es: "Categoría" },
  "form.role":             { en: "Role",                   ko: "역할",       zh: "角色",        es: "Rol" },
  "form.dayTime":          { en: "Day Time (hrs)",         ko: "주간 비행시간", zh: "白天飞行时间 (小时)", es: "Tiempo Día (h)" },
  "form.nightTime":        { en: "Night Time (hrs)",       ko: "야간 비행시간", zh: "夜间飞行时间 (小时)", es: "Tiempo Noche (h)" },
  "form.xc":               { en: "Cross-Country",          ko: "장거리",     zh: "越野",        es: "Travesía" },
  "form.xcCheck":          { en: "This flight is x-country", ko: "이 비행은 장거리입니다", zh: "此次飞行为越野飞行", es: "Este vuelo es de travesía" },
  "form.dutyTime":         { en: "Duty Time (hrs)",        ko: "근무시간",   zh: "执勤时间 (小时)", es: "Tiempo de Servicio (h)" },
  // Migration 0009 — traditional logbook fields
  "form.cfiTime":          { en: "As Flight Instructor (hrs)", ko: "교관 비행 (h)", zh: "教官时间 (小时)", es: "Como Instructor (h)" },
  "form.precApproaches":   { en: "# Precision Approaches", ko: "정밀 접근 횟수", zh: "精密进近次数", es: "# Aproximaciones de Precisión" },
  "form.nonPrecApproaches":{ en: "# Non-Precision Approaches", ko: "비정밀 접근 횟수", zh: "非精密进近次数", es: "# Aproximaciones No Precisión" },
  "form.holds":            { en: "Holds",                  ko: "홀딩",       zh: "等待航线",    es: "Esperas" },

  // Category labels (migration 0009 expansion)
  "cat.ses":               { en: "Single Engine Sea (SES)", ko: "단발 수상기 (SES)", zh: "单发水上飞机 (SES)", es: "Monomotor Mar (SES)" },
  "cat.mes":               { en: "Multi-Engine Sea (MES)", ko: "쌍발 수상기 (MES)", zh: "多发水上飞机 (MES)", es: "Multimotor Mar (MES)" },
  "cat.heli":              { en: "Helicopter",             ko: "헬리콥터",   zh: "直升机",      es: "Helicóptero" },

  // Flights table — new column headers (compact for table)
  "col.prec":              { en: "Prec",                   ko: "정밀",       zh: "精密",        es: "Prec" },
  "col.nonPrec":           { en: "Non-Prec",               ko: "비정밀",     zh: "非精密",      es: "No Prec" },
  "col.holds":             { en: "Holds",                  ko: "홀딩",       zh: "等待",        es: "Esperas" },
  "col.cfi":               { en: "CFI",                    ko: "교관",       zh: "教官",        es: "CFI" },

  // Common buttons
  "common.save":           { en: "Save",                   ko: "저장",       zh: "保存",        es: "Guardar" },
  "common.saving":         { en: "Saving…",                ko: "저장 중…",   zh: "正在保存…",   es: "Guardando…" },
  "common.cancel":         { en: "Cancel",                 ko: "취소",       zh: "取消",        es: "Cancelar" },
  "common.delete":         { en: "Delete",                 ko: "삭제",       zh: "删除",        es: "Eliminar" },
  "common.add":            { en: "Add",                    ko: "추가",       zh: "添加",        es: "Agregar" },
  "common.edit":           { en: "Edit",                   ko: "편집",       zh: "编辑",        es: "Editar" },
  "common.view":           { en: "View",                   ko: "보기",       zh: "查看",        es: "Ver" },
  "common.close":          { en: "Close",                  ko: "닫기",       zh: "关闭",        es: "Cerrar" },
  "common.language":       { en: "Language",               ko: "언어",       zh: "语言",        es: "Idioma" },

  // Charts page
  "charts.title":          { en: "Charts",                 ko: "차트",       zh: "图表",        es: "Gráficos" },
  "charts.flightMap":      { en: "Flight map · all time",  ko: "비행 지도 · 전체 기간", zh: "飞行地图 · 全部时间", es: "Mapa de vuelos · todo el tiempo" },
  "charts.hoursPerYear":   { en: "Hours per year",         ko: "연도별 비행시간", zh: "每年飞行小时", es: "Horas por año" },
  "charts.hoursPerType":   { en: "Hours per aircraft type", ko: "기종별 비행시간", zh: "每个机型飞行小时", es: "Horas por tipo de aeronave" },
  "charts.rolling":        { en: "365-day rolling total",  ko: "365일 누적 비행시간", zh: "365 天滚动总计", es: "Total móvil de 365 días" },
  "charts.calendar":       { en: "Calendar heatmap",       ko: "달력 히트맵", zh: "日历热力图",  es: "Mapa de calor de calendario" },

  // Badges page
  "badges.title":          { en: "Achievements",           ko: "성취",       zh: "成就",        es: "Logros" },
  "badges.summary":        { en: "{earned} of {total} earned across your {flights} flights.", ko: "총 비행 {flights}회 중 {total}개 성취 중 {earned}개 달성.", zh: "在 {flights} 次飞行中已获得 {total} 个成就中的 {earned} 个。", es: "{earned} de {total} obtenidos en sus {flights} vuelos." },
  "badges.cat.firsts":     { en: "Firsts",                 ko: "첫 비행",    zh: "首次",        es: "Primeras Veces" },
  "badges.cat.milestones": { en: "Hour Milestones",        ko: "시간 마일스톤", zh: "时间里程碑",  es: "Hitos de Horas" },
  "badges.cat.regime":     { en: "Certification",          ko: "자격증",     zh: "认证",        es: "Certificación" },
  "badges.cat.endurance":  { en: "Endurance",              ko: "지구력",     zh: "耐力",        es: "Resistencia" },
  "badges.earned":         { en: "Earned {date}",          ko: "{date} 달성", zh: "{date} 达成", es: "Obtenido {date}" },
  "badges.progress":       { en: "Progress",               ko: "진행",       zh: "进度",        es: "Progreso" },

  // Badge names + descriptions
  // Firsts
  "b.firstFlight.name":    { en: "First Flight",                                ko: "첫 비행",                            zh: "首次飞行",          es: "Primer Vuelo" },
  "b.firstFlight.desc":    { en: "Your very first logged flight",               ko: "기록한 첫 비행",                     zh: "您记录的第一次飞行", es: "Su primer vuelo registrado" },
  "b.firstSolo.name":      { en: "First Solo / PIC",                            ko: "첫 단독 / 기장",                     zh: "首次单飞 / 机长",   es: "Primer Solo / PIC" },
  "b.firstSolo.desc":      { en: "First time as Pilot in Command",              ko: "첫 기장(PIC) 비행",                  zh: "首次担任机长",       es: "Primera vez como Piloto al Mando" },
  "b.firstNight.name":     { en: "First Night Flight",                          ko: "첫 야간 비행",                       zh: "首次夜间飞行",       es: "Primer Vuelo Nocturno" },
  "b.firstNight.desc":     { en: "Logged your first night hours",               ko: "첫 야간 비행시간 기록",              zh: "记录第一次夜间飞行时间", es: "Registró sus primeras horas nocturnas" },
  "b.firstXC.name":        { en: "First Cross-Country",                         ko: "첫 장거리 비행",                     zh: "首次越野飞行",       es: "Primera Travesía" },
  "b.firstXC.desc":        { en: "First x-country flight",                      ko: "첫 장거리 비행",                     zh: "首次越野飞行",       es: "Primer vuelo de travesía" },
  "b.firstIFR.name":       { en: "First IFR Time",                              ko: "첫 계기 비행",                       zh: "首次仪表飞行",       es: "Primer Vuelo IFR" },
  "b.firstIFR.desc":       { en: "First logged instrument hours",               ko: "첫 계기 비행시간 기록",              zh: "记录第一次仪表飞行时间", es: "Primeras horas de instrumentos registradas" },
  "b.firstME.name":        { en: "First Multi-Engine",                          ko: "첫 쌍발 비행",                       zh: "首次多发飞行",       es: "Primer Multimotor" },
  "b.firstME.desc":        { en: "First flight in a multi-engine aircraft",     ko: "첫 쌍발 항공기 비행",                zh: "首次驾驶多发飞机",   es: "Primer vuelo en una aeronave multimotor" },
  "b.firstIntl.name":      { en: "First International",                         ko: "첫 국제 비행",                       zh: "首次国际飞行",       es: "Primer Vuelo Internacional" },
  "b.firstIntl.desc":      { en: "First flight across ICAO prefix boundaries",  ko: "ICAO 접두 코드를 넘는 첫 비행",      zh: "首次跨越 ICAO 前缀边界", es: "Primer vuelo cruzando fronteras de prefijo OACI" },

  // Hour milestones
  "b.totalHours.name":     { en: "{hours} Hours Total",                         ko: "총 {hours}시간",                     zh: "总计 {hours} 小时",  es: "{hours} Horas Totales" },
  "b.totalHours.desc":     { en: "Career total of {hours} flight hours",        ko: "경력 총 {hours} 비행시간",           zh: "职业生涯总计 {hours} 飞行小时", es: "Total de {hours} horas de vuelo en su carrera" },
  "b.picHours.name":       { en: "{hours} hours PIC",                           ko: "기장 {hours}시간",                   zh: "机长 {hours} 小时",  es: "{hours} horas PIC" },
  "b.picHours.desc":       { en: "Career {hours} hours as Pilot in Command",    ko: "기장 경력 {hours}시간",              zh: "职业生涯机长 {hours} 小时", es: "{hours} horas en su carrera como Piloto al Mando" },

  // Certification — license states
  "b.ppl.name":            { en: "PPL",                                         ko: "PPL",                                 zh: "PPL",                es: "PPL" },
  "b.cpl.name":            { en: "CPL",                                         ko: "CPL",                                 zh: "CPL",                es: "CPL" },
  "b.atpl.name":           { en: "ATPL",                                        ko: "ATPL",                                zh: "ATPL",               es: "ATPL" },
  "b.ppl.onFile":          { en: "Private Pilot License on file",               ko: "PPL 면허 등록됨",                    zh: "私人飞行员执照已存档", es: "Licencia de Piloto Privado en archivo" },
  "b.cpl.onFile":          { en: "Commercial Pilot License on file",            ko: "CPL 면허 등록됨",                    zh: "商业飞行员执照已存档", es: "Licencia de Piloto Comercial en archivo" },
  "b.atpl.onFile":         { en: "Airline Transport Pilot License on file",     ko: "ATPL 면허 등록됨",                   zh: "航线运输飞行员执照已存档", es: "Licencia de Piloto de Transporte de Línea Aérea en archivo" },
  "b.lic.upload":          { en: "Upload your {kind} to the Document Vault",    ko: "{kind} 면허를 문서 보관함에 업로드", zh: "请上传您的 {kind} 到文档保险库", es: "Suba su {kind} a la Bóveda de Documentos" },
  "b.lic.impliedBy":       { en: "Implied by your {higher}",                    ko: "{higher}로 자동 인정",               zh: "由您的 {higher} 推得", es: "Implícito por su {higher}" },

  // Ratings
  "b.nightRating.name":    { en: "Night Rating",                                ko: "야간 등급",                          zh: "夜间等级",            es: "Habilitación Nocturna" },
  "b.nightRating.desc":    { en: "10 hrs night time logged (CARs 421.42)",      ko: "야간 비행 10시간 기록 (CARs 421.42)", zh: "记录 10 小时夜间飞行 (CARs 421.42)", es: "10 h de tiempo nocturno registradas (CARs 421.42)" },
  "b.meRating.name":       { en: "Multi-Engine Rating",                         ko: "쌍발 등급",                          zh: "多发等级",            es: "Habilitación Multimotor" },
  "b.meRating.desc":       { en: "5+ hours flown in multi-engine aircraft",     ko: "쌍발 항공기 5시간 이상 비행",        zh: "在多发飞机上飞行 5 小时以上", es: "5+ horas voladas en aeronave multimotor" },
  "b.ifrRating.name":      { en: "IFR Rating",                                  ko: "계기 등급",                          zh: "仪表等级",            es: "Habilitación IFR" },
  "b.ifrRating.desc":      { en: "40 hrs instrument time (CARs 421.46)",        ko: "계기 비행 40시간 (CARs 421.46)",     zh: "40 小时仪表飞行 (CARs 421.46)", es: "40 h de tiempo de instrumentos (CARs 421.46)" },

  // Endurance
  "b.longHaul.name":       { en: "Long-haul",                                   ko: "장거리",                             zh: "长途",                es: "Larga Distancia" },
  "b.longHaul.desc":       { en: "Logged a single flight ≥ 8 hrs",              ko: "단일 비행 8시간 이상 기록",          zh: "记录单次飞行 ≥ 8 小时", es: "Registró un solo vuelo ≥ 8 h" },
  "b.ultraLong.name":      { en: "Ultra-Long",                                  ko: "초장거리",                           zh: "超长途",              es: "Ultra Larga Distancia" },
  "b.ultraLong.desc":      { en: "Logged a single flight ≥ 12 hrs",             ko: "단일 비행 12시간 이상 기록",         zh: "记录单次飞行 ≥ 12 小时", es: "Registró un solo vuelo ≥ 12 h" },

  // Aircraft types
  "b.types.name":          { en: "{n} Aircraft Types",                          ko: "{n}개 기종",                         zh: "{n} 种机型",          es: "{n} Tipos de Aeronave" },
  "b.types.desc":          { en: "Flown {n}+ different aircraft types",         ko: "{n}개 이상의 다른 기종 비행",        zh: "已飞 {n}+ 种不同机型", es: "Voló {n}+ tipos diferentes de aeronave" },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS;

/**
 * Look up a translation. Supports `{name}`-style interpolation.
 * Always falls back to English then to the key itself so the UI never breaks.
 */
export function translate(key: TranslationKey, locale: Locale, vars?: Record<string, string | number>): string {
  const entry = TRANSLATIONS[key];
  let str: string = entry?.[locale] ?? entry?.en ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}

/**
 * Convenience factory: build a translator bound to a specific locale.
 * Client components receive `locale` as a prop from their server parent and
 * use `makeT(locale)` to get a clean `t("nav.dashboard")` API.
 */
export function makeT(locale: Locale) {
  return (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(key, locale, vars);
}
