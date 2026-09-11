import { expect, test } from "bun:test";
import { Color, InstancedMesh, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createKollhoffWindowRelief } from "../src/kollhoffWindowRelief";
import { createIsometricCity, KOLLHOFF_TOWER_PRISM_IDS, type PrismPayload } from "../src/IsometricCityWorld";
import { createFriedrichstrasseArchitecture, type FriedrichstrasseBlock } from "../src/FriedrichstrasseArchitecture";
import { createDeutschesTheater, createMinecraftDeutschesTheater } from "../src/DeutschesTheater";
import { createHistoricChariteCampus, HISTORIC_CHARITE_IDS, CHARITE_ALTHOFF_TOWER_ID, historicChariteWindows } from "../src/HistoricChariteCampus";
import { createMinecraftHistoricCharite } from "../src/MinecraftHistoricCharite";
import { FRIEDRICHSTRASSE_ARCHITECTURE_SOURCE } from "../src/friedrichstrasseArchitectureProfile";
import { pointInUrbanFacadeScope, urbanFacadeInkShader, urbanFacadeScope } from "../src/urbanFacadePresentation";
import { ShaderLib } from "three";

const source = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;

test("Kollhoff's shared relief keeps the pane aperture and places the red clinker returns outside it", () => {
  const geometry = createKollhoffWindowRelief();
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true }));
  mesh.updateMatrixWorld(true);
  const hit = (x: number, y: number) => new Raycaster(new Vector3(x,y,1), new Vector3(0,0,-1),0,2).intersectObject(mesh)[0];
  expect(geometry.getAttribute("position").count).toBe(54);
  expect(geometry.getAttribute("uv")).toBeUndefined();
  for (const [x,y] of [[0,0],[.48,.48],[-.48,-.48]]) expect(hit(x,y).point.z).toBeCloseTo(0,6);
  expect(hit(.55,0).point.z).toBeCloseTo(.1,6);
  expect(hit(.62,0).point.z).toBeCloseTo(.18,6);
  expect(hit(.67,0)).toBeUndefined();
  const c = new Color().fromBufferAttribute(geometry.getAttribute("color"), hit(.62,0).face!.a);
  expect(c.r).toBeGreaterThan(c.g);
  expect(c.g).toBeGreaterThan(c.b);
  const bytes = Object.values(geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,0);
  expect(bytes).toBe(1944);
  geometry.dispose();
});

test("Potsdamer integration reuses all existing Kollhoff instances and their single batch", () => {
  const buildings = source.buildings.filter(p=>KOLLHOFF_TOWER_PRISM_IDS.has(p.id));
  const original = JSON.stringify(buildings);
  const city = createIsometricCity(source,null,null,null,{ buildings, includeContext:false });
  const panes = city.getObjectByName("Kollhoff recessed window panes") as InstancedMesh;
  expect(panes).toBeInstanceOf(InstancedMesh);
  expect(panes.geometry.getAttribute("position").count).toBe(54);
  expect(panes.instanceMatrix.count).toBe(panes.count);
  expect(panes.count).toBeGreaterThan(1000);
  expect(JSON.stringify(buildings)).toBe(original);
  city.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});
});

test("Schiffbauerdamm 8 stone balustrades refine the owned balconies in all four profiles", () => {
  const ids = new Set(FRIEDRICHSTRASSE_ARCHITECTURE_SOURCE.profiles.find(p=>p.key==="schiff8")!.ids);
  for (const minecraft of [false,true]) for (const mobileLike of [false,true]) {
    const model = createFriedrichstrasseArchitecture({minecraft,mobileLike,diagnostics:true,sourcePrisms:source.buildings});
    const blocks = model.userData.blocks as FriedrichstrasseBlock[];
    const balusters = blocks.filter(b=>b.role==="Schiffbauerdamm 8 stone baluster stem");
    expect(balusters.length).toBeGreaterThan(0);
    expect(balusters.every(b=>ids.has(b.sourceId))).toBeTrue();
    expect(balusters.every(b=>b.size[0]===.105&&b.size[1]===.70)).toBeTrue();
    expect(model.children.length).toBe(minecraft?2:3);
    model.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});
  }
});

test("the ten theatre arches retain their existing panes and gain only two side returns each", () => {
  for (const minecraft of [false,true]) for (const mobileLike of [false,true]) {
    const factory = minecraft ? createMinecraftDeutschesTheater : createDeutschesTheater;
    const model = factory(source,{mobileLike,diagnostics:true});
    const blocks = model.userData.blocks as Array<{role:string;size:number[]}>;
    const returns = blocks.filter(b=>b.role==="arched masonry jamb return");
    expect(returns).toHaveLength(20);
    expect(returns.every(b=>b.size[0]===.13&&b.size[2]===.27)).toBeTrue();
    model.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});
  }
});

test("Althoff's pale upper band and seven crowns keep the mapped facade identity and openings", () => {
  const buildings = source.buildings.filter(p=>HISTORIC_CHARITE_IDS.has(p.id));
  const part = buildings.find(p=>p.id===CHARITE_ALTHOFF_TOWER_ID)!;
  const original = JSON.stringify(buildings);
  expect(historicChariteWindows(part,buildings).filter(w=>w.streetAlthoff&&w.paired)).toHaveLength(7);
  for (const profile of ["full","mobile"] as const) {
    const model = createHistoricChariteCampus(source,profile);
    const blocks = createMinecraftHistoricCharite(buildings,profile,true);
    expect(model.userData.detailCounts.althoffUpperCrowns).toBe(7);
    expect(blocks.userData.detailCounts.windows).toBe(673);
    const details = blocks.userData.blockRecords as Array<{role:string;sourceId:string}>;
    expect(details.filter(b=>b.role==="Althoff upper plaster band")).toHaveLength(1);
    const crowns = details.filter(b=>b.role==="Althoff stepped brick crown");
    expect(crowns).toHaveLength(42);
    expect(crowns.every(b=>b.sourceId===CHARITE_ALTHOFF_TOWER_ID)).toBeTrue();
    for(const root of [model,blocks])root.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});
  }
  expect(JSON.stringify(buildings)).toBe(original);
});

test("ordinary Friedrichstrasse and theatre neighbours receive the same bounded palette and ink scope", () => {
  for(const [x,z] of [[700,-600],[1130,-360],[1200,-100]])expect(pointInUrbanFacadeScope(x,z)).toBeTrue();
  expect(pointInUrbanFacadeScope(1350,-600)).toBeFalse();
  const local=source.buildings.filter(p=>{const x=p.ring.reduce((s,v)=>s+v[0],0)/p.ring.length/10,z=p.ring.reduce((s,v)=>s+v[1],0)/p.ring.length/10;return x>=620&&x<=1280&&z>=-660&&z<=65;});
  expect(local).toHaveLength(1206);
  expect(local.every(urbanFacadeScope)).toBeTrue();
  const shader = urbanFacadeInkShader(ShaderLib.dashed.vertexShader,ShaderLib.dashed.fragmentShader);
  expect(shader.vertexShader).toContain("step(620.0, urbanXZ.x) * step(urbanXZ.x, 1280.0) * step(-660.0, urbanXZ.y) * step(urbanXZ.y, 65.0)");
});
