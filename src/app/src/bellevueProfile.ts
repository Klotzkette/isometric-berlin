import source from "./bellevueSource.json";

export const BELLEVUE_SOURCE = source;
export const BELLEVUE_SOURCE_PRISMS = source.prisms;
export const BELLEVUE_IDS: ReadonlySet<string> = new Set(source.prisms.map(p => p.id));
export const BELLEVUE_PALACE_IDS: ReadonlySet<string> = new Set(source.palace.parts.map(p => p.id.slice(-8)));
export const BELLEVUE_OFFICE_ID = "K0002RpF";
export const BELLEVUE_MAIN_ID = "xOSevtDX";
export const BELLEVUE_GROUP = "Bellevue palace and presidential office architecture";
export const MINECRAFT_BELLEVUE_GROUP = "Minecraft Bellevue palace and presidential office";
export const BELLEVUE_PRISM_TONES = Object.fromEntries(source.prisms.map(p => [p.id, p.id === BELLEVUE_OFFICE_ID ? 0x333d3e : 0xe9e5d3]));
export const BELLEVUE_ROOF_TONES = Object.fromEntries(source.prisms.map(p => [p.id, p.id === BELLEVUE_OFFICE_ID ? 0x657a83 : 0x62594f]));
export const BELLEVUE_PROFILE = {
  palace: { name: "Schloss Bellevue", parent: source.palace.parent, osm: "way/1034456118", mainFrontBays: 19, mainFloors: 2, wingFloors: 3, pedimentFigures: 3 },
  office: { name: "Bundespräsidialamt am Schloss Bellevue", parent: source.office.parent, osm: "way/226371533", architect: "Gruber + Kleine-Kraneburg", built: "1996–1998", centre: [-1383.58, 259.90], yaw: -.4738, radii: [41.42, 20.48], eaves: 22.34, lanternBase: 24.35, top: 26.287, lanternScale: [.91, .69], floors: 3 },
  sourceStatus: "All 14 palace LoD2 parts retain their original planar walls/hipped roofs and the committed DGM-aligned ground height. The office retains its exact source footprint and maximum height; its coarse conical roof is subdivided into the photographed outer photovoltaic rim and raised elliptical glass lantern. Roof furniture, facade axes and sculptural details are procedural display estimates, not measured facade or sculpture surveys.",
  constructionStatus: "The official 2026 announcement confirms refurbishment of both permanent buildings and relocation to Spreebogen. No date-specific scaffold layout is evidenced; the viewer retains the established architectural fabric, not an invented construction site or a future competition proposal.",
  sourceUrls: [
    "https://www.bundespraesident.de/DE/amt-und-aufgaben/amtssitze/schloss-bellevue/schloss-bellevue_node.html",
    "https://www.bundespraesident.de/DE/amt-und-aufgaben/bundespraesidialamt/gebaeude/gebaeude_node.html",
    "https://www.bundespraesident.de/DE/amt-und-aufgaben/amtssitze/baumassnahmen-am-berliner-amtssitz/baumassnahmen-am-berliner-amtssitz_node.html",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050346",
    "https://www.museum-der-1000-orte.de/bauwerke/bauwerk/bundesprasidialamt",
    "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
    source.source_url,
  ],
  roofReference: { bbox: [388020, 5819670, 388330, 5819960], width: 1860, height: 1740, layer: "dop_2025", license: "dl-de/zero-2-0" },
} as const;

