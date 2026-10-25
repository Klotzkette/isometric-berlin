import { expect } from "bun:test";
import type { PrismBuilding, PrismPayload } from "../../src/IsometricCityWorld";
import hansa from "../../src/data/hansaLibraryV237.json";
import elevated from "../../src/data/elevatedCoreOwnersV238.json";
import west from "../../src/data/westVenuesV260Navigation.json";
import theatres from "../../src/data/theatresV272Navigation.json";
import press from "../../src/data/pressQuarterV272Navigation.json";
import { KULTURFORUM_PIAZZETTA_PRISM_ID } from "../../src/kulturforumPiazzettaV246Profile";

/** Later exact-owner transfers, added back to the unchanged pre-v237 totals.
 * Full old records must still exist in the source payload. The Piazzetta owns
 * one explicit source ID and separately receipts its prior native columns.
 */
export function laterPrismOwnersV272(payload: PrismPayload): PrismBuilding[] {
  const recorded = [...hansa.previousPrisms, ...elevated.previousPrisms,
    ...west.legacyPrisms, ...theatres.legacyPrisms, ...press.legacyPrisms];
  for (const record of recorded) {
    const originals = payload.buildings.filter(p => p.id === record.id);
    expect(originals).toHaveLength(1);
    expect(originals[0]).toMatchObject(record);
  }
  const ids = [...recorded.map(p => p.id), KULTURFORUM_PIAZZETTA_PRISM_ID];
  expect(ids.slice(0, 10).sort()).toEqual([
    "UfOiMKPI", "5yW3Z2oo", "Ldcl7dCO", "RRTGvA3Y", "67972418", "67972414", "67972417",
    "32861687", "16160637", "48793287",
  ].sort());
  expect(ids.slice(10, 22).sort()).toEqual([
    "81194038", "65780505", "59291480", "75846696", "81646698",
    "6yqbDi2y", "pAdKsQF2", "33EWDuRF", "qazo1opJ", "2PmdjGY9", "mpTI46QR", "32698103",
  ].sort());
  expect(KULTURFORUM_PIAZZETTA_PRISM_ID).toBe("26444282");
  expect(new Set(ids).size).toBe(23);
  return ids.map(id => {
    const owners = payload.buildings.filter(p => p.id === id);
    expect(owners).toHaveLength(1);
    return owners[0];
  });
}
