import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { InstancedMesh, Matrix4, Mesh } from "three";
import { createArenaStationEnvelopesV225, createArenaStationV225 } from "../src/ArenaStationV225";
import { arenaStationV225GroundAt, arenaStationV225RoofAt, arenaStationV225SolidAt, transferArenaStationNavigationV225 } from "../src/arenaStationV225Navigation";
import { createPedestrianState, pedestrianSpawnFromView, stepPedestrian, type PedestrianEnvironment } from "../src/pedestrianNavigation";
import { stationPointV225, stationStructureV225, transferredWarschauerRoofAccentV225 } from "../src/arenaStationV225Structure";
import { transferExactPacketTriangles, transferExactPacketLines } from "../src/exactPacketTransfer";
import receipt from "../src/data/arenaStationV225Ownership.json";
import envelope from "../src/data/arenaStationV225Envelopes.json";
import rail from "../src/data/railStationsV190.json";
import { READONLY_CONSTRUCTION_JSON_FIELDS } from "../losslessJsonData";

function finish<T>(iterator: Generator<void, T>): T {
  let result = iterator.next(); while (!result.done) result = iterator.next(); return result.value;
}
test("new bodies contain every source triangle, own bounded storage and independent native geometry", () => {
  for (const native of [false, true]) {
    const roots = [createArenaStationEnvelopesV225(native), createArenaStationV225(native)];
    let bytes = 0, renderables = 0;
    for (const root of roots) {
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.userData.textureFree).toBe(true);
      root.traverse(o => {
        if (!(o instanceof Mesh)) return;
        renderables++;
        expect(o.matrixAutoUpdate).toBe(false);
        expect(o.geometry.getAttribute("uv")).toBeUndefined();
        expect(o.userData.dayMaterial.map).toBeNull();
        expect(o.userData.nightMaterial.map).toBeNull();
        for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
        bytes += o.geometry.index?.array.byteLength ?? 0;
        if (o instanceof InstancedMesh) {
          bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
          if (native) {
            const m = new Matrix4();
            for (let i = 0; i < o.count; i++) {
              o.getMatrixAt(i, m); for (const k of [1, 2, 4, 6, 8, 9]) expect(m.elements[k]).toBe(0);
            }
          }
        }
      });
    }
    expect(bytes).toBeLessThan(native ? 650_000 : 330_000);
    expect(renderables).toBe(native ? 3 : 6);
    const a = roots[0].children[0].children[0] as Mesh;
    const b = createArenaStationEnvelopesV225(native).children[0].children[0] as Mesh;
    expect(a.geometry).not.toBe(b.geometry);
    if (!native) {
      const positions = a.geometry.getAttribute("position");
      const expected = new Float32Array(envelope.surfaces.flatMap(s => s.triangles.flat(2)));
      expect(positions.array).toEqual(expected);
    }
  }
});

test("station track channels remain open, all 28 columns and real support slabs collide", () => {
  expect(stationStructureV225().filter(r => r[4] === 6)).toHaveLength(28);
  for (const native of [false, true]) {
    for (const u of [-24, -12, 0, 12, 24]) for (const v of [-4, 0, 4]) {
      const [x, z] = stationPointV225(u, v);
      expect(arenaStationV225SolidAt(x, 6, z, .25, native)).toBe(false);
      expect(arenaStationV225SolidAt(x, 10.5, z, 0, native)).toBe(true);
      expect(arenaStationV225SolidAt(x, 14, z, 0, native)).toBe(false);
      expect(arenaStationV225SolidAt(x, 19.7, z, 0, native)).toBe(true);
    }
    for (const [x, y, z] of stationStructureV225().slice(0, 28)) expect(arenaStationV225SolidAt(x, y, z, 0, native)).toBe(true);
    const [x, z] = stationPointV225(-28.1, 0);
    expect(arenaStationV225SolidAt(x, 13, z, .25, native)).toBe(false);
    expect(arenaStationV225SolidAt(0, 6, 0, 1, native)).toBe(false);
  }
});

