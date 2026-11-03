import source from "./data/northSitesV306Navigation.json";
import ground from "./data/northSchoolGroundV306.json";

function roofAt(triangles:readonly number[][][],x:number,z:number):number|null {
  let high=-Infinity;
  for(const [a,b,c] of triangles) {
    const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(Math.abs(det)<1e-9)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
    if(Math.min(u,v,1-u-v)>=-1e-7)high=Math.max(high,u*a[1]+v*b[1]+(1-u-v)*c[1]);
  }
  return Number.isFinite(high)?high:null;
}
function inRing(x:number,z:number,ring:readonly number[][]):boolean {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
/** The same finite floor as the new named school mesh, with no district fill. */
export function northSchoolGroundAtV306(x:number,z:number,native=false):number|null {
  if(native)return ground.nativeCells.some(r=>x>=r[0]&&x<r[2]&&z>=r[1]&&z<r[3])?ground.groundY:null;
  const geometry=ground.geometry;
  const polygons=geometry.type==="Polygon"?[geometry.coordinates as number[][][]]:geometry.coordinates as unknown as number[][][][];
  return polygons.some(p=>inRing(x,z,p[0])&&!p.slice(1).some(h=>inRing(x,z,h)))?ground.groundY:null;
}
/** Adopt only after the same complete northern-site root is attached. */
export function northSitesV306Solids(native=false) {
  return source.sites.flatMap(site=>(native?site.native:site.drawn).map(p=>({
    sourceId:p.sourceId,parentId:site.key,ring:p.ring,holes:p.holes,
    minY:p.low,maxY:p.high,low:p.low,high:p.high,
    topAt:(x:number,z:number)=>{
      if(native) {
        const q=p as typeof p&{nativeCaps:number[][]};
        return q.nativeCaps?.find(r=>x>=r[0]&&x<r[2]&&z>=r[1]&&z<r[3])?.[4]??null;
      }
      return roofAt(p.roofs,x,z)??(p.roofs.length?null:p.high);
    },
  })));
}
