import { expect, test } from "bun:test";
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, Vector2 } from "three";
import { gunzipSync } from "node:zlib";
import { restoreRoadGroundV343, roadGroundSourceGuardV343 } from "../src/RoadGroundV343";
import { createDistrictStreets, createSourceStreetSurfaces, type StreetSource } from "../src/DistrictStreets";
import { getMitteRoadTransactionV343 } from "../src/mitteRoadsV343";
import type { VoxelPayload } from "../src/terrainPayload";
import groundSource from "../public/mesh/regierungsviertel/ground-context.json";
import streets from "../src/data/districtStreets.json";
import ownership from "../src/data/roadGroundV343.json";
import { createKulturforumPlazaV343 } from "../src/KulturforumPlazaV343";

const ground = groundSource as unknown as VoxelPayload;
const source = streets as unknown as StreetSource;
const audit = JSON.parse(gunzipSync(new Uint8Array(await Bun.file(new URL("../../../geo_data/regierungsviertel/road-ground-v343-source.json.gz", import.meta.url)).arrayBuffer())).toString());

function finalHosts(extras: Matrix4[] = [], omit = -1): InstancedMesh {
  const rows = (audit.records as number[][]).filter((_,i)=>i!==omit);
  const slabs = new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),rows.length+extras.length);
  rows.forEach(([x0,z0,x1,z1,top,depth],i)=>{
    const matrix=new Matrix4().makeScale(x1-x0,depth,z1-z0);
    matrix.setPosition((x0+x1)/2,top-depth/2,(z0+z1)/2);
    slabs.setMatrixAt(i,matrix);slabs.setColorAt(i,new Color(.2,.3,.4));
  });
  extras.forEach((matrix,i)=>slabs.setMatrixAt(rows.length+i,matrix));
  return slabs;
}

function plazaHostIndex(): number {
  const cells=new Uint32Array(Uint8Array.from(atob(ownership.cells_u32),c=>c.charCodeAt(0)).buffer);
  const record=ownership.plazaRecords[0];
  const x=(cells[record*6]+ground.grid.min_x_idx)*ground.cell_m;
  const z=(cells[record*6+1]+ground.grid.min_z_idx)*ground.cell_m;
  return audit.records.findIndex(([x0,z0,x1,z1]:number[])=>x>=x0&&x<x1&&z>=z0&&z<z1);
}

