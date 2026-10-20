import {expect, test} from "bun:test";
import {resolve} from "node:path";
import {Raycaster, Vector3} from "three";
import data from "../src/data/steglitzCourtGroundV251.json";
import floors from "../src/data/steglitzCourtGroundV251Floor.json";
import {appendSteglitzCourtGroundV251, steglitzCourtGroundV251Enabled} from "../src/steglitzCourtGroundV251";
import {steglitzCourtGroundV251Height} from "../src/steglitzCourtGroundV251Floor";
import {justicePalaceV183Boxes} from "../src/justicePalaceV183Batches";
import {createPedestrianEnvironment, pedestrianPointIsBlocked} from "../src/pedestrianNavigation";
import type {VoxelPayload} from "../src/terrainPayload";

const entry = {
  owner: data.owner, boxes: [[1,2,3,1,1,1,0,0x888888]],
  rods: [] as number[][], nativeRows: [[1,2,3,1,1,1,0x888888]],
  labels: [{text:"retained"}],
};

test("small court appends to the retained school without altering unrelated rows", () => {
  expect(steglitzCourtGroundV251Enabled()).toBe(true);
  const result = appendSteglitzCourtGroundV251(entry);
  expect(result.labels).toBe(entry.labels);
  for (const key of ["boxes","rods","nativeRows"] as const) {
    expect(result[key].slice(0,entry[key].length)).toEqual(entry[key]);
    expect(result[key].length).toBe(entry[key].length+data[key].length);
    expect(result[key].every(r=>r.every(Number.isFinite))).toBe(true);
    expect(result[key].slice(entry[key].length).every(r=>data.palette.includes(r.at(-1)!))).toBe(true);
  }
  const other={...entry,owner:"unrelated"};
  expect(appendSteglitzCourtGroundV251(other)).toBe(other);
  expect(data.boxes.length+data.rods.length).toBeLessThan(500);
  expect(data.nativeRows.length).toBeLessThan(1000);
  expect(result.nativeRows.every(r=>r.length===7&&r.slice(3,6).every(v=>v>0))).toBe(true);
});

for (const native of [false,true]) test(`court ${native?"native":"drawn"} floor lookup matches actual supporting geometry`, () => {
  const empty={owner:data.owner,boxes:[],rods:[],nativeRows:[]};
  const result=appendSteglitzCourtGroundV251(empty);
  const rows=native?result.nativeRows:result.boxes;
  const mesh=justicePalaceV183Boxes(rows,native);
  mesh.updateMatrixWorld(true);
  const count=data.groundCounts[native?1:0];
  for(const row of rows.slice(0,count)){
    const y=steglitzCourtGroundV251Height(row[0],row[2],native);
    expect(y).toBe(3.55);
    const ray=new Raycaster(new Vector3(row[0],3.554,row[2]),new Vector3(0,-1,0),0,.01);
    const hit=ray.intersectObject(mesh,false);
    expect(hit.length).toBeGreaterThan(0);
    expect(hit[0].point.y).toBeCloseTo(y!,4);
  }
  for(const [x,z] of [[-3220,6823],[-3250,6790],[-3230,6844],[-3290,6820],[0,0]]){
    expect(steglitzCourtGroundV251Height(x,z,native)).toBeUndefined();
  }
  expect(steglitzCourtGroundV251Height(Number.NaN,6820,native)).toBeUndefined();
  mesh.geometry.dispose();
  (Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());
  mesh.dispose();
});

test("navigation imports only tiny floor profiles, and a changed shell disables geometry", async () => {
  const profile=await Bun.file(resolve(import.meta.dir,"../src/steglitzCourtGroundV251Floor.ts")).text();
  expect((profile.match(/^import /gm)||[]).length).toBe(1);
  expect(profile).not.toContain("from \"./steglitzCourtGroundV251\"");
  expect(floors.drawn.length).toBe(data.groundCounts[0]);
  expect(floors.native.length).toBe(data.groundCounts[1]);
  const code=`
    import assert from 'node:assert/strict';
    import nav from './src/data/steglitzV182Navigation.json';
    nav.buildings.find(b=>b.owner==='DEBE06YYB0000AUq').groundY+=.01;
    const m=await import('./src/steglitzCourtGroundV251');
    const entry={owner:'DEBE06YYB0000AUq',boxes:[],rods:[],nativeRows:[]};
    assert.equal(m.steglitzCourtGroundV251Enabled(),false);
    assert.equal(m.appendSteglitzCourtGroundV251(entry),entry);
  `;
  const child=Bun.spawnSync([process.execPath,"-e",code],{cwd:resolve(import.meta.dir,"..")});
  expect(child.stderr.toString()).toBe("");
  expect(child.exitCode).toBe(0);
});

test("walking uses the court finish without blocking the courtyard or inventing support", () => {
  const ground: VoxelPayload = {
    schema_version: 2, cell_m: 4, classes: ["grass"], water_top_y_m: -1,
    grid: {cols: 1, rows: 1, min_x_idx: 0, min_z_idx: 0},
    ground_height: {cols: 1, rows: 1, stride_cells: 1, y_dm: [30]},
    ground_rows: [[[0, 1, 0]]],
  };
  for (const native of [false, true]) {
    const make = (value: number | null) => {
      const environment = createPedestrianEnvironment(ground, {water: []}, null, null, {
        bounds: {minX: -3300, maxX: -3200, minZ: 6780, maxZ: 6860},
        groundAt: () => value, solidAt: () => false, waterAt: () => false,
      });
      environment.visualMode = () => native ? "minecraft" : "day";
      return environment;
    };
    const supported = make(3), higher = make(4), unsupported = make(null);
    for (const row of (native ? floors.native : floors.drawn)) {
      const x = row[0] + floors.origin[0], z = row[1] + floors.origin[1];
      expect(supported.groundAt(x,z)).toBe(3.55);
      expect(higher.groundAt(x,z)).toBe(4);
      expect(unsupported.groundAt(x,z)).toBeNull();
      expect(pedestrianPointIsBlocked(x,z,3.55,supported.obstacles,supported)).toBe(false);
    }
    expect(supported.groundAt(-3220,6823)).toBe(3);
  }
});
