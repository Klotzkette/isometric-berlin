import source from "./gorkiBuildingSource.json";
import { bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const GORKI_BUILDING_SOURCE = source;
export const GORKI_BUILDING_PRISM_IDS = new Set(source.replaced_osm_prism_ids);
export const GORKI_BUILDING_PROFILE = {
  parentId: source.parent_id,
  osmKey: "way/131835798",
  frontAxis: [[1596.111, 43.276], [1614.877, 41.239]],
  westAxis: [[1592.372, 7.872], [1595.367, 34.967]],
  entranceCount: 3,
  giantPilasterCount: 4,
  frontEavesY: 20.3,
  pedimentTopY: 23.55,
  sourceStageTopY: 26.777,
  largeHallWindows: "bricked-up blind panels since 1947",
  textureFree: true,
  catalogueAddition: false,
  sourceUrls: [
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030077",
    "https://www.stiftung-sing-akademie.de/33-0-Juengere-Geschichte.html",
    "https://www.gorki.de/de/das-theater-und-seine-geschichte-ein-spaziergang/2017-03-04-1700",
  ],
} as const;

const previous = source.previous_display_prisms.map((p) =>
  p.ring.map(([x, z]) => [x / 10, z / 10]) as WorldRing);

/** Exact old and new building footprints; neighbouring Palais remains separate. */
export function isGorkiBuildingReplacementColumn(x: number, z: number): boolean {
  if (x < 1590 || x > 1618 || z < -3 || z > 45) return false;
  return previous.some((ring) => pointInWorldRing(x, z, ring)) ||
    source.parts.some((part) => bebelplatzPartContains(part, x, z));
}

type Point = [number, number, number];
let displayPartsCache: BebelplatzSourcePart[] | null = null;

/** Retain exact footprints, interpreting the coarse roof as hall + stage tower. */
export function gorkiDisplayParts(): BebelplatzSourcePart[] {
  if (displayPartsCache) return displayPartsCache;
  displayPartsCache = source.parts.map((part) => {
    if (part.id !== "DEBE3DMSYwymK8Tq") return part;
    const P = GORKI_BUILDING_PROFILE, front = P.frontAxis, eave = P.frontEavesY;
    const dx = front[1][0] - front[0][0], dz = front[1][1] - front[0][1], w = Math.hypot(dx, dz);
    const p = (u: number, y: number, depth: number): Point =>
      [front[0][0] + (dx * u + dz * depth) / w, y, front[0][1] + (dz * u - dx * depth) / w];
    const surfaces = part.surfaces.filter((s) => s.kind === "WallSurface").map((s) => ({
      kind: s.kind, rings: s.rings.map((r) => r.map(([x, y, z]) => [x, Math.min(y, eave), z])),
    }));
    const quad = (kind: string, ...ring: Point[]) => surfaces.push({ kind, rings: [ring] });
    const back = 34.0;
    // Front pediment and two true pitched hall roof planes. The tiny original
    // pilaster steps remain in the wall polygons underneath these surfaces.
    quad("WallSurface", p(0, eave, 0), p(w, eave, 0), p(w / 2, P.pedimentTopY, 0));
    quad("RoofSurface", p(0, eave, 0), p(w / 2, P.pedimentTopY, 0), p(w / 2, P.pedimentTopY, back), p(0, eave, back));
    quad("RoofSurface", p(w / 2, P.pedimentTopY, 0), p(w, eave, 0), p(w, eave, back), p(w / 2, P.pedimentTopY, back));
    // The building owner's account identifies the separately raised northern
    // fly tower; its published source maximum remains exactly 26.777 m.
    const left = 0.4, right = w - 0.4, rear = 43;
    quad("WallSurface", p(left, eave, back), p(right, eave, back), p(right, P.sourceStageTopY, back), p(left, P.sourceStageTopY, back));
    quad("WallSurface", p(left, eave, back), p(left, P.sourceStageTopY, back), p(left, P.sourceStageTopY, rear), p(left, eave, rear));
    quad("WallSurface", p(right, eave, back), p(right, eave, rear), p(right, P.sourceStageTopY, rear), p(right, P.sourceStageTopY, back));
    quad("WallSurface", p(left, eave, rear), p(left, P.sourceStageTopY, rear), p(right, P.sourceStageTopY, rear), p(right, eave, rear));
    quad("RoofSurface", p(left, P.sourceStageTopY, back), p(right, P.sourceStageTopY, back), p(right, P.sourceStageTopY, rear), p(left, P.sourceStageTopY, rear));
    return { ...part, surfaces };
  });
  return displayPartsCache;
}

/** Shared visual/collision roof: never collide with the retired huge source slope. */
export function gorkiPartRoofAt(part: BebelplatzSourcePart, x: number, z: number): number | null {
  const displayed = gorkiDisplayParts().find((p) => p.id === part.id);
  return displayed ? bebelplatzPartRoofAt(displayed, x, z) : null;
}
