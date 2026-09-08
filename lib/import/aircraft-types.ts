/**
 * Aircraft type → engine class, for rows whose sheet names no category.
 *
 * `engineClassFor("PA44")` → "me", `engineClassFor("Cessna 172")` → "se",
 * `engineClassFor("Robinson R44")` → "heli", `engineClassFor("A320 FFS")` →
 * "sim", `engineClassFor("ASK21")` → null (gliders and anything unknown).
 *
 * Layers, first hit wins:
 *   1. simulator words anywhere in the text ("FFS", "FNPT II", "Frasca");
 *   2. the curated ICAO type-designator table below, looked up by the
 *      normalised text (upper-case, punctuation stripped), by each token and
 *      each adjacent token pair ("PA 28", "DHC 6", "B 737") and — for variant
 *      suffixes such as PA28-181, C172SP, EC135T2, AS350B2 — by the longest
 *      table prefix that still ends in a digit;
 *   3. manufacturer + model-number conventions ("Cessna 310" → C310,
 *      "Beechcraft 58" → BE58, "PA-34" → PA34, "Bell 206" → helicopter);
 *   4. common long names ("Seminole", "King Air", "Dash 8", "Boeing 737-800",
 *      "Twin Otter", "Beaver", "Cherokee", "Black Hawk" …).
 *
 * Ambiguous names ("Twin Star" is a DA42 and an AS355, "Cougar" a Grumman
 * twin and an AS532, a bare "Commander" either a single or a twin, a bare
 * "Eclipse" a DA20 or a twin jet) stay null unless qualified; apply.ts then
 * falls back to its legacy regex, and finally to SE.
 */

export type EngineClass = "se" | "me" | "heli" | "sim";

const SE = "se", ME = "me", HELI = "heli";

function table(cls: EngineClass, codes: string): [string, EngineClass][] {
  return codes.split(/\s+/).filter(Boolean).map((c) => [c, cls]);
}

/**
 * ICAO type designators plus the manufacturer spellings pilots actually
 * write (PA28 beside P28A, EC135 beside EC35, B737 beside B738 …).
 */
