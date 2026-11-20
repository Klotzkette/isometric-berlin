import {expect, test} from "bun:test";
import {BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3} from "three";
import {attachMittePlazaEdgesV367, attachMitteSquareStreetsV367, MITTE_PLAZA_EDGES_V367} from "../src/MittePlazaEdgesV367";
import {createSmoothSurfaces, ISO_GROUND_SHADES, setIsoNightPresentation} from "../src/IsometricCityWorld";
import {compilePedestrianWater, createPedestrianState, pedestrianPointIsWater, stepPedestrian} from "../src/pedestrianNavigation";
import type {VoxelPayload} from "../src/terrainPayload";
import innerCityEdges from "../src/data/innerCityPlazaEdgesV368.json";
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

test("surveyed Wittenbergplatz has four distinct surface finishes; access, tracks and stairs remain open", () => {
  const slabs = host();
  attachMitteSquareStreetsV367(slabs, ground);
  const surveyed = slabs.children[0] as Mesh;
  const colors = surveyed.geometry.getAttribute("color");
  const ray = (x: number, z: number) => new Raycaster(new Vector3(x, 80, z), new Vector3(0, -1, 0)).intersectObject(surveyed);
  const samples = [[-2012.8,1892.82],[-2046.19,1884.72],[-2036.07,1905.13],[-2074.07,1950.29]];
  const tones = samples.map(([x,z]) => {
    const hits = ray(x,z);
    expect(hits).toHaveLength(1);
    const a = hits[0].face!.a;
    return [colors.getX(a), colors.getY(a), colors.getZ(a)].join(",");
  });
  expect(new Set(tones).size).toBe(4);
  // Neighbouring carriageway pixels in the 2026 orthophoto, on the red
  // cycle crossing and immediately north of its painted edge.
  const bike = ray(-1272.4, 2076.8), car = ray(-1272.4, 2073.2);
  expect(bike).toHaveLength(1);
  expect(car).toHaveLength(1);
  expect(colors.getX(bike[0].face!.a)).toBeGreaterThan(colors.getX(car[0].face!.a));
  // The plaza has light infill inside sett bands. Four mapped tree pits
  // interrupt the paved court north of the cycle crossing.
  const paintAt = (x: number, z: number) => {
    const hits = ray(x,z);
    expect(hits).toHaveLength(1);
    const a = hits[0].face!.a;
    return [colors.getX(a), colors.getY(a), colors.getZ(a)].join(",");
  };
  for (const [x,z] of [[-1263.261,2058.575],[-1279.079,2058.105]]) expect(paintAt(x,z)).toBe(tones[2]);
  for (const [x,z] of [[-1261.79,2061.775],[-1276.203,2055.045],[-1267.668,2048.97],[-1286.956,2057.89]]) {
    expect(paintAt(x,z)).toBe(tones[0]);
  }
  // Nollendorfplatz street-survey access .504 and track .804, George-Grosz-Platz steps .864.
  for (const [x,z] of [[-1250.235,2116.325],[-1290.529,2108.565],[-3694.622,1840.055]]) {
    expect(ray(x,z)).toHaveLength(0);
  }
});

test("the inner-city subcell fragments retain their exact height and footprint", () => {
  const data = Buffer.from(innerCityEdges.words, "base64");
  const row = data.readUInt16LE(0), col = data.readUInt16LE(2), kind = data.readUInt16LE(4);
  const x = (col + ground.grid.min_x_idx) * 4, z = (row + ground.grid.min_z_idx) * 4;
  const slabs = host();
  slabs.setMatrixAt(0, new Matrix4().makeScale(4, 3, 4).setPosition(x+2, 2.5, z+2));
  slabs.setColorAt(0, new Color(ISO_GROUND_SHADES[ground.classes[kind]][0]));
  // The first cell straddles the borough boundary. It has two disjoint
  // fragments from the two releases, sharing the same ground host.
  expect(attach(slabs)).toBe(2);
  const fragment = slabs.children[0] as Mesh;
  expect(fragment.userData.correctedMitteCells).toBe(1);
  expect(fragment.userData.correctedInnerCityCellsV368).toBe(1);
  const u = [8,12,16].map(offset => data.readUInt16LE(offset) / innerCityEdges.subunits);
  const v = [10,14,18].map(offset => data.readUInt16LE(offset) / innerCityEdges.subunits);
  const ray = (x: number, z: number) => new Raycaster(new Vector3(x, 80, z), new Vector3(0, -1, 0)).intersectObject(fragment);
  const center = ray(x + (u[0]+u[1]+u[2])/3, z + (v[0]+v[1]+v[2])/3);
  expect(center).toHaveLength(1);
  expect(center[0].point.y).toBe(4);
  expect(ray(x+4.1,z+2)).toHaveLength(0);
});
