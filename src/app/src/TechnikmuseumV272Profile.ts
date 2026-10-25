import data from './data/technikmuseumV272.json';

type Source={id?:unknown;ring?:unknown;holes?:unknown;y0_dm?:unknown;h_dm?:unknown;class?:unknown;roof?:unknown;tone?:unknown};
const fingerprint=(p:Source)=>JSON.stringify([p.id,p.ring,p.holes,p.y0_dm,p.h_dm,p.class,p.roof,p.tone]);
const originals=new Map(data.previousPrisms.map(p=>[p.id,fingerprint(p)]));
const sourceRingsDm=new Map(data.previousPrisms.map(p=>[p.id,p.ring]));
const neighbours=new Map(data.neighbours.map(p=>[p.id,fingerprint(p)]));
export const TECHNIKMUSEUM_V272_PROFILE={fullStaticDetailOnTouch:true,independentlyOrthogonalNative:true,sourcePlans:data.sites.map(s=>s.prism),dimensionPolicy:data.estimates,rotorLengthM:44,locomotiveCount:6,nativeCellM:1.2,cameras:{front:{position:[520,94,2130],target:[386,23,2260]},railway:{position:[370,77,2465],target:[274,10,2396]},glazedHall:{position:[304.8,9.2,2371],target:[276,8.2,2363]}}} as const;

export function isTechnikmuseumSourceV272(value:unknown):boolean{
 if(!value||typeof value!=='object')return false;
 const p=value as Source;if(typeof p.id!=='string')return false;const original=originals.get(p.id);return original!==undefined&&original===fingerprint(p);
}
/** The complete original selection must match; changed or newly overlapping
 * neighbours conservatively keep the old column. Never a location-only filter. */
export function createTechnikmuseumColumnTesterV272(prisms:readonly unknown[]|undefined,cell:number){
 const no=(_x:number,_z:number,_lo:number,_hi:number,_kind:number)=>false;
 if(cell!==data.cellM||!prisms)return no;
 if(data.previousPrisms.some(p=>prisms.filter(r=>(r as Source)?.id===p.id).length!==1||!prisms.some(r=>(r as Source)?.id===p.id&&isTechnikmuseumSourceV272(r))))return no;
 const foreign=prisms.flatMap(raw=>{
  if(!raw||typeof raw!=='object'||isTechnikmuseumSourceV272(raw))return[];
  const p=raw as Source;if(!Array.isArray(p.ring))return[];
  const r=p.ring as number[][],b={minX:Math.min(...r.map(p=>p[0]))/10,maxX:Math.max(...r.map(p=>p[0]))/10,minZ:Math.min(...r.map(p=>p[1]))/10,maxZ:Math.max(...r.map(p=>p[1]))/10};
  if(b.maxX<185||b.minX>432||b.maxZ<2200||b.minZ>2496)return[];
  if(typeof p.id==='string'&&neighbours.get(p.id)===fingerprint(p))return[];
  return[b];
 });
 const keys=new Set(data.columns.filter(c=>!foreign.some(b=>b.maxX>=c[0]*cell&&b.minX<=(c[0]+1)*cell&&b.maxZ>=c[1]*cell&&b.minZ<=(c[1]+1)*cell)).map(c=>c.join('/')));
 return(x:number,z:number,lo:number,hi:number,kind:number)=>keys.has([x,z,lo,hi,kind].join('/'));
}
export function technikmuseumContainsV272(ring:readonly (readonly number[])[],x:number,z:number):boolean{
 let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;
}
export function technikmuseumRoofV272(site:typeof data.sites[number],x:number,z:number,native=false):number|null{
 const cell=TECHNIKMUSEUM_V272_PROFILE.nativeCellM;
 if(native){x=(Math.floor(x/cell)+.5)*cell;z=(Math.floor(z/cell)+.5)*cell;}
 if(native?!technikmuseumContainsV272(sourceRingsDm.get(site.prism)!,Math.round(x*10),Math.round(z*10)):!technikmuseumContainsV272(site.ring,x,z))return null;
 return technikmuseumRoofHeightV272(site,x,z,native);
}
export function technikmuseumRoofHeightV272(site:typeof data.sites[number],x:number,z:number,native=false):number{
 let top=site.roofY;
 if(site.centre){const r=Math.hypot(x-site.centre[0],z-site.centre[1]),inner=site.key==='roundhouse1'?25.4:25.3,outer=site.key==='roundhouse1'?53.8:55;top=site.eaveY+(site.roofY-site.eaveY)*Math.max(0,1-Math.abs((r-(inner+outer)/2)/((outer-inner)/2)));}
 return native?Math.ceil(top/.4)*.4:top;
}
/** Closed source-owned exteriors; clear glazing makes interior displays visible
 * without inventing a walk-through museum or deleting its roofs. */
export function technikmuseumSolidsV272(native=false){
 return data.sites.map(s=>({ring:native?s.nativeRing:s.ring,holes:native?s.nativeHoles:s.holes,minY:s.groundY,maxY:s.roofY+.4,sourceId:s.prism,topAt:(x:number,z:number)=>technikmuseumRoofV272(s,x,z,native)}));
}