export const ICAO_TYPE_CLASSES: Readonly<Record<string, EngineClass>> = Object.fromEntries([
  // ---- single-engine pistons & turboprops ---------------------------------
  ...table(SE, `
    C120 C140 C150 C152 C162 C170 C172 C175 C177 C180 C182 C185 C188 C190 C195 C205 C206 C207 C208 C210 C350 C400
    C72R C77R C82R P210 T182 T206 T210 T240 U206 COL3 COL4
    PA11 PA12 PA14 PA15 PA16 PA17 PA18 PA19 PA20 PA22 PA24 PA25 PA28 P28A P28B P28R P28T PA32 P32R P32T PA36 PA38 PA46 P46T PA47
    J3 J3C J4 J5 PA28R PA32R PA46T M350 M500 M600
    BE17 BE19 BE23 BE24 BE33 BE35 BE36 B36 A36 B36T BE45 BE77 A36TC
    SR20 SR22 S22T SR22T SF50
    DA20 DV20 DA40 DA50 HK36 DA40NG
    M20 M20C M20E M20F M20J M20K M20M M20P M20R M20S M20T M20U M20V M22
    DHC1 DHC2 DHC3 DH82 DHC2T
    PC6 PC7 PC9 PC12 PC21 PC12NG
    TBM TBM7 TBM8 TBM9 TB9 TB10 TB20 TB21 TB30 RALL MS88 MS89
    RV3 RV4 RV6 RV7 RV8 RV9 RV10 RV12 RV14
    GLST GLAS LNC2 LNC4 LNCE KODI EPIC
    AA1 AA5 AA5A AA5B TIGR AC11 AC14 NAVI
    BL8 CH7A CH7B 8KCAB 7ECA 7GCBC HUSK SCOU DECA
    PTS1 PTS2 E300 E330 EA300 EA330 EA200 EA400 SU26 SU29 SU31 EAGL YK18 YK50 YK52 YK55 CJ6 T6 TEX2 P51 ST75 T34 T28
    P92 P96 P2002 P2008 P2010 P208 AT01 EV97 C42 CTLS CTSW VIRU SINU PANT
    Z42 Z43 Z142 Z242 Z526 DR40 DR400 DR22 DR30 DR221 DR253 DR300 HR20 HR200 R200 R300 R3000 D11 D112 D140 DR10 DR11
    G115 G120 T67 BDOG
    AT3P AT3T AT4P AT4T AT5P AT5T AT6T AT8T AT301 AT401 AT402 AT502 AT602 AT802
    LA4 LA4A LA25 SEAB REPB C305 O1 L18 L19 L21 CUB
    AN2 WILG PZ06 M4 M5 M6 M7 M7T ERCO SWIF TCRT 7AC 11AC
    L39 L29 TUCA
  `),
  // ---- multi-engine pistons, turboprops, bizjets, airliners -----------------
  ...table(ME, `
    PA23 PA27 PA30 PA31 P31T PA34 PA39 PA42 PA44 P44 PA60 AEST PAY1 PAY2 PAY3 PAY4 PA31T PA31P
    BE18 BE50 BE55 BE56 BE58 BE60 BE65 BE70 BE76 BE80 BE88 BE90 BE9L BE9T BE10 BE20 BE30 BE40 BE95 BE99 B190 B200 B250 B300 B350 BE200 BE300 BE350 BE1900 B1900
    A90 B90 C90 E90 F90 PRM1 H25A H25B H25C HA4T BE58P BE58TC MU2 MU30
    C303 C310 C320 C335 C336 C337 P337 T303 T310 T337 C340 C401 C402 C404 C406 C411 C414 C421 C425 C441
    C500 C501 C510 C525 C25A C25B C25C C25M C526 C550 C551 C55B C560 C56X C650 C680 C68A C700 C750 CJ1 CJ2 CJ3 CJ4
    DA42 DA62 P2006 P06T P2012 P68 PN68 P68T P68C P68R
    BN2 BN2A BN2B BN2P BN2T TRIS GA7 G21 G44 G73 AC50 AC56 AC68 AC90 AC95 AC80
    DHC4 DHC5 DHC6 DHC7 DHC8 DH8A DH8B DH8C DH8D Q100 Q200 Q300 Q400 DHC6300 DHC6400
    AT43 AT44 AT45 AT46 AT72 AT73 AT75 AT76 ATR42 ATR72
    SF34 SB20 SF340 SAAB340 SAAB2000
    E110 E120 E135 E140 E145 E170 E175 E190 E195 E75L E75S E190E2 E195E2 E290 E295 E50P E55P E35L E545 E550 ERJ135 ERJ145 ERJ170 ERJ190 EMB110 EMB120 EMB135 EMB145 EMB170 EMB190
    CRJ1 CRJ2 CRJ7 CRJ9 CRJX CRJ100 CRJ200 CRJ700 CRJ900 CRJ1000 CL30 CL35 CL60 CL64 CL65 CL300 CL350 CL600 CL601 CL604 CL605 CL650 GL5T GLEX GL7T GL8T GALX
    LJ23 LJ24 LJ25 LJ28 LJ31 LJ35 LJ36 LJ40 LJ45 LJ55 LJ60 LJ70 LJ75 LJ85
    GLF2 GLF3 GLF4 GLF5 GLF6 GIV GV G100 G150 G200 G280 G450 G500 G550 G600 G650 G700 G800 GA5C GA6C GA7C GA8C
    FA10 FA20 FA50 F900 F2TH FA7X FA8X FA6X FA9X
    HDJT EA50 SW2 SW3 SW4 SW5 JS31 JS32 JS41 JS20 B461 B462 B463 RJ70 RJ85 RJ1H BA11 ATP HS748 D228 D328 J328 SH33 SH36 SC7 L410 L420 P180 P166 PC24 CVLT CVLP
    F27 F28 F50 F70 F100 F406
    AN24 AN26 AN28 AN30 AN32 AN72 AN12 AN22 AN124 AN148 AN158 A140 A148
    B703 B712 B720 B721 B722 B731 B732 B733 B734 B735 B736 B737 B738 B739 B37M B38M B39M B3XM B741 B742 B743 B744 B748 B74S B752 B753 B762 B763 B764 B772 B773 B77L B77W B778 B779 B788 B789 B78X
    B707 B717 B727 B747 B757 B767 B777 B787 B737NG B737MAX
    A300 A306 A30B A310 A318 A319 A320 A321 A19N A20N A21N A330 A332 A333 A338 A339 A340 A342 A343 A345 A346 A350 A359 A35K A380 A388 A400 A220 BCS1 BCS3 A221 A223
    DC3 DC4 DC6 DC7 DC8 DC85 DC86 DC87 DC9 DC91 DC92 DC93 DC94 DC95 DC10 MD11 MD80 MD81 MD82 MD83 MD87 MD88 MD90 MD95
    L101 L188 C130 C17 C5 P3 P8 E3 KC135 KC10 IL18 IL62 IL76 IL86 IL96 IL14 TU34 TU54 TU14 TU04 TU95 YK40 YK42 SU95 C919 ARJ21 MRJ9 SSJ100
    S601 N262 YS11 HERN C46 L049 CONI
  `),
  // ---- helicopters ----------------------------------------------------------
  ...table(HELI, `
    R22 R44 R66 R22B R44II R66T
    B06 B06L B06T B47 B47G B204 B205 B206 B206L B210 B212 B214 B222 B230 B407 B412 B427 B429 B430 B505 B525 UH1 UH1H UH1N UH1Y AH1 AH1Z TH57 TH67 OH58
    EC20 EC30 EC35 EC45 EC55 EC75 EC25 EC120 EC130 EC135 EC145 EC155 EC175 EC225 EC635 EC665
    H120 H125 H130 H135 H145 H155 H160 H175 H215 H225
    AS32 AS3B AS50 AS55 AS65 AS332 AS350 AS355 AS365 AS532 AS550 AS555 AS565 SA315 SA316 SA318 SA319 SA321 SA330 SA341 SA342 SA360 SA365 ALO2 ALO3 LAMA GAZL PUMA BK17 BK117 B105 BO105 SUPERPUMA
    S51 S55 S58 S61 S62 S64 S65 S70 S76 S92 S434 S300 S330 S333 H60 UH60 HH60 SH60 MH60 CH53 H53 CH46 SEAK
    H269 H300 H369 H500 HU50 MD50 MD52 MD53 MD60 MD500 MD520 MD530 MD600 MD900 MD902 EXPL
    A109 A119 A129 A139 A149 A169 A189 AW09 AW109 AW119 AW139 AW149 AW169 AW189 AW101 EH101 A109E A109S
    EN28 EN48 G2CA UH12 KA26 KA27 KA32 MI2 MI8 MI17 MI24 MI26 MI171 MI172 CH47 AH64 OH6 UH72
  `),
]);

