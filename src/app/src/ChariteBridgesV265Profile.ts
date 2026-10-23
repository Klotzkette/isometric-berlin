import data from "./data/chariteBridgesV265.json";

type Point = readonly number[];
type Source = { id?: unknown; ring?: unknown; holes?: unknown; y0_dm?: unknown; h_dm?: unknown; class?: unknown; roof?: unknown; tone?: unknown };
export const CHARITE_BRIDGE_PROFILES_V265 = data.sites;
export interface ChariteBridgeSolidV265 {
  ring: number[][]; holes: number[][][]; minY: number; maxY: number; sourceId: string;
}
const expected = new Map(data.sites.map(s => [s.id, s.previousPrism]));
const fingerprint = (p: Source) => JSON.stringify([p.id, p.ring, p.holes, p.y0_dm, p.h_dm, p.class, p.roof, p.tone]);

/** Only the immutable exact prior prism authorizes the documented replacement. */
export function isChariteBridgeSourceV265(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const p = value as Source, reference = expected.get(p.id as string);
  return !!reference && fingerprint(p) === fingerprint(reference);
}

export function chariteBridgeContainsV265(ring: readonly Point[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function touchesCell(ring: readonly Point[], x: number, z: number, cell: number): boolean {
  const x0 = x * cell, z0 = z * cell, x1 = x0 + cell, z1 = z0 + cell;
  if (ring.every(p => p[0] < x0) || ring.every(p => p[0] > x1) || ring.every(p => p[1] < z0) || ring.every(p => p[1] > z1)) return false;
  if (ring.some(p => p[0] >= x0 && p[0] <= x1 && p[1] >= z0 && p[1] <= z1)) return true;
  const corners = [[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
  if (corners.some(p => chariteBridgeContainsV265(ring,p[0],p[1]))) return true;
  const cross = (a: Point,b: Point,c: Point) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for (let i=0;i<ring.length;i++) for (let j=0;j<4;j++) {
    const a=ring[i], b=ring[(i+1)%ring.length], c=corners[j], d=corners[(j+1)%4];
    if (cross(a,b,c)*cross(a,b,d)<=0 && cross(c,d,a)*cross(c,d,b)<=0) return true;
  }
  return false;
}

/** Receipt is full-column, full-source-owner and exact-height constrained.
 * New/changed neighbouring source geometry fails closed; no centrepoint deletion. */
export function createChariteBridgeColumnTesterV265(sourcePrisms: readonly unknown[] | undefined, cell: number) {
  const no = (_x: number, _z: number, _low: number, _high: number, _kind: number) => false;
  if (!sourcePrisms || cell !== data.cellM) return no;
  const validIds = new Set(sourcePrisms.filter(isChariteBridgeSourceV265).map(p => (p as Source).id));
  if (data.sites.some(s => !validIds.has(s.id))) return no;
  const candidates = data.columns.map(c => ({ c, blocked: false }));
  for (const raw of sourcePrisms) {
    const p = raw as Source;
    if (isChariteBridgeSourceV265(p) || !Array.isArray(p?.ring)) continue;
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(const point of p.ring as number[][]){minX=Math.min(minX,point[0]);maxX=Math.max(maxX,point[0]);minZ=Math.min(minZ,point[1]);maxZ=Math.max(maxZ,point[1]);}
    if(maxX<4720||minX>5360||maxZ< -8520||minZ> -6520)continue;
    // Holes intentionally do not grant deletion rights: retain conservative cells.
    const ring = (p.ring as number[][]).map(r => [r[0]/10,r[1]/10]);
    for (const candidate of candidates) if (!candidate.blocked && touchesCell(ring,candidate.c[0],candidate.c[1],cell)) candidate.blocked = true;
  }
  const keys = new Set(candidates.filter(c => !c.blocked).map(({c}) => c.join("/")));
  return (x: number,z: number,low: number,high: number,kind: number) => keys.has([x,z,low,high,kind].join("/"));
}

export const CHARITE_BRIDGE_SOLIDS_V265: readonly ChariteBridgeSolidV265[] = [
  ...data.sites.map(s => ({ring:s.ring,holes:s.holes,minY:s.bottomY,maxY:s.topY,sourceId:s.id})),
  ...data.supports.map(([x,y,z,w,h,d]) => ({ring:[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]],holes:[],minY:y-h/2,maxY:y+h/2,sourceId:"4gyC0jjm"})),
];

/** Solids begin at the undercroft, with only the photographed support pair below. */
export function chariteBridgeSolidsForV265(id: string, _native = false): readonly ChariteBridgeSolidV265[] {
  return CHARITE_BRIDGE_SOLIDS_V265.filter(s => s.sourceId === id);
}
