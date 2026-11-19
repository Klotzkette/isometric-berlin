import {expect, test} from "bun:test";
import {BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3} from "three";
import {attachMittePlazaEdgesV367, attachMitteSquareStreetsV367, MITTE_PLAZA_EDGES_V367} from "../src/MittePlazaEdgesV367";
import {createSmoothSurfaces, ISO_GROUND_SHADES, setIsoNightPresentation} from "../src/IsometricCityWorld";
import {compilePedestrianWater, createPedestrianState, pedestrianPointIsWater, stepPedestrian} from "../src/pedestrianNavigation";
import type {VoxelPayload} from "../src/terrainPayload";
import source from "../src/data/mittePlazaEdgesV367.json";
import raster from "../public/mesh/regierungsviertel/ground-context.json";

const ground = raster as unknown as VoxelPayload;
const fixture = Buffer.from(source.words, "base64");
const row = fixture.readUInt16LE(0), col = fixture.readUInt16LE(2);
const oldKind = fixture.readUInt16LE(4), triangles = fixture.readUInt16LE(6);
const x = (col + ground.grid.min_x_idx) * ground.cell_m;
const z = (row + ground.grid.min_z_idx) * ground.cell_m;

function host(width = ground.cell_m, colour = ISO_GROUND_SHADES[ground.classes[oldKind]][0]) {
  const slabs = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 1);
  slabs.userData.nightMaterial = slabs.material;
  slabs.name = "Drawn ground slabs";
  slabs.setMatrixAt(0, new Matrix4().makeScale(width, 3, ground.cell_m).setPosition(x+width/2, 5.5, z+ground.cell_m/2));
  slabs.setColorAt(0, new Color(colour));
  return slabs;
}

function attach(slabs: InstancedMesh) {
  const steps = attachMittePlazaEdgesV367(slabs, ground, ISO_GROUND_SHADES);
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}

test("planted and paved margins follow their sub-cell boundary at the surviving host height", () => {
  const slabs = host(), original = Array.from(slabs.instanceMatrix.array);
  expect(attach(slabs)).toBe(1);
  const mesh = slabs.getObjectByName(MITTE_PLAZA_EDGES_V367) as Mesh;
  const p = mesh.geometry.getAttribute("position"), index = mesh.geometry.index!;
  expect(index.count).toBe(triangles*3);
  const xs: number[] = [], zs: number[] = [];
  for (let i = 0; i < p.count; i++) {
    xs.push(p.getX(i)); zs.push(p.getZ(i));
    expect(p.getY(i)).toBe(7);
  }
  expect(Math.min(...xs)).toBeGreaterThanOrEqual(x);
  expect(Math.max(...xs)).toBeLessThanOrEqual(x+4);
  expect(Math.min(...zs)).toBeGreaterThanOrEqual(z);
  expect(Math.max(...zs)).toBeLessThanOrEqual(z+4);
  expect(xs.some(v => v > x && v < x+4) || zs.some(v => v > z && v < z+4)).toBe(true);
  expect(Array.from(slabs.instanceMatrix.array)).toEqual(original);
  expect(attach(slabs)).toBe(0);
  const scene = new Group().add(slabs);
  setIsoNightPresentation(scene, true);
  expect(mesh.material).toBe(mesh.userData.nightMaterial);
  setIsoNightPresentation(scene, false);
  expect(mesh.material).toBe(mesh.userData.dayMaterial);
});

test("partial slabs, a changed host paint and native blocks cannot acquire a paving fragment", () => {
  expect(attach(host(2))).toBe(0);
  expect(attach(host(4, 0x777777))).toBe(0);
  const native = host();
  native.name = "Voxel ground runs";
  expect(attach(native)).toBe(0);
});

test("Leopoldplatz carries surveyed sidewalks, roadway and divider but keeps both subway entrances open", () => {
  const slabs = host();
  attachMitteSquareStreetsV367(slabs, ground);
  const mesh = slabs.children[0] as Mesh;
  const down = new Vector3(0, -1, 0);
  const hitsAt = (x: number, z: number) => new Raycaster(new Vector3(x, 100, z), down).intersectObject(mesh);
  // Interior points of the public Berlin street-survey features.
  const sidewalk = hitsAt(-811.31, -3145.28);
  const roadway = hitsAt(-763.06, -3085.41);
  const divider = hitsAt(-774.59, -3087.61);
  for (const hit of [sidewalk, roadway, divider]) expect(hit).toHaveLength(1);
  const colors = mesh.geometry.getAttribute("color");
  expect(new Set([sidewalk, roadway, divider].map(h => colors.getX(h[0].face!.a))).size).toBe(3);
  // bm_zugangsbauwerk.413 and .419 are open in the final mesh.
  expect(hitsAt(-735.25, -3080.21)).toHaveLength(0);
  expect(hitsAt(-759.07, -3107.95)).toHaveLength(0);
  attachMitteSquareStreetsV367(slabs, ground);
  expect(slabs.children).toHaveLength(1);
  const newTerrain = host();
  attachMitteSquareStreetsV367(newTerrain, {...ground, ground_height: {...ground.ground_height, y_dm: []}});
  expect(newTerrain.children).toHaveLength(0);
});

test("the flat Leopoldplatz fountain replaces the blue pool and spans its paved apron", () => {
  const field = {area_m2:185, holes:[], kind:"basin", name:"Fontänenfeld",
    ring:[[-7461,-31561],[-7545,-31477],[-7655,-31588],[-7570,-31672],[-7461,-31561]]};
  const adjacentBasin = {...field, ring:field.ring.map(([x,z]) => [x+400,z])};
  const water = compilePedestrianWater({water:[field, adjacentBasin]});
  expect(water).toHaveLength(1);
  expect(pedestrianPointIsWater(-755,-3157,water)).toBe(false);
  expect(pedestrianPointIsWater(-715,-3157,water)).toBe(true);
  const environment = {bounds:{minX:-790, maxX:-680, minZ:-3190, maxZ:-3120}, groundAt:() => 5.2, water};
  let walker = createPedestrianState(environment, {x:-772, z:-3157, yaw:Math.PI/2, pitch:0});
  for (let i=0; i<400; i++) {
    walker = stepPedestrian(walker, {forward:1, strafe:0, turn:0, look:0, sprint:false}, .05, environment).state;
  }
  expect(walker.x).toBeGreaterThan(-742);
  expect(walker.x).toBeLessThan(-715);
  expect(walker.groundY).toBe(5.2);
  const surfaces = {schema_version:9, parks:[], water:[field]};
  const drawn = createSmoothSurfaces(surfaces, 1, 5.2, () => 5.2);
  for (const name of ["basin water", "basin floors", "basin display-depth walls", "static water ripple ribbons"])
    expect(drawn.getObjectByName(name)).toBeUndefined();
  const other = createSmoothSurfaces({...surfaces, water:[{...field,name:"Other basin"}]}, 1, 5.2, () => 5.2);
  expect(other.getObjectByName("basin water")).toBeDefined();
  const slabs = host();
  attachMitteSquareStreetsV367(slabs, ground);
  for (const [x,z] of [[-749.4,-3091.2],[-758,-3099.9],[-746.97,-3152.46],[-754,-3154]])
    expect(new Raycaster(new Vector3(x, 20, z), new Vector3(0,-1,0)).intersectObject(slabs.children[0])).toHaveLength(1);
});