/** Number of curated designators (tests assert the table stays large). */
export const ICAO_TYPE_COUNT = Object.keys(ICAO_TYPE_CLASSES).length;

// ---------------------------------------------------------------------------
// Long names and manufacturer conventions
// ---------------------------------------------------------------------------

/** Simulator words — whole tokens, so "Simba" or "FTDX" do not count. */
const SIM_WORDS = /(?:^|[^a-z])(?:sim|sims|simulator|simulateur|simulador|simulatore|ffs|ftd|fnpt|fstd|aatd|batd|pcatd|frasca|redbird|alsim|mechtronix|synthetic\s*trainer|flight\s*trainer|flight\s*sim(?:ulator)?|link\s*trainer|시뮬레이터|시뮬|모의비행장치|模拟机|模擬機|模拟器|模擬器|シミュレーター)(?=$|[^a-z])/i;

/** "Cessna 310R" → C310; "PA-34-200T" → PA34; "Beechcraft 58" → BE58, "Beech 1900D" → BE1900; "Bell 407GX" → helicopter. */
const CESSNA_MODEL = /\bcessna\s*-?\s*(\d{3})/;
const PIPER_MODEL = /\bpa\s*-?\s*(\d{2})\b/;
const BEECH_MODEL = /\bbeech(?:craft)?\s*-?\s*([a-z]?\d{2,4}[a-z]?)\b/;
const BELL_MODEL = /\bbell\s*-?\s*(\d{2,3})/;

