/** Full mouth/Nav intersections. A clear entrance centre never proves that the
 * whole stair is clear of an adjacent building, shoreline or ground hole. */
import {ShapeUtils,Vector2}from'three';
import type{UbahnAccessOpeningV326}from'./UbahnAccessV326';
import type{SurroundingNavigation,SurroundingPolygon}from'./SurroundingCityGeometry';
import{mergeUbahnNativeCellsV326}from'./UbahnGroundAtlasV326';
import{subtractUbahnConvexV326}from'./UbahnGroundSupportV326';
type P=number[];const area=(p:readonly P[])=>{if(!p.length)return 0;const o=p[0];return Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+(a[0]-o[0])*(b[2]-o[2])-(b[0]-o[0])*(a[2]-o[2]);},0))/2;};
export type UbahnNavigationSupportV326=((o:UbahnAccessOpeningV326)=>boolean)&{complete:()=>boolean};
export function createUbahnNavigationSupportV326(nav:SurroundingNavigation,origin:readonly[number,number,number]):UbahnNavigationSupportV326{
 const original=JSON.stringify(nav),complete=()=>JSON.stringify(nav)===original;
 const cache=new Map<SurroundingPolygon,P[][]>();
 const triangles=(p:SurroundingPolygon)=>{let out=cache.get(p);if(out)return out;const rings=[p.ring,...p.holes].map(r=>r.map(q=>new Vector2(q[0]+origin[0],q[1]+origin[2]))),ids=ShapeUtils.triangulateShape(rings[0],rings.slice(1)),all=rings.flat();out=ids.map(ids=>ids.map(i=>[all[i].x,0,all[i].y]));cache.set(p,out);return out;};
 const supports=(o:UbahnAccessOpeningV326)=>{if(!complete())return false;let mouths:P[][]=[];if(o.native){for(const r of mergeUbahnNativeCellsV326(o.nativeCells??[]))mouths.push([[r[0],0,r[1]],[r[2],0,r[1]],[r[2],0,r[3]],[r[0],0,r[3]]]);}else mouths=[o.ring.map(p=>[p[0],0,p[1]])];
  if(!mouths.length)return false;
  // Triangulate source concavities before every convex subtraction.
  const pieces=mouths.flatMap(p=>ShapeUtils.triangulateShape(p.map(q=>new Vector2(q[0],q[2])),[]).map(ids=>ids.map(i=>p[i])));
  for(const p of pieces){for(const obstacle of[...nav.buildings.filter(b=>nav.groundY+(b.groundOffset??0)+b.minHeight<=o.surfaceY+.35&&nav.groundY+(b.groundOffset??0)+b.height>=o.bottomY-.05),...nav.water])for(const t of triangles(obstacle)){const outside=subtractUbahnConvexV326(p,t).reduce((n,p)=>n+area(p),0);if(area(p)-outside>1e-7)return false;}
   let remainder=[p];for(const ground of nav.ground)for(const t of triangles(ground)){remainder=remainder.flatMap(p=>subtractUbahnConvexV326(p,t));if(!remainder.length)break;}if(remainder.reduce((n,p)=>n+area(p),0)>1e-6)return false;
  }return true;
 };return Object.assign(supports,{complete});
}
