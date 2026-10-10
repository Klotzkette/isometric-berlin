import data from "./data/neukoellnPlacesV210Navigation.json";
import receipt from "./data/neukoellnPlacesV210Ownership.json";
import type { SurroundingNavigation } from "./SurroundingCityGeometry";

const nearby = (x: number, z: number, radius = 0) => data.bounds.some(b =>
  x + radius >= b[0] && x - radius <= b[2] && z + radius >= b[1] && z - radius <= b[3]);
const partOwners = new Set(data.owners.map(owner => owner.owner));
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => equal(v, b[i]));
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && equal(x[k], y[k]));
}
/** Complete original records guard the removal; every replacement source owner
 * has required geometry and the navigation below before city publication. */
export function transferNeukoellnNavigationV210(tile: string, nav: SurroundingNavigation): SurroundingNavigation {
  const records = receipt.navigationRecords.filter(r => r.tile === tile && r.groundY === nav.groundY && r.replacementOwners.every(id => partOwners.has(id)));
  const buildings = nav.buildings.filter(b => !records.some(r => r.owner === b.sourceId && equal(b, r.original)));
  return buildings.length === nav.buildings.length ? nav : { ...nav, buildings };
}
export function neukoellnV210RoofAt(x: number, z: number, native = false): number | null {
  if (!nearby(x, z)) return null;
  let height: number | null = null;
  for (const [a,b,c] of data.roofTriangles) {
    const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if (Math.abs(d)<1e-9) continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
    if (u<-.000001 || v<-.000001 || u+v>1.000001) continue;
    const y=u*a[1]+v*b[1]+(1-u-v)*c[1];
    height=Math.max(height??-Infinity,native?Math.floor(y)+1:y);
  }
  return height;
}
function inside(ring: number[][], x: number, z: number): boolean {
  let value=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) value=!value;
  }
  return value;
}
export function neukoellnV210SolidAt(x: number, y: number, z: number, radius = 0, native = false): boolean {
  if (!nearby(x,z,radius)) return false;
  for(const p of data.owners) {
    if(y<=p.low || y>p.high+(native?1:0)) continue;
    if(inside(p.ring,x,z) && !p.holes.some(r=>inside(r,x,z))) {
      const roof=neukoellnV210RoofAt(x,z,native); if(roof!==null && y<roof) return true;
    }
    if(radius>0) for(const ring of [p.ring,...p.holes]) for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const a=ring[j],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
      const px=a[0]+t*dx,pz=a[1]+t*dz;
      if(Math.hypot(x-px,z-pz)<radius) {
        const roof=neukoellnV210RoofAt(px,pz,native); if(roof!==null && y<roof) return true;
      }
    }
  }
  return false;
}
