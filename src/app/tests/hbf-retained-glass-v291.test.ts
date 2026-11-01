import { describe, expect, test } from "bun:test";
import { BufferGeometry, DoubleSide, LineSegments, Mesh, Raycaster, Vector3 } from "three";
import { createDistantBuildingShells, createIsometricCityCore, type PrismPayload } from "../src/IsometricCityWorld";
import { HBF_CIRCULATION_V291 as hbf, hbfLocalToWorldV291, hbfRailCurveAtV291 } from "../src/HbfCirculationV291";
import { hbfRetainedGlassOpeningsV291 } from "../src/HbfRetainedGlassV291";
import { hauptbahnhofWalkableInteriorAt } from "../src/HauptbahnhofNavigation";

const full = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const records = full.buildings.filter(p => (hbf.upperRailEnvelopeSourceIds as readonly string[]).includes(p.id));
const prisms = { ...full, buildings: records };
function build(enabled:boolean, fallback=false, buildings=records) {
  const root=fallback ? createDistantBuildingShells(prisms,buildings,{hbfCirculationV291:enabled}) : createIsometricCityCore({...prisms,buildings},null,null,null,{includeContext:false,hbfCirculationV291:enabled,smoothSurfaces:null});
  root.updateMatrixWorld(true);
  return root;
}
function mesh(root:ReturnType<typeof build>,fallback=false):Mesh {
  const result=root.getObjectByName(fallback?"LoD2 distant building shells":"LoD2 glass prisms") as Mesh;
  expect(result).toBeDefined();
  // Check both sheet sides rather than relying on favourable ray winding.
  for(const material of Array.isArray(result.material)?result.material:[result.material])material.side=DoubleSide;
  return result;
}
const local=(x:number,y:number,z:number)=>new Vector3(...hbfLocalToWorldV291([x,y,z]));
function inSourceFootprint(p:Vector3) {
  return records.some(record=>{
    let inside=false;
    for(let i=0,j=record.ring.length-1;i<record.ring.length;j=i++) {
      const a=record.ring[i],b=record.ring[j];
      if((a[1]/10>p.z)!==(b[1]/10>p.z)&&p.x<(b[0]-a[0])/10*(p.z-a[1]/10)/((b[1]-a[1])/10)+a[0]/10)inside=!inside;
    }
    return inside;
  });
}
function courseRay(x:number,island:number,offset:number,height:number) {
  const from=local(x,10.73+height,hbfRailCurveAtV291(x)+island+offset),to=local(x+.5,10.73+height,hbfRailCurveAtV291(x+.5)+island+offset);
  return new Raycaster(from,to.clone().sub(from).normalize(),0,from.distanceTo(to));
}
function buffers(geometry:BufferGeometry) {
  return {index:geometry.index?Array.from(geometry.index.array):null,attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([key,attribute])=>[key,Array.from(attribute.array)]))};
}

