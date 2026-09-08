/**
 * Header vocabulary (EN / KO / ZH / ES / DE / FR) → facets.
 *
 * A header segment is reduced to a small set of facets: the time category /
 * condition / role it names, whether it is about cross-country, instrument,
 * approaches, landings …, and a handful of direct field readings. The
 * mapper combines the facets of every segment on a column's path, so
 * ["Multi-Engine Aircraft", "Night", "FO"] → {me, night, fo} and
 * ["Cross Country", "Day", "PIC"] → cross-country time.
 *
 * Latin matchers work on whole tokens, so German compounds ("Gesamtflugzeit",
 * "Nachtlandungen", "Startort") are split into their morphemes first; the
 * compounds are also listed verbatim so a segment that is exactly one of them
 * scores as a whole-segment hit.
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
  /** "Block"/"Blockzeit" — a duration that is usually a little longer than flight time. */
  blockWord: boolean;
  approach: "any" | "precision" | "non_precision" | null;
  holds: boolean;
  landing: boolean;
  takeoff: boolean;
  /** "FS"/"full stop" — a subset of all landings. */
  fullStop: boolean;
  field: FieldTarget | null;
  name: NameField | null;
  ignore: boolean;
  /** 1 when the whole segment is a known token, 0.85 when it merely contains one. */
  strength: number;
}

const EMPTY_FACETS: Facets = {
  cat: null, cond: null, role: null, xc: false, inst: null, instrumentWord: false, total: false, timeWord: false, blockWord: false,
  approach: null, holds: false, landing: false, takeoff: false, fullStop: false, field: null, name: null, ignore: false, strength: 0,
};

// ---------------------------------------------------------------------------
// Matchers
// ---------------------------------------------------------------------------

interface Matcher { latin?: RegExp; cjk?: RegExp; exact?: Set<string> }

/**
 * `latin` alternatives match as whole tokens anywhere in the segment (and as
 * the whole segment); `exactOnly` alternatives match only when they ARE the
 * whole segment — for words too common to be safe as tokens ("de", "à").
 */
function m(latin: string, cjk?: string, exactOnly?: string): Matcher {
  const alts = latin.split("|").map((a) => a.trim()).filter(Boolean);
  const exact = new Set(alts);
  for (const a of (exactOnly ?? "").split("|").map((x) => x.trim()).filter(Boolean)) exact.add(a);
  return {
    latin: alts.length ? new RegExp(`(?:^|\\s)(?:${alts.map((a) => a.replace(/ /g, "\\s")).join("|")})(?:\\s|$)`) : undefined,
    cjk: cjk ? new RegExp(cjk.split("|").map((a) => a.trim()).filter(Boolean).join("|")) : undefined,
    exact,
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
  "weather", "wx", "temp", "wind", "sn", "s n", "line", "entry", "rev", "revision", "version", "custom", "public", "private", "locked",
  "연료", "서명", "페이지", "누계", "燃油", "签名", "页码", "累计",
]);
const IGNORE_PHRASE = m(
  "hobbs start|hobbs end|tach start|tach end|on duty|off duty|duty time|flight number|flight no|flt no|flt|flight num|flight id|flightid|nvg ops|nvg proficiency|faa 6158|faa6158|flight review|ground training|instructor comments|person 1|person 2|person 3|person 4|person 5|person 6|custom field name|carried forward|brought forward|running total|total to date|hobbs time|tach time|fuel used|fuel added"
  // Engine / flight clock stamps (MyFlightbook) are neither takeoffs nor block times we import.
  + "|engine start|engine end|engine stop|engine starts|engine on|engine off|flight start|flight end|flight stop"
  // Multi-pilot (crew complement) time is not multi-engine time; custom fields are opaque.
  + "|multi pilot|multipilot|multi pilot time|multi crew|multicrew|multi crew time|custom time|customtime|custom field|custom fields",
);

