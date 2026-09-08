/**
 * Header-vocabulary / column-mapping tests for the import pipeline
 * (lib/import/synonyms.ts, lib/import/shape.ts, lib/import/mapping.ts).
 *
 *   npm run test:import        (runs every scripts/import-*.test.ts)
 *
 * One case per robustness-review finding: a header row plus one or two data
 * rows → the expected canonical target per column. Pure and offline — CSV
 * text is built in memory, no fixtures, no network, no database. Every case
 * prints PASS/FAIL; `process.exitCode` is set to 1 on any failure.
 *
 *   R6   German compounds (Gesamtflugzeit, Nachtlandungen, Startort …), French and Spanish vocabulary
 *   R9   "Engine Start" / "Flight Start" are clock stamps, not takeoffs
 *   R12  PUT / P1/S / P2 (UK role headers)            R24  header "P2" and cell "P2" both FO
 *   R19  LogTen crew-name columns pick the name field from their role token
 *   R20  multi-pilot time and custom fields are ignored
 *   R21  Dept / Arr / Von / Nach / De / À / Immat; tighter tail-number shape; fall-through to the next candidate
 *   R22  unit leaves ("no.", "#", "hrs") inherit their parent's meaning
 *   R23  "TO Day" / "TO Night" / "TO's" are takeoffs; bare "To" stays the arrival
 *   R25  headerless sheets: one flight-time column, registrations over type codes, small integers are landings
 *   R26  a generic "Landings" column survives next to "FS Day/Night Landings"
 *   R34  a bare "IFR" column yields to an explicit Actual / Hood column
 *   R35  "Aeroplane" over hours is aeroplane time, not a type
 *   R36  duplicate headers stay mapped, the second one flagged for review
 */
import assert from "node:assert/strict";
import { analyzeWorkbook, applyMapping, readWorkbook, targetKey, type Analysis, type Cell, type Grid } from "../lib/import";
import { columnStats, looksLikeTail, shapeScore } from "../lib/import/shape";
import { facetsOf, splitCompounds } from "../lib/import/synonyms";
import { effectiveSegs } from "../lib/import/mapping";
import { field } from "../lib/import/targets";

