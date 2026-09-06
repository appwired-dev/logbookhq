/**
 * Header vocabulary (EN / KO / ZH / ES / DE / FR) → facets.
 *
 * A header segment is reduced to a small set of facets: the time category /
 * condition / role it names, whether it is about cross-country, instrument,
 * approaches, landings …, and a handful of direct field readings. The
 * mapper combines the facets of every segment on a column's path, so
 * ["Multi-Engine Aircraft", "Night", "FO"] → {me, night, fo} and
 * ["Cross Country", "Day", "PIC"] → cross-country time.
 */
import type { FieldTarget, TimeCategory, TimeCondition, TimeRole } from "./types";
import { normaliseHeader } from "./util";

export type NameField = "pic" | "copilot" | "third_pilot" | "check_pilot";

export interface Facets {
  cat: TimeCategory | null;
  cond: TimeCondition | null;
  role: TimeRole | null;
  xc: boolean;
  inst: "actual" | "hood" | null;
  /** Bare "Instrument"/"IFR" — a group word (leaf → actual instrument). */
  instrumentWord: boolean;
  total: boolean;
  timeWord: boolean;
  approach: "any" | "precision" | "non_precision" | null;
  holds: boolean;
  landing: boolean;
  takeoff: boolean;
  field: FieldTarget | null;
  name: NameField | null;
  ignore: boolean;
  /** 1 when the whole segment is a known token, 0.85 when it merely contains one. */
  strength: number;
}

const EMPTY_FACETS: Facets = {
  cat: null, cond: null, role: null, xc: false, inst: null, instrumentWord: false, total: false, timeWord: false,
  approach: null, holds: false, landing: false, takeoff: false, field: null, name: null, ignore: false, strength: 0,
};

// ---------------------------------------------------------------------------
// Matchers
// ---------------------------------------------------------------------------

interface Matcher { latin?: RegExp; cjk?: RegExp; exact?: Set<string> }

function m(latin: string, cjk?: string): Matcher {
  const alts = latin.split("|").map((a) => a.trim()).filter(Boolean);
  return {
    latin: alts.length ? new RegExp(`(?:^|\\s)(?:${alts.map((a) => a.replace(/ /g, "\\s")).join("|")})(?:\\s|$)`) : undefined,
    cjk: cjk ? new RegExp(cjk.split("|").map((a) => a.trim()).filter(Boolean).join("|")) : undefined,
    exact: new Set(alts),
  };
}

function hit(s: string, mt: Matcher): number {
  if (mt.exact?.has(s)) return 1;
  if (mt.latin?.test(s)) return 0.85;
  if (mt.cjk?.test(s)) return s.length <= 4 ? 1 : 0.85;
  return 0;
}

// Order matters inside each family: longer / more specific phrases first.
// Ignore vocabulary: whole-segment words (never matched as tokens — "id"
// would otherwise swallow "AircraftID") plus phrases that are safe as tokens.
const IGNORE_EXACT = new Set([
  "distance", "dist", "nm", "hobbs", "tach", "tacho", "fuel", "oil", "duty", "pax", "passengers", "signature", "signed", "sig",
  "page", "seq", "row", "no", "nr", "num", "number", "idx", "index", "id", "uuid", "guid", "nvg", "checkride", "ipc", "bfr",
  "ground", "cumulative", "cum", "balance", "sync", "created", "updated", "modified", "attachment", "photo", "image", "url", "link",
  "weather", "wx", "temp", "wind", "sn", "s n", "line", "entry", "rev", "revision", "version",
  "연료", "서명", "페이지", "누계", "燃油", "签名", "页码", "累计",
]);
const IGNORE_PHRASE = m(
  "hobbs start|hobbs end|tach start|tach end|on duty|off duty|duty time|flight number|flight no|flt no|flt|flight num|nvg ops|nvg proficiency|faa 6158|faa6158|flight review|ground training|instructor comments|person 1|person 2|person 3|person 4|person 5|person 6|custom field name|carried forward|brought forward|running total|total to date|hobbs time|tach time|fuel used|fuel added",
);