/** Ordered: helicopters, then twins, then singles, then explicit unknowns (gliders …). */
const NAME_PATTERNS: [RegExp, EngineClass | null][] = [
  // -- helicopters first: they share words with fixed-wing makers ("Airbus H135", "Apache", "Bell") --
  [/\b(?:helicopter|helicopters|helicoptere|hélicoptère|helicoptero|helicóptero|hubschrauber|rotorcraft|rotary\s*wing)\b|헬기|헬리콥터|회전익|直升机|直升機|ヘリ/, HELI],
  [/\brobinson\b|\br-?(?:22|44|66)\b/, HELI],
  [/\bjet\s*ranger\b|\bjetranger\b|\blong\s*ranger\b|\blongranger\b|\bhuey\b|\bkiowa\b|\bcobra\b/, HELI],
  [/\b(?:as|h|ec)\s*-?\s*(?:120|125|130|135|145|155|160|175|215|225|332|350|355|365|532|550|555|565|635|665)\b/, HELI],
  [/\b(?:ecureuil|écureuil|squirrel|astar|a-star|fennec|dauphin|panther|caracal|puma|super\s*puma|gazelle|alouette|lama|bk\s*-?117|bo\s*-?105|colibri)\b/, HELI],
  [/\bsikorsky\b|\bs-?(?:58|61|64|70|76|92|434)\b|\bblack\s*hawk\b|\bblackhawk\b|\bsea\s*king\b|\bseahawk\b|\b(?:uh|hh|sh|mh)-?60\b|\bch-?(?:47|53|46)\b|\bchinook\b|\bah-?64\b|\boh-?58\b|\buh-?72\b|\blakota\b/, HELI],
  [/\b(?:agusta|agustawestland|leonardo)\b|\baw-?\s?(?:09|109|119|139|149|169|189|101)\b|\ba-?(?:109|119|129|139|149|169|189)\b|\bkoala\b|\bgrand\s*new\b|\beh-?101\b/, HELI],
  [/\bmd\s*helicopters?\b|\bmd\s*-?\s*(?:500|520|530|600|900|902)\b|\bhughes\s*-?\s*(?:269|300|369|500)\b|\bschweizer\s*-?\s*(?:269|300|330|333|s300)\b|\bmd\s*explorer\b|\bnotar\b/, HELI],
  [/\b(?:enstrom|cabri|guimbal|brantly|hiller|kamov|eurocopter|aerospatiale|aérospatiale|airbus\s*helicopters?|westland|wessex|merlin\s*hc|ka-?(?:26|27|32)|mi-?(?:2|8|17|24|26|171|172))\b/, HELI],
  // -- twins by name --
  [/\btwin\s*otter\b|\bdhc\s*-?\s*6\b/, ME],
  [/\bdash\s*-?\s*(?:7|8)\b|\bdhc\s*-?\s*(?:7|8)\b|\bq\s*-?(?:100|200|300|400)\b|\bdh8[abcd]\b/, ME],
  [/\btwin\s*comanche\b|\btwin\s*bonanza\b|\btwin\s*beech\b|\btwin\s*commander\b|\btwin\s*navion\b/, ME],
  [/\b(?:seminole|seneca|aztec|apache|navajo|chieftain|mojave|cheyenne|aerostar|baron|duchess|duke|travel\s*air|queen\s*air|king\s*air|super\s*king\s*air|starship|beechjet|premier|hawker|beech\s*-?\s*(?:18|99|1900)|1900[cd]?)\b/, ME],
  [/\b(?:skymaster|skyknight|golden\s*eagle|chancellor|conquest|crusader|titan|citation|sovereign|latitude|longitude|citationjet|cj-?[1-4]|mustang\s*(?:510|c510)|c-?5(?:00|01|10|25|50|51|60|6x)\b|c-?6(?:50|80|8a)\b|c-?7(?:00|50)\b)/, ME],
  [/\bcessna\s*-?\s*(?:303|310|320|335|336|337|340|401|402|404|406|411|414|421|425|441|500|501|510|525|550|551|560|650|680|700|750)\b|\bc-?(?:303|310|320|335|336|337|340|401|402|404|406|411|414|421|425|441)[a-z]?\b/, ME],
  [/\b(?:islander|trislander|defender|partenavia|vulcanair|p-?68|tecnam\s*p-?(?:2006|2012)|p-?2006|p-?2012|da-?42|da-?62|diamond\s*twin)\b/, ME],
  [/\b(?:caribou|buffalo|metro|metroliner|merlin|jetstream|bandeirante|brasilia|xingu|phenom|legacy|praetor|lineage|erj|e-?jet|crj|challenger|global\s*(?:express|xrs|5000|5500|6000|6500|7000|7500|8000)|learjet|lear\s*jet|lear|gulfstream|falcon\s*\d|falcon|hondajet|honda\s*jet|eclipse\s*(?:500|550|ea500)|ea-?500|avanti|piaggio|saab\s*(?:340|2000)|saab|fokker|bae\s*-?\s*146|avro\s*rj|rj-?(?:70|85|100)|dornier\s*(?:228|328)|do-?(?:228|328)|let\s*-?\s*410|l-?410|shorts?\s*(?:330|360)|skyvan|nomad|convair|electra|tristar|l-?1011|hercules|c-?130|globemaster|c-?17|orion|p-?3|poseidon|p-?8|superjet|ssj|mrj|spacejet|arj21|c919|comac|fouga|magister|alpha\s*jet|pc-?24)\b/, ME],
  [/\b(?:aero|turbo|jet|shrike|grand)\s*commander\b|\bcommander\s*-?\s*(?:500|520|560|680|690|695|840|900|980|1000)\b/, ME],
  [/\b(?:grumman\s*cougar|ga-?7|goose|widgeon|mallard|albatross)\b/, ME],
  // Boeing Stearman before the generic Boeing rule.
  [/\bstearman\b|\bpt-?17\b/, SE],
  [/\b(?:boeing|airbus|embraer|bombardier|canadair|atr|mcdonnell|douglas|dc-?(?:3|4|6|7|8|9|10)|md-?(?:8\d|9\d|11)|lockheed|antonov|an-?(?:12|22|24|26|28|30|32|72|124|148|158)|ilyushin|il-?(?:18|62|76|86|96)|tupolev|tu-?(?:134|154|204|214)|yak-?(?:40|42)|british\s*aerospace|de\s*havilland\s*(?:dove|heron|comet)|vickers|viscount|fairchild\s*(?:metro|sw))\b/, ME],
  [/(?:^|[^0-9a-z])7[0-9]7(?:[^0-9]|$)|(?:^|[^0-9a-z])a3[0-9]{2}(?:[^0-9]|$)|(?:^|[^0-9a-z])a220(?:[^0-9]|$)|\b737\s*(?:ng|max)\b|\bmax\s*[89]\b/, ME],
  // -- singles by name --
  [/\bbeaver\b|\bdhc\s*-?\s*2\b|\botter\b|\bdhc\s*-?\s*3\b|\bchipmunk\b|\bdhc\s*-?\s*1\b|\btiger\s*moth\b/, SE],
  [/\b(?:cherokee|warrior|cadet|archer|arrow|dakota|pathfinder|lance|saratoga|malibu|mirage|matrix|meridian|m350|m500|m600|tomahawk|pawnee|brave|comanche|pacer|tri-?pacer|colt|clipper|vagabond|cub|super\s*cub|cruiser|j-?3)\b/, SE],
  [/\b(?:bonanza|debonair|musketeer|sundowner|sierra|skipper|mentor|staggerwing|beech\s*-?\s*(?:19|23|24|33|35|36|77)|t-?34)\b/, SE],
  [/\b(?:skyhawk|skylane|stationair|centurion|cardinal|cutlass|caravan|grand\s*caravan|skywagon|skycatcher|corvalis|columbia|ttx|skylark|hawk\s*xp|cessna\s*-?\s*(?:120|140|150|152|162|170|172|175|177|180|182|185|188|205|206|207|208|210|240|350|400))\b/, SE],
  [/\b(?:cirrus|sr-?(?:20|22)|vision\s*jet|sf-?50)\b/, SE],
  [/\b(?:mooney|ovation|acclaim|m20[a-z]?)\b/, SE],
  [/\b(?:katana|diamond\s*(?:star|da20|da40|da50|dv20)|da-?(?:20|40|50)|dv-?20)\b/, SE],
  [/\b(?:pilatus\s*pc-?\s*(?:6|7|9|12|21)|pc-?(?:6|7|9|12|21)|porter|turbo\s*porter|tbm\s*-?\s*(?:700|850|900|910|930|940|960)|tbm|socata|daher|trinidad|tobago|tampico|rallye|kodiak|quest\s*kodiak|epic\s*(?:e1000|lt))\b/, SE],
  [/\b(?:van'?s|rv-?\s?(?:3|4|6|7|8|9|10|12|14)[a-z]?|glasair|glastar|lancair)\b/, SE],
  [/\b(?:grumman\s*(?:aa-?[15]|tiger|cheetah|traveler|yankee|trainer|lynx)|aa-?5[ab]?|aa-?1[abc]?|tiger|cheetah|american\s*general)\b/, SE],
  [/\b(?:citabria|decathlon|super\s*decathlon|champ|champion|scout|aeronca|bellanca|viking|husky|aviat|pitts|extra\s*-?\s*(?:200|230|300|330|400|500)|extra|ea-?\s?(?:200|230|300|330)|sukhoi\s*su-?(?:26|29|31)|su-?(?:26|29|31)|christen\s*eagle|yak-?\s?(?:18|50|52|55)|yakovlev|nanchang|cj-?6|texan|harvard|t-?6|t-?28|trojan|mustang\s*p-?51|p-?51|spitfire|hurricane|waco|stinson|luscombe|taylorcraft|ercoupe|swift|navion|maule|lake\s*(?:la-?4|buccaneer|renegade)|buccaneer|seabee)\b/, SE],
  [/\b(?:tecnam\s*p-?(?:92|96|2002|2008|2010)|p-?(?:92|96|2002|2008|2010)|aquila|evektor|eurostar|sportstar|ikarus|c-?42|flight\s*design|ctls|ctsw|pipistrel|virus|sinus|panthera|alpha\s*trainer|sport\s*cruiser|sportcruiser|bristell|sling\s*(?:2|4|tsi)|jabiru|rans|kitfox|zenith|zenair|ch-?(?:601|650|701|750)|savannah|skyranger|eurofox|foxbat|aeroprakt|a-?22|a-?32|remos|breezer|fk-?9|dynamic\s*wt9|shark|blackshape|vl-?3|tarragon|pioneer\s*(?:200|300|400)|alpi)\b/, SE],
  [/\b(?:zlin|z-?(?:42|43|142|143|242|526)|robin|dr-?(?:40|400|221|253|300|315|360)|hr-?(?:100|200)|jodel|d-?(?:112|117|119|140)|grob\s*-?\s?(?:115|120)|g-?115|g-?120|slingsby|t-?67|firefly|bulldog|tutor|tucano|embraer\s*(?:312|314)|hawk\s*t\d?|l-?39|albatros|l-?29|delfin|air\s*tractor|at-?\s?(?:301|401|402|502|602|802)|thrush|ag\s*cat|dromader|pzl|wilga|an-?2|antonov\s*-?\s*2)\b/, SE],
  [/\bcommander\s*-?\s*(?:112|114|115)\b|\brockwell\s*commander\b/, SE],
  // -- gliders, balloons, gyros: explicitly unknown, never "single" --
  [/\b(?:glider|sailplane|segelflugzeug|planeur|planeador|motor\s*glider|balloon|ballon|gyro|gyroplane|gyrocopter|autogyro|paraglider|hang\s*glider|ask-?\s?\d+|ls-?\d|dg-?\d{3,4}|discus|duo\s*discus|ventus|nimbus|janus|astir|twin\s*astir|grob\s*-?\s?(?:102|103|104|109)|g-?103|blanik|l-?13|l-?23|schleicher|schempp|puchacz|pw-?[56]|sgs\s*2-?33|2-?33|1-?26|pegase|pégase|std\s*cirrus|libelle|ka-?[678]|k-?(?:7|8|13|21))\b|글라이더|滑翔机/, null],
];

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/** Upper-case with every non-alphanumeric removed: "PA-28 181" → "PA28181". */
export function normaliseTypeCode(s: string): string {
  return (s ?? "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

/**
 * Exact table hit for a normalised code; with `allowPrefix`, the longest
 * table prefix that ends in a digit for variant suffixes ("C172SP" → C172,
 * "PA28181" → PA28, "EC135T2" → EC135). Registrations never hit: no code
 * starts with a nationality mark followed by a digit-ending table prefix.
 */
function codeClass(norm: string, allowPrefix: boolean): EngineClass | null {
  if (!norm) return null;
  const exact = ICAO_TYPE_CLASSES[norm];
  if (exact) return exact;
  if (!allowPrefix || norm.length > 9 || !/^[A-Z]/.test(norm)) return null;
  for (let len = norm.length - 1; len >= 3 && norm.length - len <= 5; len--) {
    const prefix = norm.slice(0, len);
    if (!/\d$/.test(prefix)) continue;
    const hit = ICAO_TYPE_CLASSES[prefix];
    if (hit) return hit;
  }
  return null;
}

const cache = new Map<string, EngineClass | null>();

/**
 * Engine class of an aircraft make/model (or bare type code) as written in a
 * logbook; null when the text is unknown, a glider, or ambiguous.
 */
export function engineClassFor(makeModel: string): EngineClass | null {
  const key = (makeModel ?? "").trim();
  if (!key) return null;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const out = classify(key);
  if (cache.size > 5000) cache.clear();
  cache.set(key, out);
  return out;
}

function classify(text: string): EngineClass | null {
  const lower = text.normalize("NFKC").toLowerCase().replace(/[\s ]+/g, " ").trim();
  if (SIM_WORDS.test(lower)) return "sim";

  // 1. The whole string as a code ("PA44", "PA-44-180", "C172SP").
  const whole = normaliseTypeCode(text);
  const direct = codeClass(whole, true);
  if (direct) return direct;

  // 2. Tokens and adjacent pairs ("Piper PA 28 161 Warrior", "DHC 6", "B 737 800", "Cessna C172 N12345").
  const tokens = text.normalize("NFKC").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.length >= 3) {
      const c = codeClass(t, true);
      if (c) return c;
    }
    if (i + 1 < tokens.length) {
      const pair = t + tokens[i + 1];
      if (pair.length >= 3 && pair !== whole) {
        const c = codeClass(pair, true);
        if (c) return c;
      }
    }
  }

  // 3. Manufacturer + model number.
  const cessna = CESSNA_MODEL.exec(lower);
  if (cessna) {
    const c = codeClass(`C${cessna[1]}`, false) ?? codeClass(`T${cessna[1]}`, false);
    if (c) return c;
  }
  const piper = PIPER_MODEL.exec(lower);
  if (piper) {
    const c = codeClass(`PA${piper[1]}`, false);
    if (c) return c;
  }
  const beech = BEECH_MODEL.exec(lower);
  if (beech) {
    const m = beech[1].toUpperCase();
    const c = codeClass(m, true) ?? codeClass(`BE${m}`, true) ?? codeClass(`B${m}`, true);
    if (c) return c;
  }
  if (BELL_MODEL.test(lower)) return "heli";

  // 4. Long names.
  for (const [re, cls] of NAME_PATTERNS) {
    if (re.test(lower)) return cls;
  }
  return null;
}
