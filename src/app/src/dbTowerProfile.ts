import source from "./dbTowerSource.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
export { DB_TOWER_PRISM_IDS } from "./dbTowerIds";
export const DB_TOWER_SOURCE = source;
export type DbTowerPart = typeof source.parts[number];
export const DB_TOWER_PROFILE = {
  parentId: source.parent_id,
  address: "Potsdamer Platz 2",
  floors: 26,
  ground: 5.3,
  sourceGround: 4.923,
  sourceOffsetY: .377,
  mainTop: 99.329,
  top: 108.493,
  officeBottom: 11.3,
  officeFloors: 25,
  crownBottom: 99.329,
  crownTop: 108.078,
  windowNightIntensity: 1.8,
  sourceStatus: "Exact LoD2 footprint and original planar surfaces; facade bays, glass screen and logo are procedural display subdivisions",
  sources: [
    "https://www.aukett-heese.de/de/projects/sony-center-bahntower/",
    "https://www.berlin.de/en/attractions-and-sights/3560868-3104052-sony-center.en.html",
    "https://ir.deutschebahn.com/fileadmin/Anhaenge/Wegbeschreibungen_Deutsche_Bahn_Potsdamer_Platz_en.pdf",
  ],
} as const;
export function dbTowerPartContains(part: {ring:number[][];holes:number[][][]},x:number,z:number):boolean {
  return pointInWorldRing(x,z,part.ring as unknown as WorldRing) && !part.holes.some(h=>pointInWorldRing(x,z,h as unknown as WorldRing));
}
export function dbTowerDisplayY(y:number):number { return y+DB_TOWER_PROFILE.sourceOffsetY; }
const roofs=source.parts.flatMap(part=>part.surfaces.filter(s=>s.kind==="RoofSurface").map(s=>{
 const r=s.rings[0], n=[0,0,0];
 for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);}
 return {part,r,n};
}));
/** Actual retained planes, translated only to the committed local ground sample. */
export function dbTowerRoofAt(x:number,z:number,id?:string):number|null {
 let top:number|null=null;
 for(const p of roofs)if((!id||p.part.id===id||p.part.id.endsWith(id))&&Math.abs(p.n[1])>1e-6&&pointInWorldRing(x,z,p.r.map(v=>[v[0],v[2]]) as WorldRing)){
  const a=p.r[0],y=dbTowerDisplayY(a[1]-(p.n[0]*(x-a[0])+p.n[2]*(z-a[2]))/p.n[1]);top=Math.max(top??-Infinity,y);
 }
 return top;
}
/** Match only raster cells supported by an original tower footprint and height. */
export function isDbTowerReplacementColumn(x:number,z:number,top?:number,cell=4):boolean {
 if(x<185||x>254||z<1016||z>1048)return false;
 return source.prisms.some(p=>{
  // Another building or canopy merged into a cell remains outside this owner.
  const expected=p.y0_dm/10+Math.ceil(p.h_dm/10/cell)*cell;
  if(top!==undefined && (Math.abs(top-expected)>.21 || top<90))return false;
  const ring=p.ring.map(v=>[v[0]/10,v[1]/10]) as WorldRing;
  return [-.49,0,.49].some(dx=>[-.49,0,.49].some(dz=>pointInWorldRing(x+dx*cell,z+dz*cell,ring)));
 });
}
