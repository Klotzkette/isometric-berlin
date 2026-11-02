/** The same complete source leaves, court holes and actual cardinal roof caps. */
import profile from "./data/neukoellnLandmarksV305Profile.json";
type NativeRectangle = [string,number,number,number,number,number,number];
let byLevel:Map<string,Map<number,NativeRectangle[]>>|undefined;
function nativeRows(){
 if(byLevel)return byLevel;
 byLevel=new Map();
 for(const row of profile.nativeNavigation as NativeRectangle[]){const[site,,z,,z1,low]=row,key=`${site}:${low}`,map=byLevel.get(key)??new Map<number,NativeRectangle[]>();for(let zz=z;zz<z1;zz++){const list=map.get(zz)??[];list.push(row);map.set(zz,list);}byLevel.set(key,map);}
 return byLevel;
}
function roofAt(triangles: readonly number[][][], x:number,z:number): number|null {
  let high=-Infinity;
  for (const [a,b,c]of triangles) {
    const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(Math.abs(det)<1e-9)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
    if(Math.min(u,v,1-u-v)>=-1e-7)high=Math.max(high,u*a[1]+v*b[1]+(1-u-v)*c[1]);
  }
  return Number.isFinite(high)?high:null;
}
/** Required model is attached before the caller adopts these solids. */
export function neukoellnLandmarksV305Solids(native=false) {
  // Native navigation uses each actual compiled cardinal run, including its
  // exposed half-metre edge. It is never gated through a rotated source ring.
  const rows=native?nativeRows():undefined;
  const leaves=native?profile.nativeRegions.map((p,i)=>({
    sourceId:`${p.site}-cardinal-region-${i}`,parentId:p.site,ring:p.ring,holes:p.holes,minY:p.low,maxY:p.high,low:p.low,high:p.high,
    topAt:(x:number,z:number)=>rows!.get(`${p.site}:${p.low}`)?.get(Math.floor(z/.5))?.find(r=>x>=r[1]*.5&&x<r[3]*.5)?.[6]??null,
  })):profile.navigation.map(p=>({sourceId:p.id,parentId:p.parent,ring:p.ring,holes:p.holes,
    minY:p.low,maxY:p.high,low:p.low,high:p.high,
    topAt:(x:number,z:number)=>roofAt(p.roofTriangles,x,z)??(p.roofTriangles.length?null:p.high)}));
  const tower=(native?profile.towerNavigation.native:profile.towerNavigation.drawn).map((r,i)=>{
    const [x,y,z,w,h,d,yaw]=r,c=Math.cos(yaw),s=-Math.sin(yaw);
    const ring=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+c*u-s*v,z+s*u+c*v]);
    return {sourceId:`${profile.tower.id}-${native?"native":"drawn"}-${i}`,parentId:profile.tower.id,ring,holes:[] as number[][][],minY:y-h/2,maxY:y+h/2,low:y-h/2,high:y+h/2,topAt:()=>y+h/2};
  });
  const hip=profile.towerRoof;
  return [...leaves,...tower,...(native?[]:[{sourceId:profile.tower.id+"-smooth-copper-hip",parentId:profile.tower.id,ring:hip.ring,holes:[]as number[][][],minY:hip.low,maxY:hip.high,low:hip.low,high:hip.high,topAt:(x:number,z:number)=>roofAt(hip.roofTriangles,x,z)}])];
}