const CAT_MES = m("mes|ames|multi engine sea|multiengine sea|multi sea|me sea|multi engine seaplane", "다발 수상|多发水上");
const CAT_SES = m("ses|ases|single engine sea|singleengine sea|single sea|se sea|sea|seaplane|seaplanes|float|floats|floatplane|amphib|amphibian|amphibious|hidro|hidroavion|hidroavión", "수상|水上");
const CAT_ME = m("me|mel|amel|multi|multi engine|multiengine|multi eng|multi engine land|multi engine aircraft|multi engine airplane|multiengine aircraft|twin|twins|multimotor|multimotores|bimotor|mehrmotorig|multimoteur", "다발|多发|多發|双发|雙發|多発");
const CAT_SE = m("se|sel|asel|single|single engine|singleengine|single eng|single engine land|single engine aircraft|single engine airplane|singleengine aircraft|monomotor|monomotores|mono|einmotorig|monomoteur", "단발|单发|單發|単発");
const CAT_HELI = m("heli|helo|helicopter|helicopters|rotor|rotorcraft|rotary|rotary wing|helicoptero|helicóptero|hubschrauber|hélicoptère|helicoptere", "헬기|헬리콥터|회전익|直升机|直升機|ヘリ");
const CAT_SIM = m("sim|sims|simulator|simulators|simulated flight|flight simulator|ftd|ffs|fstd|aatd|batd|fnpt|fnpt ii|synthetic|synthetic trainer|device|training device|simulador|simulateur", "시뮬레이터|시뮬|모의비행|모의|모의비행장치|模拟机|模擬機|模拟器|模擬器|シミュレーター");

const COND_DAY = m("day|days|daytime|day time|daylight|diurno|diurna|dia|día|tag|jour|de dia|de día", "주간|白天|昼间|晝間|日间|日間|昼");
const COND_NIGHT = m("night|nights|nite|night time|nighttime|nocturnal|nocturno|nocturna|noche|nacht|nuit|de noche", "야간|夜航|夜间|夜間|夜");

const CFI = m("dual given|dual gvn|dual giv|given|instruction given|instructor time|as instructor|instructing|teaching|cfi|cfii|mei|fi|fi time|instructor|flight instructor|instrucción dada|instruccion dada|fluglehrer|instructeur", "교관|교관비행|교관시간|教员|教官|教練");
const ROLE_DUAL = m("dual|dual received|dual rec|dual recd|dual rcvd|dual recvd|dual rec d|received|rec d|recd|instruction|instruction received|training|trng|trainee|student pilot|with instructor|dual time|dual instruction|doble mando|instrucción|instruccion|instrucción recibida|doppelsteuer|double commande|dc", "훈련|교육|교육비행|동승|带飞|帶飛|教学|教學|受訓");
const ROLE_PIC = m("pic|p1|p 1|pilot in command|captain|capt|cpt|cmdr|command|in command|pic time|pic us|picus|comandante|kommandant|kapitän|kapitan|cdb|commandant|commandant de bord", "기장|机长|機長");
const ROLE_SIC = m("sic|p2|p 2|second in command|second in cmd|2nd in command|aug|augment|augmenting|augmented|augmentation|augmenting pilot|relief|cruise relief|cruise|irp|international relief|heavy crew|segundo al mando|segundo piloto", "증원|보강|加机组|巡航|巡航机长");
const ROLE_FO = m("fo|f o|first officer|1st officer|co pilot|copilot|co pilote|copiloto|cp|kopilot|primer oficial|opl|erster offizier", "부조종사|부기장|副驾驶|副機長|副操縦士");
const ROLE_CHECK = m("check|chk|check flight|line check|ppc|pcc|proficiency check|skill test|flight test|examination|exam|check ride|prüfung|pruefung|check time", "체크|심사|考核|检查|檢查");
const ROLE_SOLO = m("solo|solo flight|solo time|en solitario|alleinflug", "단독|단독비행|单飞|單飛|単独");

const XC = m("cross country|crosscountry|x country|xcountry|xc|x c|xctry|cross ctry|x ctry|cross country time|xc time|navigation|navex|nav ex|travesía|travesia|vuelo de travesía|überland|ueberland|überlandflug|voyage|cross", "야외비행|야외|크로스컨트리|转场|轉場|野外|野外飞行|野外飛行");
const INST_HOOD = m("hood|hooded|under the hood|under hood|simulated instrument|sim instrument|sim inst|simulated inst|sim imc|simulated imc|foggles|view limiting|capucha|instrumentos simulados|instrument simulé", "후드|후드계기|모의계기|模拟仪表|模擬儀表");
const INST_ACTUAL = m("actual|actual instrument|actual inst|act inst|act|imc|instrument actual|in imc|real|real imc|actual imc|ifr actual|instrumentos reales|instrument réel", "실계기|실제계기|计器实际|实际仪表|實際儀表|実機計器");
const INST_WORD = m("instrument|instruments|inst|instr|ifr|if|instrument time|instrument flight|instrumentos|instrumental|instrumenten|instrumentenflug|vol aux instruments", "계기|계기비행|仪表|儀表|計器");