test("production walking lands on the roof or concourse without lifting track-level visitors", () => {
  const idle = { forward: 0, strafe: 0, turn: 0, look: 0, sprint: false };
  for (const native of [false, true]) {
    const environment: PedestrianEnvironment = {
      bounds: { minX: 4700, maxX: 5500, minZ: 1300, maxZ: 1800 },
      groundAt: () => 3, water: [],
      interiorGroundAt: (x, z, y) => arenaStationV225GroundAt(x, z, y ?? 3, native),
      interiorSolidAt: (x, y, z, r) => arenaStationV225SolidAt(x, y, z, r, native),
    };
    const [x, z] = stationPointV225(0, 0);
    expect(arenaStationV225GroundAt(x, z, 3, native)).toBeNull();
    expect(arenaStationV225GroundAt(x, z, 6, native)).toBeNull();
    expect(arenaStationV225GroundAt(x, z, 11.96, native)).toBe(11.96);
    expect(arenaStationV225GroundAt(x, z, 50, native)).toBe(19.96);
    for (const [cameraY, expected] of [[48, 19.96], [16, 11.96], [7, 3]]) {
      const camera = { x, y: cameraY, z };
      const spawn = pedestrianSpawnFromView(environment, { x, y: 0, z }, camera, { x: 0, y: -.3, z: -1 })!;
      let state = createPedestrianState(environment, spawn);
      for (let i = 0; i < 900 && !state.grounded; i++) state = stepPedestrian(state, idle, 1 / 60, environment).state;
      expect(state.grounded).toBe(true); expect(state.groundY).toBeCloseTo(expected, 6);
      const start = { x: state.x, z: state.z };
      for (let i = 0; i < 10; i++) state = stepPedestrian(state, { ...idle, strafe: 1 }, 1 / 60, environment).state;
      expect(Math.hypot(state.x - start.x, state.z - start.z)).toBeGreaterThan(.5);
      expect(state.groundY).toBeCloseTo(expected, 6);
    }
    const arenaRoof = arenaStationV225RoofAt(4868, 1515, native)!;
    expect(arenaStationV225GroundAt(4868, 1515, 60, native)).toBe(arenaRoof);
    expect(arenaStationV225GroundAt(4868, 1515, 3, native)).toBeNull();
  }
});

test("actual immutable packets lose exactly their audited indices and fully equal navigation rows", () => {
  const keys = new Set(receipt.records.map(r => `${r.tile}:${r.mode}`));
  for (const key of keys) {
    const [tile, mode] = key.split(":"), native = mode === "minecraft";
    const bytes = readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${tile}.${mode}.json.gz`, import.meta.url));
    const payload = JSON.parse(gunzipSync(bytes).toString());
    const rows = receipt.records.filter(r => r.tile === tile && r.mode === mode);
    for (const r of rows) expect(createHash("sha256").update(bytes).digest("hex")).toBe(r.sha256);
    for (const part of payload.meshes) {
      if (part.kind !== "city") continue;
      const encoded = structuredClone(part), indices = new Uint32Array(Uint8Array.from(Buffer.from(part.indices, "base64")).buffer);
      const original = indices.slice(), selected = new Set(rows.flatMap(r => r.triangles));
      expect(finish(transferExactPacketTriangles(receipt.records, tile, native, part, indices, 0))).toBe(selected.size);
      for (let i = 0; i < indices.length; i += 3) {
        expect(Array.from(indices.slice(i, i + 3))).toEqual(selected.has(i / 3) ? [original[i], original[i], original[i]] : Array.from(original.slice(i, i + 3)));
      }
      expect(part).toEqual(encoded);
      const changed = { ...part, colors: part.colors.slice(0, -4) + "AAAA" }, protectedIndices = original.slice();
      expect(finish(transferExactPacketTriangles(receipt.records, tile, native, changed, protectedIndices, 0))).toBe(0);
      expect(protectedIndices).toEqual(original);
    }
    if (!native) {
      const part = payload.lines, original = new Uint16Array(Uint8Array.from(Buffer.from(part.positions, "base64")).buffer), positions = original.slice();
      const selected = new Set(receipt.lineRecords.filter(r => r.tile === tile).flatMap(r => r.segments));
      expect(finish(transferExactPacketLines(receipt.lineRecords, tile, part, positions, 3))).toBe(selected.size);
      for (let i = 0; i < positions.length; i += 6) expect(Array.from(positions.slice(i, i + 6))).toEqual(selected.has(i / 6)
        ? [...original.slice(i, i + 3), ...original.slice(i, i + 3)] : [...original.slice(i, i + 6)]);
    }
    const nav = transferArenaStationNavigationV225(tile, payload.nav);
    const retired = receipt.navigationRecords.filter(r => r.tile === tile && r.mode === mode);
    expect(nav.buildings.length).toBe(payload.nav.buildings.length - retired.length);
    expect(nav.buildings).toEqual(payload.nav.buildings.filter((b: { sourceId: string }) => !retired.some(r => r.owner === b.sourceId)));
    for (const record of retired) {
      const changed = { ...record.original, height: record.original.height + .01 };
      const nav = { ...payload.nav, buildings: [changed] };
      expect(transferArenaStationNavigationV225(tile, nav)).toBe(nav);
    }
  }
});

test("only the unchanged former six-metre station roof accent transfers; platforms remain exact", () => {
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["arenaStationV225Envelopes.json"]).toEqual(["surfaces", "blocks"]);
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["arenaStationV225Navigation.json"]).toBeUndefined();
  const old = rail.roofs.find(r => r.id === "way/297153147")!;
  expect(transferredWarschauerRoofAccentV225(old)).toBe(true);
  expect(transferredWarschauerRoofAccentV225({ ...old, y: 19.96 })).toBe(false);
  const changed = structuredClone(old); changed.rings[0][0][0] += .001;
  expect(transferredWarschauerRoofAccentV225(changed)).toBe(false);
  expect(rail.platforms.filter(p => p.station === "Warschauer Straße").map(p => p.id)).toEqual(["relation/11765290", "relation/11765307"]);
});
