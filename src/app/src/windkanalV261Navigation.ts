import source from "./data/windkanalV261.json";

type Triangle = number[][];
const triangles = new Map<string, Triangle[]>();
const nativeTops = new Map<string, number>();
const key = (x: number, z: number): string => `${Math.floor(x)},${Math.floor(z)}`;
for (const row of source.triangles) {
  const t = row.slice(1) as Triangle;
  const xs = t.map(v => v[0]), zs = t.map(v => v[2]);
  for (let x = Math.floor(Math.min(...xs)); x <= Math.floor(Math.max(...xs)); x++)
    for (let z = Math.floor(Math.min(...zs)); z <= Math.floor(Math.max(...zs)); z++) {
      const k = key(x,z), list = triangles.get(k) ?? []; list.push(t); triangles.set(k,list);
    }
}
for (const b of source.blocks) {
  const k=key(b[0],b[2]); nativeTops.set(k,Math.max(nativeTops.get(k)??-Infinity,b[1]+b[4]/2));
}

/** Exact generated triangle/voxel roof support. Return null off the added skin:
 * both courtyard holes and all surrounding original navigation remain open. */
export function windkanalV261GroundAt(x: number, z: number, native=false): number | null {
  const [x0,z0,x1,z1]=source.bounds;
  if(x<x0-1||x>x1+1||z<z0-1||z>z1+1)return null;
  if(native)return nativeTops.get(key(x,z))??null;
  let top=-Infinity;
  for(const [a,b,c] of triangles.get(key(x,z))??[]) {
    const denominator=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(Math.abs(denominator)<1e-10)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/denominator;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/denominator;
    if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)top=Math.max(top,u*a[1]+v*b[1]+(1-u-v)*c[1]);
  }
  return Number.isFinite(top)?top:null;
}