const CAT_MES = m("mes|ames|multi engine sea|multiengine sea|multi sea|me sea|multi engine seaplane", "다발 수상|多发水上");
const CAT_SES = m("ses|ases|single engine sea|singleengine sea|single sea|se sea|sea|seaplane|seaplanes|float|floats|floatplane|amphib|amphibian|amphibious|hidro|hidroavion|hidroavión", "수상|水上");
const CAT_ME = m("me|mel|amel|multi|multi engine|multiengine|multi eng|multi engine land|multi engine aircraft|multi engine airplane|multiengine aircraft|twin|twins|multimotor|multimotores|bimotor|mehrmotorig|multimoteur", "다발|多发|多發|双发|雙發|多発");
const CAT_SE = m("se|sel|asel|single|single engine|singleengine|single eng|single engine land|single engine aircraft|single engine airplane|singleengine aircraft|monomotor|monomotores|mono|einmotorig|monomoteur", "단발|单发|單發|単発");
const CAT_HELI = m("heli|helo|helicopter|helicopters|rotor|rotorcraft|rotary|rotary wing|helicoptero|helicóptero|hubschrauber|hélicoptère|helicoptere", "헬기|헬리콥터|회전익|直升机|直升機|ヘリ");
const CAT_SIM = m("sim|sims|simulator|simulators|simulated flight|flight simulator|ftd|ffs|fstd|aatd|batd|fnpt|fnpt ii|synthetic|synthetic trainer|device|training device|simulador|simulateur", "시뮬레이터|시뮬|모의비행|모의|모의비행장치|模拟机|模擬機|模拟器|模擬器|シミュレーター");

const COND_DAY = m("day|days|daytime|day time|daylight|diurno|diurna|dia|día|tag|tagflug|tag flug|jour|de jour|vol de jour|de dia|de día", "주간|白天|昼间|晝間|日间|日間|昼");
const COND_NIGHT = m("night|nights|nite|night time|nighttime|nocturnal|nocturno|nocturna|noche|nacht|nachtflug|nacht flug|nuit|de nuit|vol de nuit|de noche|vuelo nocturno", "야간|夜航|夜间|夜間|夜");

const CFI = m("dual given|dual gvn|dual giv|given|instruction given|instructor time|as instructor|instructing|teaching|cfi|cfii|mei|fi|fi time|instructor|flight instructor|instrucción dada|instruccion dada|fluglehrer|flug lehrer|lehrer|instructeur", "교관|교관비행|교관시간|教员|教官|教練");
const ROLE_DUAL = m("dual|dual received|dual rec|dual recd|dual rcvd|dual recvd|dual rec d|received|rec d|recd|instruction|instruction received|training|trng|trainee|student pilot|with instructor|dual time|dual instruction|put|p ut|pu t|p u t|pilot under training|under training|doble mando|instrucción|instruccion|instrucción recibida|doppelsteuer|doppel steuer|double commande|dc", "훈련|교육|교육비행|동승|带飞|帶飛|教学|教學|受訓");
const ROLE_PIC = m("pic|p1|p 1|p 1 s|pilot in command|captain|capt|cpt|cmdr|command|in command|pic time|pic us|picus|comandante|piloto al mando|al mando|kommandant|kapitän|kapitan|verantwortlicher pilot|verantwortlicher|cdb|commandant|commandant de bord", "기장|机长|機長");
const ROLE_SIC = m("sic|second in command|second in cmd|2nd in command|aug|augment|augmenting|augmented|augmentation|augmenting pilot|relief|cruise relief|cruise|irp|international relief|heavy crew|segundo al mando|segundo piloto", "증원|보강|加机组|巡航|巡航机长");
// UK "P2" is the operating co-pilot (first officer), not augmenting crew — cell text "P2" maps to FO in apply as well.
const ROLE_FO = m("fo|f o|p2|p 2|first officer|1st officer|co pilot|copilot|co pilote|copilote|copiloto|cp|kopilot|primer oficial|opl|erster offizier", "부조종사|부기장|副驾驶|副機長|副操縦士");
const ROLE_CHECK = m("check|chk|check flight|line check|ppc|pcc|proficiency check|skill test|flight test|examination|exam|check ride|prüfung|pruefung|check time", "체크|심사|考核|检查|檢查");
const ROLE_SOLO = m("solo|solo flight|solo time|en solitario|alleinflug", "단독|단독비행|单飞|單飛|単独");