// ---------------------------------------------------------------------------
// Tiny runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    const reason = e instanceof Error ? e.message : String(e);
    console.log(`FAIL  ${name}\n      ${reason.split("\n").join("\n      ")}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const enc = (t: string) => new TextEncoder().encode(t);

function analyse(name: string, lines: string[]): Analysis {
  return analyzeWorkbook(enc(lines.join("\n")), name);
}

function pipeline(name: string, lines: string[]) {
  const bytes = enc(lines.join("\n"));
  const analysis = analyzeWorkbook(bytes, name);
  const applied = applyMapping(readWorkbook(bytes, name), analysis, analysis.mapping);
  return { analysis, applied };
}

function labelOf(a: Analysis, col: number): string {
  return a.header.paths.find((p) => p.col === col)?.label ?? "";
}

function assignmentAt(a: Analysis, col: number) {
  const c = a.mapping.columns.find((x) => x.col === col);
  assert.ok(c, `column ${col} "${labelOf(a, col)}" has no assignment`);
  return c;
}

function colByLabel(a: Analysis, label: string): number {
  const p = a.header.paths.find((x) => x.label === label);
  assert.ok(p, `no column labelled "${label}" (have: ${a.header.paths.map((x) => x.label).filter(Boolean).join(", ")})`);
  return p.col;
}

function assignment(a: Analysis, label: string) {
  return assignmentAt(a, colByLabel(a, label));
}

/** Assert the target key of every listed column (by index); reports every miss at once. */
function expectKeys(a: Analysis, expected: Record<number, string>): void {
  const bad: string[] = [];
  for (const [col, key] of Object.entries(expected)) {
    const got = targetKey(assignmentAt(a, Number(col)).target);
    if (got !== key) bad.push(`col ${col} "${labelOf(a, Number(col))}": expected ${key}, got ${got}`);
  }
  assert.equal(bad.length, 0, bad.join("\n"));
}

/** Same, addressed by header label. */
function expectByLabel(a: Analysis, expected: Record<string, string>): void {
  const byIndex: Record<number, string> = {};
  for (const [label, key] of Object.entries(expected)) byIndex[colByLabel(a, label)] = key;
  expectKeys(a, byIndex);
}

const text = (value: string): Cell => ({ kind: "text", value });
const num = (value: number, raw?: string): Cell => (raw ? { kind: "number", value, raw } : { kind: "number", value });

function gridOf(cells: Cell[]): Grid {
  return { sheet: "t", rows: cells.map((c) => [c]), width: 1 };
}

// ---------------------------------------------------------------------------
// R6 — German compounds, French and Spanish vocabulary
// ---------------------------------------------------------------------------

test("R6: German compounds split into morphemes; plain words and 'starts' are left alone", () => {
  assert.equal(splitCompounds("gesamtflugzeit"), "gesamt flug zeit");
  assert.equal(splitCompounds("nachtlandungen"), "nacht landungen");
  assert.equal(splitCompounds("startort landeort"), "start ort lande ort");
  assert.equal(splitCompounds("flugzeugtyp"), "flugzeug typ");
  assert.equal(splitCompounds("doppelsteuer"), "doppel steuer");
  assert.equal(splitCompounds("landings"), "landings");
  assert.equal(splitCompounds("starts"), "starts");
  assert.equal(splitCompounds("engine start"), "engine start");
});

test("R6: german-compounds.csv — Gesamtflugzeit, Blockzeit, Nachtflug, Nachtlandungen, Startort/Landeort, Verantwortlicher Pilot, Fluglehrer, Anflüge", () => {
  const a = analyse("german-compounds.csv", [
    "Datum,Kennzeichen,Flugzeugtyp,Startort,Landeort,Blockzeit,Gesamtflugzeit,Nachtflug,Nachtlandungen,Verantwortlicher Pilot,Fluglehrer,Anflüge",
    "05.03.2024,D-EABC,C172,EDDF,EDDM,1.6,1.5,0.5,1,1.5,,1",
    "06.03.2024,D-EABC,C172,EDDM,EDDF,1.3,1.2,,,,1.2,",
  ]);
  expectByLabel(a, {
    Datum: "field:date", Kennzeichen: "field:registration", Flugzeugtyp: "field:make_model",
    Startort: "field:from", Landeort: "field:to",
    Gesamtflugzeit: "field:total_time", Blockzeit: "ignore",
    Nachtflug: "time:any:night:any", Nachtlandungen: "field:landings_night",
    "Verantwortlicher Pilot": "time:any:any:pic", Fluglehrer: "field:cfi_time", "Anflüge": "field:ifr_approaches",
  });
  assert.deepEqual(a.lowConfidenceCols, []);
});

test("R6: german.csv — Flugzeit is the row total, Von/Nach are from/to, Doppelsteuer is dual", () => {
  const a = analyse("german.csv", [
    "Datum,Kennzeichen,Muster,Von,Nach,Flugzeit,Nacht,PIC,Doppelsteuer,Landungen,Bemerkungen",
    "05.03.2024,D-EABC,C172,EDDF,EDDM,1.5,0.5,1.5,,1,Streckenflug",
    "06.03.2024,D-EABC,C172,EDDM,EDDF,1.2,,,1.2,2,Schulung",
  ]);
  expectByLabel(a, {
    Von: "field:from", Nach: "field:to", Flugzeit: "field:total_time", Nacht: "time:any:night:any",
    Doppelsteuer: "time:any:any:dual", Landungen: "field:landings_day", Bemerkungen: "field:remarks",
  });
});

test("R6: french-2.csv — Immat, De, À, Temps de vol, Jour, Nuit, Fonction, VSV, Nb att., Commentaires", () => {
  const a = analyse("french-2.csv", [
    "Date,Immat,Avion,De,À,Temps de vol,Jour,Nuit,Fonction,VSV,Nb att.,Commentaires",
    "05/03/2024,F-GABC,DR400,LFPB,LFPN,1.5,1.0,0.5,CDB,,1,Navigation",
    "06/03/2024,F-GABC,DR400,LFPN,LFPB,1.3,1.3,,DC,0.3,2,Instruction",
  ]);
  expectByLabel(a, {
    Immat: "field:registration", Avion: "field:make_model", De: "field:from", "À": "field:to",
    "Temps de vol": "field:total_time", Jour: "time:any:day:any", Nuit: "time:any:night:any",
    Fonction: "field:role", VSV: "field:actual_inst",
    // "Nb att." abbreviates "nombre d'atterrissages" — landings.
    "Nb att.": "field:landings_day", Commentaires: "field:remarks",
  });
  assert.deepEqual(a.lowConfidenceCols, []);
  const fr = analyse("french.csv", [
    "Date,Immatriculation,Type,Départ,Arrivée,Temps de vol,Nuit,CDB,OPL,Double commande,Atterrissages,Remarques",
    "05/03/2024,F-GABC,DR400,LFPB,LFPN,1.5,0.5,1.5,,,1,Navigation",
    "07/03/2024,F-HXYZ,A320,LFPG,LFMN,1.4,,,1.4,,1,",
  ]);
  expectByLabel(fr, { CDB: "time:any:any:pic", OPL: "time:any:any:fo", "Double commande": "time:any:any:dual", "Départ": "field:from", "Arrivée": "field:to" });
});

test("R6: spanish — Fecha, Matrícula, Ruta, Piloto al mando, Copiloto, Alumno, Doble mando, Noche, Despegues, Aterrizajes, Instrucción", () => {
  const a = analyse("spanish-3.csv", [
    "Fecha,Matrícula,Ruta,Piloto al mando,Copiloto,Alumno,Doble mando,Noche,Despegues,Aterrizajes,Instrucción",
    "05/03/2024,EC-ABC,LEMD-LEBL,1.5,,J. Pérez,,0.5,1,1,",
    "06/03/2024,EC-ABC,LEBL-LEMD,,1.2,J. Pérez,1.2,,2,2,1.2",
  ]);
  expectByLabel(a, {
    Fecha: "field:date", "Matrícula": "field:registration", Ruta: "field:route",
    "Piloto al mando": "time:any:any:pic", Copiloto: "time:any:any:fo", Alumno: "field:copilot",
    "Doble mando": "time:any:any:dual", Noche: "time:any:night:any",
    Despegues: "field:takeoffs_day", Aterrizajes: "field:landings_day", "Instrucción": "time:any:any:dual",
  });
});

// ---------------------------------------------------------------------------
// R9 — engine / flight clock stamps are not takeoffs
// ---------------------------------------------------------------------------

test("R9: Engine Start/End and Flight Start/End are ignored; count targets score 0 on clock-like cells", () => {
  const a = analyse("myfb-stamps.csv", [
    "Date,Tail Number,Model,Total Flight Time,Engine Start,Engine End,Flight Start,Flight End,Comments",
    "2024-05-12,N12345,C172,1.4,2024-05-12 18:20,2024-05-12 19:58,2024-05-12 18:30,2024-05-12 19:55,Solo XC",
    "2024-05-15,C-GXBG,DH8C,4.2,2024-05-15 13:50,2024-05-15 18:20,2024-05-15 14:00,2024-05-15 18:12,Charter",
  ]);
  expectByLabel(a, { "Engine Start": "ignore", "Engine End": "ignore", "Flight Start": "ignore", "Flight End": "ignore", "Total Flight Time": "field:total_time", Comments: "field:remarks" });
  assert.equal(facetsOf("Engine Starts").ignore, true, "'Engine Starts' is a stamp count, not takeoffs");
  assert.equal(facetsOf("Starts").takeoff, true, "German 'Starts' still counts takeoffs");
  assert.equal(facetsOf("Start").takeoff, false, "bare 'Start' is no longer a takeoff word");

  const stamps = columnStats(gridOf([text("2024-05-12 18:20"), text("2024-05-15 13:50"), text("2024-05-20 09:00")]), 0, 0);
  assert.equal(shapeScore(field("takeoffs_day"), stamps), 0);
  const clocks = columnStats(gridOf([text("18:20"), text("13:50")]), 0, 0);
  assert.equal(shapeScore(field("landings_day"), clocks), 0);
  const counts = columnStats(gridOf([num(1), num(2), num(3)]), 0, 0);
  assert.equal(shapeScore(field("takeoffs_day"), counts), 1);
});

// ---------------------------------------------------------------------------
// R12 / R24 — UK role headers
// ---------------------------------------------------------------------------

test("R12/R24: PUT is dual, P1/S is PIC, header P2 and cell P2 are both FO", () => {
  const a = analyse("uk-easa.csv", [
    "Date,Dept,Arr,Type,Reg,Total Duration,P1,P2,P1/S,PUT,Night,Ldg Day,Ldg Night",
    "05/03/2024,EGLL,EGKK,C172,G-ABCD,1.5,1.5,,,,0.5,1,1",
    "06/03/2024,EGKK,EGLL,C172,G-ABCD,1.2,,,,1.2,,1,",
    "15/03/2024,EGLL,EHAM,B738,G-XLEA,1.3,,1.3,,,0.6,,1",
    "16/03/2024,EHAM,EGLL,B738,G-XLEA,1.4,,,1.4,,,1,",
  ]);
  expectByLabel(a, { P1: "time:any:any:pic", P2: "time:any:any:fo", "P1/S": "time:any:any:pic", PUT: "time:any:any:dual", "Total Duration": "field:total_time" });
  assert.deepEqual(a.lowConfidenceCols, []);
  for (const h of ["P/UT", "PU/T", "Pilot under training", "P UT"]) assert.equal(facetsOf(h).role, "dual", `${h} → dual`);

  const { applied } = pipeline("role-p2.csv", [
    "Date,Aircraft,Reg,Role,Total",
    "2024-03-06,C172,G-ABCD,P2,1.5",
    "2024-03-07,C172,G-ABCD,P1,1.5",
  ]);
  assert.deepEqual(applied.flights.map((f) => f.role), ["FO", "PIC"], "cell text P2 is FO, matching the header rule");
});

// ---------------------------------------------------------------------------
// R19 — LogTen crew-name columns
// ---------------------------------------------------------------------------

test("R19: flight_selectedCrewPIC/SIC/Student/Instructor pick the name field from the role token", () => {
  const a = analyse("logten-crew.csv", [
    "flight_flightDate,flight_selectedAircraftType,flight_selectedAircraftID,flight_totalTime,flight_pic,flight_sic,flight_selectedCrewPIC,flight_selectedCrewSIC,flight_selectedCrewInstructor",
    "2024-05-12,C172,N12345,1.4,1.4,0,John Smith,,",
    "2024-05-15,DH8C,C-GXBG,4.2,0,4.2,Jane Capt,Me,Bob CFI",
  ]);
  expectByLabel(a, {
    flight_selectedCrewPIC: "field:pic", flight_selectedCrewSIC: "field:copilot", flight_selectedCrewInstructor: "field:check_pilot",
    flight_pic: "time:any:any:pic", flight_sic: "time:any:any:sic",
  });
  assert.deepEqual(a.lowConfidenceCols, []);
  const b = analyse("logten-student.csv", [
    "flight_flightDate,flight_selectedAircraftType,flight_selectedAircraftID,flight_totalTime,flight_dualGiven,flight_selectedCrewPIC,flight_selectedCrewStudent",
    "2024-05-12,C172,N12345,1.4,1.4,Me,A. Student",
  ]);
  expectByLabel(b, { flight_selectedCrewPIC: "field:pic", flight_selectedCrewStudent: "field:copilot", flight_dualGiven: "field:cfi_time" });
  // Time columns that merely mention a crew keep their role.
  assert.equal(facetsOf("Heavy Crew").role, "sic");
  assert.equal(facetsOf("Heavy Crew").name, null);
});

// ---------------------------------------------------------------------------
// R20 — multi-pilot time and custom fields
// ---------------------------------------------------------------------------

test("R20: multi-pilot time and custom fields are ignored, not multi-engine", () => {
  const a = analyse("logten-extras.csv", [
    "flight_flightDate,flight_selectedAircraftType,flight_selectedAircraftID,flight_totalTime,flight_multiPilot,flight_customTime1,Multi-Pilot Time,Custom Field 1,ME",
    "2024-05-15,DH8C,C-GXBG,4.2,4.2,0,4.2,x,4.2",
    "2024-05-20,C172,N12345,1.1,0,0,0,y,",
  ]);
  expectByLabel(a, { flight_multiPilot: "ignore", flight_customTime1: "ignore", "Multi-Pilot Time": "ignore", "Custom Field 1": "ignore", ME: "time:me:any:any" });
});

// ---------------------------------------------------------------------------
// R21 — departure / arrival vocabulary, tail shape, fall-through
// ---------------------------------------------------------------------------

test("R21: Dept/Arr map to from/to; looksLikeTail rejects ICAO codes, 'Self' and clock strings", () => {
  const a = analyse("uk-dept-arr.csv", [
    "Date,Dept,Arr,Type,Reg,Total",
    "05/03/2024,EGLL,EGKK,C172,G-ABCD,1.5",
    "06/03/2024,EGKK,EGLL,C172,G-ABCD,1.2",
  ]);
  expectByLabel(a, { Dept: "field:from", Arr: "field:to", Type: "field:make_model", Reg: "field:registration" });
  assert.deepEqual(a.lowConfidenceCols, []);

  for (const yes of ["G-ABCD", "C-GABC", "N12345", "N1X", "HL1234", "D-EABC", "4X-ABC", "C172"]) assert.equal(looksLikeTail(yes), true, `${yes} looks like a tail`);
  for (const no of ["EGLL", "KSEA", "SELF", "SIM", "18:20", "1H30", "0H20", "1:30", "CAPT", "ME"]) assert.equal(looksLikeTail(no), false, `${no} must not look like a tail`);
});

test("R21: an unrecognised header over airport codes falls through to from/to instead of ignore", () => {
  const a = analyse("fallthrough.csv", [
    "Date,Aircraft,Reg,Foo,Bar,Total",
    "2024-03-05,C172,G-ABCD,EGLL,EGKK,1.5",
    "2024-03-06,C172,G-ABCD,EGKK,EGLL,1.2",
    "2024-03-07,PA28,G-BXYZ,EGLL,EHAM,1.1",
  ]);
  expectByLabel(a, { Reg: "field:registration", Foo: "field:from", Bar: "field:to" });
  assert.ok(assignment(a, "Foo").confidence < 0.6 && assignment(a, "Bar").confidence < 0.6, "shape-only guesses stay below the review threshold");
  assert.ok(a.lowConfidenceCols.includes(colByLabel(a, "Foo")) && a.lowConfidenceCols.includes(colByLabel(a, "Bar")));
});

// ---------------------------------------------------------------------------
// R22 — unit leaves
// ---------------------------------------------------------------------------

test("R22: 'Landings › no.', 'Approaches › #' and 'PIC › hrs' inherit the parent's meaning", () => {
  const a = analyse("units-row.csv", [
    "Date,Aircraft,Reg,Route,PIC,Dual,Night,Total,Landings,Approaches",
    ",,,,hrs,hrs,hrs,hrs,no.,#",
    "2024-03-05,C172,G-ABCD,EGLL-EGKK,1.5,,0.5,1.5,1,2",
    "2024-03-06,C172,G-ABCD,EGKK-EGLL,,1.2,,1.2,3,",
  ]);
  expectByLabel(a, {
    "PIC › hrs": "time:any:any:pic", "Dual › hrs": "time:any:any:dual", "Night › hrs": "time:any:night:any", "Total › hrs": "field:total_time",
    "Landings › no.": "field:landings_day", "Approaches › #": "field:ifr_approaches",
  });
  assert.deepEqual(a.lowConfidenceCols, []);
  assert.deepEqual(effectiveSegs(["Landings", "no."]), ["Landings"]);
  assert.deepEqual(effectiveSegs(["Approaches", "#"]), ["Approaches"]);
  assert.deepEqual(effectiveSegs(["Remarks", "no."]), ["Remarks"]);
  assert.deepEqual(effectiveSegs(["no."]), ["no."], "a lone unit leaf has nothing to inherit");
});

// ---------------------------------------------------------------------------
// R23 — "TO Day" / "TO Night" / "TO's"
// ---------------------------------------------------------------------------

test("R23: TO Day / TO Night / TO's are takeoffs with the condition facet; bare To stays the arrival", () => {
  const a = analyse("to-day.csv", [
    "Date,Aircraft,Reg,From,To,TO Day,TO Night,Total",
    "2024-03-05,C172,G-ABCD,EGLL,EGKK,1,,1.5",
    "2024-03-06,C172,G-ABCD,EGKK,EGLL,,1,1.2",
  ]);
  expectByLabel(a, { From: "field:from", To: "field:to", "TO Day": "field:takeoffs_day", "TO Night": "field:takeoffs_night" });
  assert.deepEqual(a.lowConfidenceCols, []);
  const b = analyse("tos.csv", [
    "Date,Aircraft,Reg,To,TO's,Ldgs,Total",
    "2024-03-05,C172,G-ABCD,EGKK,1,1,1.5",
    "2024-03-06,C172,G-ABCD,EGLL,3,3,1.2",
  ]);
  expectByLabel(b, { To: "field:to", "TO's": "field:takeoffs_day", Ldgs: "field:landings_day" });
  // A generic "TO's" beside explicit day/night takeoff columns would double count — it is dropped, as for landings.
  const c = analyse("tos-both.csv", [
    "Date,Aircraft,Reg,TO Day,TO Night,TO's,Total",
    "2024-03-05,C172,G-ABCD,1,,1,1.5",
  ]);
  expectByLabel(c, { "TO Day": "field:takeoffs_day", "TO Night": "field:takeoffs_night", "TO's": "ignore" });
});

// ---------------------------------------------------------------------------
// R25 — headerless defaults
// ---------------------------------------------------------------------------

test("R25: no header — one flight-time column, registration over type code, small integers are landings", () => {
  const { analysis: a, applied } = pipeline("no-header-plain.csv", [
    "2024-03-05,C172,G-ABCD,EGLL-EGKK,1.5,0.5,1",
    "2024-03-06,C172,G-ABCD,EGKK-EGLL,1.2,,1",
    "2024-03-07,PA28,G-BXYZ,EGLL-EGLL,2.1,1.0,2",
  ]);
  assert.deepEqual(a.header.rows, [], "no header band");
  expectKeys(a, { 0: "field:date", 1: "field:make_model", 2: "field:registration", 3: "field:route", 4: "time:any:any:any", 5: "ignore", 6: "field:landings_day" });
  assert.ok(assignmentAt(a, 5).confidence < 0.6, "the second hours column is left for review");
  assert.deepEqual(applied.flights.map((f) => f.day_time + f.night_time), [1.5, 1.2, 2.1]);
  assert.deepEqual(applied.flights.map((f) => f.registration), ["G-ABCD", "G-ABCD", "G-BXYZ"]);
  assert.deepEqual(applied.flights.map((f) => f.landings_day), [1, 1, 2]);
});

// ---------------------------------------------------------------------------
// R26 — generic Landings next to full-stop columns
// ---------------------------------------------------------------------------

test("R26: 'Landings' stays mapped beside 'FS Day/Night Landings' (the FS day subset is dropped); plain Day/Night still win", () => {
  const { analysis: a, applied } = pipeline("myfb-landings.csv", [
    "Date,Tail Number,Model,Landings,FS Night Landings,FS Day Landings,Total Flight Time",
    "2024-05-15,C-GXBG,DH8C,2,1,1,4.2",
    "2024-05-20,N12345,C172,3,0,3,1.1",
  ]);
  expectByLabel(a, { Landings: "field:landings_day", "FS Night Landings": "field:landings_night", "FS Day Landings": "ignore" });
  assert.match(assignment(a, "FS Day Landings").reason ?? "", /full-stop/);
  assert.deepEqual(applied.flights.map((f) => [f.landings_day, f.landings_night]), [[1, 1], [3, 0]]);

  const b = analyse("plain-landings.csv", [
    "Date,Aircraft,Reg,Landings,Day Landings,Night Landings,Total",
    "2024-03-05,C172,G-ABCD,2,1,1,1.5",
  ]);
  expectByLabel(b, { Landings: "ignore", "Day Landings": "field:landings_day", "Night Landings": "field:landings_night" });
});

// ---------------------------------------------------------------------------
// R34 / R10 — bare IFR yields to Actual / Hood
// ---------------------------------------------------------------------------

test("R34: a bare IFR column is ignored next to Actual IMC; alone it stays actual instrument", () => {
  const a = analyse("ifr-plus-actual.csv", [
    "Date,Type,Reg,P1,IFR,Actual IMC,Total",
    "2024-03-05,B738,G-XLEA,1.5,1.5,0.3,1.5",
    "2024-03-06,B738,G-XLEA,2.0,2.0,,2.0",
  ]);
  expectByLabel(a, { IFR: "ignore", "Actual IMC": "field:actual_inst" });
  assert.equal(assignment(a, "IFR").reason, "covered by the actual/hood columns");
  const b = analyse("ifr-plus-hood.csv", [
    "Date,Type,Reg,P1,IFR,Sim Inst,Total",
    "2024-03-05,B738,G-XLEA,1.5,1.5,0.3,1.5",
  ]);
  expectByLabel(b, { IFR: "ignore", "Sim Inst": "field:hood_inst" });
  const c = analyse("ifr-only.csv", [
    "Date,Type,Reg,P1,IFR,Total",
    "2024-03-05,B738,G-XLEA,1.5,1.5,1.5",
  ]);
  expectByLabel(c, { IFR: "field:actual_inst" });
});

// ---------------------------------------------------------------------------
// R35 — "Aeroplane" over hours
// ---------------------------------------------------------------------------

test("R35: an Aeroplane hours column is aeroplane time; a text Aircraft column is still the type", () => {
  const a = analyse("heli.csv", [
    "Date,Aircraft,Reg,Aeroplane,Helicopter,PIC,Dual,Night,Total",
    "2024-03-01,R22,G-HELI,,1.0,,1.0,,1.0",
    "2024-03-02,R44,G-ROBO,,1.5,1.5,,0.5,1.5",
    "2024-03-03,C172,G-ABCD,1.2,,1.2,,,1.2",
  ]);
  expectByLabel(a, { Aircraft: "field:make_model", Aeroplane: "time:any:any:any", Helicopter: "time:heli:any:any", PIC: "time:any:any:pic" });
  assert.ok(assignment(a, "Aeroplane").confidence >= 0.6);
});

// ---------------------------------------------------------------------------
// R36 — duplicate headers
// ---------------------------------------------------------------------------

test("R36: two 'Night' columns both map to night time; the second is low-confidence with a 'duplicate header' reason", () => {
  const a = analyse("dup-night.csv", [
    "Date,Aircraft,Reg,Route,PIC,Night,Night,Total",
    "2024-03-05,C172,G-ABCD,EGLL-EGKK,1.5,0.5,1,1.5",
    "2024-03-06,C172,G-ABCD,EGKK-EGLL,1.2,,,1.2",
  ]);
  expectKeys(a, { 5: "time:any:night:any", 6: "time:any:night:any", 7: "field:total_time" });
  assert.ok(assignmentAt(a, 5).confidence >= 0.6, "first Night keeps its confidence");
  assert.ok(assignmentAt(a, 6).confidence < 0.6, "second Night is flagged");
  assert.match(assignmentAt(a, 6).reason ?? "", /duplicate header/);
  assert.deepEqual(a.lowConfidenceCols, [6]);
});

test("R6b: a block-time column yields to an explicit flight-time column (Blockzeit vs. Gesamtflugzeit)", () => {
  const a = analyse("german-block.csv", [
    "Datum,Kennzeichen,Flugzeugtyp,Blockzeit,Gesamtflugzeit,Nachtflug",
    "05.03.2024,D-EABC,C172,1.6,1.5,0.5",
    "06.03.2024,D-EABC,C172,1.3,1.2,",
  ]);
  const target = (label: string) => {
    const p = a.header.paths.find((x) => x.label === label);
    assert.ok(p, `no column "${label}"`);
    const col = a.mapping.columns.find((c) => c.col === p.col);
    assert.ok(col, `no assignment for "${label}"`);
    return { key: targetKey(col.target), reason: col.reason ?? "" };
  };
  assert.equal(target("Gesamtflugzeit").key, "field:total_time");
  assert.equal(target("Blockzeit").key, "ignore");
  assert.match(target("Blockzeit").reason, /block time — flight time comes from "Gesamtflugzeit"/);
  // A lone block column still supplies the hours (as a time bucket or as the row total) — nothing better to use.
  const lone = analyse("block-only.csv", ["Datum,Kennzeichen,Flugzeugtyp,Blockzeit", "05.03.2024,D-EABC,C172,1.6"]);
  const b = lone.mapping.columns.find((c) => c.col === lone.header.paths.find((x) => x.label === "Blockzeit")!.col)!;
  assert.ok(b.target.kind === "time" || targetKey(b.target) === "field:total_time", `lone Blockzeit → ${targetKey(b.target)}`);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exitCode = 1;
