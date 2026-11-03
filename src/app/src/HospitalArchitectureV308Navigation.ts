/** Measured complete roofs/court holes and the same compiled cardinal cells. */
import rawProfile from "./data/hospitalArchitectureV308Profile.json";
type Rectangle=[string,number,number,number,number,number,number];
type Part={id:string;parent:string;ring:number[][];holes:number[][][];low:number;high:number;roofTriangles:number[][][]};
type Region={site:string;ring:number[][];holes:number[][][];low:number;high:number};
const profile=rawProfile as unknown as {sites:{navigation:Part[];nativeNavigation:Rectangle[];nativeRegions?:Region[]}[];oldCBFOverrideBounds:number[]};
let rows:Map<string,Map<number,Rectangle[]>>|undefined;
function nativeRows(){
 if(rows)return rows;
 rows=new Map();
 for(const site of profile.sites)for(const row of site.nativeNavigation as Rectangle[]){
  const[key,,z0,,z1,low]=row,id=`${key}:${low}`,map=rows.get(id)??new Map<number,Rectangle[]>();
  for(let z=z0;z<z1;z++){const list=map.get(z)??[];list.push(row);map.set(z,list);}
  rows.set(id,map);
 }
 return rows;
}
function roofAt(triangles:readonly number[][][],x:number,z:number):number|null{
 let top=-Infinity;
 for(const[a,b,c]of triangles){
  const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(det)<1e-9)continue;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,
    v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
  if(Math.min(u,v,1-u-v)>=-1e-7)top=Math.max(top,u*a[1]+v*b[1]+(1-u-v)*c[1]);
 }
 return Number.isFinite(top)?top:null;
}
/** Caller adopts these only after the private complete replacement admission. */
export function hospitalArchitectureV308Solids(native=false){
 if(native){
  const index=nativeRows();
  return profile.sites.flatMap(site=>(site.nativeRegions??[]).map((p,i)=>({
   sourceId:`hospital-v308-${p.site}-cardinal-${i}`,parentId:p.site,
   ring:p.ring,holes:p.holes,minY:p.low,maxY:p.high,low:p.low,high:p.high,
   topAt:(x:number,z:number)=>index.get(`${p.site}:${p.low}`)?.get(Math.floor(z/.5))?.find(r=>x>=r[1]*.5&&x<r[3]*.5)?.[6]??null,
  })));
 }
 return profile.sites.flatMap(site=>site.navigation.map(p=>({sourceId:p.id,parentId:p.parent,
  ring:p.ring,holes:p.holes,minY:p.low,maxY:p.high,low:p.low,high:p.high,
  topAt:(x:number,z:number)=>roofAt(p.roofTriangles,x,z)??(p.roofTriangles.length?null:p.high),
 })));
}
/** Exact finite scope of the superseded CBF v228 helper, including its coarse
 * native outside edge. Other required hospital pads/helpers remain active. */
export function hospitalV308OverridesV228(x:number,z:number,_native=false):boolean{
 const b=profile.oldCBFOverrideBounds;
 return x>=b[0]&&x<=b[2]&&z>=b[1]&&z<=b[3];
}
