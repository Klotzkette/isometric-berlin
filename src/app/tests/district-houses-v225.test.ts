import { expect, test } from "bun:test";
import { Color, InterleavedBufferAttribute, Mesh } from "three";
import { districtHouseOwnerV225, districtHouseRegionV225, shadeDistrictHousePanesV225 } from "../src/districtHousePresentationV225";
import { createSurroundingCityChunk, createSurroundingCityChunkCooperatively, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { surroundingColourOwners, surroundingGenericColour } from "../src/surroundingCityColourV184";
import { createDistantBuildingShells, createIsometricCity, type PrismPayload, type PrismBuilding } from "../src/IsometricCityWorld";
import { coreHousePaintV273 } from "../src/CoreHouseColoursV273";

const rgb = (hex: number) => new Color(hex).toArray().map(value => Math.round(value * 255));
const encode = (array: Uint8Array | Uint16Array | Uint32Array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64");
function finish<T>(steps: Generator<void, T>): T { let next = steps.next(); while (!next.done) next = steps.next(); return next.value; }
const ANCHORS = [[-2358, -911], [3229, -1921], [-1178, 3578], [-3299, 3084], [-3235, 6831]];

function pane(native = false, kind = "district-facades-v188", origin = ANCHORS[0]): SurroundingCityChunk {
  const width = native ? 115 : 132, height = native ? 140 : 180;
  const colors = native ? [...rgb(0x5d777c), ...rgb(0x5d777c), ...rgb(0x5d777c), ...rgb(0x5d777c)] :
    [...rgb(0x7a9497), ...rgb(0x7a9497), ...rgb(0x4e6972), ...rgb(0x4e6972)];
  return { schemaVersion: 1, origin: [origin[0], 0, origin[1]],
    meshes: [{ kind, positionType: "u16cm", positions: encode(new Uint16Array([0, 100, 0, width, 100, 0, width, 100 + height, 0, 0, 100 + height, 0])),
      colors: encode(new Uint8Array(colors)), indices: encode(new Uint32Array([0, 1, 2, 0, 2, 3])) }],
    nav: { groundY: 0, ground: [], water: [], buildings: [] } };
}
const data = (root: ReturnType<typeof createSurroundingCityChunk>["root"]) =>
  ((root.children[0] as Mesh).geometry.getAttribute("color") as InterleavedBufferAttribute).data.array;

test("exact four district selectors and finite school margin exclude unrelated areas and dedicated school owners", () => {
  ANCHORS.forEach(([x, z], index) => expect(districtHouseRegionV225(x, z)).toBe(index));
  for (const [x, z] of [[1200, 600], [-500, -4000], [6000, 2500], [-5800, -500], [-3630, 7500]]) expect(districtHouseRegionV225(x, z)).toBe(-1);
  const ring = [[0, 0], [10, 0], [10, 10], [0, 10]];
  expect(districtHouseOwnerV225("DEBE06YYB0000AUq", ring, -3630, 6931)).toBeFalse();
  expect(districtHouseOwnerV225("way/35607218", ring, -3630, 6931)).toBeFalse();
  expect(districtHouseOwnerV225("DEBE06ordinary", ring, -3630, 6931)).toBeTrue();
  expect(districtHouseOwnerV225("DEBE06ordinary", [[0, 0], [1000, 0], [0, 10]], -3630, 6931)).toBeFalse();
});

test("actual decoder changes only known estimated glass and keeps geometry, navigation and both independent families", () => {
  for (const native of [false, true]) for (const kind of ["district-facades-v188", "kiez-facades-v209"]) {
    const chunk = pane(native, kind), original = JSON.stringify(chunk);
    const changed = createSurroundingCityChunk(chunk, "fixture", native);
    const untouched = createSurroundingCityChunk(pane(native, kind, [1200, 600]), "outside", native);
    try {
      expect(changed.root.userData.districtHousePanesV225).toBe(1);
      expect(untouched.root.userData.districtHousePanesV225).toBeUndefined();
      expect(changed.geometryBytes).toBe(untouched.geometryBytes);
      expect(changed.geometryBytes).toBe(60);
      expect(changed.bufferCount).toBe(untouched.bufferCount);
      expect(changed.root.children.length).toBe(untouched.root.children.length);
      expect(changed.nav).toBe(chunk.nav);
      const current = data(changed.root), before = data(untouched.root);
      expect(current).not.toEqual(before);
      for (let v = 0; v < 4; v++) for (let c = 0; c < 3; c++) expect(current[v * 6 + c]).toBe(before[v * 6 + c]);
      expect((changed.root.children[0] as Mesh).geometry.index!.array).toEqual((untouched.root.children[0] as Mesh).geometry.index!.array);
      if (native) expect(Array.from(current.slice(3, 6))).toEqual(Array.from(current.slice(15, 18)));
      else expect(current[15]).toBeGreaterThan(current[3]); // Cool sky above denser lower glass.
      expect(JSON.stringify(chunk)).toBe(original);
    } finally { disposeSurroundingCityRoot(changed.root); disposeSurroundingCityRoot(untouched.root); }
  }
});

test("authored glass, partial quads, exact recipe colour changes and sills cannot qualify", () => {
  for (const mutation of ["kind", "colour", "width", "indices"]) {
    const chunk = pane();
    if (mutation === "kind") chunk.meshes[0].kind = "bespoke-model";
    if (mutation === "colour") chunk.meshes[0].colors = encode(new Uint8Array(Array(4).fill(rgb(0x7a9498)).flat()));
    if (mutation === "width") chunk.meshes[0].positions = encode(new Uint16Array([0, 100, 0, 154, 100, 0, 154, 111, 0, 0, 111, 0]));
    if (mutation === "indices") chunk.meshes[0].indices = encode(new Uint32Array([0, 1, 2]));
    const built = createSurroundingCityChunk(chunk, mutation);
    try { expect(built.root.userData.districtHousePanesV225).toBeUndefined(); }
    finally { disposeSurroundingCityRoot(built.root); }
  }
});

test("source-owned roof correction protects original paint, corners and split boundary owners", () => {
  const building = { sourceId: "DEBE06ordinary", ring: [[0, 0], [10, 0], [10, 10], [0, 10]], holes: [], height: 20, minHeight: 0 };
  const old = finish(surroundingColourOwners([building], 0, 0));
  for (const [x, z] of ANCHORS) {
    const local = finish(surroundingColourOwners([building], 0, 0, x, z));
    const roof = rgb(0x9d978c), wall = rgb(0xd3d0c3);
    const read = (owners: typeof old, color: number[]) => surroundingGenericColour(owners, 0, 0, color[0], color[1], color[2]);
    expect(read(local, roof)).not.toEqual(read(old, roof));
    expect(read(local, wall)).toEqual(read(old, wall));
    expect(read(local, rgb(0xb76f52))).toBeUndefined();
    expect(surroundingGenericColour(local, 500, 500, roof[0], roof[1], roof[2])).toBeUndefined();
  }
  const outside = { ...building, ring: building.ring.map(([x, z]) => [x + 1000, z]) };
  const first = finish(surroundingColourOwners([building, outside], 0, 0, -3630, 6931));
  const second = finish(surroundingColourOwners([outside, building], 0, 0, -3630, 6931));
  expect(first.get(0)?.palette).toEqual(old.get(0)?.palette);
  expect(second.get(0)?.palette).toEqual(old.get(0)?.palette);
});

test("cooperative presentation remains deterministic and bounded", async () => {
  const chunk = pane();
  const sync = createSurroundingCityChunk(chunk, "sync");
  let yields = 0;
  const async = await createSurroundingCityChunkCooperatively(chunk, "async", false, { budgetMs: 0, yield: async () => { yields++; } });
  try { expect(data(sync.root)).toEqual(data(async.root)); expect(yields).toBeGreaterThan(0); }
  finally { disposeSurroundingCityRoot(sync.root); disposeSurroundingCityRoot(async.root); }
  // A malformed non-recipe input is rejected without reading a source-wide array.
  expect(finish(shadeDistrictHousePanesV225("city", new Uint16Array(), new Uint16Array(), 0, 0, 0, 0, false))).toBe(0);
});

test("actual core Moabit roofs retain the fallback and exact source-guarded paint without changing topology", async () => {
  const source = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
  for (const id of ["78474603", "78474607"]) for (const detailed of [false, true]) {
    const part = source.buildings.find(building => building.id === id)!;
    const original = JSON.stringify(part);
    const outside: PrismBuilding = { ...part, ring: part.ring.map(([x, z]) => [x + 400000, z + 400000]),
      holes: part.holes?.map(ring => ring.map(([x, z]) => [x + 400000, z + 400000])) };
    // v273 intentionally changes both roof and facade for these exact source
    // parts. Moving them must reject that receipt, not carry the new facade
    // colour to unrelated coordinates. Exercise the earlier v225 roof-only
    // fallback separately with the same deliberately unreceipted sample on
    // both footprints; this changes no source or frozen historical fixture.
    const fallbackTone: [number, number, number] = [part.tone![0] + 1, part.tone![1], part.tone![2]];
    const fallbackPart = { ...part, tone: fallbackTone };
    const fallbackOutside = { ...outside, tone: fallbackTone };
    expect(coreHousePaintV273(part)).toBeDefined();
    expect(coreHousePaintV273(outside)).toBeUndefined();
    expect(coreHousePaintV273(fallbackPart)).toBeUndefined();
    expect(coreHousePaintV273(fallbackOutside)).toBeUndefined();
    const build = (building: PrismBuilding) => detailed
      ? createIsometricCity(source, null, null, null, { buildings: [building], includeContext: false })
      : createDistantBuildingShells(source, [building]);
    const local = build(part), remote = build(outside);
    const fallbackLocal = build(fallbackPart), fallbackRemote = build(fallbackOutside);
    try {
      const name = detailed ? "LoD2 prism buildings" : "LoD2 distant building shells";
      const a = (local.getObjectByName(name) as Mesh).geometry, b = (remote.getObjectByName(name) as Mesh).geometry;
      const fa = (fallbackLocal.getObjectByName(name) as Mesh).geometry, fb = (fallbackRemote.getObjectByName(name) as Mesh).geometry;
      expect(a.getAttribute("position").count).toBe(b.getAttribute("position").count);
      expect(a.index?.array).toEqual(b.index?.array);
      expect(a.index?.array).toEqual(fa.index?.array);
      expect(fa.index?.array).toEqual(fb.index?.array);
      for (const [attribute, value] of Object.entries(a.attributes)) {
        expect(value.array.byteLength).toBe(fa.getAttribute(attribute).array.byteLength);
        if (attribute !== "color") expect(value.array).toEqual(fa.getAttribute(attribute).array);
      }
      expect(a.getAttribute("color").array).not.toEqual(fa.getAttribute("color").array);
      const ac = fa.getAttribute("color"), bc = fb.getAttribute("color");
      let changed = 0, unchanged = 0;
      for (let i = 0; i < ac.count; i++) {
        if (ac.getX(i) !== bc.getX(i) || ac.getY(i) !== bc.getY(i) || ac.getZ(i) !== bc.getZ(i)) changed++;
        else unchanged++;
      }
      expect(changed).toBeGreaterThan(0); expect(unchanged).toBeGreaterThan(0);
      expect(ac.array.byteLength).toBe(bc.array.byteLength);
      expect(JSON.stringify(part)).toBe(original);
    } finally {
      for (const group of [local, remote, fallbackLocal, fallbackRemote]) group.traverse(object => {
        const mesh = object as Mesh;
        mesh.geometry?.dispose();
        for (const material of mesh.material ? Array.isArray(mesh.material) ? mesh.material : [mesh.material] : []) material.dispose();
      });
    }
  }
});
