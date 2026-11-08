/** Main-thread streamed public sites only; no dependency from the city Worker. */
import field from "./data/northEastPublicSitesV326Terrain.json";

export const NORTH_EAST_PUBLIC_SITES_KIND_V326="north-east-public-sites-v326";
type Polygon={ring:number[][];holes:number[][][]};
type Solid=Polygon&{low:number;high:number};
const TERRAIN_CONTROL:number=830710484;
const control=(v:unknown)=>{let h=2166136261;for(const c of JSON.stringify(v))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
const trusted=control(field)===TERRAIN_CONTROL;
function freeze(value:unknown):void{if(value&&typeof value==="object"){for(const child of Object.values(value))freeze(child);Object.freeze(value);}}
if(trusted)freeze(field);
const bounds=[field.x0,field.z0,field.x0+(field.width-1)*8,field.z0+(field.height-1)*8];
function inRing(x:number,z:number,ring:readonly number[][]):boolean{
 let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;
}
function contains(polygons:readonly Polygon[],x:number,z:number):boolean{
 return polygons.some(p=>inRing(x,z,p.ring)&&!p.holes.some(h=>inRing(x,z,h)));
}
/** Broad-phase rejection precedes any source polygon/height query. */
export function northEastPublicSiteTerrainCandidateV326(x:number,z:number):boolean{
 return trusted&&x>=bounds[0]&&x<=bounds[2]&&z>=bounds[1]&&z<=bounds[3];
}
/** Exact represented terrain, not an invented roof/highest-deck sampler.
 * Supply the actual resident road membership; stairs retain their exact tops. */
export function northEastPublicSiteGroundAtV326(x:number,z:number,native=false,road=false):number|null{
 if(!northEastPublicSiteTerrainCandidateV326(x,z)||!contains(field.domain,x,z)||contains(field.lake,x,z))return null;
 const stairs=(native?field.fountainSteps.native:field.fountainSteps.drawn).filter(p=>inRing(x,z,p.ring));
 if(stairs.length)return Math.max(...stairs.map(p=>p.top));
 if(native){x=Math.floor(x/16)*16+8;z=Math.floor(z/16)*16+8;}
 const u=(x-field.x0)/8,v=(z-field.z0)/8,i=Math.floor(u),j=Math.floor(v);
 if(i<0||j<0||i+1>=field.width||j+1>=field.height)return null;
 const a=field.valuesCm[j*field.width+i],b=field.valuesCm[j*field.width+i+1],
  c=field.valuesCm[(j+1)*field.width+i],d=field.valuesCm[(j+1)*field.width+i+1];
 if(a===null||b===null||c===null||d===null)return null;
 const s=u-i,t=v-j;
 return(s+t<=1?a+(b-a)*s+(c-a)*t:d+(c-d)*(1-s)+(b-d)*(1-t))/100+(road?.09:0);
}
/** Lake identity and measured horizontal water plane stay distinct from JVA. */
export function northEastPublicSiteWaterAtV326(x:number,z:number):number|null{
 return northEastPublicSiteTerrainCandidateV326(x,z)&&contains(field.lake,x,z)?field.lakeY:null;
}
const solids=trusted?[false,true].map(native=>{
 const index=new Map<string,Solid[]>(),rows:Solid[]=[...field.fountainSolids[native?"native":"drawn"]];
 for(const p of field.trees){const y=native?p.nativeY:p.drawnY;rows.push({ring:[[p.x-.19,p.z-.19],[p.x+.19,p.z-.19],[p.x+.19,p.z+.19],[p.x-.19,p.z+.19]],holes:[],low:y,high:y+p.height});}
 for(const row of rows){const x0=Math.min(...row.ring.map(p=>p[0])),x1=Math.max(...row.ring.map(p=>p[0])),z0=Math.min(...row.ring.map(p=>p[1])),z1=Math.max(...row.ring.map(p=>p[1]));
  for(let x=Math.floor(x0/8);x<=Math.floor(x1/8);x++)for(let z=Math.floor(z0/8);z<=Math.floor(z1/8);z++){const key=x+","+z,list=index.get(key)??[];list.push(row);index.set(key,list);}
 }return index;
}):[new Map<string,Solid[]>(),new Map<string,Solid[]>()];
/** Represented fountain solids and trunks only; no whole-park collision zone. */
export function northEastPublicSiteSolidAtV326(x:number,y:number,z:number,radius=0,native=false):boolean{
 if(!northEastPublicSiteTerrainCandidateV326(x,z))return false;
 const candidates=new Set<Solid>();
 for(let a=Math.floor((x-radius)/8);a<=Math.floor((x+radius)/8);a++)for(let b=Math.floor((z-radius)/8);b<=Math.floor((z+radius)/8);b++)for(const q of solids[+native].get(a+","+b)??[])candidates.add(q);
 for(const p of candidates){if(y<p.low||y>p.high)continue;if(inRing(x,z,p.ring))return true;if(radius>0)for(let i=0,j=p.ring.length-1;i<p.ring.length;j=i++){
  const a=p.ring[j],b=p.ring[i],dx=b[0]-a[0],dz=b[1]-a[1],den=dx*dx+dz*dz,t=den?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/den)):0;
  if((x-a[0]-t*dx)**2+(z-a[1]-t*dz)**2<=radius*radius)return true;
 }}return false;
}
