import source from "./data/alexanderNorthV166Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const ALEXANDER_NORTH_V166_PRISM_IDS: ReadonlySet<string> = new Set();
export const ALEXANDER_NORTH_V166_PARTS = source.parts;
export const ALEXANDER_NORTH_V166_PARENT_IDS: ReadonlySet<string> = new Set(source.outerOwners.map(p => p.id));
export const ALEXANDER_NORTH_V166_OUTER_SOURCE_IDS = ALEXANDER_NORTH_V166_PARENT_IDS;
const inRing = (x: number, z: number, ring: number[][]) => pointInWorldRing(x, z, ring as unknown as WorldRing);
const contains = (x: number, z: number, p: {ring: number[][]; holes: number[][][]}) => inRing(x,z,p.ring) && !p.holes.some(h => inRing(x,z,h));
const bounds = source.parts.map(p => ({ p, minX: Math.min(...p.ring.map(q=>q[0])), maxX: Math.max(...p.ring.map(q=>q[0])), minZ: Math.min(...p.ring.map(q=>q[1])), maxZ: Math.max(...p.ring.map(q=>q[1])) }));
const nativeRoofs = new Map(source.nativeRoofCells.map(([x,z,y])=>[`${Math.floor(x/2)},${Math.floor(z/2)}`,y]));

/** Exact delivered two-metre parent-column ownership; unrelated columns survive. */
export function alexanderNorthV166SourceColumn(x: number, z: number, baseY: number, topY: number): boolean {
  if (x < 2475 || x > 3100 || z < -1130 || z > -280) return false;
  return source.outerOwners.some(p => Math.abs(baseY - (3+p.minHeight)) < .11 && Math.abs(topY - (3+p.nativeHeight)) < .11 && p.polygons.some(poly=>contains(x,z,poly)));
}

/** Shared precise roof support for all drawn modes; native uses its own cells. */
export function alexanderNorthV166RoofAt(x: number, z: number, minecraft=false): number | null {
  if (minecraft) return nativeRoofs.get(`${Math.floor(x/2)},${Math.floor(z/2)}`) ?? null;
  if (!bounds.some(b=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&contains(x,z,b.p))) return null;
  let top: number | null = null;
  for (const [a,b,c] of source.roofTriangles) {
    const denominator = (b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if (Math.abs(denominator)<1e-8) continue;
    const u = ((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/denominator;
    const v = ((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/denominator;
    if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001) top=Math.max(top??-Infinity,u*a[1]+v*b[1]+(1-u-v)*c[1]);
  }
  return top;
}

/** Closed occupied source bodies only; courts remain clear at every height. */
export function alexanderNorthV166SolidAt(x: number, y: number, z: number): boolean {
  return bounds.some(b=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&y>b.p.ground_y_m+.1&&y<b.p.top_y_m&&contains(x,z,b.p)&&y<(alexanderNorthV166RoofAt(x,z)??-Infinity));
}
