import receipt from "./data/prisonsMemorialsOwnershipV209.json";
import owners from "./data/prisonsMemorialsV209Owners.json";
import type { SurroundingNavigation } from "./SurroundingCityGeometry";

const requiredOwners = new Set(owners.map(owner => owner.id));

/** Preserve exact values and every field, including optional or future metadata. */
function exactlyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
      a.every((value, i) => exactlyEqual(value, b[i]));
  }
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length &&
    keys.every(key => Object.hasOwn(right, key) && exactlyEqual(left[key], right[key]));
}

/** Retire only unchanged old navigation rows whose complete required replacements
 * are present in the v209 owner inventory. Drawn and native source rows are
 * independently retained; their complete values determine the matching family.
 * Required bodies and source navigation must precede city publication.
 */
export function transferPrisonsNavigationV209(
  tile: string, nav: SurroundingNavigation,
): SurroundingNavigation {
  const records = receipt.navigationRecords.filter(record => record.tile === tile &&
    record.groundY === nav.groundY && record.replacementOwners.length > 0 &&
    record.replacementOwners.every(owner => requiredOwners.has(owner)));
  if (!records.length) return nav;
  const buildings = nav.buildings.filter(building => !records.some(record =>
    record.owner === building.sourceId && exactlyEqual(building, record.original)));
  return buildings.length === nav.buildings.length ? nav : { ...nav, buildings };
}
