import data from './data/golgathaV270Profile.json';

export const GOLGATHA_V270_PROFILE={owner:data.owner,part:data.part,groundY:data.groundY,cutY:data.cutY,topY:data.topY,metrics:data.metrics,independentlyOrthogonalNative:true,heightStatus:'Photo-estimated upper levels; original source datum and lower sheets preserved'} as const;
const columns=new Map(data.nativeColumns.map(([x,z,top])=>[`${x}/${z}`,top]));

export function golgathaRoofAtV270(x:number,z:number,native=false):number|null{
 if(native)return columns.get(`${Math.floor(x/data.nativeCellM)}/${Math.floor(z/data.nativeCellM)}`)??null;
 let top=-Infinity;
 for(const [a,b,c] of data.roofTriangles){
  const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-8)continue;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
  if(Math.min(u,v,1-u-v)>=-1e-6)top=Math.max(top,u*a[1]+v*b[1]+(1-u-v)*c[1]);
 }
 return Number.isFinite(top)?top:null;
}

/** Only the previous tower navigation leaf yields. Both mode families may be
 * registered once with live visual-mode gates; no ground-level doorway added. */
export function golgathaSolidsV270(native=false){
 return [
  {...data.drawnFootprint,minY:data.groundY,maxY:data.cutY,sourceId:data.owner,topAt:()=>data.cutY},
  ...(native?data.nativeFootprints:[data.drawnFootprint]).map(p=>({...p,minY:data.cutY,maxY:data.topY,sourceId:data.owner,topAt:(x:number,z:number)=>golgathaRoofAtV270(x,z,native)})),
 ];
}
