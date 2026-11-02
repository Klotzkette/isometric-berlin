import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { BufferGeometry, InstancedMesh, type Group, type Mesh, type Object3D } from "three";
import data from "../src/data/tierparkV255.json";
import playgrounds from "../src/data/playgroundsV255.json";
import { prepareTierparkV255, tierparkGroundGuardV255, type TierparkSourceV255 } from "../src/TierparkV255";
import { prepareTierparkV276 } from "../src/TierparkV276";
import { houseCurbGroundGuardV233 } from "../src/houseCurbsV233";
import { createSurroundingCityChunkCooperatively, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { createStreamedSurroundingCityChunkV255, disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { transferTierparkAnimalsV282 } from "../src/tierparkAnimalTransferV282";
import type { ZooAnimalHandleV282 } from "../src/ZooAnimalsV282";
import { createTierparkHouseV282 } from "../src/ZooHousesV282";
import { hasBrehmTropicalHallParentV282 } from "../src/brehmTropicalHallV282Profile";
import tropicalHall from "../src/data/brehmTropicalHallV282.json";

const source = data as TierparkSourceV255;
const dir = path.resolve(import.meta.dir, "../public/mesh/surrounding-berlin-v159");
function fixture(key: string): SurroundingCityChunk {
  const [family, id] = key.split(":");
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${id}.${family}.json.gz`))).toString());
}
function digest(root: Object3D): string {
  const hash = new Bun.CryptoHasher("sha256");
  root.traverse(object => {
    const mesh = object as Mesh;
    hash.update(JSON.stringify([object.name, object.position.toArray(), object.scale.toArray()]));
    if (!mesh.geometry) return;
    for (const [name, attr] of Object.entries(mesh.geometry.attributes)) {
      const values = "data" in attr ? attr.data.array : attr.array;
      hash.update(name);
      hash.update(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
    }
    const index = mesh.geometry.index?.array;
    if (index) hash.update(new Uint8Array(index.buffer, index.byteOffset, index.byteLength));
    if (mesh instanceof InstancedMesh) for (const attribute of [mesh.instanceMatrix, mesh.instanceColor]) {
      const values = attribute?.array;
      if (values) hash.update(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
    }
  });
  return hash.digest("hex");
}
function measured(root: Group): { bytes: number; buffers: number } {
  const arrays = new Set<ArrayBufferView>();
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.geometry) return;
    for (const attribute of Object.values(mesh.geometry.attributes)) arrays.add("data" in attribute ? attribute.data.array : attribute.array);
    if (mesh.geometry.index) arrays.add(mesh.geometry.index.array);
    if (mesh instanceof InstancedMesh) {
      arrays.add(mesh.instanceMatrix.array);
      if (mesh.instanceColor) arrays.add(mesh.instanceColor.array);
    }
  });
  return { bytes: [...arrays].reduce((n, array) => n + array.byteLength, 0), buffers: arrays.size };
}

test("streamed Tierpark additions exactly match explicit preparation for all ten existing packets", async () => {
  for (const key of source.ids) {
    const [family, id] = key.split(":"), native = family === "minecraft";
    const raw = fixture(key), unchanged = JSON.stringify(raw);
    const steps = prepareTierparkV255(raw, id, native);
    let next = steps.next(); while (!next.done) next = steps.next();
    const v255 = next.value;
    // V255's original source and addition remain a complete prefix when the
    // separately guarded v276 companion is present on these existing tiles.
    expect(v255.meshes.slice(0, raw.meshes.length)).toEqual(raw.meshes);
    expect(v255.meshes.at(-1)).toBe(source.packets[key].mesh);
    const v276Steps = prepareTierparkV276(v255, id, native);
    let v276 = v276Steps.next(); while (!v276.done) v276 = v276Steps.next();
    expect(v276.value.meshes.slice(0, v255.meshes.length)).toEqual(v255.meshes);
    const transferred = transferTierparkAnimalsV282(v276.value, id, native);
    const explicit = await createSurroundingCityChunkCooperatively(transferred.chunk, id, native);
    const streamed = await createStreamedSurroundingCityChunkV255(raw, id, native);
    const figures = streamed.root.children.filter(child => child.userData.zooAnimalsV282);
    const houses = streamed.root.children.filter(child => child.userData.zooHousesV282) as Group[];
    // Production has passed the retained complete parent witness since v282.
    // Omitting it replays only the older fittings without the measured upper
    // tropical hall, rather than the actual unchanged v192 stream behaviour.
    const explicitHouse = createTierparkHouseV282(id, native, transferred.chunk);
    try {
      expect(streamed.root.userData.sourceKinds).toContain("tierpark-v255");
      const handles = figures.map(child => child.userData.zooAnimalsV282 as ZooAnimalHandleV282);
      expect(houses).toHaveLength(explicitHouse ? 1 : 0);
      if (explicitHouse) {
        const fallback=createTierparkHouseV282(id,native)!;
        try{
          for(const old of fallback.children){
            const retained=explicitHouse.children.find(child=>child.name===old.name)!;
            expect(retained).toBeDefined();expect(digest(retained)).toBe(digest(old));
          }
          const admitted=hasBrehmTropicalHallParentV282(transferred.chunk,id);
          expect(explicitHouse.children.length).toBe(fallback.children.length+(admitted?1:0));
          expect(typeof explicitHouse.userData.brehmTropicalHallSolidAt).toBe(admitted?"function":"undefined");
        }finally{disposeSurroundingCityRoot(fallback);}
        explicitHouse.position.set(-raw.origin[0], -raw.origin[1], -raw.origin[2]);
        explicitHouse.updateMatrix();
        expect(digest(houses[0])).toBe(digest(explicitHouse));
        expect(houses[0].userData.preservedBrehmEnvelope).toBe(true);
        streamed.root.updateMatrixWorld(true);
        expect(houses[0].matrixWorld.elements).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      }
      const houseMemory = explicitHouse ? measured(explicitHouse) : { bytes: 0, buffers: 0 };
      expect(streamed.geometryBytes).toBe(explicit.geometryBytes + handles.reduce((n, handle) => n + handle.geometryBytes, 0) + houseMemory.bytes);
      expect(streamed.bufferCount).toBe(explicit.bufferCount + handles.reduce((n, handle) => n + handle.bufferCount, 0) + houseMemory.buffers);
      expect(measured(streamed.root)).toEqual({ bytes: streamed.geometryBytes, buffers: streamed.bufferCount });
      expect(streamed.nav).toEqual(explicit.nav);
      // The separate v282 owner is allowed to move. All retained architecture,
      // paths and static surface bytes still match the full explicit decoder.
      if (figures.length) streamed.root.remove(...figures);
      if (houses.length) streamed.root.remove(...houses);
      expect(digest(streamed.root)).toBe(digest(explicit.root));
      expect(JSON.stringify(raw)).toBe(unchanged);
    } finally {
      if (figures.length) streamed.root.add(...figures);
      if (houses.length) streamed.root.add(...houses);
      if (explicitHouse) disposeSurroundingCityRoot(explicitHouse);
      disposeSurroundingCityRoot(explicit.root);
      disposeSurroundingCityRoot(streamed.root);
    }
  }
}, 60_000);

test("the local Tierpark receipt hash equals the existing shared guard exactly", () => {
  for (const key of source.ids) {
    const ground = fixture(key).nav.ground;
    expect(tierparkGroundGuardV255(ground)).toBe(houseCurbGroundGuardV233(ground));
    expect(tierparkGroundGuardV255(ground)).toBe(source.packets[key].guard);
  }
  for (const ground of [[], [{
    ring: [[-1.0005, -0.0005], [0.0005, 1.9995], [3.1415926535, -2.718281828], [-1.0005, -0.0005]],
    holes: [[[0, 0], [.0005, -.0005], [-.0005, .0005], [0, 0]]],
  }]]) expect(tierparkGroundGuardV255(ground)).toBe(houseCurbGroundGuardV233(ground));
});

test("Brehm house replay admits only its complete current parent and retains every old fitting for changed witnesses",()=>{
  for(const native of[false,true]){
    const id=tropicalHall.packetId,raw=fixture(`${native?"minecraft":"drawn"}:${id}`),snapshot=JSON.stringify(raw),fallback=createTierparkHouseV282(id,native)!;
    const expected=fallback.children.map(digest);
    try{
      expect(hasBrehmTropicalHallParentV282(raw,id)).toBe(true);
      for(const change of["missing","changed","duplicate","origin"]as const){
        const altered=structuredClone(raw),at=altered.nav.buildings.findIndex(p=>(p as typeof p&{partId?:string}).partId===tropicalHall.parentId);
        expect(at).toBeGreaterThanOrEqual(0);
        if(change==="missing")altered.nav.buildings.splice(at,1);
        if(change==="changed")altered.nav.buildings[at].height++;
        if(change==="duplicate")altered.nav.buildings.push(altered.nav.buildings[at]);
        if(change==="origin")altered.origin[0]++;
        const closed=createTierparkHouseV282(id,native,altered)!;
        try{
          expect(hasBrehmTropicalHallParentV282(altered,id)).toBe(false);
          expect(closed.children.map(digest)).toEqual(expected);
          expect(closed.userData.brehmTropicalHallSolidAt).toBeUndefined();
        }finally{disposeSurroundingCityRoot(closed);}
      }
      expect(JSON.stringify(raw)).toBe(snapshot);
    }finally{disposeSurroundingCityRoot(fallback);}
  }
});

test("streamed playground metadata is attached without changing its actual geometry or navigation", async () => {
  const id = Object.keys(playgrounds.packetSites)[0], raw = fixture(`drawn:${id}`);
  const base = await createSurroundingCityChunkCooperatively(raw, id);
  const streamed = await createStreamedSurroundingCityChunkV255(raw, id);
  try {
    expect(streamed.root.userData.playgroundV255.fullStaticDetailOnTouch).toBe(true);
    expect(base.root.userData.playgroundV255).toBeUndefined();
    expect(digest(streamed.root)).toBe(digest(base.root));
    expect(streamed.nav).toEqual(base.nav);
  } finally { disposeSurroundingCityRoot(base.root); disposeSurroundingCityRoot(streamed.root); }
});

test("abort during Tierpark preparation leaves the source untouched and publishes no root", async () => {
  const key = source.ids[0], [family, id] = key.split(":"), raw = fixture(key);
  const unchanged = JSON.stringify(raw), controller = new AbortController();
  let yields = 0;
  await expect(createStreamedSurroundingCityChunkV255(raw, id, family === "minecraft", {
    signal: controller.signal, yield: async () => { yields++; controller.abort(); },
  })).rejects.toMatchObject({ name: "AbortError" });
  expect(yields).toBe(1);
  expect(JSON.stringify(raw)).toBe(unchanged);
});

test("abort after decoder allocation disposes the unpublished geometry", async () => {
  const key = source.ids[0], [family, id] = key.split(":"), raw = fixture(key);
  const controller = new AbortController();
  const setAttribute = BufferGeometry.prototype.setAttribute, dispose = BufferGeometry.prototype.dispose;
  const allocated = new Set<BufferGeometry>(), disposed = new Set<BufferGeometry>();
  BufferGeometry.prototype.setAttribute = function (...args) {
    allocated.add(this); return setAttribute.apply(this, args);
  };
  BufferGeometry.prototype.dispose = function () { disposed.add(this); dispose.call(this); };
  try {
    await expect(createStreamedSurroundingCityChunkV255(raw, id, family === "minecraft", {
      signal: controller.signal, budgetMs: 0,
      yield: async () => { if (allocated.size) controller.abort(); },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(allocated.size).toBeGreaterThan(0);
    expect([...allocated].every(geometry => disposed.has(geometry))).toBe(true);
  } finally {
    BufferGeometry.prototype.setAttribute = setAttribute;
    BufferGeometry.prototype.dispose = dispose;
  }
});