const XC = m("cross country|crosscountry|x country|xcountry|xc|x c|xctry|cross ctry|x ctry|cross country time|xc time|navigation|navex|nav ex|travesía|travesia|vuelo de travesía|überland|ueberland|überlandflug|voyage|cross", "야외비행|야외|크로스컨트리|转场|轉場|野外|野外飞行|野外飛行");
const INST_HOOD = m("hood|hooded|under the hood|under hood|simulated instrument|sim instrument|sim inst|simulated inst|sim imc|simulated imc|foggles|view limiting|capucha|instrumentos simulados|instrument simulé", "후드|후드계기|모의계기|模拟仪表|模擬儀表");
const INST_ACTUAL = m("actual|actual instrument|actual inst|act inst|act|imc|instrument actual|in imc|real|real imc|actual imc|ifr actual|instrumentos reales|instrument réel", "실계기|실제계기|计器实际|实际仪表|實際儀表|実機計器");
const INST_WORD = m("instrument|instruments|inst|instr|ifr|if|ifr time|instrument time|instrument flight|instrumentos|instrumental|instrumenten|instrumentenflug|instrumentenflugzeit|vol aux instruments|vsv|vol sans visibilite|vol sans visibilité", "계기|계기비행|仪表|儀表|計器");

const TOTAL = m("total|totals|tot|sum|sub total|subtotal|grand total|gesamt|gesamtzeit|gesamt zeit|gesamtflugzeit|gesamt flug zeit|somme|suma|totale", "합계|총계|총|계|总计|總計|合计|合計|小计|小計|計");
const TIME_WORD = m(
  "time|times|hours|hrs|hr|h|duration|dur|block|blk|block time|flight time|flt time|flt hrs|flight hours|tt|total time|piloting time|tiempo|horas|hora|tiempo de vuelo|tiempo total|horas de vuelo|zeit|stunden|dauer|flugzeit|flug zeit|flugstunden|flug stunden|blockzeit|block zeit|gesamtzeit|gesamt zeit|gesamtflugzeit|gesamt flug zeit|flugdauer|flug dauer|temps|heures|heure|temps de vol|temps total|durée de vol|duree de vol|durée|duree",
  "비행시간|시간|飞行时间|飛行時間|時間|时间",
);
const BLOCK_WORD = m("block|blk|block time|blockzeit|block zeit|bloc|temps bloc|tiempo bloque|blocks");

const APPR_PREC = m("precision|precision approach|precision approaches|prec|ils|par|lpv|mls|gls|cat i|cat ii|cat iii", "정밀|精密");
const APPR_NONPREC = m("non precision|nonprecision|non precision approach|non precision approaches|non prec|np|npa|vor|ndb|rnav|lnav|lnav vnav|loc|localizer|gps|rnp", "비정밀|非精密");
const APPROACH = m("approaches|approach|apprs|appr|apch|apchs|app|apps|appchs|appch|iap|iaps|instrument approaches|instrument approach|ifr approaches|ifr appchs|ifr app|ifr apps|no of approaches|number of approaches|aproximaciones|aproximación|aproximacion|anflüge|anfluege|anflug|approches|approche|nb app|nb appr|nb approches|nombre d approches", "접근|진입|접근횟수|进近|進近|进近次数");
const HOLDS = m("holds|hold|holding|holding patterns|holding pattern|hld|esperas|espera|warteverfahren|attente", "체공|홀딩|等待|等待程序");
// "Nb att." is the French club-logbook abbreviation of "nombre d'atterrissages" (landings).
const LANDING = m("landings|landing|ldg|ldgs|lndg|lnd|land|full stop|full stops|full stop landings|fs|touch and go|touch go|t g|tg|t gs|aterrizajes|aterrizaje|landungen|landung|nachtlandungen|nacht landungen|taglandungen|tag landungen|atterrissages|atterrissage|nb att|nb atterrissages|nombre d atterrissages|day landings|night landings", "착륙|착륙횟수|着陆|著陸|着陸|降落");
const FULL_STOP = m("fs|full stop|full stops|full stop landings|fullstop");
// German bare "Start" is left out on purpose: "Engine Start" / "Flight Start" are clock stamps. Compounds carry it.
const TAKEOFF = m("takeoffs|takeoff|take offs|take off|t o|t os|to s|tos|to day|to night|to d|to n|tko|tkos|tkof|toff|toffs|departures|despegues|despegue|starts|nachtstarts|nacht starts|tagstarts|tag starts|anzahl starts|décollages|decollages|décollage", "이륙|이륙횟수|起飞|起飛|離陸");

