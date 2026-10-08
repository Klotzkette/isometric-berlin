import source from "./data/alexanderStationsV183Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const ALEXANDER_STATIONS_V183_OUTER_SOURCE_IDS: ReadonlySet<string> = new Set(source.outerOwners.map(p => p.id));
export const ALEXANDER_STATIONS_V183_PRISM_IDS: ReadonlySet<string> = new Set();
export const ALEXANDER_STATIONS_V183_PARTS = source.profiles.flatMap(p => p.parts);
export const ALEXANDER_STATIONS_V183_BUILDING_PARTS = source.profiles.filter(p => !["jannowitz", "alexanderStation", "berolinahaus"].includes(p.key)).flatMap(p => p.parts.map(q => p.key === "lehrer" ? { ...q, top_y_m: 57.844 } : q));
export const ALEXANDER_STATIONS_V183_HALL_PART_IDS: ReadonlySet<string> = new Set(source.profiles.filter(p => p.key === "jannowitz" || p.key === "alexanderStation").flatMap(p => p.parts.map(q => q.id)));
export const ALEXANDER_STATIONS_V183_HALL_SOLIDS = source.profiles.filter(p => p.key === "jannowitz" || p.key === "alexanderStation").flatMap(p => {
  const f = p.frame, alex = p.key === "alexanderStation", length = f.length - (alex ? .18 : 1.5), half = f.width / 2 - .12, platform = alex ? 13.38 : 10.95;
  const result: { id: string; ring: number[][]; holes: number[][][]; ground_y_m: number; top_y_m: number }[] = [];
  const block = (u: number, v: number, w: number, d: number, low: number, high: number, role: string) => {
    const ring = [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([du,dv]) => [f.x+f.dx*(u+du)-f.dz*(v+dv), f.z+f.dz*(u+du)+f.dx*(v+dv)]);
    result.push({ id: `${p.key}-${role}-${result.length}`, ring, holes: [], ground_y_m: low, top_y_m: high });
  };
  for (const v of alex ? [-half*.48,half*.48] : [0]) block(0,v,length-2,alex?6.6:5.3,platform-.60,platform,"platform");
  if (!alex) {
    block(0,0,length,half*2,platform-1.3,platform-.6,"deck");
    for(let u=-length/2+8;u<length/2-3;u+=8.5) for(const side of [-1,1]) block(u,side*(half-.45),1.3,.9,3,9.6,"pier");
  }
  return result;
});
const contains = (x: number, z: number, p: { ring: number[][]; holes: number[][][] }) => pointInWorldRing(x, z, p.ring as unknown as WorldRing) && !p.holes.some(h => pointInWorldRing(x, z, h as unknown as WorldRing));

/** Compare exact old-owner vertical envelopes: unrelated overlapping towers survive. */
export function alexanderStationsV183SourceColumn(x: number, z: number, baseY: number, topY: number): boolean {
  if (x < 2600 || x > 3400 || z < -400 || z > 700) return false;
  return source.outerOwners.some(p => Math.abs(baseY - (3 + p.minHeight)) < .11 && Math.abs(topY - (3 + p.nativeHeight)) < .11 && p.polygons.some(q => contains(x, z, q)));
}
/** Closed civic bodies only. Station interiors and rail mouths never become solids. */
export function alexanderStationsV183SolidAt(x: number, y: number, z: number): boolean {
  return ALEXANDER_STATIONS_V183_BUILDING_PARTS.some(p => y > p.ground_y_m + .1 && y < p.top_y_m && contains(x, z, p));
}
/** A station footprint is a replacement identity, never pedestrian collision. */
export function alexanderStationsV183HallContains(x: number, z: number): boolean {
  return source.profiles.filter(p => p.key === "jannowitz" || p.key === "alexanderStation").some(p => p.parts.some(q => contains(x, z, q)));
}
