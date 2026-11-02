import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Box3, Group, InstancedMesh, Matrix4, Mesh } from "three";
import source from "../src/data/westKiezV302Core.json";
import owners from "../src/data/westKiezV302CoreOwners.json";
import navigation from "../src/data/westKiezV302CoreNavigation.json";
import nativeNavigation from "../src/data/westKiezV302NativeNavigation.json";
import {
  createWestKiezV302Core, hasCompleteWestKiezV302Core, westKiezV302Solids,
  admitsWestKiezV302Core, admitsWestKiezV302Native, isWestKiezV302OldCore,
  isWestKiezV302OldNativeColumn,
} from "../src/WestKiezV302Core";

const evidence = JSON.parse(gunzipSync(readFileSync(new URL("../../../geo_data/regierungsviertel/west-kiez-v302-core-source.json.gz", import.meta.url))).toString());
const dispose = (root: Group) => root.traverse(object => {
  const mesh = object as Mesh;
  mesh.geometry?.dispose();
  mesh.userData.dayMaterial?.dispose(); mesh.userData.nightMaterial?.dispose();
  if (mesh instanceof InstancedMesh) mesh.dispose();
});

test("complete official families retain every source part and their exact precompiled wall/roof vertices", () => {
  expect(source.sites).toHaveLength(15);
  expect(source.sites.reduce((n, site) => n + site.addresses.length, 0)).toBe(16);
  expect(evidence.sites.reduce((n: number, site: { parts: unknown[] }) => n + site.parts.length, 0)).toBe(89);
  const root = createWestKiezV302Core();
  const mesh = root.children[0] as Mesh;
  const positions = mesh.geometry.getAttribute("position"), colors = mesh.geometry.getAttribute("color");
  let vertex = 0, index = 0;
  for (const site of source.sites) {
    const p = new Float32Array(Uint8Array.from(Buffer.from(site.drawn.positions, "base64")).buffer);
    const c = Buffer.from(site.drawn.colors, "base64");
    const ix = new Uint32Array(Uint8Array.from(Buffer.from(site.drawn.indices, "base64")).buffer);
    for (let at = 0; at < p.length; at++) {
      expect(positions.array[vertex * 3 + at]).toBe(Math.fround(p[at] + site.origin[at % 3]));
      expect(colors.array[vertex * 3 + at]).toBe(c[at]);
    }
    for (const v of ix) expect(mesh.geometry.index!.array[index++]).toBe(v + vertex);
    vertex += p.length / 3;
  }
  expect(positions.count).toBe(vertex); expect(mesh.geometry.index!.count).toBe(index);
  expect(hasCompleteWestKiezV302Core(root, false)).toBe(true);
  expect(hasCompleteWestKiezV302Core(root, true)).toBe(false);
  expect(hasCompleteWestKiezV302Core(new Group())).toBe(false);
  dispose(root);
});

test("native source members are independent finite cardinal surfaces and touch keeps every member", () => {
  const a = createWestKiezV302Core(true), b = createWestKiezV302Core(true, { mobileLike: true });
  const members = a.children as InstancedMesh[], touchMembers = b.children as InstancedMesh[];
  expect(members.reduce((n,m)=>n+m.count,0)).toBe(source.sites.reduce((n, site) => n + site.nativeRows.length + site.nativeFittings.length, 0));
  expect(members).toHaveLength(2);expect(touchMembers).toHaveLength(2);
  const matrix = new Matrix4();
  for(const [j,mesh]of members.entries()){
    expect(mesh.instanceMatrix.array).toEqual(touchMembers[j].instanceMatrix.array);
    expect(mesh.instanceColor!.array).toEqual(touchMembers[j].instanceColor!.array);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(mesh.geometry.getAttribute("color").count).toBe(mesh.geometry.getAttribute("position").count);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      for (const at of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[at]).toBe(0);
      for (const at of [0, 5, 10]) expect(matrix.elements[at]).toBeGreaterThan(0);
    }
  }
  expect(members[1].userData.nightMaterial.emissiveIntensity).toBe(.38);
  expect(members[0].userData.nightMaterial.emissiveIntensity).toBe(0);
  expect(hasCompleteWestKiezV302Core(a, true)).toBe(true);
  const mesh=members[0];
  const count = mesh.count; mesh.count--;
  expect(hasCompleteWestKiezV302Core(a, true)).toBe(false); mesh.count = count;
  dispose(a); dispose(b);
});