const F_DATE = m("date|dates|flight date|date flown|date of flight|dt|datum|fecha|data|flight flight date", "날짜|일자|비행일|비행일자|日期|日付|年月日");
const F_REG = m("registration|reg|regn|regno|reg no|reg number|reg nr|tail|tail number|tail no|tail num|tail nr|tailnumber|ident|identifier|aircraft id|aircraft ident|aircraft identification|aircraft registration|a c reg|ac reg|n number|n no|nnumber|call sign|callsign|matricula|matrícula|kennzeichen|immatriculation|immat|immat avion|flight aircraft registration", "등록번호|등록기호|기체번호|注册号|注冊號|机号|机尾号|登録記号|機体番号");
const F_MAKE = m("make model|make and model|make|model|aircraft type|aircraft model|aircraft make|acft type|a c type|ac type|type code|typecode|type|types|aircraft|acft|a c|ac|airplane|aeroplane|plane|equipment|equip|aeronave|tipo|tipo de aeronave|flugzeugtyp|flugzeug typ|flugzeug|typ|muster|avion|aeronef|aéronef|type d avion|type d aeronef|type d aéronef|flight aircraft type|flight selected aircraft type|aircraft type code", "기종|항공기|항공기기종|机型|機種|型号|飞机|航空機|機体");
const F_ROUTE = m("route|routing|city pair|city pairs|legs|leg|segment|sector|sectors|trip|ruta|strecke|trajet|itinéraire|itineraire", "항로|경로|구간|航线|航線|航路|路线|路線");
const F_FROM = m(
  "from|dep|dept|departure|departure airport|departure aerodrome|dep airport|origin|orig|off from|point of departure|departure point|place of departure|flight actual departure|actual departure|desde|origen|salida|von|abflug|abflugort|abflug ort|startort|start ort|départ|depart|aerodrome de depart|aérodrome de départ",
  "출발|출발지|출발공항|起飞地|起飞机场|出发|出發|出発地|出发地",
  "de|ab",
);
const F_TO = m(
  "to|dest|destination|destination airport|arr|arrival|arrival airport|arr airport|point of arrival|place of arrival|flight actual destination|actual destination|hasta|destino|llegada|nach|ankunft|ankunftsort|ankunft ort|landeort|lande ort|arrivée|arrivee|vers|aerodrome d arrivee|aérodrome d arrivée",
  "도착|도착지|목적지|도착공항|目的地|到达|到達|到着地|到达地",
  "à",
);
const F_REMARKS = m("remarks|remark|comments|comment|notes|note|description|memo|pilot comments|endorsements|endorsement|comments remarks|remarks and endorsements|flight remarks|observaciones|observations|bemerkungen|anmerkungen|commentaires|remarques", "비고|메모|특이사항|내용|참고|备注|備考|备考|注记|摘要");
const F_CATEGORY = m("category|cat|class|aircraft category|category class|cat class|aircraft class|category and class|categoría|categoria|clase|klasse|catégorie|categorie", "기종구분|구분|类别|類別|类型");
const F_ROLE = m("role|capacity|function|position|crew position|duty position|pilot function|seat|función|funcion|funktion|fonction|rôle", "직책|역할|职位|職位|职务");
const F_BLOCK_OFF = m("block off|blk off|off block|off blocks|out|time out|out time|chocks off|gate out|departure time|dep time|atd|std|off|time off|wheels off|airborne|takeoff time|t o time|block out|startzeit|start zeit|abflugzeit|abflug zeit|heure de depart|heure de départ|hora de salida", "출발시간|출발시각|起飞时间|离港时间");
const F_BLOCK_ON = m("block on|blk on|on block|on blocks|in|time in|in time|chocks on|gate in|arrival time|arr time|ata|sta|on|time on|wheels on|touchdown|landing time|ldg time|block in|landezeit|lande zeit|ankunftszeit|ankunft zeit|heure d arrivee|heure d arrivée|hora de llegada", "도착시간|도착시각|降落时间|到港时间");