const TOTAL = m("total|totals|tot|sum|sub total|subtotal|grand total|gesamt|gesamtzeit|somme|suma|totale", "합계|총계|총|계|总计|總計|合计|合計|小计|小計|計");
const TIME_WORD = m("time|times|hours|hrs|hr|h|duration|dur|block|blk|block time|flight time|flt time|flt hrs|flight hours|tt|total time|piloting time|tiempo|horas|zeit|stunden|temps|heures|durée|duree", "비행시간|시간|飞行时间|飛行時間|時間|时间");

const APPR_PREC = m("precision|precision approach|precision approaches|prec|ils|par|lpv|mls|gls|cat i|cat ii|cat iii", "정밀|精密");
const APPR_NONPREC = m("non precision|nonprecision|non precision approach|non precision approaches|non prec|np|npa|vor|ndb|rnav|lnav|lnav vnav|loc|localizer|gps|rnp", "비정밀|非精密");
const APPROACH = m("approaches|approach|apprs|appr|apch|apchs|app|apps|appchs|appch|iap|iaps|instrument approaches|instrument approach|ifr approaches|ifr appchs|ifr app|ifr apps|no of approaches|number of approaches|aproximaciones|aproximación|aproximacion|anflüge|anfluege|anflug|approches|approche", "접근|진입|접근횟수|进近|進近|进近次数");
const HOLDS = m("holds|hold|holding|holding patterns|holding pattern|hld|esperas|espera|warteverfahren|attente", "체공|홀딩|等待|等待程序");
const LANDING = m("landings|landing|ldg|ldgs|lndg|lnd|land|full stop|full stops|full stop landings|fs|touch and go|touch go|t g|tg|t gs|aterrizajes|aterrizaje|landungen|landung|atterrissages|atterrissage|day landings|night landings", "착륙|착륙횟수|着陆|著陸|着陸|降落");
const TAKEOFF = m("takeoffs|takeoff|take offs|take off|t o|t os|tko|tkos|tkof|toff|toffs|departures|despegues|despegue|starts|start|décollages|decollages|décollage", "이륙|이륙횟수|起飞|起飛|離陸");

const F_DATE = m("date|dates|flight date|date flown|date of flight|dt|datum|fecha|data|flight flight date", "날짜|일자|비행일|비행일자|日期|日付|年月日");
const F_REG = m("registration|reg|regn|regno|reg no|reg number|reg nr|tail|tail number|tail no|tail num|tail nr|tailnumber|ident|identifier|aircraft id|aircraft ident|aircraft identification|aircraft registration|a c reg|ac reg|n number|n no|nnumber|call sign|callsign|matricula|matrícula|kennzeichen|immatriculation|flight aircraft registration", "등록번호|등록기호|기체번호|注册号|注冊號|机号|机尾号|登録記号|機体番号");
const F_MAKE = m("make model|make and model|make|model|aircraft type|aircraft model|aircraft make|acft type|a c type|ac type|type code|typecode|type|types|aircraft|acft|a c|ac|airplane|aeroplane|plane|equipment|equip|aeronave|tipo|tipo de aeronave|flugzeugtyp|muster|avion|type d avion|flight aircraft type|flight selected aircraft type|aircraft type code", "기종|항공기|항공기기종|机型|機種|型号|飞机|航空機|機体");
const F_ROUTE = m("route|routing|city pair|city pairs|legs|leg|segment|sector|sectors|trip|ruta|strecke|trajet|itinéraire|itineraire", "항로|경로|구간|航线|航線|航路|路线|路線");
const F_FROM = m("from|dep|departure|departure airport|departure aerodrome|dep airport|origin|orig|off from|point of departure|departure point|flight actual departure|actual departure|desde|origen|salida|abflug|départ|depart", "출발|출발지|출발공항|起飞地|起飞机场|出发|出發|出発地|出发地");
const F_TO = m("to|dest|destination|destination airport|arr|arrival|arrival airport|arr airport|point of arrival|flight actual destination|actual destination|hasta|destino|llegada|ankunft|arrivée|arrivee", "도착|도착지|목적지|도착공항|目的地|到达|到達|到着地|到达地");
const F_REMARKS = m("remarks|remark|comments|comment|notes|note|description|memo|pilot comments|endorsements|endorsement|comments remarks|remarks and endorsements|flight remarks|observaciones|observations|bemerkungen|anmerkungen|commentaires|remarques", "비고|메모|특이사항|내용|참고|备注|備考|备考|注记|摘要");
const F_CATEGORY = m("category|cat|class|aircraft category|category class|cat class|aircraft class|category and class|categoría|categoria|clase|klasse|catégorie|categorie", "기종구분|구분|类别|類別|类型");
const F_ROLE = m("role|capacity|function|position|crew position|duty position|pilot function|seat|función|funcion|funktion|fonction|rôle", "직책|역할|职位|職位|职务");
const F_BLOCK_OFF = m("block off|blk off|off block|off blocks|out|time out|out time|chocks off|gate out|departure time|dep time|atd|std|off|time off|wheels off|airborne|takeoff time|t o time|block out", "출발시간|출발시각|起飞时间|离港时间");
const F_BLOCK_ON = m("block on|blk on|on block|on blocks|in|time in|in time|chocks on|gate in|arrival time|arr time|ata|sta|on|time on|wheels on|touchdown|landing time|ldg time|block in", "도착시간|도착시각|降落时间|到港时间");

