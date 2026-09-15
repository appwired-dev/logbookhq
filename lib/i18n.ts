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
  "nav.skipToContent": { en: "Skip to content", ko: "본문으로 건너뛰기", zh: "跳到主要内容", es: "Saltar al contenido" },
  "nav.flights":    { en: "Flights",    ko: "비행",     zh: "飞行",       es: "Vuelos" },
  "nav.charts":     { en: "Charts",     ko: "차트",     zh: "图表",       es: "Gráficos" },
  "nav.documents":  { en: "Documents",  ko: "문서",     zh: "文档",       es: "Documentos" },
  "nav.export":     { en: "Export",     ko: "내보내기", zh: "导出",       es: "Exportar" },
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
  "export.pilotName":      { en: "Pilot Name",             ko: "조종사 이름", zh: "飞行员姓名",  es: "Nombre del Piloto" },
  "export.licenseOpt":     { en: "License # (optional)",   ko: "면허 번호 (선택)", zh: "执照号 (可选)", es: "N.º de Licencia (opcional)" },
  "export.fromDate":       { en: "From Date",              ko: "시작 날짜",  zh: "起始日期",    es: "Fecha Desde" },
  "export.toDate":         { en: "To Date",                ko: "종료 날짜",  zh: "结束日期",    es: "Fecha Hasta" },
  "export.inRange":        { en: "{flights} flights in range · {hours} hrs total", ko: "범위 내 {flights}회 비행 · 총 {hours}시간", zh: "范围内 {flights} 次飞行 · 共 {hours} 小时", es: "{flights} vuelos en el rango · {hours} h en total" },
  "export.generating":     { en: "Generating…",            ko: "생성 중…",   zh: "正在生成…",   es: "Generando…" },
  "export.licensePh":      { en: "ATPL #...",              ko: "ATPL 번호...", zh: "ATPL 编号...", es: "N.º ATPL..." },

  // Import page

  // Documents page
  "docs.title":            { en: "Document Vault",         ko: "문서 보관함", zh: "文档保险库",  es: "Bóveda de Documentos" },
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
  "docs.empty.title":      { en: "No documents yet",       ko: "아직 문서가 없습니다", zh: "暂无文档", es: "Aún no hay documentos" },
  "docs.empty.body":       { en: "Add your medical, licenses, type ratings, IPC, recurrent records.", ko: "신체검사, 면허, 기종 한정, IPC, 정기 교육 기록을 추가하세요.", zh: "添加您的体检、执照、机型等级、IPC、复训记录。", es: "Agregue su médico, licencias, habilitaciones de tipo, IPC, registros de recurrente." },
  "docs.delete":           { en: "Delete",                 ko: "삭제",       zh: "删除",        es: "Eliminar" },
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
  "flights.searchPh":      { en: "Search make, reg, route, pilots, remarks…", ko: "기종, 등록번호, 항로, 조종사, 비고 검색…", zh: "搜索机型、注册号、航线、飞行员、备注…", es: "Buscar marca, matrícula, ruta, pilotos, observaciones…" },
  "flights.makeModel":     { en: "Aircraft",               ko: "기종",       zh: "机型",        es: "Aeronave" },
  "flights.pic":           { en: "PIC",                    ko: "기장",       zh: "机长",        es: "PIC" },

  // Charts page
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
  "settings.augCredit":     { en: "Credit augmenting (SO / cruise-relief) time at 50%", ko: "증원 조종사(SO / 순항 교대) 시간을 50%로 인정", zh: "增援机组（SO / 巡航接替）时间按 50% 计入", es: "Acreditar el tiempo de refuerzo (SO / relevo en crucero) al 50%" },
  "settings.augCreditHint": { en: "Applies to total, multi-engine and per-type totals and the Sankey charts. Flights keep their full logged time; flight-time limits, cross-country and instrument totals are unchanged.", ko: "총 시간, 다발 및 기종별 합계, Sankey 차트에 적용됩니다. 비행 기록은 전체 시간을 유지하며 비행시간 제한·야외 비행·계기 합계는 변경되지 않습니다.", zh: "影响总时间、多发与各机型合计以及 Sankey 图。飞行记录保留完整时间；飞行时间限制、转场和仪表合计不变。", es: "Afecta al total, multimotor, totales por tipo y los diagramas Sankey. Los vuelos conservan su tiempo completo; los límites de tiempo de vuelo, travesía e instrumentos no cambian." },
  "dash.augCreditNote":     { en: "augmenting time credited at 50%", ko: "증원 시간 50% 인정", zh: "增援时间按 50% 计入", es: "tiempo de refuerzo acreditado al 50%" },
  "charts.augCreditNote":   { en: "augmenting time at 50%", ko: "증원 시간 50%", zh: "增援时间 50%", es: "refuerzo al 50%" },

  // Flights page
  "flights.title":         { en: "Flights",                ko: "비행 기록",  zh: "飞行记录",    es: "Vuelos" },
  "flights.new":           { en: "New Flight",           ko: "새 비행",  zh: "新飞行",    es: "Nuevo Vuelo" },
  "flights.date":          { en: "Date",                   ko: "날짜",       zh: "日期",        es: "Fecha" },
  "flights.aircraft":      { en: "Aircraft",               ko: "항공기",     zh: "航空器",      es: "Aeronave" },
  "flights.reg":           { en: "Reg",                    ko: "등록번호",   zh: "注册号",      es: "Matrícula" },
  "flights.route":         { en: "Route",                  ko: "항로",       zh: "航线",        es: "Ruta" },
  "flights.role":          { en: "Role",                   ko: "역할",       zh: "角色",        es: "Rol" },
  "flights.day":           { en: "Day",                    ko: "주간",       zh: "白天",        es: "Día" },
  "flights.night":         { en: "Night",                  ko: "야간",       zh: "夜间",        es: "Noche" },
  "flights.total":         { en: "Total",                  ko: "총합",       zh: "总计",        es: "Total" },

  // Flight form
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
  "form.multiPilot":       { en: "Multi-pilot",           ko: "복수 조종",   zh: "多机组",      es: "Multipiloto" },
  "form.multiPilotCheck":  { en: "Multi-pilot operation (EASA)", ko: "복수 조종 운항 (EASA)", zh: "多机组运行（EASA）", es: "Operación multipiloto (EASA)" },
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
  "common.edit":           { en: "Edit",                   ko: "편집",       zh: "编辑",        es: "Editar" },
  "common.language":       { en: "Language",               ko: "언어",       zh: "语言",        es: "Idioma" },

  // Charts page
  "charts.title":          { en: "Charts",                 ko: "차트",       zh: "图表",        es: "Gráficos" },
  "charts.flightMap":      { en: "Flight map · all time",  ko: "비행 지도 · 전체 기간", zh: "飞行地图 · 全部时间", es: "Mapa de vuelos · todo el tiempo" },
  "charts.hoursPerType":   { en: "Hours per aircraft type", ko: "기종별 비행시간", zh: "每个机型飞行小时", es: "Horas por tipo de aeronave" },
  "charts.rolling":        { en: "365-day rolling total",  ko: "365일 누적 비행시간", zh: "365 天滚动总计", es: "Total móvil de 365 días" },
  "charts.calendar":       { en: "Calendar heatmap",       ko: "달력 히트맵", zh: "日历热力图",  es: "Mapa de calor de calendario" },

  // Badges page

  // Badge names + descriptions
  // Firsts

  // Hour milestones

  // Certification — license states

  // Ratings

  // Endurance

  // Aircraft types
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
