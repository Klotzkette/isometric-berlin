import source from "./data/tuWaterV168Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
export const TU_WATER_V168_PRISM_IDS: ReadonlySet<string> = new Set(source.legacyPrisms.map(p => p.id));
export const TU_WATER_V168_PARENT_IDS: ReadonlySet<string> = new Set(source.parents.map(p => p.id));
/** Ground obstacles preserve source courtyards and the UT2 elevated structural clearance. */
export const TU_WATER_V168_PARTS = source.parts;
export const TU_WATER_V168_PROFILE = Object.freeze({ parents: source.parents, sourceParts: source.sourceParts, sites: ["TU Berlin main building", "Versuchsanstalt für Wasserbau und Schiffbau / Umlauftank 2"], correctedSourcePart: "DEBE3DQSGZbL6snz", originalSurveyRetainedInEvidence: true });
const ringContains = (x: number, z: number, ring: readonly number[][]): boolean => pointInWorldRing(x, z, ring as unknown as WorldRing);
export function tuWaterV168SourceColumn(x: number, z: number, base: number, top: number): boolean {
  if (x < -3140 || x > -2460 || z < 620 || z > 745) return false;
  return source.legacyPrisms.some(p => {
    const expectedBase=p.y0_dm/10, height=Math.ceil(p.h_dm/40)*4, expectedTop=expectedBase+height;
    const body=Math.abs(base-expectedBase)<.11&&Math.abs(top-expectedTop)<.11;
    const tier=[3100,3200,3300,3400].includes(p.roof)&&Math.abs(base-expectedTop)<.11&&Math.abs(top-expectedTop-4)<.11;
    return (body||tier)&&ringContains(x*10,z*10,p.ring)&&!p.holes.some(h=>ringContains(x*10,z*10,h));
  });
}
const nativeRoof = new Map(source.nativeRoofCells.map(([x, z, y]) => [`${x},${z}`, y]));
const ROOF_CELL = 8;
const roofTriangles = source.roofTriangles.map(([a,b,c]) => ({
  a,b,c,
  d: (b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]),
  x0: Math.min(a[0],b[0],c[0]), x1: Math.max(a[0],b[0],c[0]),
  z0: Math.min(a[2],b[2],c[2]), z1: Math.max(a[2],b[2],c[2]),
}));
const roofIndex = new Map<string, number[]>();
roofTriangles.forEach((t,i) => {
  if(Math.abs(t.d)<1e-8)return;
  for(let x=Math.floor(t.x0/ROOF_CELL);x<=Math.floor(t.x1/ROOF_CELL);x++) {
    for(let z=Math.floor(t.z0/ROOF_CELL);z<=Math.floor(t.z1/ROOF_CELL);z++) {
      const key=`${x},${z}`, ids=roofIndex.get(key);
      if(ids)ids.push(i);else roofIndex.set(key,[i]);
    }
  }
});
export function tuWaterV168RoofAt(x: number, z: number, minecraft = false): number | null {
  if (minecraft) return nativeRoof.get(`${Math.floor(x)},${Math.floor(z)}`) ?? null;
  const candidates=roofIndex.get(`${Math.floor(x/ROOF_CELL)},${Math.floor(z/ROOF_CELL)}`);
  if(!candidates)return null;
  let roof: number | null = null;
  for(const i of candidates) {
    const {a,b,c,d,x0,x1,z0,z1}=roofTriangles[i];
    if(x<x0-1e-6||x>x1+1e-6||z<z0-1e-6||z>z1+1e-6)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
    if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001) {
      const y=u*a[1]+v*b[1]+(1-u-v)*c[1];roof=roof===null?y:Math.max(roof,y);
    }
  }
  return roof;
}

/** Tight broad phase only; solidAt supplies the open industrial shape. */
export const TU_WATER_V168_STRUCTURE = Object.freeze({
  sourceId: "ut2-open-industrial-structure",
  x: -2581, z: 650, radius: 33,
  minX: -2611, maxX: -2551, minZ: 635, maxZ: 665,
  minY: 5.1, maxY: 40.6,
});
const structureBands = new Map<string, number[][]>();
const structureFineBands = new Map<string, number[][]>();
for(const [values,map] of [[source.structureNativeBands,structureBands],[source.structureNativeFineBands,structureFineBands]] as const) {
  for(const [x,z,lo,hi] of values) {
    const key=`${x},${z}`, column=map.get(key), band=[lo,hi];
    if(column)column.push(band);else map.set(key,[band]);
  }
}
function structurePointSolid(x:number,z:number,y:number,minecraft:boolean):boolean {
  if(x<TU_WATER_V168_STRUCTURE.minX||x>TU_WATER_V168_STRUCTURE.maxX||z<TU_WATER_V168_STRUCTURE.minZ||z>TU_WATER_V168_STRUCTURE.maxZ||y<5.1||y>40.6)return false;
  if(minecraft) {
    const occupied=(bands:number[][]|undefined)=>bands?.some(([lo,hi])=>y>lo+.005&&y<hi-.005)??false;
    return occupied(structureBands.get(`${Math.floor(x)},${Math.floor(z)}`))||occupied(structureFineBands.get(`${Math.floor(x/.5)},${Math.floor(z/.5)}`));
  }
  const norm=Math.hypot(.9493,.3144),dx=.9493/norm,dz=.3144/norm;
  const u=(x+2606.55)*dx+(z-641.02)*dz,v=-(x+2606.55)*dz+(z-641.02)*dx;
  const inBox=(u0:number,u1:number,y0:number,y1:number,v0:number,v1:number)=>u>=u0&&u<=u1&&y>y0+.005&&y<y1-.005&&v>=v0&&v<=v1;
  if(inBox(16.8,43,17.8,39.667,-4.6,4.9)||inBox(29.1,36.6,7,17.8,-4.4,4.7))return true;
  for(const pu of [17.2,26.5,37.1,42.5])for(const pv of [-4.2,4.5])if(inBox(pu-.23,pu+.23,5.2,17.8,pv-.23,pv+.23))return true;
  for(const pu of [20,25,30,35,40])if(inBox(pu-1.6,pu+1.6,39.667,40.05,-2.9,2.9))return true;
  // Distance to the closed vertical stadium centreline, then its circular tube.
  const axial=u-Math.max(8.7,Math.min(43,u));
  const loopDistance=Math.abs(Math.hypot(axial,y-16.25)-5.85);
  return loopDistance*loopDistance+(v-.15)*(v-.15)<4.45*4.45;
}
/** Physical UT2 solids with vertical gaps; argument order matches other profiles. */
export function tuWaterV168StructureSolidAt(x:number,z:number,y:number,minecraft=false,radius=0):boolean {
  return structurePointSolid(x,z,y,minecraft)||(radius>0&&(
    structurePointSolid(x-radius,z,y,minecraft)||structurePointSolid(x+radius,z,y,minecraft)||
    structurePointSolid(x,z-radius,y,minecraft)||structurePointSolid(x,z+radius,y,minecraft)
  ));
}