test("each exact old source prism is needed once before a coarse owner can yield", () => {
  const payload = { buildings: structuredClone(owners.oldPrisms) };
  expect(payload.buildings).toHaveLength(18);
  expect(admitsWestKiezV302Core(payload)).toBe(true);
  expect(admitsWestKiezV302Core({ buildings: payload.buildings.slice(1) })).toBe(false);
  expect(admitsWestKiezV302Core({ buildings: [...payload.buildings, payload.buildings[0]] })).toBe(false);
  for (const p of payload.buildings) {
    expect(isWestKiezV302OldCore(p)).toBe(true);
    expect(isWestKiezV302OldCore({ ...p, h_dm: p.h_dm + 1 })).toBe(false);
    expect(isWestKiezV302OldCore({ ...p, extra: true })).toBe(false);
  }
  let reads = 0;
  const accessor = Object.defineProperty({ ...payload.buildings[0] }, "ring", { enumerable: true, get() { reads++; return payload.buildings[0].ring; } });
  expect(isWestKiezV302OldCore(accessor)).toBe(false); expect(reads).toBe(0);
  expect(admitsWestKiezV302Core({ buildings: [] })).toBe(false);
});

test("native admission binds full actual source rows and retires only exact exclusive five-value tuples", () => {
  const payload = { schema_version: 2, cell_m: 4, grid: owners.nativeGrid, classes: owners.nativeClasses,
    building_rows: [] as number[][][] };
  for (const row of owners.nativeRows) payload.building_rows[row.index] = structuredClone(row.row);
  expect(admitsWestKiezV302Native(payload)).toBe(true);
  expect(owners.sharedColumns).toHaveLength(0);
  expect(owners.nativeColumns).toHaveLength(552);
  for (const column of owners.nativeColumns) {
    expect(isWestKiezV302OldNativeColumn(column)).toBe(true);
    expect(isWestKiezV302OldNativeColumn([...column.slice(0, 4), column[4] + 1])).toBe(false);
  }
  const changed = structuredClone(payload);
  changed.building_rows[owners.nativeRows[0].index][0][4]++;
  expect(admitsWestKiezV302Native(changed)).toBe(false);
  expect(admitsWestKiezV302Native({ ...payload, cell_m: 2 })).toBe(false);
  expect(admitsWestKiezV302Native({ ...payload, classes: {} })).toBe(false);
  expect(isWestKiezV302OldNativeColumn(owners.nativeColumns[0].slice(0, 4))).toBe(false);
});

test("granular navigation matches complete measured low/top levels and source roofs", () => {
  const solids = westKiezV302Solids();
  expect(solids).toHaveLength(89);
  for (const [i, solid] of solids.entries()) {
    const sourcePart = navigation.parts[i];
    expect(solid.ring).toBe(sourcePart.ring); expect(solid.holes).toBe(sourcePart.holes);
    expect(solid.minY).toBe(sourcePart.low); expect(solid.maxY).toBe(sourcePart.high);
    for (const [a, b, c] of sourcePart.roofTriangles) {
      const x = (a[0] + b[0] + c[0]) / 3, z = (a[2] + b[2] + c[2]) / 3;
      const roof = solid.topAt(x, z);
      if (Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])) > 1e-8) {
        expect(roof).not.toBeNull(); expect(roof!).toBeGreaterThanOrEqual((a[1] + b[1] + c[1]) / 3 - 1e-6);
      }
    }
    expect(solid.topAt(0, 0)).toBeNull();
  }
  const root = createWestKiezV302Core();
  const bounds = new Box3().setFromObject(root);
  expect(bounds.max.y).toBeGreaterThan(30);
  dispose(root);
});

test("native navigation stands on the actual precompiled cap surfaces instead of lower measured roof slopes",()=>{
  const native=westKiezV302Solids(true),drawn=westKiezV302Solids(false);
  expect(native).toHaveLength(89);
  for(const [i,part]of nativeNavigation.parts.entries()){
    const solid=native[i];expect(solid.sourceId).toBe(part.id);expect(solid.ring).toBe(drawn[i].ring);expect(solid.holes).toBe(drawn[i].holes);
    expect(solid.minY).toBe(part.low);expect(solid.maxY).toBe(part.high);
    for(const [x0,z0,x1,z1,top]of part.caps){
      const actual=solid.topAt(part.origin[0]+(x0+x1)/2/nativeNavigation.scale,part.origin[1]+(z0+z1)/2/nativeNavigation.scale);
      expect(actual).not.toBeNull();expect(actual!).toBeGreaterThanOrEqual(top/nativeNavigation.scale-1e-7);
      expect(actual!).toBeLessThanOrEqual(solid.maxY+1e-7);
    }
    expect(solid.topAt(0,0)).toBeNull();
  }
});
