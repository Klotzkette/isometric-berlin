import source from "./data/mitteHeritageV166Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const MITTE_HERITAGE_V166_PRISM_IDS = new Set(source.legacyPrisms.map(p=>p.id));
export const MITTE_HERITAGE_V166_PARTS = source.parts;
const bounds=source.parts.map(p=>({p,x0:Math.min(...p.ring.map(v=>v[0])),x1:Math.max(...p.ring.map(v=>v[0])),z0:Math.min(...p.ring.map(v=>v[1])),z1:Math.max(...p.ring.map(v=>v[1]))}));
const cells=new Map<string,number>();
for(const [start,end,z,y] of source.nativeRoofRuns)for(let ix=start;ix<end;ix++){
  cells.set(`${ix},${z}`,y);
}
export function mitteHeritageV166RoofAt(x:number,z:number,minecraft=false):number|null {
  if(minecraft)return cells.get(`${Math.floor(x)},${Math.floor(z)}`)??null;
  if(!bounds.some(b=>x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1&&pointInWorldRing(x,z,b.p.ring as unknown as WorldRing)&&!b.p.holes.some(h=>pointInWorldRing(x,z,h as unknown as WorldRing))))return null;
  let top:number|null=null;
  for(const [a,b,c] of source.roofTriangles){
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
