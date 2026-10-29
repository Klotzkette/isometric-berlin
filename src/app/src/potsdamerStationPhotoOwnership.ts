type Prism = { id?: unknown; ring?: unknown; holes?: unknown; y0_dm?: unknown;
  h_dm?: unknown; class?: unknown; roof?: unknown; tone?: unknown };
/** Immutable old native owner. These are source receipts, never new geometry.
 * Original cell-centre raster replay assigns exactly these 43 class-4 cells
 * to the south hall. The separately receipted two strip cells need the
 * complete paired open-frame replacement before their retirement. */
export const POTSDAMER_SOUTH_STATION_PHOTO_RECEIPT = {"previousPrism":{"id":"K0000BRX","ring":[[3102,11500],[2841,11528],[2813,11267],[3074,11239]],"holes":[],"y0_dm":54,"h_dm":147,"class":1,"roof":1000,"tone":[70,74,72]},"columns":[[72,281,53,213,4],[73,281,54,214,4],[74,281,54,214,4],[75,281,54,214,4],[76,281,54,214,4],[70,282,53,213,4],[71,282,53,213,4],[72,282,54,214,4],[73,282,54,214,4],[74,282,54,214,4],[75,282,54,214,4],[76,282,54,214,4],[71,283,54,214,4],[72,283,54,214,4],[73,283,54,214,4],[74,283,54,214,4],[75,283,54,214,4],[76,283,55,215,4],[71,284,54,214,4],[72,284,54,214,4],[73,284,55,215,4],[74,284,54,214,4],[75,284,55,215,4],[76,284,55,215,4],[71,285,54,214,4],[72,285,55,215,4],[73,285,55,215,4],[74,285,55,215,4],[75,285,55,215,4],[76,285,55,215,4],[71,286,55,215,4],[72,286,55,215,4],[73,286,55,215,4],[74,286,55,215,4],[75,286,55,215,4],[76,286,55,215,4],[71,287,55,215,4],[72,287,55,215,4],[73,287,55,215,4],[74,287,55,215,4],[75,287,55,215,4],[76,287,55,215,4],[77,287,55,215,4]]} as const;


/** Complete separate OSM owner; never attributed to the disjoint LoD2 hall. */
export const POTSDAMER_STATION_PHOTO_STRIP_RECEIPT = {"previousPrism":{"id":"64904393","ring":[[3075,11209],[3085,11207],[3118,11499],[3108,11501]],"holes":[],"y0_dm":55,"h_dm":90,"class":0,"roof":9999,"tone":[65,70,68]},"columns":[[77,284,55,175,3],[77,285,55,175,3]],"fullSourceRingWorldM":[[307.4713579599047,1120.8541345177218],[308.4651498971507,1120.7429529745132],[311.81442902010167,1149.9395231800154],[310.82063130673487,1150.0507054729387]],"osmWayId":"464904393","groundYM":5.5,"alignedRoofYM":14.178,"sourceHeightM":9,"heightStatus":"Original 9m building=yes fallback retained; roof-edge/support-frame alignment with the adjacent measured hall is a photo/context interpretation, not a surveyed strip height"} as const;

const fingerprint = (p: Prism) => JSON.stringify([p.id, p.ring, p.holes,
  p.y0_dm, p.h_dm, p.class, p.roof, p.tone]);
const original = fingerprint(POTSDAMER_SOUTH_STATION_PHOTO_RECEIPT.previousPrism);
const originalStrip = fingerprint(POTSDAMER_STATION_PHOTO_STRIP_RECEIPT.previousPrism);

/** Exact retained owner only; altered or unrelated source records stay intact. */
export function isPotsdamerSouthStationPhotoSource(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as Prism).id === "K0000BRX" &&
    fingerprint(value as Prism) === original);
}

export function isPotsdamerStationPhotoStripSource(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as Prism).id === "64904393" &&
    fingerprint(value as Prism) === originalStrip);
}

/** Both exact old carriers yield only with their complete independent models. */
export function isPotsdamerStationPhotoSource(value: unknown): boolean {
  return isPotsdamerSouthStationPhotoSource(value) || isPotsdamerStationPhotoStripSource(value);
}

/** Admission is a family decision: duplicate, missing or changed owners keep
 * the prior presentation instead of admitting a hardcoded replacement. */
export function canReplacePotsdamerSouthStationPhoto(prisms: readonly unknown[] | undefined): boolean {
  if (!prisms) return false;
  const matches = prisms.filter(value => value && typeof value === "object" &&
    (value as Prism).id === "K0000BRX");
  const stripMatches = prisms.filter(value => value && typeof value === "object" &&
    (value as Prism).id === "64904393");
  return matches.length === 1 && isPotsdamerSouthStationPhotoSource(matches[0]) &&
    stripMatches.length === 1 && isPotsdamerStationPhotoStripSource(stripMatches[0]);
}
