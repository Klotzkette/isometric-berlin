import correction from "./data/centralSitesV200Correction.json";

const falsePrismIds = new Set<string>([correction.falsePrismId]);

/** The one audited above-ground extrusion; no mutable Set escapes this module. */
export const CENTRAL_SITES_V200_FALSE_PRISM_IDS: ReadonlySet<string> =
  Object.freeze({
    get size(): number { return falsePrismIds.size; },
    has: (id: string): boolean => falsePrismIds.has(id),
    entries: () => falsePrismIds.entries(),
    keys: () => falsePrismIds.keys(),
    values: () => falsePrismIds.values(),
    [Symbol.iterator]: () => falsePrismIds[Symbol.iterator](),
    forEach(
      callback: (value: string, key: string, set: ReadonlySet<string>) => void,
      thisArg?: unknown,
    ): void {
      for (const id of falsePrismIds)
        callback.call(thisArg, id, id, CENTRAL_SITES_V200_FALSE_PRISM_IDS);
    },
  });

const cellKeys = new Set(correction.native.cellKeys);
const cellM = correction.native.cellM;
const baseM = correction.native.signature.y0Dm / 10;
const topM = correction.native.signature.y1Dm / 10;

/**
 * Only the 29 retained native column centres and their exact decoded metre
 * heights match. Call before terrain translation, using y0dm/10 and y1dm/10.
 * This is deliberately not a point-in-footprint or bounding-box cleanup rule.
 */
export function isCentralSitesV200FalseColumn(
  worldX: number,
  worldZ: number,
  y0: number,
  y1: number,
): boolean {
  if (y0 !== baseM || y1 !== topM) return false;
  const xIndex = worldX / cellM - 0.5;
  const zIndex = worldZ / cellM - 0.5;
  return Number.isInteger(xIndex) && Number.isInteger(zIndex) &&
    cellKeys.has(`${xIndex},${zIndex}`);
}
