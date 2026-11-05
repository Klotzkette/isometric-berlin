/** Actual complete leaves and cardinal native runs share the rendered heights. */
import source from "./data/treptowWaterfrontV317Navigation.json";

type Drawn = {
  sourceId: string; parentId: string; ring: number[][]; holes: number[][][];
  low: number; high: number; roofTriangles: number[][][];
};
type Native = [string, number, number, number, number, number, number];

function roofAt(triangles: number[][][], x: number, z: number): number | null {
  let top = -Infinity;
  for (const [a,b,c] of triangles) {
    const det = (b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if (Math.abs(det) < 1e-9) continue;
    const u = ((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
    const v = ((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
    if (Math.min(u,v,1-u-v) >= -1e-7) top = Math.max(top,u*a[1]+v*b[1]+(1-u-v)*c[1]);
  }
  return Number.isFinite(top) ? top : null;
}

/** Caller admits these solids only with its attached private complete model. */
export function treptowWaterfrontV317Solids(native = false) {
  const text = JSON.stringify(source);
  let hash = 2166136261;
  for (let i=0;i<text.length;i++) hash = Math.imul(hash ^ text.charCodeAt(i),16777619) >>> 0;
  if (hash !== 2871831136) throw Error("Incomplete v317 navigation source");
  if (native) return (source.minecraft as Native[]).map(([parentId,x,z,x1,z1,low,high],i) => ({
    sourceId: `${parentId}-v317-cardinal-${i}`, parentId,
    ring: [[x,z],[x1,z],[x1,z1],[x,z1]], holes: [] as number[][][],
    low, high, minY: low, maxY: high, topAt: () => high,
  }));
  return (source.drawn as Drawn[]).map(p => ({
    sourceId: p.sourceId, parentId: p.parentId, ring: p.ring, holes: p.holes,
    low: p.low, high: p.high, minY: p.low, maxY: p.high,
    topAt: (x: number, z: number) => roofAt(p.roofTriangles,x,z),
  }));
}
