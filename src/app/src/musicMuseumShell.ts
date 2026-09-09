import { ShapeUtils, Vector2, Vector3 } from "three";
import type { Builder } from "./drawnKit";
import type { MuseumLenneBlock } from "./MuseumLenneArchitecture";
import { MUSIC_MUSEUM_PARTS, MUSIC_MUSEUM_ENTRANCE_ID, MUSIC_MUSEUM_HALL_ID, MUSIC_MUSEUM_ROOF_BASE, MUSIC_MUSEUM_ROOF_BANDS, musicMuseumRoofBandCoordinate, musicMuseumPartRoofHeightAt } from "./museumLenneProfile";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { paintGeometry } from "./drawnKit";
type P = [number,number,number];
function polygon(builder:Builder,ring:P[],color:number,normal?:Vector3){
 if(ring.length<3)return;
 const n=normal?.clone()??new Vector3();
 if(!normal)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];n.x+=(a[1]-b[1])*(a[2]+b[2]);n.y+=(a[2]-b[2])*(a[0]+b[0]);n.z+=(a[0]-b[0])*(a[1]+b[1]);}
 const axis=Math.abs(n.y)>Math.max(Math.abs(n.x),Math.abs(n.z))?1:Math.abs(n.x)>Math.abs(n.z)?0:2;
 const project=(p:P)=>axis===1?new Vector2(p[0],p[2]):axis===0?new Vector2(p[2],p[1]):new Vector2(p[0],p[1]);
 const tris=ShapeUtils.triangulateShape(ring.map(project),[]),positions:number[]=[];
 for(const tri of tris){const a=new Vector3(...ring[tri[0]]),b=new Vector3(...ring[tri[1]]),c=new Vector3(...ring[tri[2]]);if(b.sub(a).cross(c.sub(a)).dot(n)<0)tri.reverse();for(const i of tri)positions.push(...ring[i]);}
 if(!positions.length)return;
 const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(Array.from({length:positions.length/3},(_,i)=>i));paintGeometry(g,color);builder.parts.push(g);
}
function clip(r:P[],signed:(p:P)=>number):P[]{const out:P[]=[];for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],da=signed(a),db=signed(b);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t)as P);}}return out;}
/** Exact official shell is never rebased from its basement onto terrain. */
export function addMusicMuseumShell(builder:Builder,blocks:MuseumLenneBlock[],minecraft:boolean,selected:ReadonlySet<string>):void{
 for(const part of MUSIC_MUSEUM_PARTS){
  if(!selected.has(part.prism_id))continue;
  const hall=part.prism_id===MUSIC_MUSEUM_HALL_ID;
  for(const s of part.surfaces){
   if(s.kind==='GroundSurface'||part.prism_id===MUSIC_MUSEUM_ENTRANCE_ID&&s.kind==='WallSurface')continue;
   if(minecraft)continue;
   if(hall&&s.kind==='RoofSurface')continue;
   const r=s.rings[0].map(p=>[p[0],Math.max(part.street_ground_y_m, hall?Math.min(p[1],MUSIC_MUSEUM_ROOF_BASE):p[1]),p[2]]as P);
   polygon(builder,r,s.kind==='RoofSurface'?0xb5b6b1:0xb9b8b0,s.kind==='RoofSurface'?new Vector3(0,1,0):undefined);
  }
  const roofs=part.surfaces.filter(s=>s.kind==='RoofSurface');
  if(minecraft){
   const points=roofs.flatMap(s=>s.rings[0]),xs=points.map(p=>p[0]),zs=points.map(p=>p[2]);
   // One-metre surface-only grid, shared by full/mobile roof support callbacks.
   for(let x=Math.floor(Math.min(...xs))+.5;x<Math.max(...xs);x++)for(let z=Math.floor(Math.min(...zs))+.5;z<Math.max(...zs);z++){
    let y=musicMuseumPartRoofHeightAt(part.prism_id,x,z,true);if(y===null)continue;if(part.prism_id===MUSIC_MUSEUM_ENTRANCE_ID)y=8.053;
    blocks.push({position:[x,y-.24,z],size:[1.02,.48,1.02],yaw:0,color:0xb5b6b1,role:'museum exact roof block',sourceId:part.prism_id});
   }
  }
  if(!hall||minecraft)continue;
  for(const s of roofs){
   const base=s.rings[0].map(p=>[p[0],MUSIC_MUSEUM_ROOF_BASE,p[2]]as P);
   polygon(builder,base,0xb5b6b1,new Vector3(0,1,0));
   for(let i=0;i<MUSIC_MUSEUM_ROOF_BANDS.count;i++){
    const lo=MUSIC_MUSEUM_ROOF_BANDS.start+i*MUSIC_MUSEUM_ROOF_BANDS.pitch+.04,hi=lo+MUSIC_MUSEUM_ROOF_BANDS.pitch-.08;
    const r=clip(clip(clip(base,p=>musicMuseumRoofBandCoordinate(p[0],p[2])-lo),p=>hi-musicMuseumRoofBandCoordinate(p[0],p[2])),p=>-47-p[0]-.5*(p[2]-941));
    const slope=r.map(p=>[p[0],MUSIC_MUSEUM_ROOF_BASE+(musicMuseumRoofBandCoordinate(p[0],p[2])-lo)/(hi-lo)*2.4,p[2]]as P);
    polygon(builder,slope,0xc7c9c3,new Vector3(0,1,0));
    // Full-width translucent-looking vertical clerestory and narrow solid end cheeks.
    for(let j=0;j<slope.length;j++){
     const a=slope[j],b=slope[(j+1)%slope.length],high=Math.abs(musicMuseumRoofBandCoordinate(a[0],a[2])-hi)<.001&&Math.abs(musicMuseumRoofBandCoordinate(b[0],b[2])-hi)<.001;
     polygon(builder,[[a[0],MUSIC_MUSEUM_ROOF_BASE,a[2]],a,b,[b[0],MUSIC_MUSEUM_ROOF_BASE,b[2]]],high?0x75878a:0xb7bab4,new Vector3(b[2]-a[2],0,a[0]-b[0]));
    }
   }
  }
 }
}
