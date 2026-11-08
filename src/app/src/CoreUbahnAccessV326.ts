import authored from './data/ubahnAuthoredGroundV326Index.json';
/** Deliberately lazy, after required Core publication and first upload. */
import {Group,Mesh,ShapeUtils,Vector2}from'three';
import {pedestrianObstacleCellKey,type PedestrianEnvironment,type PedestrianObstacle}from'./pedestrianNavigation';
import {subtractUbahnConvexV326}from'./UbahnGroundSupportV326';
import {mergeUbahnNativeCellsV326}from'./UbahnGroundAtlasV326';
import type {UbahnNavigationSupportV326}from'./UbahnNavigationSupportV326';
import type {UbahnAccessOpeningV326}from'./UbahnAccessV326';
import {createUbahnGroundRuntimeV326Steps,ubahnCandidatesV326,type UbahnGroundRuntimeV326}from'./UbahnGroundRuntimeV326';
export function* createCoreUbahnAccessV326Steps(world:Group,native:boolean,ground:(x:number,z:number)=>number|null,clearance?:UbahnNavigationSupportV326):Generator<void,UbahnGroundRuntimeV326|null>{
 if(!clearance||!clearance.complete())return null;
 const names=new Set(['Drawn ground slabs','Voxel ground runs','Block-native Unter den Linden complete avenue exposed top cells','District asphalt carriageways','District mapped paved walkways','Brandenburg approach raised sidewalks','Unter den Linden mapped gravel promenade']);
 // Genuine Northern outside complements are siblings with the same source
 // name. Include every matching real carrier, not just the first old mesh.
 const hosts:Mesh[]=[];world.traverse(o=>{if(o instanceof Mesh&&names.has(o.name))hosts.push(o);});
 const east=world.getObjectByName(native?'Block-native Schloss to Alexanderplatz mapped street extension exposed top cells':'Schloss to Alexanderplatz mapped street extension');
 if(east){if(native&&east instanceof Mesh)hosts.push(east);else east.traverse(o=>{if(o instanceof Mesh&&!/kerb|curb|marking/i.test(o.name))hosts.push(o);});}
 const ready=authored.entries.filter(e=>e.admission==='ready').map(e=>e.id);
 const ids=[...new Set([...ubahnCandidatesV326([-3900,-3620,2412,2912],true),...ready])];
 return yield*createUbahnGroundRuntimeV326Steps(world,[...new Set(hosts)],ids,native,ground,true,clearance);
}

/** Borrow the existing complete source index; retain only queried local cells.
 * Actual carrier coverage proves ground separately. This is a negative guard,
 * never a fabricated positive ground rectangle or a centre-only collision test. */
export function createCoreUbahnClearanceV326(environment:PedestrianEnvironment):UbahnNavigationSupportV326|null{
 const index=environment.obstacles,water=environment.water;if(!index||!Number.isFinite(index.cellSizeM)||index.cellSizeM<=0||!Array.isArray(water))return null;
 const size=index.cellSizeM,waterWords=JSON.stringify(water),cells=new Map<number|string,{rows:PedestrianObstacle[];words:string}>();
 const polygonRows=(rows:PedestrianObstacle[]|undefined)=>rows?.filter(r=>r.kind==='polygon')??[];
 const complete=()=>environment.obstacles===index&&index.cellSizeM===size&&environment.water===water&&JSON.stringify(water)===waterWords&&[...cells].every(([key,p])=>{const rows=polygonRows(index.cells.get(key));return rows.length===p.rows.length&&rows.every((r,i)=>r===p.rows[i])&&JSON.stringify(rows)===p.words;});
 const area=(p:readonly number[][])=>{if(!p.length)return 0;const a=p[0];return Math.abs(p.reduce((n,b,i)=>{const c=p[(i+1)%p.length];return n+(b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]);},0))/2;};
 const triangulate=(ring:readonly(readonly number[])[],holes:readonly(readonly(readonly number[])[])[]=[],scale=1)=>{const rings=[ring,...holes].map(r=>r.map(p=>new Vector2(p[0]*scale,p[1]*scale)));const triangles=ShapeUtils.triangulateShape(rings[0],rings.slice(1)),flat=rings.flat();return triangles.map(ids=>ids.map(i=>[flat[i].x,0,flat[i].y]));};
 const supports:UbahnNavigationSupportV326=Object.assign((o:UbahnAccessOpeningV326)=>{
  if(!complete()||o.ring.length<3)return false;
  const xs=o.ring.map(p=>p[0]),zs=o.ring.map(p=>p[1]),bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)],obstacles=new Set<PedestrianObstacle>();
  for(let z=Math.floor(bounds[1]/size);z<=Math.floor(bounds[3]/size);z++)for(let x=Math.floor(bounds[0]/size);x<=Math.floor(bounds[2]/size);x++){const key=pedestrianObstacleCellKey(x,z),rows=polygonRows(index.cells.get(key));if(!cells.has(key))cells.set(key,{rows,words:JSON.stringify(rows)});for(const r of rows)obstacles.add(r);}
  const mouths=o.native?mergeUbahnNativeCellsV326(o.nativeCells??[]).flatMap(r=>triangulate([[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]])):triangulate(o.ring);
  if(!mouths.length)return false;
  const overlaps=(b:{minX:number;minZ:number;maxX:number;maxZ:number})=>b.minX<=bounds[2]&&b.maxX>=bounds[0]&&b.minZ<=bounds[3]&&b.maxZ>=bounds[1];
  const blockers:number[][][]=[];
  for(const b of obstacles)if(b.kind==='polygon'&&overlaps(b)&&b.minY<=o.surfaceY+.35&&b.maxY>=o.bottomY-.05)blockers.push(...triangulate(b.ring,b.holes,b.coordinateScale));
  for(const w of water)if(overlaps(w))blockers.push(...triangulate(w.ring,w.holes));
  return complete()&&mouths.every(p=>blockers.every(t=>area(p)-subtractUbahnConvexV326(p,t).reduce((n,q)=>n+area(q),0)<=1e-7));
 },{complete});
 return supports;
}