const N_PIC = m("pic|pilot in command|captain|capt|commander|pilot|pilot name|name|names|instructor|instructor name|cfi name", "기장|기장명|조종사|이름|성명|机长|姓名|飞行员");
const N_COPILOT = m("co pilot|copilot|first officer|fo|f o|sic|second pilot|student|students|trainee|other pilot|other crew|crew|crew member|crew names|second in command|co pilot student|student or co pilot|alumno|alumna|estudiante|eleve|élève|schüler|schueler|flugschüler|flugschueler|copilote|co pilote", "부기장|부조종사|학생|副驾驶|副機長|学员");
const N_THIRD = m("third pilot|3rd pilot|relief pilot|cruise pilot|relief|aug pilot|augmenting pilot|third crew", "제3조종사|第三");
const N_CHECK = m("check pilot|examiner|check airman|check captain|checker|inspector|dpe|ace|tre|tri|fe|flight examiner|examinador", "검열관|심사관|시험관|考核员|检查员");
/** A header that names a crew slot: inside it the role token says WHICH name field (LogTen "flight_selectedCrewPIC"). */
const CREW_WORD = m("crew|crew member|crew members|crew name|crew names|selected crew|crew list");

// ---------------------------------------------------------------------------
// German compounds
// ---------------------------------------------------------------------------

/** Morphemes a logbook compound is built from; a token that is entirely ≥ 2 of these is split ("gesamtflugzeit" → "gesamt flug zeit"). */
const DE_PARTS = ["gesamt", "flugzeug", "flug", "block", "nacht", "tag", "zeit", "landungen", "landung", "lande", "starts", "start", "ort", "steuer", "lehrer", "doppel", "typ", "stunden", "dauer", "anzahl", "abflug", "ankunft"];
const DE_MIN_TOKEN = 6;

/** Fewest-pieces segmentation of `token` into DE_PARTS, or null when it does not decompose into at least two. */
function segmentGerman(token: string): string[] | null {
  const n = token.length;
  const best: (string[] | undefined)[] = new Array<string[] | undefined>(n + 1);
  best[0] = [];
  for (let i = 0; i < n; i++) {
    const cur = best[i];
    if (!cur) continue;
    for (const p of DE_PARTS) {
      if (!token.startsWith(p, i)) continue;
      const j = i + p.length;
      const prev = best[j];
      if (!prev || prev.length > cur.length + 1) best[j] = [...cur, p];
    }
  }
  const r = best[n];
  return r && r.length >= 2 ? r : null;
}