test("the building Worker cannot statically import the main-only road correction source",async()=>{
  const core=await Bun.file(new URL("../src/IsometricCityWorld.ts",import.meta.url)).text();
  const worker=await Bun.file(new URL("../src/progressiveWorld.worker.ts",import.meta.url)).text();
  expect(core).not.toMatch(/import[^;]*["']\.\/RoadGroundV343["']/);
  expect(worker).not.toContain("RoadGroundV343");
  expect(core).toContain("if (surfaces && !options.retainRasterAsphalt) options.restoreRoadGroundV343?.(slabs, ground)");
});

test("exact road identity rejects even a one-byte changed source", () => {
  expect(roadGroundSourceGuardV343(source)).toBe(ownership.roadGuards[0]);
  const changed = {...source,surfaces:source.surfaces.map((s,i)=>i? s : {...s,positions_cm_b64:(s.positions_cm_b64[0]==="A"?"B":"A")+s.positions_cm_b64.slice(1)})};
  expect(roadGroundSourceGuardV343(changed)).not.toBe(ownership.roadGuards[0]);
});

test("final host paint and complete outside geometry survive; repeated admission is inert", () => {
  const matrix=new Matrix4().makeScale(4,3,4);matrix.setPosition(9000,2.5,9000);
  const slabs=finalHosts([matrix]);
  const sentinel=Array.from(matrix.elements);
  const older=new Mesh(new BoxGeometry(),new MeshBasicMaterial());slabs.add(older);
  const plaza=createKulturforumPlazaV343(ground)!;
  expect(restoreRoadGroundV343(slabs,ground,plaza)).toBeTrue();
  expect(slabs.userData.roadGroundCellsV343).toBeGreaterThan(0);
  expect(slabs.children).toContain(older);
  expect(plaza.parent).toBe(slabs);
  expect(Array.from(slabs.instanceMatrix.array).slice(-16)).toEqual(sentinel);
  const meshes:Mesh[]=[];
  slabs.children.filter(o=>o.userData.roadGroundV343).forEach(root=>root.traverse(o=>{if(o instanceof Mesh)meshes.push(o);}));
  expect(meshes.length).toBeGreaterThan(0);
  for(const mesh of meshes){
    const paint=mesh.geometry.getAttribute("color");
    for(let i=0;i<paint.count;i++){expect(paint.getX(i)).toBeCloseTo(.2,6);expect(paint.getY(i)).toBeCloseTo(.3,6);}
  }
  const matrices=Array.from(slabs.instanceMatrix.array),children=slabs.children.length;
  let disposed=false;(plaza.children[0] as Mesh).geometry.addEventListener("dispose",()=>{disposed=true;});
  expect(restoreRoadGroundV343(slabs,ground,plaza)).toBeFalse();
  expect(Array.from(slabs.instanceMatrix.array)).toEqual(matrices);
  expect(slabs.children).toHaveLength(children);
  expect(disposed).toBeFalse();
});

test("shifted, sheared and differently deep fragments never become a correction host",()=>{
  const [x0,z0,x1,z1,top,depth]=audit.records[0] as number[];
  const matrix=new Matrix4().makeScale(x1-x0,depth,z1-z0);
  matrix.setPosition((x0+x1)/2,top-depth/2,(z0+z1)/2+.5);
  const shifted=matrix.clone();matrix.elements[14]-=.5;matrix.elements[1]=.125;
  const shallow=matrix.clone();shallow.elements[1]=0;shallow.elements[5]-=.5;shallow.elements[13]+=.25;
  const slabs=finalHosts([shifted,matrix,shallow]);
  const old=Array.from(slabs.instanceMatrix.array).slice(-48);
  expect(restoreRoadGroundV343(slabs,ground,createKulturforumPlazaV343(ground))).toBeTrue();
  expect(slabs.userData.roadGroundCellsV343).toBeGreaterThan(0);
  expect(Array.from(slabs.instanceMatrix.array).slice(-48)).toEqual(old);
});

test("missing, forged or incomplete plaza never removes original ground and retires rejected resources",()=>{
  for(const condition of ["missing","forged","incomplete","altered","missing-host","changed-depth"]){
    const host=plazaHostIndex();expect(host).toBeGreaterThanOrEqual(0);
    const slabs=finalHosts([],condition==="missing-host"?host:-1);
    if(condition==="changed-depth"){
      const matrix=new Matrix4();slabs.getMatrixAt(host,matrix);
      matrix.elements[5]-=.5;matrix.elements[13]+=.25;slabs.setMatrixAt(host,matrix);
    }
    const original=Array.from(slabs.instanceMatrix.array);
    const plaza=condition==="missing"?null:condition==="forged"?new Group():createKulturforumPlazaV343(ground)!;
    if(condition==="forged")plaza!.add(new Mesh(new BoxGeometry(),new MeshBasicMaterial()));
    let disposed=false;
    if(plaza){
      const mesh=plaza.children[0] as Mesh;
      mesh.geometry.addEventListener("dispose",()=>{disposed=true;});
      if(condition==="incomplete")mesh.geometry.setIndex([0,1,2]);
      if(condition==="altered")mesh.geometry.getAttribute("position").setX(0,12345);
    }
    expect(restoreRoadGroundV343(slabs,ground,plaza)).toBeFalse();
    expect(Array.from(slabs.instanceMatrix.array)).toEqual(original);
    expect(slabs.children).toHaveLength(0);
    expect(disposed).toBe(condition!=="missing");
    if(plaza)expect(plaza.children).toHaveLength(0);
  }
});

test("the actual Kanzleramt screenshot rays see road above every retained ground fragment",()=>{
  const slabs=finalHosts();
  expect(restoreRoadGroundV343(slabs,ground,createKulturforumPlazaV343(ground))).toBeTrue();
  const streets=createDistrictStreets(ground);
  slabs.updateMatrixWorld(true);streets.updateMatrixWorld(true);
  const camera=new PerspectiveCamera(16,1280/720,.25,10000);
  camera.position.set(65,62,20);camera.lookAt(-40,5,-62);camera.updateMatrixWorld(true);
  const ray=new Raycaster();
  for(const [x,y] of [[650,325],[690,325],[710,325],[670,320]]){
    ray.setFromCamera(new Vector2(x/640-1,1-y/360),camera);
    const hits=ray.intersectObjects([slabs,streets],true).filter(h=>h.object instanceof Mesh);
    expect(hits[0]?.object.name).toBe("Mitte surveyed road material 02");
  }
});

test("public core streets admit the exact finite transaction while standalone constructor stays original",()=>{
  const transaction=getMitteRoadTransactionV343(source)!;
  expect(transaction).not.toBeNull();
  const current=createDistrictStreets(ground);
  const original=createSourceStreetSurfaces(ground,source,"unchanged source");
  expect(current.userData.mitteRoadsV343).toBeTrue();
  for(const kind of ["asphalt","paving","sidewalk","gravel","grass"] as const){
    const name={asphalt:"District asphalt carriageways",paving:"District mapped paved walkways",sidewalk:"Brandenburg approach raised sidewalks",gravel:"Unter den Linden mapped gravel promenade",grass:"Brandenburg approach mapped lawns"}[kind];
    const before=original.getObjectByName(name) as Mesh,after=current.children.find(o=>o.name===name) as Mesh;
    expect(Array.from(after.geometry.getAttribute("position").array)).toEqual(Array.from(before.geometry.getAttribute("position").array));
    const removed=transaction.surfaceRemovals.get(kind)??new Set<number>();
    const expected=Array.from(before.geometry.index!.array).filter((_,i)=>!removed.has(Math.floor(i/3)));
    expect(Array.from(after.geometry.index!.array)).toEqual(expected);
  }
  const oldCurbs=(original.getObjectByName("District raised kerbstones") as Mesh).geometry.getAttribute("position").array;
  const curbs=(current.children.find(o=>o.name==="District raised kerbstones") as Mesh).geometry.getAttribute("position").array;
  let oldAt=0,newAt=0;
  source.curbs_m.forEach((line,i)=>{
    const replacement=transaction.curbReplacements.get(i);
    if(!replacement)expect(Array.from(curbs.slice(newAt,newAt+line.length*12))).toEqual(Array.from(oldCurbs.slice(oldAt,oldAt+line.length*12)));
    oldAt+=line.length*12;newAt+=(replacement?replacement.reduce((n,l)=>n+l.length,0):line.length)*12;
  });
  let objects=0,bytes=0;
  current.traverse(o=>{if("geometry" in o){const g=(o as Mesh).geometry;objects++;bytes+=(g.index?.array.byteLength??0)+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0);}});
  expect(objects).toBeLessThanOrEqual(20);
  expect(bytes).toBeLessThan(25*1024*1024);
});
