import receipt from "./data/centralNamedV230Ownership.json";
import type { SurroundingNavigation } from "./SurroundingCityGeometry";

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  const keys = Object.keys(x);
  return keys.length === Object.keys(y).length && keys.every(key => Object.hasOwn(y, key) && equal(x[key], y[key]));
}

/** Required measured shells own only these completely replayed navigation rows.
 * Changed sources keep their original collision, including every courtyard. */
export function transferCentralNamedNavigationV230(tile: string, nav: SurroundingNavigation): SurroundingNavigation {
  const records = receipt.navigationRecords.filter(r => r.tile === tile && r.groundY === nav.groundY);
  if (!records.length) return nav;
  const buildings = nav.buildings.filter(b => !records.some(r => r.owner === b.sourceId && equal(b, r.original)));
  return buildings.length === nav.buildings.length ? nav : { ...nav, buildings };
}
