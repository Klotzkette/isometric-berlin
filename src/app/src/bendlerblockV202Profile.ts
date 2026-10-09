import source from "./data/bendlerblockV202Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const BENDLERBLOCK_V202_PRISM_IDS: ReadonlySet<string> = new Set(source.prismIds);
export const BENDLERBLOCK_V202_PARTS = source.parts;
const columns = new Map(source.columns.map(([x,z,bottom,top]) => [`${x},${z}`, [bottom,top]]));
export function isBendlerblockV202ReplacedColumn(x: number, z: number, bottom: number, top: number): boolean {
  const range = columns.get(`${x},${z}`);
  return range !== undefined && Math.abs(bottom-range[0]) < 1e-6 && Math.abs(top-range[1]) < 1e-6;
}
export function bendlerblockV202PassageAt(x: number, y: number, z: number, sourceId?: string): boolean {
  if (sourceId && !BENDLERBLOCK_V202_PRISM_IDS.has(sourceId) && !source.parts.some(p => p.id === sourceId)) return false;
  return source.passages.some(p => {
    if (y < 5.15 || y >= 5.2+p.height) return false;
    const dx=p.b[0]-p.a[0], dz=p.b[1]-p.a[1], len=Math.hypot(dx,dz);
    const along=((x-p.a[0])*dx+(z-p.a[1])*dz)/len;
    const across=((x-p.a[0])*dz-(z-p.a[1])*dx)/len;
    return along > -p.width/2 && along < len+p.width/2 && Math.abs(across) < p.width/2-.05;
  });
}
function contains(part: typeof source.parts[number], x: number, z: number): boolean {
  return pointInWorldRing(x,z,part.ring as unknown as WorldRing) && !part.holes.some(h=>pointInWorldRing(x,z,h as unknown as WorldRing));
}
const nativeRoofIndex = new Map<string, number[][]>();
for (const face of source.nativeRoofFaces) {
  for (let x=Math.floor(face[0]/16);x<=Math.floor(face[2]/16);x++)
    for (let z=Math.floor(face[1]/16);z<=Math.floor(face[3]/16);z++) {
      const key=`${x},${z}`, rows=nativeRoofIndex.get(key)??[];
      rows.push(face); nativeRoofIndex.set(key,rows);
    }
}
export function bendlerblockV202RoofAt(x: number,z: number,native=false): number | null {
  if (native) {
    let top:number|null=null;
    for (const face of nativeRoofIndex.get(`${Math.floor(x/16)},${Math.floor(z/16)}`)??[])
      if(x>=face[0]&&x<=face[2]&&z>=face[1]&&z<=face[3]) top=Math.max(top??-Infinity,face[4]);
    if(top!==null)return top;
  }
  let top: number | null = null;
  for (const part of source.parts) {
    if (!contains(part,x,z)) continue;
    for (const [a,b,c] of part.roofTriangles) {
      const determinant=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
      if (Math.abs(determinant)<1e-8) continue;
      const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/determinant;
      const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/determinant;
      if (u < -1e-7 || v < -1e-7 || u+v > 1.0000001) continue;
      const y=u*a[1]+v*b[1]+(1-u-v)*c[1]; top=top===null?y:Math.max(top,y);
    }
  }
  return top;
}
export function bendlerblockV202GroundAt(x: number,z: number,feetY: number): number | null {
  const court = source.court.some(p=>pointInWorldRing(x,z,p.ring as unknown as WorldRing) && !p.holes.some(h=>pointInWorldRing(x,z,h as unknown as WorldRing)));
  // Roof walkers above a portal keep the measured roof, not its undercroft.
  const passage = bendlerblockV202PassageAt(x,feetY+1.8,z);
  return feetY >= 4.75 && (court || passage) ? 5.30 : null;
}
