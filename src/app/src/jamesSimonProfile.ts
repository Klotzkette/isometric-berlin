import source from './jamesSimonSource.json';
import { pointInWorldRing, type WorldRing } from './chancelleryExtensionProfile';
export const JAMES_SIMON_SOURCE = source;
export const JAMES_SIMON_GROUP = 'James-Simon-Galerie complete source architecture';
export const MINECRAFT_JAMES_SIMON_GROUP = 'Minecraft James-Simon-Galerie native architecture';
export const JAMES_SIMON_PRISM_IDS = new Set(['94422265']);
export const JAMES_SIMON_PROFILE = {
  version: '1.0.47', osmKey: 'way/194422265', parentId: source.parent_id,
  textureFree: true, catalogueAddition: false, sourcePartCount: 8,
  terraceY: 10.41, canopyY: 18.95, columnWidthM: .3,
  geometryStatus: 'All eight official parts, roofs and original wall planes are retained in the source. Only the main canal-facing upper wall is articulated into open slender columns and recessed glazing. Lower colonnade roof strips keep their exact source surfaces above open posts. The bounded three-flight staircase cuts the coarse plinth roof and upper wall infill only; all original polygons remain packaged. The main source-footprint floor and source-base stair foundations close terrain ownership only beneath represented solids. Stair, joint and glazing dimensions are procedural display subdivisions.',
  sourceUrls: [source.source_url, 'https://www.openstreetmap.org/way/194422265', 'https://davidchipperfield.com/projects/james-simon-galerie'],
} as const;
const C = Math.cos(Math.atan2(.772,.636)), S = Math.sin(Math.atan2(.772,.636));
export function jamesSimonWorld(u: number, y: number, v: number): [number,number,number] { return [1696.788+C*u-S*v,y,-110.054+S*u+C*v]; }
export function jamesSimonLocal(x:number,z:number): [number,number] { const dx=x-1696.788,dz=z+110.054;return [dx*C+dz*S,-dx*S+dz*C]; }
export const JAMES_SIMON_YAW = -Math.atan2(S,C);
export const JAMES_SIMON_OPEN_PART_IDS = new Set(['DEBE3DRgYzniuE8d','DEBE3DLE2UZsuGcF','DEBE3DdiH2RPygTn','DEBE3DyalNkqmhtt']);
export function jamesSimonContains(x:number,z:number):boolean {return source.parts.some(p=>pointInWorldRing(x,z,p.ring as unknown as WorldRing));}
/** Exact old OSM footprint only; roof-height guard keeps unrelated taller cells. */
export function isJamesSimonReplacementColumn(x:number,z:number,top?:number,cell=4):boolean {
  if(x<1690-cell||x>1784+cell||z< -132-cell||z> -28+cell)return false;
  if(top!==undefined&&top>13.21)return false;
  const ring:WorldRing=[[1745.4,-51.5],[1712.8,-79.3],[1693.4,-102.9],[1716.6,-121.6],[1780.2,-44.4],[1762.8,-30.7]];
  return [-.499,0,.499].some(a=>[-.499,0,.499].some(b=>pointInWorldRing(x+a*cell,z+b*cell,ring)));
}
export function jamesSimonStairTopAt(u:number,v:number):number|null {
 if(u<28||u>78||v<.35||v>5.55)return null;
 let top=4.6;for(let flight=0;flight<3;flight++){
  for(let i=0;i<12;i++){const centre=78-(flight+(i+.5)*.84/12)*50/3;if(Math.abs(u-centre)<=50*.84/72+.0125+1e-8)top=Math.max(top,4.6+(flight+(i+1)/12)*(10.41-4.6)/3);}
  if(Math.abs(u-(78-(flight+.92)*50/3))<=50*.16/6+1e-8)top=Math.max(top,4.6+(flight+1)*(10.41-4.6)/3);
 }return top;
}
const roofPlanes=source.parts.flatMap(p=>p.surfaces.filter(s=>s.kind==='RoofSurface').map(s=>{const r=s.rings[0],n=[0,0,0];for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);}return {id:p.id,a:r[0],n,ring:r.map(v=>[v[0],v[2]]) as unknown as WorldRing};}));
export function jamesSimonRoofAt(x:number,z:number,sourceId?:string):number|null {let y:number|null=null;for(const p of roofPlanes)if((!sourceId||p.id===sourceId)&&Math.abs(p.n[1])>1e-7&&pointInWorldRing(x,z,p.ring)){const h=p.a[1]-(p.n[0]*(x-p.a[0])+p.n[2]*(z-p.a[2]))/p.n[1];const [u,v]=jamesSimonLocal(x,z),stair=jamesSimonStairTopAt(u,v);y=Math.max(y??-Infinity,p.id==='DEBE3DuquIO5LuiT'&&stair!==null?Math.min(h,stair):h);}return y;}
export const JAMES_SIMON_LOW_POSTS=source.parts.filter(p=>JAMES_SIMON_OPEN_PART_IDS.has(p.id)).flatMap(part=>{
 const ring=part.ring;let best=0;const length=(i:number)=>Math.hypot(ring[(i+1)%ring.length][0]-ring[i][0],ring[(i+1)%ring.length][1]-ring[i][1]);for(let i=1;i<ring.length;i++)if(length(i)>length(best))best=i;
 const a=ring[best],b=ring[(best+1)%ring.length],n=Math.max(2,Math.round(length(best)/2.4));return Array.from({length:n+1},(_,i)=>({x:a[0]+(b[0]-a[0])*i/n,z:a[1]+(b[1]-a[1])*i/n,top:part.top_y_m,partId:part.id}));
});
export function jamesSimonWalkSurfaceAt(x:number,z:number,feetY:number):number|null {
 const [u,v]=jamesSimonLocal(x,z);let y:number|null=null;const accept=(h:number)=>{if(h<=feetY+.52)y=Math.max(y??-Infinity,h);};
 if(u>=5.7&&u<=103.1&&v>=-5.1&&v<=.1)accept(10.41);
 // Three discrete flights climb along the canal plinth, separated by landings.
 const stair=jamesSimonStairTopAt(u,v);if(stair!==null)accept(stair);
 const roof=jamesSimonRoofAt(x,z);if(roof!==null)accept(roof);return y;
}
/** Full source parts drive ordinary solids; this capsule void opens just the represented terrace. */
export function jamesSimonTerraceVoidAt(x:number,y:number,z:number,sourceId?:string):boolean {
 if(x<1690||x>1785||z< -132||z> -28)return false;
 const stair=jamesSimonStairTopAt(...jamesSimonLocal(x,z));if(stair!==null&&(!sourceId||sourceId==='DEBE3DuquIO5LuiT'||sourceId==='94422265')&&y>=stair-.55&&y<Math.max(10.95,stair+1.85))return true;
 for(const p of source.parts)if(JAMES_SIMON_OPEN_PART_IDS.has(p.id)&&(!sourceId||sourceId===p.id)&&y>4.6&&y<p.top_y_m-.36&&pointInWorldRing(x,z,p.ring as unknown as WorldRing))return true;
 if(sourceId&&sourceId!=='DEBE3DetH0pbh00c'&&sourceId!=='94422265')return false;
 const [u,v]=jamesSimonLocal(x,z);return u>5.7&&u<103.1&&v>-5.05&&v<.15&&y>10.4&&y<18.45;
}
export function jamesSimonExtraSolidAt(x:number,y:number,z:number,radius=0):boolean {
 if(x<1690-radius||x>1785+radius||z< -132-radius||z> -28+radius)return false;
 for(const p of JAMES_SIMON_LOW_POSTS)if(y>=4.6-radius&&y<=p.top+radius&&Math.abs(x-p.x)<.2+radius&&Math.abs(z-p.z)<.2+radius)return true;
 const [u,v]=jamesSimonLocal(x,z);if(y<10.41-radius||y>18.7+radius)return false;
 if(Math.abs(v)>.15+radius)return false;
 for(let i=0;i<=40;i++)if(Math.abs(u-(5.8+i*97.2/40))<.15+radius)return true;return false;
}