const N_PIC = m("pic|pilot in command|captain|capt|commander|pilot|pilot name|name|names|instructor|instructor name|cfi name", "기장|기장명|조종사|이름|성명|机长|姓名|飞行员");
const N_COPILOT = m("co pilot|copilot|first officer|fo|f o|sic|second pilot|student|students|trainee|other pilot|other crew|crew|crew member|crew names|second in command|co pilot student|student or co pilot", "부기장|부조종사|학생|副驾驶|副機長|学员");
const N_THIRD = m("third pilot|3rd pilot|relief pilot|cruise pilot|relief|aug pilot|augmenting pilot|third crew", "제3조종사|第三");
const N_CHECK = m("check pilot|examiner|check airman|check captain|checker|inspector|dpe|ace|tre|tri|fe|flight examiner|examinador", "검열관|심사관|시험관|考核员|检查员");

// ---------------------------------------------------------------------------
// Segment → facets
// ---------------------------------------------------------------------------

const cache = new Map<string, Facets>();

export function facetsOf(rawSegment: string): Facets {
  const s = normaliseHeader(rawSegment).replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2");
  const hitCache = cache.get(s);
  if (hitCache) return hitCache;
  const f: Facets = { ...EMPTY_FACETS };
  if (!s) { cache.set(s, f); return f; }
  let strength = 0;
  const take = (v: number) => { if (v > strength) strength = v; return v > 0; };

  if (IGNORE_EXACT.has(s) || (take(hit(s, IGNORE_PHRASE)) && !hit(s, F_DATE) && !hit(s, F_REMARKS))) { f.ignore = true; strength = Math.max(strength, 1); }

  // Instrument / hood before the sim category ("sim inst" is hood time).
  if (take(hit(s, INST_HOOD))) f.inst = "hood";
  else if (take(hit(s, INST_ACTUAL))) f.inst = "actual";
  else if (take(hit(s, INST_WORD))) { f.instrumentWord = true; f.inst = "actual"; }

  if (!f.inst || f.instrumentWord) {
    if (take(hit(s, CAT_MES))) f.cat = "mes";
    else if (take(hit(s, CAT_SES))) f.cat = "ses";
    else if (take(hit(s, CAT_ME))) f.cat = "me";
    else if (take(hit(s, CAT_SE))) f.cat = "se";
    else if (take(hit(s, CAT_HELI))) f.cat = "heli";
    else if (take(hit(s, CAT_SIM))) f.cat = "sim";
    // "Single Engine Sea" carries both; sea wins above, keep multi/single as-is.
  }

  if (take(hit(s, COND_NIGHT))) f.cond = "night";
  else if (take(hit(s, COND_DAY))) f.cond = "day";

  if (take(hit(s, CFI))) f.field = "cfi_time";
  else if (take(hit(s, ROLE_SOLO))) f.role = "solo";
  else if (take(hit(s, ROLE_DUAL))) f.role = "dual";
  else if (take(hit(s, ROLE_SIC))) f.role = "sic";
  else if (take(hit(s, ROLE_FO))) f.role = "fo";
  else if (take(hit(s, ROLE_PIC))) f.role = "pic";
  else if (take(hit(s, ROLE_CHECK))) f.role = "check";

  if (take(hit(s, XC))) f.xc = true;

  if (take(hit(s, APPR_NONPREC)) && hit(s, APPROACH)) f.approach = "non_precision";
  else if (take(hit(s, APPR_PREC)) && hit(s, APPROACH)) f.approach = "precision";
  else if (take(hit(s, APPROACH))) f.approach = "any";
  else if (hit(s, APPR_NONPREC) && !f.role && !f.cat && !f.cond) { f.approach = "non_precision"; take(0.85); }
  else if (hit(s, APPR_PREC) && !f.role && !f.cat && !f.cond) { f.approach = "precision"; take(0.85); }
  if (take(hit(s, HOLDS))) f.holds = true;

  // Block clock times before landing/takeoff ("landing time" is a clock time).
  if (take(hit(s, F_BLOCK_OFF)) && (hit(s, TIME_WORD) || /^(out|off|atd|std|block off|blk off|off blocks|chocks off|gate out|block out|airborne|wheels off)$/.test(s))) f.field = "block_off";
  else if (take(hit(s, F_BLOCK_ON)) && (hit(s, TIME_WORD) || /^(in|on|ata|sta|block on|blk on|on blocks|chocks on|gate in|block in|touchdown|wheels on)$/.test(s))) f.field = "block_on";
  else {
    if (take(hit(s, LANDING))) f.landing = true;
    if (take(hit(s, TAKEOFF))) f.takeoff = true;
  }

  if (take(hit(s, TOTAL))) f.total = true;
  if (take(hit(s, TIME_WORD))) f.timeWord = true;

  if (!f.field) {
    if (take(hit(s, F_DATE))) f.field = "date";
    else if (take(hit(s, F_REG))) f.field = "registration";
    else if (take(hit(s, F_ROUTE))) f.field = "route";
    else if (take(hit(s, F_REMARKS))) f.field = "remarks";
    else if (take(hit(s, F_CATEGORY)) && !f.cat) f.field = "category";
    else if (take(hit(s, F_ROLE)) && !f.role) f.field = "role";
    else if (take(hit(s, F_FROM)) && !f.takeoff) f.field = "from";
    else if (take(hit(s, F_TO)) && !f.landing) f.field = "to";
    else if (take(hit(s, F_MAKE)) && !f.cat) f.field = "make_model";
  }

  if (take(hit(s, N_CHECK))) f.name = "check_pilot";
  else if (take(hit(s, N_THIRD))) f.name = "third_pilot";
  else if (take(hit(s, N_COPILOT))) f.name = "copilot";
  else if (take(hit(s, N_PIC))) f.name = "pic";

  f.strength = strength;
  cache.set(s, f);
  return f;
}