type Point = readonly number[];
type Part = { ring: readonly Point[]; holes?: readonly (readonly Point[])[] };
export function bellevueInRing(ring: readonly Point[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
export function bellevueContains(p: Part, x: number, z: number): boolean {
  return bellevueInRing(p.ring, x * 10, z * 10) && !(p.holes ?? []).some(h => bellevueInRing(h, x * 10, z * 10));
}
export function bellevueOfficeLocal(x: number, z: number): [number, number] {
  const p = BELLEVUE_PROFILE.office, dx = x - p.centre[0], dz = z - p.centre[1];
  return [dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw), dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)];
}
export function bellevueOfficeRoofTopAt(x: number, z: number): number {
  const p = BELLEVUE_PROFILE.office, [u, v] = bellevueOfficeLocal(x, z);
  const radius = Math.hypot(u / (p.radii[0] * p.lanternScale[0]), v / (p.radii[1] * p.lanternScale[1]));
  return radius <= 1 ? p.top : p.eaves + .18 + Math.max(0, 1 - radius) * 1.2;
}
type RoofPlane = { id: string; ring: number[][]; a: Point; normal: number[]; offset: number; min: number; max: number };
const roofPlanes: RoofPlane[] = source.palace.parts.flatMap(part => {
  const prism = source.prisms.find(p => p.id === part.id.slice(-8))!;
  return part.surfaces.filter(s => s.kind === "RoofSurface").map(s => {
    const r = s.rings[0], a = r.reduce((v, p) => v.map((q, i) => q + p[i] / r.length), [0, 0, 0]), normal = [0, 0, 0];
    // Entire-ring Newell normal avoids unstable first-three-point planes at
    // near-collinear survey subdivisions on hipped-roof perimeter edges.
    for (let i = 0; i < r.length; i++) { const b = r[i], c = r[(i + 1) % r.length]; normal[0] += (b[1] - c[1]) * (b[2] + c[2]); normal[1] += (b[2] - c[2]) * (b[0] + c[0]); normal[2] += (b[0] - c[0]) * (b[1] + c[1]); }
    return { id: prism.id, ring: r.map(p => [p[0], p[2]]), a, normal, min: Math.min(...r.map(p=>p[1])), max: Math.max(...r.map(p=>p[1])), offset: prism.y0_dm / 10 - part.ground_y_m };
  });
});
/** Exact source planar roofs, in the release's terrain-aligned vertical frame. */
export function bellevueRoofTopAt(x: number, z: number, id?: string): number | null {
  if (x < -1428 || x > -1190 || z < 72 || z > 293) return null;
  if ((!id || id === BELLEVUE_OFFICE_ID) && bellevueContains(source.prisms[0], x, z)) return bellevueOfficeRoofTopAt(x, z);
  const tops = roofPlanes.filter(p => (!id || id === p.id) && Math.abs(p.normal[1]) > .001 && bellevueInRing(p.ring, x, z)).map(p => Math.max(p.min,Math.min(p.max,p.a[1] - (p.normal[0] * (x - p.a[0]) + p.normal[2] * (z - p.a[2])) / p.normal[1])) + p.offset);
  return tops.length ? Math.max(...tops) : null;
}
/** Clamp only this building's own rounded source column; taller overlaps survive. */
export function bellevueColumnTopAt(x: number, z: number, top: number, cell = 4): number {
  if (!Number.isFinite(cell) || cell <= 0 || x < -1428 || x > -1190 || z < 72 || z > 293) return top;
  // Rasterisation also retains boundary cells whose centres lie a fraction of
  // a metre outside the simplified decimetre ring. A touching-cell lookup is
  // bounded to this envelope and to its own known roof-course heights.
  const parts = source.prisms.filter(p => [-.49,0,.49].some(dx=>[-.49,0,.49].some(dz=>bellevueContains(p,x+dx*cell,z+dz*cell))));
  if (!parts.length) return top;
  const rounded = Math.max(...parts.map(p => p.y0_dm / 10 + Math.ceil(p.h_dm / (cell * 10)) * cell + (p.roof===3200 ? cell : 0)));
  const samples = [-.49,0,.49].flatMap(dx=>[-.49,0,.49].map(dz=>bellevueRoofTopAt(x+dx*cell,z+dz*cell))).filter((y):y is number=>y!==null);
  const roof = samples.length ? Math.min(...samples) : null;
  return roof !== null && top <= rounded + .001 ? Math.min(top, roof - .06) : top;
}