export function splitCompounds(s: string): string {
  if (!/[a-zäöüß]{6,}/.test(s)) return s;
  return s
    .split(" ")
    .map((t) => (t.length >= DE_MIN_TOKEN && /^[a-zäöüß]+$/.test(t) ? (segmentGerman(t)?.join(" ") ?? t) : t))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Segment → facets
// ---------------------------------------------------------------------------

const cache = new Map<string, Facets>();

/** normaliseHeader + compound splitting + digit/letter separation — the string the matchers see. */
export function normaliseSegment(rawSegment: string): string {
  return splitCompounds(normaliseHeader(rawSegment)).replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2");
}

export function facetsOf(rawSegment: string): Facets {
  const s = normaliseSegment(rawSegment);
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
    if (f.landing && hit(s, FULL_STOP)) f.fullStop = true;
  }

  if (take(hit(s, TOTAL))) f.total = true;
  if (take(hit(s, TIME_WORD))) f.timeWord = true;
  if (f.timeWord && hit(s, BLOCK_WORD)) f.blockWord = true;

  if (!f.field) {
    if (take(hit(s, F_DATE))) f.field = "date";
    else if (take(hit(s, F_REG))) f.field = "registration";
    else if (take(hit(s, F_ROUTE))) f.field = "route";
    else if (take(hit(s, F_REMARKS))) f.field = "remarks";
    else if (take(hit(s, F_CATEGORY)) && !f.cat) f.field = "category";
    else if (take(hit(s, F_ROLE)) && !f.role) f.field = "role";
    else if (take(hit(s, F_FROM)) && !f.takeoff) f.field = "from";
    else if (take(hit(s, F_TO)) && !f.landing && !f.takeoff) f.field = "to";
    else if (take(hit(s, F_MAKE)) && !f.cat) f.field = "make_model";
  }

  if (take(hit(s, N_CHECK))) f.name = "check_pilot";
  else if (take(hit(s, N_THIRD))) f.name = "third_pilot";
  else if (take(hit(s, N_COPILOT))) f.name = "copilot";
  else if (take(hit(s, N_PIC))) f.name = "pic";

  // A crew-slot header is a name column whatever role word it carries: the
  // role picks the field (…CrewPIC → PIC name, …CrewSIC → co-pilot, …CrewInstructor → check pilot).
  // "Heavy Crew" / "Crew Time" are hours columns: they keep their role and are not names.
  if (hit(s, CREW_WORD) && (f.timeWord || /(?:^|\s)heavy crew(?:\s|$)/.test(s))) {
    f.name = null;
  } else if (hit(s, CREW_WORD)) {
    if (f.name !== "third_pilot" && f.name !== "check_pilot") {
      if (f.role === "pic" || f.role === "solo") f.name = "pic";
      else if (f.role === "fo" || f.role === "sic" || f.role === "dual") f.name = "copilot";
      else if (f.role === "check" || f.field === "cfi_time") f.name = "check_pilot";
      else if (!f.name) f.name = "copilot";
    }
    f.role = null;
    if (f.field === "cfi_time") f.field = null;
  }

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
    if (f.blockWord) out.blockWord = true;
    if (f.approach) out.approach = f.approach;
    if (f.holds) out.holds = true;
    if (f.landing) out.landing = true;
    if (f.takeoff) out.takeoff = true;
    if (f.fullStop) out.fullStop = true;
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

/** True when the facets carry anything a unit leaf ("no.", "#", "hrs") could inherit from its parents. */
export function hasInheritableFacets(f: Facets): boolean {
  return Boolean(f.landing || f.takeoff || f.approach || f.holds || f.timeWord || f.total || f.cat || f.cond || f.role || f.inst || f.xc || f.field);
}

const UNIT_LEAF_RE = /^(?:hrs?|hours?|no|nr|num|number|min|mins|minutes|count|cnt|qty|quantity|anzahl|nbr|nb|x|n|times|std|h)$/;

/** True for a leaf that only states a unit ("hrs", "no.", "#", "count") — or nothing at all once normalised ("#"). */
export function isUnitLeaf(rawSegment: string): boolean {
  const s = normaliseSegment(rawSegment);
  return s === "" || UNIT_LEAF_RE.test(s);
}
