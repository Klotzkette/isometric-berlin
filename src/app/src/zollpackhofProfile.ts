import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
import { fitZollpackhofRoof } from "./zollpackhofRoof";

/** Exact committed LoD2 plans; heights below are explicit photo display estimates. */
export const ZOLLPACKHOF_PARTS = [
  {
    id: "RVRCWHeT", gmlId: "DEBE3Dv7RVRCWHeT", sourceHeightM: 26.046,
    groundY: 5.5, wallHeightM: 4.2, roofRiseM: 4.2, frontEdge: 2,
    ring: [[-306.5,-264.9],[-313.9,-274],[-313.7,-273.7],[-300.6,-284.3],[-293.5,-275.4]] as WorldRing,
  },
  {
    id: "FqL2azIz", gmlId: "DEBE3DKSFqL2azIz", sourceHeightM: 17.639,
    groundY: 5.4, wallHeightM: 4.2, roofRiseM: 3.5, frontEdge: 6,
    ring: [[-305.3,-263.4],[-310.8,-258.8],[-311.1,-259.1],[-317.5,-253.8],[-325.8,-263.8],[-319.3,-269.1],[-319.5,-269.4],[-313.9,-274]] as WorldRing,
  },
] as const;
export const ZOLLPACKHOF_PRISM_IDS = new Set(ZOLLPACKHOF_PARTS.map(({id}) => id));
const roofPlans = ZOLLPACKHOF_PARTS.map((part) => ({
  part,
  rect: fitZollpackhofRoof(part.ring.map(([x, z]) => [x, z]))!,
}));

/** Collision follows the represented roof, never the conflicting tall source cap. */
export function zollpackhofDisplayTopAt(
  x: number,
  z: number,
  minecraft = false,
): number | null {
  let top: number | null = null;
  for (const { part, rect } of roofPlans) {
    if (!pointInWorldRing(x, z, part.ring)) continue;
    const dx = x - rect.center[0], dz = z - rect.center[1];
    const u = dx * rect.axis[0] + dz * rect.axis[1];
    const v = -dx * rect.axis[1] + dz * rect.axis[0];
    let rise: number;
    if (minecraft) {
      // The renderer starts its 1.2 m roof columns at the fitted rectangle's
      // lower corner. Query the same cell centre and half-metre roof steps.
      const q = 1.2;
      const cu = -rect.halfLength + (Math.floor((u + rect.halfLength) / q) + 0.5) * q;
      const cv = -rect.halfWidth + (Math.floor((v + rect.halfWidth) / q) + 0.5) * q;
      const edge = Math.min(rect.halfLength - Math.abs(cu), rect.halfWidth - Math.abs(cv));
      const cellInside = pointInWorldRing(rect.center[0] + rect.axis[0] * cu - rect.axis[1] * cv,
        rect.center[1] + rect.axis[1] * cu + rect.axis[0] * cv, part.ring);
      rise = cellInside ? Math.floor(Math.min(1, Math.max(0, edge / rect.halfWidth)) * part.roofRiseM / 0.5) * 0.5 + 0.55 : 0;
    } else {
      const hl = rect.halfLength + 0.2, hw = rect.halfWidth + 0.2;
      const inset = Math.min(hw, hl * 0.6);
      rise = part.roofRiseM * Math.max(0, Math.min(1,
        (hl - Math.abs(u)) / inset, (hw - Math.abs(v)) / hw));
    }
    top = Math.max(top ?? -Infinity, part.groundY + part.wallHeightM + rise);
  }
  return top;
}
export const ZOLLPACKHOF_PROFILE = {
  parentGmlId: "DEBE01YYK0002Tak",
  restaurantOsmNode: 269676264,
  gardenOsmWay: 422205278,
  sourceUrl: "https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5820.zip",
  sourceCreated: "2026-03-02",
  checkedSourceSha256: "dcbbcf6837ec0b767bdabba8ad03e4d1384de3b506982b1d97c23405f0022068",
  operatorUrl: "https://www.zollpackhof.de/the-restaurant.html",
  gardenUrl: "https://www.zollpackhof.de/the-beergarden.html",
  visualReferences: [
    "https://commons.wikimedia.org/wiki/File:Zollpackhof-Berlin.jpg",
    "https://commons.wikimedia.org/wiki/File:Zollpackhof_Berlin_2024-05-09_01.jpg",
  ],
  geometryStatus: "Exact LoD2 plans retained. Raw LoD2 26.046/17.639 m heights conflict with the photographed low restaurant: 4.2 m walls and 8.4/7.7 m overall heights are explicitly non-surveyed display estimates. Window, dormer and roof-tile subdivisions are procedural; no photo or texture is loaded.",
  treeDateStatus: "OSM natural-monument identity and height retained; the former 1555 planting claim conflicts with the operator's more-than-150-year account and is not repeated as fact.",
} as const;

export function zollpackhofContains(x: number, z: number): boolean {
  if (x < -326 || x > -293 || z < -285 || z > -253) return false;
  return ZOLLPACKHOF_PARTS.some(({ring}) => pointInWorldRing(x,z,ring));
}
