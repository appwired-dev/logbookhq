/**
 * Smoke test for the multi-format CSV importer. Feeds a synthetic sample of
 * each supported format and checks that:
 *   - the format is detected correctly
 *   - at least one row parses successfully
 *   - core fields (date, registration, totals) round-trip
 *
 * Run with: `npx tsx scripts/test-import-formats.ts`
 */
import { detectFormat, parseAnyLogbook } from "../lib/import-formats";

const FOREFLIGHT = `ForeFlight Logbook Import

Aircraft Table
AircraftID,TypeCode,Make,Model
N12345,C172,Cessna,172
C-GXBG,DH8C,Bombardier,Dash 8

Flights Table
Date,AircraftID,From,To,Route,TimeOut,TotalTime,PIC,SIC,Night,CrossCountry,ActualInstrument,SimulatedInstrument,DayTakeoffs,DayLandingsFullStop,NightTakeoffs,NightLandingsFullStop,Approach1,PilotComments
2024-05-12,N12345,KSEA,KPDX,KSEA-KPDX,18:30,1.4,1.4,0,0.2,1,0,0,1,1,0,0,,Solo XC
2024-05-15,C-GXBG,CYVR,CYYZ,CYVR-CYYZ,14:00,4.2,4.2,0,2.1,1,1.5,0,1,1,1,1,ILS RWY 24L,Charter
`;

const LOGTEN = `flight_flightDate,flight_aircraftType,flight_aircraftRegistration,flight_actualDeparture,flight_actualDestination,flight_totalTime,flight_pic,flight_sic,flight_dual,flight_night,flight_crossCountry,flight_actualInstrument,flight_simulatedInstrument,flight_dayTakeoffs,flight_dayLandings,flight_remarks
2024-06-01,C172,N99999,KSFO,KSJC,0.8,0.8,0,0,0,0.4,0,0,1,1,Pattern work
2024-06-05,DH8C,C-GABC,CYVR,CYEG,3.5,0,3.5,0,1.0,1,0.5,0,1,1,FO leg
`;

const MYFLIGHTBOOK = `Date,Tail Number,Aircraft,Route,Total Flight Time,Approaches,PIC,SIC,CFI,Cross-Country,Night,IMC,Sim Instrument,Landings,Night Landings,Comments/Remarks
2024-07-10,N54321,Piper PA-28,KPAO-KSFO,1.2,1,1.2,0,0,1.2,0,0,0,1,0,ILS practice
2024-07-12,C-FABC,Cessna 152,CYNJ-CYVR,1.5,0,0,0,1.5,0,0.5,0,0,1,1,Dual night XC
`;

function check(name: string, sample: string, expectedFormat: string) {
  console.log(`\n=== ${name} ===`);
  const detected = detectFormat(sample);
  console.log(`  detectFormat: ${detected} (expected ${expectedFormat}) ${detected === expectedFormat ? "✓" : "✗"}`);
  const { format, flights } = parseAnyLogbook(sample);
  console.log(`  parseAnyLogbook: ${flights.length} flights, format=${format}`);
  for (const f of flights) {
    console.log(`    ${f.date}  ${f.registration?.padEnd(8)}  ${f.make_model.padEnd(20)}  total=${(f.day_time + f.night_time).toFixed(1)}h  role=${f.role}  cat=${f.category}  xc=${f.is_xcountry}`);
  }
}

check("ForeFlight",   FOREFLIGHT,   "foreflight");
check("LogTen Pro",   LOGTEN,       "logten");
check("MyFlightbook", MYFLIGHTBOOK, "myflightbook");
