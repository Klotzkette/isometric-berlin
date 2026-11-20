import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Group, InstancedMesh, OrthographicCamera, Raycaster, Vector3 } from "three";
import { attachRailSteelV369 } from "../src/RailSteelPacketV369";
import { STEEL_RAIL_MESH_V369 } from "../src/SteelRailBridgesV369";
import { createSurroundingCity } from "../src/SurroundingCity";
import { createSurroundingCityChunkCooperatively, type SurroundingCityChunk, type SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";
import exterior from "../src/data/steelRailExteriorV369.json";
import hosts from "../src/data/steelRailHostIdsV369.json";

const directory = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", directory), "utf8"));
function newHost(): SurroundingChunkGeometry {
  return {
    root: new Group(), origin: [19, 1, -37], geometryBytes: 0, bufferCount: 0,
    nav: { groundY: 0, ground: [], water: [], buildings: [] },
  };
}
async function settle(test: () => boolean) {
  const timeout = performance.now() + 8000;
  while (!test() && performance.now() < timeout) await Bun.sleep(10);
  expect(test()).toBe(true);
}
test("lossless repacking retains fitted bridge members, altered coordinates and cancelled hosts do not", async () => {
  const id = hosts[0];
  const asset = manifest.chunks.find((x: {id: string}) => x.id === id).drawn;
  const raw = readFileSync(new URL(asset.url, directory));
  const packet: SurroundingCityChunk = JSON.parse(gunzipSync(raw).toString());
  const signal = new AbortController().signal;
  const entry = newHost();
  await attachRailSteelV369(entry, id, false, signal, true, false, packet, "different-encoding");
  expect(entry.root.getObjectByName(STEEL_RAIL_MESH_V369)).toBeInstanceOf(InstancedMesh);
  expect(entry.root.children[0].position.toArray()).toEqual([-19, -1, 37]);
  expect(entry.geometryBytes).toBeGreaterThan(0);
  expect(entry.bufferCount).toBeGreaterThan(0);
  const changed = newHost();
  const altered = {...packet, meshes: packet.meshes.map((mesh, i) => i ? mesh : {...mesh, positions: "AA=="})};
  await attachRailSteelV369(changed, id, false, signal, true, false, altered, "different-encoding");
  expect(changed.root.children).toHaveLength(0);
  const abandoned = newHost();
  await expect(attachRailSteelV369(abandoned, id, false, AbortSignal.abort(), true, false, packet, asset.sha256))
    .rejects.toThrow();
  expect(abandoned.geometryBytes).toBe(0);
});
test("a freestanding deck streams, changes family and releases its instanced buffers without a terrain request", async () => {
  const {bounds: [x0, z0, x1, z1]} = exterior[0];
  const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
  const camera = new OrthographicCamera(-32, 32, 32, -32, 1, 160);
  camera.position.set(x, 60, z);
  camera.up.set(0, 0, -1);
  camera.lookAt(x, 0, z);
  const requests: string[] = [];
  const city = createSurroundingCity({ camera, mode: "day", steelRailBridgesV369: true,
    manifestUrl: new URL("https://steel.test/manifest.json"),
    fetch: (async input => {
      requests.push(String(input));
      return new Response(JSON.stringify({...manifest, chunks: []}));
    }) as typeof fetch,
  });
  try {
    await city.ready;
    const find = () => city.root.getObjectByName(STEEL_RAIL_MESH_V369);
    await settle(() => !!find() && !city.pending);
    expect(city.residentChunkCount).toBeGreaterThan(0);
    expect(city.navigationTiles).toHaveLength(0);
    const original = find()!;
    let disposed = false;
    (original as InstancedMesh).addEventListener("dispose", () => { disposed = true; });
    city.setMode("minecraft");
    await settle(() => !!find() && find() !== original && !city.pending);
    expect(disposed).toBe(true);
    expect(requests).toEqual(["https://steel.test/manifest.json"]);
    expect(city.navigationTiles).toHaveLength(0);
  } finally {
    city.dispose();
  }
}, 20000);

test("the mapped lower streets continue beneath the lifted decks in the city and block models", async () => {
  for (const [id, x, z] of [
    ["ring182--3_8", -1331.20, 4332.80], ["-8_2", -3948.99, 1418.90],
  ] as const) {
    const descriptor = manifest.chunks.find((c: {id: string}) => c.id === id);
    for (const family of ["drawn", "minecraft"] as const) {
      const asset = descriptor[family];
      const raw = gunzipSync(readFileSync(new URL(asset.url, directory)));
      const packet: SurroundingCityChunk = JSON.parse(raw.toString());
      const native = family === "minecraft";
      const entry = await createSurroundingCityChunkCooperatively(packet, id, native);
      const ray = new Raycaster(new Vector3(x, 5, z), new Vector3(0, -1, 0));
      const street = () => {
        entry.root.updateMatrixWorld(true);
        return ray.intersectObject(entry.root, true)[0];
      };
      expect(street().point.y).toBeCloseTo(3.15, 2);
      await attachRailSteelV369(entry, id, native, new AbortController().signal, true, false, packet, asset.sha256);
      expect(street().point.y).toBeCloseTo(3.09, 2);
      expect(street().object.name).toBe("Street surfaces beneath elevated rail v369");
    }
  }
});
