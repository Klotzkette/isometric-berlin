import { ABGEORDNETENHAUS_PROFILE as A, abgeordnetenhausLocalPoint, abgeordnetenhausWorldPoint } from "./abgeordnetenhausProfile";
import { hbfMergeAdjacentBoxesV291, hbfPolygonComplementV291, type HbfOpeningV291, type HbfPlaneV291, type HbfBoxV291 } from "./HbfGeometryOpeningsV291";
export type ParliamentSiteV295 = "reichstag" | "abgeordnetenhaus";
export type ParliamentPointV295 = [
  number,
  number,
  number
];
export type ParliamentFlightV295 = {
  id: string;
  site: ParliamentSiteV295;
  from: ParliamentPointV295;
  to: ParliamentPointV295;
  width: number;
  steps: number;
};
export const PARLIAMENT_INTERIORS_V295 = {
  geometryStatus: "Published circulation, room identities and architectural forms; interior dimensions, subdivisions, furniture coordinates and stair/lift arrangements are explicit display estimates, not a measured internal plan.",
  reichstag: { anchor: [317.729, 3.595, 40.477] as const, yaw: -1.676 * Math.PI / 180, floor: 7.595, terrace: 27.595, roomHalf: [23.2, 25.2] as const, sourceIds: ["K0002MCN", "UbQkgNZe", "ycOYQRVL"] as const },
  abgeordnetenhaus: { floor: 13, foyerFloor: 6, room: [-20, 20, -80, -44] as const, glazedRoof: [-20, 20, -80, -44] as const, sourceIds: [A.mainPrismId] as const },
  sources: [
    "https://www.bundestag.de/besuche/architektur/reichstag/architektur/",
    "https://www.bundestag.de/besuche/architektur/reichstag/kuppel",
    "https://www.kuppelkucker.de/entdecke-den-bundestag/wer-sitzt-wo-im-plenarsaal",
    "https://www.bpb.de/shop/zeitschriften/apuz/archiv/538999/republikanische-lockerungsuebungen-der-umzug-nach-berlin-und-das-ende-der-angst-vor-der-baugeschichte/",
    "https://www.parlament-berlin.de/das-haus/architektur",
    "https://www.parlament-berlin.de/media/download/541",
    "https://www.parlament-berlin.de/media/download/4784",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096004",
  ] as const,
  textureFree: true, fullStaticDetailOnTouch: true,
} as const;
export function parliamentWorldPointV295(site: ParliamentSiteV295, p: readonly number[]): ParliamentPointV295 {
  if (site === "abgeordnetenhaus")
    return abgeordnetenhausWorldPoint(p[0], p[1], p[2]);
  const f = PARLIAMENT_INTERIORS_V295.reichstag, c = Math.cos(f.yaw), s = Math.sin(f.yaw);
  return [f.anchor[0] + p[0] * c + p[2] * s, p[1], f.anchor[2] - p[0] * s + p[2] * c];
}
export function parliamentLocalPointV295(site: ParliamentSiteV295, x: number, y: number, z: number): ParliamentPointV295 {
  if (site === "abgeordnetenhaus") {
    const [u, v] = abgeordnetenhausLocalPoint(x, z);
    return [u, y, v];
  }
  const f = PARLIAMENT_INTERIORS_V295.reichstag, c = Math.cos(f.yaw), s = Math.sin(f.yaw), dx = x - f.anchor[0], dz = z - f.anchor[2];
  return [dx * c - dz * s, y, dx * s + dz * c];
}
export function parliamentYawV295(site: ParliamentSiteV295): number { return site === "reichstag" ? PARLIAMENT_INTERIORS_V295.reichstag.yaw : A.facadeYaw; }
export function parliamentLocalBoxOpeningV295(site: ParliamentSiteV295, id: string, min: ParliamentPointV295, max: ParliamentPointV295): HbfOpeningV291 {
  const yaw = parliamentYawV295(site), c = Math.cos(yaw), s = Math.sin(yaw), o = parliamentWorldPointV295(site, [0, 0, 0]);
  const local: HbfPlaneV291[] = [[1, 0, 0, -min[0]], [-1, 0, 0, max[0]], [0, 1, 0, -min[1]], [0, -1, 0, max[1]], [0, 0, 1, -min[2]], [0, 0, -1, max[2]]];
  const corners = [min[0], max[0]].flatMap(x => [min[2], max[2]].map(z => parliamentWorldPointV295(site, [x, 0, z])));
  return { id, planes: local.map(([a, b, d, e]) => { const x = a * c + d * s, z = -a * s + d * c; return [x, b, z, e - x * o[0] - z * o[2]] as HbfPlaneV291; }), bounds: { min: [Math.min(...corners.map(p => p[0])), min[1], Math.min(...corners.map(p => p[2]))], max: [Math.max(...corners.map(p => p[0])), max[1], Math.max(...corners.map(p => p[2]))] } };
}
export const PARLIAMENT_LOCAL_AIR_V295: Record<ParliamentSiteV295, readonly {
  id: string;
  min: ParliamentPointV295;
  max: ParliamentPointV295;
}[]> = {
  reichstag: [
    { id: "plenary-room", min: [-23.2, 7.595, -25.2], max: [23.2, 27.595, 25.2] },
    { id: "dome-light-well", min: [-21.3, 27.5, -21.3], max: [21.3, 34, 21.3] },
    { id: "west-foyer", min: [-48, 7.595, -10], max: [-23, 17, 10] },
    { id: "west-public-door", min: [-60, 7.595, -2], max: [-46, 11.8, 2] },
    { id: "west-public-stair", min: [-46, 7.595, -10], max: [-26, 32, -2] },
    { id: "terrace-link", min: [-46, 27.595, -8], max: [-19, 33.5, -2] },
    { id: "west-fine-stair", min: [-67, 3.5, -2], max: [-57, 8, 2] },
  ],
  abgeordnetenhaus: [{ id: "public-central-portal", min: [-1.6, 6, -2], max: [1.6, 10.4, 3.2] }],
};
export const PARLIAMENT_OPENINGS_V295: Record<ParliamentSiteV295, readonly HbfOpeningV291[]> = { reichstag: PARLIAMENT_LOCAL_AIR_V295.reichstag.map(p => parliamentLocalBoxOpeningV295("reichstag", p.id, p.min, p.max)), abgeordnetenhaus: PARLIAMENT_LOCAL_AIR_V295.abgeordnetenhaus.map(p => parliamentLocalBoxOpeningV295("abgeordnetenhaus", p.id, p.min, p.max)) };
/** Every cardinal cell is proved inside the UNION of the rotated public air.
* Testing each rectangle separately would leave solid seams where the foyer,
* chamber and stairs join. Each vertical slab has a constant active cut set;
* polygon subtraction proves the complete square, including concave corners. */
const nativeAirCache: Partial<Record<ParliamentSiteV295, readonly HbfBoxV291[]>> = {};
export function parliamentNativeAirBoxesV295(site: ParliamentSiteV295): readonly HbfBoxV291[] {
  if (nativeAirCache[site])
    return nativeAirCache[site]!;
  const cuts = PARLIAMENT_OPENINGS_V295[site], out: HbfBoxV291[] = [];
  const levels = [...new Set(cuts.flatMap(c => [c.bounds.min[1], c.bounds.max[1]]))].sort((a, b) => a - b);
  const minX = Math.floor(Math.min(...cuts.map(c => c.bounds.min[0]))), maxX = Math.ceil(Math.max(...cuts.map(c => c.bounds.max[0])));
  const minZ = Math.floor(Math.min(...cuts.map(c => c.bounds.min[2]))), maxZ = Math.ceil(Math.max(...cuts.map(c => c.bounds.max[2])));
  for (let i = 0; i + 1 < levels.length; i++) {
    const lo = levels[i], hi = levels[i + 1], y = (lo + hi) / 2, active = cuts.filter(c => y > c.bounds.min[1] && y < c.bounds.max[1]);
    if (!active.length)
      continue;
    for (let x = minX; x < maxX; x++)
      for (let z = minZ; z < maxZ; z++) {
        const remainder = hbfPolygonComplementV291([[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]], active);
        if (remainder?.length === 0)
          out.push({ min: [x, lo, z], max: [x + 1, hi, z + 1] });
      }
  }
  return nativeAirCache[site] = hbfMergeAdjacentBoxesV291(out);
}
export const PARLIAMENT_FLIGHTS_V295: readonly ParliamentFlightV295[] = [
  { id: "reichstag-west-front", site: "reichstag", from: [-66, 5.0, 0], to: [-58, 7.595, 0], width: 3.6, steps: 20 },
  ...Array.from({ length: 8 }, (_, i): ParliamentFlightV295 => ({ id: `reichstag-foyer-stair-${i}`, site: "reichstag", from: [i % 2 ? -28 : -44, 7.595 + i * 2.5, i % 2 ? -4 : -8], to: [i % 2 ? -44 : -28, 10.095 + i * 2.5, i % 2 ? -4 : -8], width: 2.2, steps: 16 })),
  { id: "agh-front", site: "abgeordnetenhaus", from: [0, 4.89, 8], to: [0, 6, 2], width: 3.1, steps: 6 },
  { id: "agh-grand-stair-one", site: "abgeordnetenhaus", from: [-5, 6, -16], to: [-5, 9.5, -30], width: 4, steps: 20 },
  { id: "agh-grand-stair-two", site: "abgeordnetenhaus", from: [5, 9.5, -30], to: [5, 13, -16], width: 4, steps: 20 },
  { id: "agh-visitor-gallery", site: "abgeordnetenhaus", from: [-17.6, 13, -46], to: [-17.6, 18, -61], width: 2.4, steps: 30 },
];
export function parliamentFlightTopV295(f: ParliamentFlightV295, u: number, v: number, padding = 0): number | null {
  const dx = f.to[0] - f.from[0], dz = f.to[2] - f.from[2], len = Math.hypot(dx, dz), t = ((u - f.from[0]) * dx + (v - f.from[2]) * dz) / (len * len), side = Math.abs((u - f.from[0]) * -dz + (v - f.from[2]) * dx) / len;
  if (t < 0 || t > 1 || side > f.width / 2 + padding)
    return null;
  return f.from[1] + (f.to[1] - f.from[1]) * Math.min(1, Math.ceil(Math.max(1e-8, t) * f.steps) / f.steps);
}
export function parliamentBerlinRoofTopV295(x: number, z: number): number | null {
  const [u, v] = abgeordnetenhausLocalPoint(x, z);
  if (Math.abs(u) > 20 || v < -80 || v > -44)
    return null;
  const roof = Math.max(Math.abs(u) / 20, Math.max(0, Math.abs(v + 62) - 6) / 12);
  return A.wallTopY + A.displayRoofRiseM * Math.max(0, 1 - roof);
}