describe("Hauptbahnhof retained source glazing v291",()=>{
  test("complete source pins guard every field; inactive, changed and foreign owners preserve actual meshes and ink",()=>{
    expect(records).toHaveLength(7);
    for(const record of records) {
      expect(new Bun.CryptoHasher("sha256").update(JSON.stringify(record)).digest("hex")).toBe(hbf.upperRailEnvelopeSourceSha256[record.id as keyof typeof hbf.upperRailEnvelopeSourceSha256]);
      expect(hbfRetainedGlassOpeningsV291(record,false)).toHaveLength(0);
      expect(hbfRetainedGlassOpeningsV291(record,true).length).toBeGreaterThan(0);
      for(const changed of [{...record,h_dm:record.h_dm+1},{...record,id:`foreign-${record.id}`},{...record,tone:[1,2,3] as [number,number,number]},{...record,ring:record.ring.map((p,i)=>i?[...p]:[p[0]+1,p[1]])},{...record,extra:"unreceipted"}])expect(hbfRetainedGlassOpeningsV291(changed,true)).toHaveLength(0);
    }
    const changed=records.filter(p=>p.id==="hlYYwDX2").map(p=>({...p,h_dm:p.h_dm+1}));
    const off=build(false,false,changed),on=build(true,false,changed);
    for(const name of ["LoD2 glass prisms","LoD2 prism ink lines","LoD2 glass mullions"]) {
      const original=off.getObjectByName(name) as Mesh|LineSegments,replacement=on.getObjectByName(name) as Mesh|LineSegments;
      expect(buffers(replacement.geometry)).toEqual(buffers(original.geometry));
    }
  });

  test("real merged glass and distant fallback sheets are clear across three complete upper routes",()=>{
    for(const fallback of [false,true]) {
      const baseline=mesh(build(false,fallback),fallback),opened=mesh(build(true,fallback),fallback);
      let oldBlockers=0;
      const blockers:{x:number;island:number;offset:number;height:number;point:number[]}[]=[];
      for(let x=-112;x<112;x+=.5)for(const island of hbf.upperPlatformCentresLocalZ)for(const offset of [-1,0,1])for(const height of [.2,1.5,2]) {
        const ray=courseRay(x,island,offset,height);
        if(ray.intersectObject(baseline,false).length)oldBlockers++;
        const hit=ray.intersectObject(opened,false)[0];
        if(hit)blockers.push({x,island,offset,height,point:hit.point.toArray()});
      }
      expect(oldBlockers).toBeGreaterThan(30);
      expect(blockers.slice(0,20)).toEqual([]);
    }
  },60_000);

  test("six actual upper flight corridors are clear and opening planes agree with physical source admission",()=>{
    const allCuts=records.flatMap(record=>hbfRetainedGlassOpeningsV291(record,true));
    const contains=(p:Vector3)=>allCuts.some(c=>c.planes.every(q=>q[0]*p.x+q[1]*p.y+q[2]*p.z+q[3]>=-1e-7));
    for(const fallback of [false,true]) {
      const opened=mesh(build(true,fallback),fallback);
      for(const flight of hbf.flights.filter(f=>f.fromLevelId==="upper-rail")) {
        const dx=flight.to[0]-flight.from[0],dz=flight.to[2]-flight.from[2],length=Math.hypot(dx,dz);
        for(const offset of [-.8,0,.8])for(const height of [.2,1.5,2])for(let i=0;i<48;i++) {
          const point=(t:number)=>local(flight.from[0]+dx*t-dz/length*offset,flight.from[1]+(flight.to[1]-flight.from[1])*t+height,flight.from[2]+dz*t+dx/length*offset);
          const a=point(i/48),b=point((i+1)/48);
          expect(new Raycaster(a,b.clone().sub(a).normalize(),0,a.distanceTo(b)).intersectObject(opened,false)).toHaveLength(0);
        }
      }
    }
    // Check the shape, including the retained gaps between islands and offices
    // above the passage, against the independently consumed navigation API.
    for(let x=-60;x<=60;x+=2)for(let z=-33;z<=33;z+=1.5)for(const y of [4,6,8,10.3,11.5,13,14,24]) {
      const p=local(x,y,hbfRailCurveAtV291(x)+z);
      // Candidate cuts are source-bounds filtered, so compare where a source
      // sheet actually exists rather than in empty space between its bounds.
      if(!inSourceFootprint(p))continue;
      expect(contains(p),`body admission at ${x},${y},${z}`).toBe(hauptbahnhofWalkableInteriorAt(p.x,p.y,p.z,"hlYYwDX2"));
    }
  },60_000);

  test("exterior sheets, offices, cap geometry and transparency remain outside the narrow passage",()=>{
    for(const fallback of [false,true]) {
    const baselineRoot=build(false,fallback),openedRoot=build(true,fallback),baseline=mesh(baselineRoot,fallback),opened=mesh(openedRoot,fallback);
    const position=baseline.geometry.getAttribute("position"),index=baseline.geometry.index;
    const allCuts=records.flatMap(record=>hbfRetainedGlassOpeningsV291(record,true));
    let preserved=0,top=0;
    const failures:number[][]=[];
    for(let i=0;i<(index?.count??position.count);i+=3) {
      const vertices=[0,1,2].map(j=>{const k=index?index.getX(i+j):i+j;return new Vector3(position.getX(k),position.getY(k),position.getZ(k));});
      const centre=vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1/3);
      if(allCuts.some(c=>c.planes.every(p=>p[0]*centre.x+p[1]*centre.y+p[2]*centre.z+p[3]>=-.02)))continue;
      const normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
      if(normal.lengthSq()<.9)continue;
      const hits=new Raycaster(centre.clone().addScaledVector(normal,.02),normal.clone().negate(),0,.04).intersectObject(opened,false);
      // Coincident retained LoD2 sheets can produce an earlier hit as well;
      // the original source face itself must still exist at exactly .02 m.
      if(!hits.some(hit=>Math.abs(hit.distance-.02)<2e-4))failures.push(centre.toArray());
      preserved++;if(normal.y>.9)top++;
    }
    expect(preserved).toBeGreaterThanOrEqual(80);expect(top).toBeGreaterThan(8);expect(failures.slice(0,20)).toEqual([]);
    const original=Array.isArray(baseline.material)?baseline.material[0]:baseline.material,replacement=Array.isArray(opened.material)?opened.material[0]:opened.material;
    expect(replacement.transparent).toBe(original.transparent);expect(replacement.opacity).toBe(original.opacity);expect(replacement.vertexColors).toBe(original.vertexColors);
    expect(opened.renderOrder).toBe(baseline.renderOrder);
    }
  },60_000);

  test("original edges and mullions leave no line across the open upper body envelope",()=>{
    const root=build(true);const cuts=records.flatMap(record=>hbfRetainedGlassOpeningsV291(record,true));
    let retained=0;
    for(const name of ["LoD2 prism ink lines","LoD2 glass mullions"]) {
      const lines=root.getObjectByName(name) as LineSegments;expect(lines).toBeDefined();
      const p=lines.geometry.getAttribute("position"),crossings:number[][]=[];
      for(let i=0;i<p.count;i+=2) {
        const a=[p.getX(i),p.getY(i),p.getZ(i)],b=[p.getX(i+1),p.getY(i+1),p.getZ(i+1)],m=a.map((v,j)=>(v+b[j])/2);
        // Real reveal borders are permitted; strokes strictly inside are not.
        if(cuts.some(c=>c.planes.every(q=>q[0]*m[0]+q[1]*m[1]+q[2]*m[2]+q[3]>2e-4)))crossings.push(m);
        retained++;
      }
      expect(crossings.slice(0,20)).toEqual([]);
    }
    expect(retained).toBeGreaterThan(300);
  },60_000);
});
