import sourcePrisms from "./bundesratPrisms.json";

export const BUNDESRAT_GROUP = "Bundesrat source-bound architecture";
export const MINECRAFT_BUNDESRAT_GROUP = "Minecraft Bundesrat architecture";
export const BUNDESRAT_SOURCE_PRISMS = sourcePrisms;
export const BUNDESRAT_IDS: ReadonlySet<string> = new Set(sourcePrisms.map(p => p.id));
export const BUNDESRAT_MAIN_ID = "lZJjdWRB";
export const BUNDESRAT_TOP = 27.3;
export const BUNDESRAT_PRISM_TONES: Readonly<Record<string, number>> = Object.fromEntries(sourcePrisms.map(p => [p.id, p.id === BUNDESRAT_MAIN_ID ? 0xd3c8af : 0xc0b59e]));
export const BUNDESRAT_ROOF_TONES: Readonly<Record<string, number>> = Object.fromEntries(sourcePrisms.map(p => [p.id, 0x959d98]));
export const BUNDESRAT_PROFILE = {
  name: "Bundesrat / ehemaliges Preußisches Herrenhaus",
  address: "Leipziger Straße 3–4, 10117 Berlin", osm: "way/11688785",
  parent: "DEBE01YYK00005AI", architect: "Friedrich Schulze", built: "1899–1904",
  porticoColumns: 6, porticoBays: 5, frontWingBays: 6, bronzeWorks: 8,
  sourceStatus: "Four exact Berlin LoD2 parts, all source footprints and heights retained. Facade subdivisions, the source-absent pediment and glazed roof, and simplified bronze silhouettes are bounded procedural display reconstructions, not a facade or sculpture survey. The 2025 DOP locates roof fields; published 4 × 2 m dimensions apply only to the two central bronze reliefs.",
  sourceUrls: [
    "https://www.bundesrat.de/DE/bundesrat/gebaeude/gebaeude-node.html",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096003",
    "https://www.museum-der-1000-orte.de/bauwerke/bauwerk/bundesrat-1",
    "https://www.museum-der-1000-orte.de/kunstwerke/kunstwerk/o-t-plastik",
    "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
  ],
  sculptureCredit: "Otto Lessing: historic pediment relief; Per Kirkeby: eight bronze works, 2000. Current bronze silhouettes are retained instead of restoring lost historical attic figures.",
  roof: { x: 646.8, z: 1110.5, width: 25.8, depth: 24.0, rise: 5.2, yaw: .075, status: "DOP-sited plan and photo-proportioned rise; display estimate" },
  roofReference: { bbox: [390075, 5818850, 390210, 5818980], width: 1350, height: 1300, source: "Geoportal Berlin DOP 2025 spring, dl-de/zero-2-0" },
  referenceUrls: [
    "https://commons.wikimedia.org/wiki/File:Christmas_tree_Bundesrat_Berlin-Mitte_2025-12-18_01.jpg",
    "https://commons.wikimedia.org/wiki/File:Vista_del_Bundesrat_desde_el_hotel_de_enfrente_01.jpg",
    "https://commons.wikimedia.org/wiki/File:Berlin_Hi-Flyer_Sept14_views10.jpg",
    "https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Leipziger_Strasse,_Bundesrat_01.jpg",
  ],
} as const;

type Part = { ring: number[][]; holes?: number[][][] };
function inRing(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
export function bundesratContains(p: Part, x: number, z: number): boolean {
  return inRing(p.ring, x * 10, z * 10) && !(p.holes ?? []).some(h => inRing(h, x * 10, z * 10));
}
/** Retain source-centred columns while removing only vertical voxel rounding. */
export function bundesratColumnTopAt(x: number, z: number, top: number, cell = 4): number {
  if (x < 580 || x > 705 || z < 1030 || z > 1150 || !Number.isFinite(cell) || cell <= 0) return top;
  const matches = sourcePrisms.filter(p => bundesratContains(p, x, z));
  if (!matches.length) return top;
  const exact = Math.max(...matches.map(p => (p.y0_dm + p.h_dm) / 10));
  const rounded = Math.max(...matches.map(p => p.y0_dm / 10 + Math.ceil(p.h_dm / (10 * cell)) * cell));
  return top <= rounded + .0001 ? Math.min(top, exact) : top;
}
/** Flat source roof plus the explicitly approximate, DOP-sited plenary skylight. */
export function bundesratRoofTopAt(x: number, z: number): number | null {
  const main = sourcePrisms.find(p => p.id === BUNDESRAT_MAIN_ID)!;
  if (!bundesratContains(main, x, z)) return null;
  const r = BUNDESRAT_PROFILE.roof, dx = x - r.x, dz = z - r.z;
  const u = dx * Math.cos(r.yaw) - dz * Math.sin(r.yaw), v = dx * Math.sin(r.yaw) + dz * Math.cos(r.yaw);
  const t = Math.max(Math.abs(u) / (r.width / 2), Math.abs(v) / (r.depth / 2));
  return t < 1 ? BUNDESRAT_TOP + .15 + r.rise * (1 - t) : BUNDESRAT_TOP;
}
