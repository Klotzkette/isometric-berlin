import source from "./data/hackescherMarktV163Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
export const HACKESCHER_MARKT_V163_PRISM_IDS = new Set(source.legacyPrisms.map(p => p.id));
export const HACKESCHER_MARKT_V163_PARTS = source.parts;
const bounds = source.parts.map(p => ({p,minX:Math.min(...p.ring.map(v=>v[0])),maxX:Math.max(...p.ring.map(v=>v[0])),minZ:Math.min(...p.ring.map(v=>v[1])),maxZ:Math.max(...p.ring.map(v=>v[1]))}));
const nativeRoofs = new Map(source.nativeRoofCells.map(([x,z,y])=>[`${Math.floor(x/2)},${Math.floor(z/2)}`,y]));
export function hackescherMarktRoofAt(x:number,z:number,minecraft=false):number|null {
  if (minecraft) return nativeRoofs.get(`${Math.floor(x/2)},${Math.floor(z/2)}`)??null;
  if (!bounds.some(b=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&pointInWorldRing(x,z,b.p.ring as unknown as WorldRing)&&!b.p.holes.some(h=>pointInWorldRing(x,z,h as unknown as WorldRing)))) return null;
  let top:number|null=null;
  for (const [a,b,c] of source.roofTriangles) {
    const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-8)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
    if(u < -1e-6||v < -1e-6||u+v>1.000001)continue;
    top=Math.max(top??-Infinity,u*a[1]+v*b[1]+(1-u-v)*c[1]);
  }
  return top;
}
export function hackescherMarktSourceColumn(x:number,z:number,base:number,top:number):boolean {
  if (x < 1960 || x > 2210 || z < -680 || z > -325) return false;
  return source.legacyPrisms.some(p=>Math.abs(base-p.y0_dm/10)<.11&&Math.abs(top-base-Math.ceil(p.h_dm/40)*4)<.11&&pointInWorldRing(x*10,z*10,p.ring as unknown as WorldRing)&&!p.holes.some(h=>pointInWorldRing(x*10,z*10,h as unknown as WorldRing)));
}
/** Only ten mapped building passages, bounded to their source parents and height. */
export function hackescherHoefePassageAt(x:number,y:number,z:number,sourceId?:string):boolean {
  if (y<4.9||y>9.35||x<1990||x>2135||z< -665||z> -495) return false;
  if(sourceId&&!source.parts.some(p=>p.id===sourceId&&p.kind==='courts')&&!HACKESCHER_MARKT_V163_PRISM_IDS.has(sourceId))return false;
  return source.passages.some(p=>p.line.slice(1).some((b,i)=>{
    const a=p.line[i],dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l));
    return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<p.widthM/2;
  }));
}
