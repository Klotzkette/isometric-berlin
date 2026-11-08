/** Finite new ordinary ground packets; no city Worker geometry or new loader. */
import data from './data/ubahnGroundApproachesV326Index.json';

type Point=readonly[number,number];
type Polygon={ring:readonly Point[];holes:readonly(readonly Point[])[]};
const CONTROL=1820223599;
function control(value:unknown):number{let h=2166136261;for(const c of JSON.stringify(value))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
const trusted=control(data)===CONTROL;
function freeze(value:unknown):void{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}}
if(trusted)freeze(data);

export const ubahnGroundApproachesManifestV326=data;
export const UBAHN_GROUND_APPROACH_PREFIX_V326='ubahnApproach326-';
const assets=trusted?new Map(data.chunks.map(c=>[c.id,c])):new Map<string,typeof data.chunks[number]>();
/** Five own data words from the already literal-pinned original descriptor.
 * A public prefix, inherited field, accessor or partial hash is no authority. */
export function hasUbahnGroundApproachSourceV326(id:string,native:boolean,asset:unknown):boolean{
 if(!trusted||typeof id!=='string'||typeof native!=='boolean'||!asset||typeof asset!=='object'||Array.isArray(asset))return false;
 const descriptor=assets.get(id);if(!descriptor)return false;
 const original=descriptor[native?'minecraft':'drawn'];
 return(['url','sha256','bytes','decodedBytes','encoding']as const).every(key=>{const d=Object.getOwnPropertyDescriptor(asset,key);return!!d&&'value'in d&&Object.is(d.value,original[key]);});
}
const polygons=[data.footprint,data.nativeFootprint] as unknown as readonly(readonly Polygon[])[];
const cells=polygons.map(rows=>{
 const index=new Map<string,Polygon[]>();
 for(const p of rows){const xs=p.ring.map(p=>p[0]),zs=p.ring.map(p=>p[1]);for(let z=Math.floor(Math.min(...zs)/512);z<=Math.floor(Math.max(...zs)/512);z++)for(let x=Math.floor(Math.min(...xs)/512);x<=Math.floor(Math.max(...xs)/512);x++){const key=x+','+z,old=index.get(key)??[];old.push(p);index.set(key,old);}}
 return index;
});
const values=trusted?new Map(data.terrainSamples.map(([x,n,cm])=>[x+','+n,cm/100-30])):new Map<string,number>();
function ringContains(ring:readonly Point[],x:number,z:number):boolean{
 let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[j],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1];
  if(Math.abs((x-a[0])*dz-(z-a[1])*dx)<1e-7&&x>=Math.min(a[0],b[0])-1e-7&&x<=Math.max(a[0],b[0])+1e-7&&z>=Math.min(a[1],b[1])-1e-7&&z<=Math.max(a[1],b[1])+1e-7)return true;
  if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;
}
/** The caller must separately require its actual source packet to be resident.
 * This is the represented DGM skin, never paper, a roof or an unknown fallback. */
export function ubahnGroundApproachAtV326(x:number,z:number,native=false):number|null{
 if(!trusted||!Number.isFinite(x)||!Number.isFinite(z))return null;
 if(!(cells[+native].get(Math.floor(x/512)+','+Math.floor(z/512))??[]).some(p=>ringContains(p.ring,x,z)&&!p.holes.some(h=>ringContains(h,x,z))))return null;
 const east=x+389500,north=5820000-z;
 if(native){const y=values.get(Math.floor(east)+','+Math.floor(north));return y===undefined?null:Math.round(y*10)/10+.1;}
 const i=Math.floor(east-.5),j=Math.floor(north-.5),u=east-.5-i,v=north-.5-j;
 const a=values.get(i+','+j),b=values.get((i+1)+','+j),c=values.get(i+','+(j+1)),d=values.get((i+1)+','+(j+1));
 if(a===undefined||b===undefined||c===undefined||d===undefined)return null;
 return(u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v))+.1;
}