/** Merge segment facets along a path (outer → leaf); later segments win conflicts. */
export function facetsOfPath(path: string[]): Facets {
  const out: Facets = { ...EMPTY_FACETS };
  for (const seg of path) {
    const f = facetsOf(seg);
    if (f.cat) out.cat = f.cat;
    if (f.cond) out.cond = f.cond;
    if (f.role) out.role = f.role;
    if (f.xc) out.xc = true;
    if (f.inst) out.inst = f.inst;
    if (f.instrumentWord) out.instrumentWord = true;
    if (f.total) out.total = true;
    if (f.timeWord) out.timeWord = true;
    if (f.approach) out.approach = f.approach;
    if (f.holds) out.holds = true;
    if (f.landing) out.landing = true;
    if (f.takeoff) out.takeoff = true;
    if (f.field) out.field = f.field;
    if (f.name) out.name = f.name;
    if (f.ignore) out.ignore = true;
    out.strength = Math.max(out.strength, f.strength);
  }
  return out;
}

/** True when a segment says nothing more specific than "time"/"hours"/"total". */
export function isGenericTimeLeaf(f: Facets): boolean {
  return (f.total || f.timeWord) && !f.cat && !f.cond && !f.role && !f.xc && !f.inst && !f.approach && !f.holds && !f.landing && !f.takeoff && !f.field;
}
