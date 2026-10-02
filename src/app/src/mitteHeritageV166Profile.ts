import source from "./data/mitteHeritageV166Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
import { buildingTerrainOffset } from "./weinbergTerrainV176";

export const MITTE_HERITAGE_V166_PRISM_IDS = new Set(source.legacyPrisms.map(p=>p.id));
const parentOffsets = new Map<string, number>();
for (const parentId of new Set(source.parts.map(p => p.parentId))) {
  const parts = source.parts.filter(p => p.parentId === parentId);
  const ring = parts.flatMap(p => p.ring);
  const x = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
  const z = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  parentOffsets.set(parentId, buildingTerrainOffset(parentId, x, z, Math.min(...parts.map(p => p.ground_y_m))));
}
export function mitteHeritageV166ParentOffset(parentId: string): number {
  return parentOffsets.get(parentId) ?? 0;
}
export function mitteHeritageV166PartOffset(partId: string): number {
  return mitteHeritageV166ParentOffset(source.parts.find(p => p.id === partId)?.parentId ?? partId);
}
const affectedBounds = source.parts.filter(p => mitteHeritageV166ParentOffset(p.parentId) !== 0).map(p => ({
  x0: Math.min(...p.ring.map(v => v[0])) - 1.2, x1: Math.max(...p.ring.map(v => v[0])) + 1.2,
  z0: Math.min(...p.ring.map(v => v[1])) - 1.2, z1: Math.max(...p.ring.map(v => v[1])) + 1.2,
}));

/** Rows are source building skin only; nearest footprint resolves offset panes/voxels. */
export function mitteHeritageV166BuildingOffsetAt(x: number, z: number): number {
  if (!affectedBounds.some(b => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1)) return 0;
  let nearest = Infinity, owner = "";
  for (const part of source.parts) {
    if (pointInWorldRing(x, z, part.ring as unknown as WorldRing) && !part.holes.some(h => pointInWorldRing(x, z, h as unknown as WorldRing))) {
      return mitteHeritageV166ParentOffset(part.parentId);
    }
    for (const ring of [part.ring, ...part.holes]) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
      const t = length2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2)) : 0;
      const distance = (x - a[0] - t * dx) ** 2 + (z - a[1] - t * dz) ** 2;
      if (distance < nearest) { nearest = distance; owner = part.parentId; }
    }
  }
  return mitteHeritageV166ParentOffset(owner);
}

export const MITTE_HERITAGE_V166_PARTS = source.parts.map(p => {
  const offset = mitteHeritageV166ParentOffset(p.parentId);
  return offset === 0 ? p : { ...p, ground_y_m: p.ground_y_m + offset, top_y_m: p.top_y_m + offset };
});
const bounds=source.parts.map(p=>({p,x0:Math.min(...p.ring.map(v=>v[0])),x1:Math.max(...p.ring.map(v=>v[0])),z0:Math.min(...p.ring.map(v=>v[1])),z1:Math.max(...p.ring.map(v=>v[1]))}));
const cells=new Map<string,number>();
for(const [start,end,z,y] of source.nativeRoofRuns)for(let ix=start;ix<end;ix++){
  cells.set(`${ix},${z}`,y + mitteHeritageV166BuildingOffsetAt(ix + .5, z + .5));
}
const roofTriangles = source.roofTriangles.map(triangle => {
  const x = triangle.reduce((sum, p) => sum + p[0], 0) / 3;
  const z = triangle.reduce((sum, p) => sum + p[2], 0) / 3;
  const offset = mitteHeritageV166BuildingOffsetAt(x, z);
  return offset === 0 ? triangle : triangle.map(p => [p[0], p[1] + offset, p[2]]);
});
export function mitteHeritageV166RoofAt(x:number,z:number,minecraft=false):number|null {
  if(minecraft)return cells.get(`${Math.floor(x)},${Math.floor(z)}`)??null;
  if(!bounds.some(b=>x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1&&pointInWorldRing(x,z,b.p.ring as unknown as WorldRing)&&!b.p.holes.some(h=>pointInWorldRing(x,z,h as unknown as WorldRing))))return null;
  let top:number|null=null;
  for(const [a,b,c] of roofTriangles){
    const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-8)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
    if(u<-.000001||v<-.000001||u+v>1.000001)continue;top=Math.max(top??-Infinity,u*a[1]+v*b[1]+(1-u-v)*c[1]);
  }
  return top;
}
export function mitteHeritageV166SourceColumn(x:number,z:number,base:number,top:number):boolean {
  if(x < 1300 || x > 2350 || z < -2000 || z > -200)return false;
  return source.legacyPrisms.some(p=>Math.abs(base-p.y0_dm/10)<.11&&Math.abs(top-base-Math.ceil(p.h_dm/40)*4)<.11&&pointInWorldRing(x*10,z*10,p.ring as unknown as WorldRing)&&!p.holes.some(h=>pointInWorldRing(x*10,z*10,h as unknown as WorldRing)));
}
