import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { BufferAttribute, Group, InstancedMesh, Material, Mesh } from "three";
import { build } from "vite";
import { losslessJsonData, READONLY_CONSTRUCTION_JSON_FIELDS } from "../losslessJsonData";

const fields: Record<string, string[]> = {
  "westLandmarksV187.json": ["groups"],
  "eastLandmarksV187.json": ["cells"],
  "eastLandmarksV187Native.json": ["cells"],
  "southWestLandmarksV187.json": ["sites"],
  "southWestLandmarksV187Native.json": ["sites"],
  "northSitesV190.json": ["cells"],
  "northSitesV190Native.json": ["cells"],
  "airportsV194.json": ["surfaces", "boxes"],
  "teufelsbergStationV195.json": ["surfaces", "lines"],
  "westLakesV194.json": ["sites"],
  "lindenCorridorV197.json": ["surfaces", "boxes", "blocks"],
  "tegelSpandauV198.json": ["sites"],
  "tegelSpandauV198Native.json": ["sites"],
  "northParksV198Drawn0.json": ["cells"],
  "northParksV198Drawn1.json": ["cells"],
  "northParksV198Native0.json": ["cells"],
  "northParksV198Native1.json": ["cells"],
  "eastParksV198.json": ["grounds", "trees", "paths", "facades", "buildings"],
  "iccV199.json": ["sites"],
  "iccV199Native.json": ["sites"],
  "funkturmV199.json": ["groups"],
  "funkturmV199Native.json": ["groups"],
  "cemeteryGrunewaldV199Drawn.json": ["positions", "colors", "boxes"],
  "cemeteryGrunewaldV199Native.json": ["boxes"],
};
const excluded: Record<string, string[]> = {
  "airportsV194.json": ["blocks", "navigation"],
  "teufelsbergStationV195.json": ["boxes", "blocks", "navigation"],
  "westLakesV194Native.json": ["sites"],
};

/** Deterministic cache collection tests ownership, not any browser's GC timing. */
class CollectableReference {
  static entries: CollectableReference[] = [];
  private value: object | undefined;
  constructor(value: object) { this.value = value; CollectableReference.entries.push(this); }
  deref(): object | undefined { return this.value; }
  static collect(): void { for (const entry of this.entries) entry.value = undefined; this.entries.length = 0; }
}
type Fixture = { factories: Array<(native: boolean) => Group>; sources: Record<string, Record<string, unknown>> };

async function compile(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "isometric-outer-cache-v196-"));
  const app = resolve(import.meta.dir, "../src");
  const files = [...new Set([...Object.keys(fields), ...Object.keys(excluded)])];
  const imports = files.map((file, index) => `import data${index} from ${JSON.stringify(join(app, "data", file))};`);
  const factories = [
    ["WesternLandmarksV187", "createWesternLandmarksV187", "createMinecraftWesternLandmarksV187"],
    ["EastLandmarksV187", "createEastLandmarksV187"],
    ["MinecraftEastLandmarksV187", "createMinecraftEastLandmarksV187"],
    ["SouthWestLandmarksV187", "createSouthWestLandmarksV187"],
    ["NorthSitesV190", "createNorthSitesV190"],
    ["MinecraftNorthSitesV190", "createMinecraftNorthSitesV190"],
    ["AirportsV194", "createAirportsV194"],
    ["TeufelsbergStationV195", "createTeufelsbergStationV195"],
    ["WestLakesV194", "createWestLakesV194"],
    ["LindenCorridorV197", "createLindenCorridorV197"],
    ["TegelSpandauV198", "createTegelSpandauV198"],
    ["NorthParksV198", "createNorthParksV198"],
    ["EastParksV198", "createEastParksV198"],
    ["IccV199", "createIccV199"],
    ["FunkturmV199", "createFunkturmV199"],
    ["CemeteryGrunewaldV199", "createCemeteryGrunewaldV199"],
  ];
  for (const [file, ...names] of factories) imports.push(`import { ${names.join(",")} } from ${JSON.stringify(join(app, file + ".ts"))};`);
  const entry = join(directory, "entry.js");
  await writeFile(entry, `${imports.join("\n")}
window.fixture = { sources: {${files.map((file, index) => `${JSON.stringify(file)}:data${index}`).join(",")}}, factories: [
  native => native ? createMinecraftWesternLandmarksV187() : createWesternLandmarksV187(),
  native => native ? createMinecraftEastLandmarksV187() : createEastLandmarksV187(),
  createSouthWestLandmarksV187,
  native => native ? createMinecraftNorthSitesV190() : createNorthSitesV190(),
  createAirportsV194, createTeufelsbergStationV195, createWestLakesV194, createLindenCorridorV197, createTegelSpandauV198, createNorthParksV198, createEastParksV198, createIccV199, createFunkturmV199, createCemeteryGrunewaldV199
] };`);
  try {
    const result = await build({ configFile: false, root: directory, publicDir: false, logLevel: "silent",
      plugins: [losslessJsonData()], build: { write: false, minify: true, rolldownOptions: { input: entry } } });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one bundle");
    const chunk = result.output.find(item => item.type === "chunk" && item.isEntry);
    if (!chunk || chunk.type !== "chunk") throw new Error("Missing factory bundle");
    return chunk.code;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
function execute(code: string, weak: boolean): Fixture {
  const window: { fixture?: Fixture } = {};
  new Function("window", "WeakRef", code)(window, weak ? CollectableReference : undefined);
  return window.fixture!;
}
function hashValue(value: unknown): string { return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex"); }

/** Every final render buffer plus appearance/placement/culling, without random UUIDs. */
function renderDigest(root: Group): string {
  const hash = new Bun.CryptoHasher("sha256");
  const geometries = new Set<Mesh["geometry"]>(), materials = new Set<Material>();
  function attribute(value?: BufferAttribute): void {
    if (!value) { hash.update("none"); return; }
    hash.update(JSON.stringify([value.itemSize, value.normalized, value.count, value.array.constructor.name]));
    hash.update(new Uint8Array(value.array.buffer, value.array.byteOffset, value.array.byteLength));
  }
  root.updateMatrixWorld(true);
  root.traverse(object => {
    hash.update(JSON.stringify([object.type, object.name, object.visible, object.renderOrder, object.frustumCulled,
      object.matrix.elements, object.matrixWorld.elements]));
    const mesh = object as Mesh;
    if (!mesh.geometry) return;
    geometries.add(mesh.geometry);
    for (const [name, value] of Object.entries(mesh.geometry.attributes).sort(([a], [b]) => a.localeCompare(b))) {
      hash.update(name); attribute(value as BufferAttribute);
    }
    attribute(mesh.geometry.index ?? undefined);
    hash.update(JSON.stringify([mesh.geometry.groups, mesh.geometry.drawRange, mesh.geometry.boundingBox, mesh.geometry.boundingSphere]));
    const instance = mesh as InstancedMesh;
    if (instance.isInstancedMesh) {
      attribute(instance.instanceMatrix); attribute(instance.instanceColor ?? undefined);
      hash.update(JSON.stringify([instance.count, instance.boundingBox, instance.boundingSphere]));
    }
    for (const material of [mesh.material, mesh.userData.dayMaterial, mesh.userData.nightMaterial].flat().filter(Boolean) as Material[]) {
      materials.add(material);
      const json = material.toJSON();
      delete (json as { uuid?: string }).uuid;
      hash.update(JSON.stringify(json));
    }
  });
  const result = hash.digest("hex");
  root.traverse(object => { const mesh = object as InstancedMesh; if (mesh.isInstancedMesh) mesh.dispose(); });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  root.clear();
  return result;
}

describe("v196–v199 outer construction source ownership", () => {
  test("only audited geometry inputs are weak; real factories preserve all render values across collection", async () => {
    for (const [file, names] of Object.entries(fields)) expect(READONLY_CONSTRUCTION_JSON_FIELDS[file]).toEqual(names);
    for (const [file, names] of Object.entries(excluded)) for (const name of names)
      expect(READONLY_CONSTRUCTION_JSON_FIELDS[file] ?? []).not.toContain(name);
    const code = await compile();
    const strong = execute(code, false), weak = execute(code, true);
    for (const [file, names] of Object.entries(fields)) for (const name of names) {
      const source = weak.sources[file], original = source[name], checksum = hashValue(original);
      CollectableReference.collect();
      if (JSON.stringify(original).length >= 64 * 1024) expect(source[name]).not.toBe(original);
      else expect(source[name]).toBe(original); // small inline fields retain identity
      expect(hashValue(source[name])).toBe(checksum);
    }
    for (const [file, names] of Object.entries(excluded)) for (const name of names) {
      const source = weak.sources[file], original = source[name];
      CollectableReference.collect();
      expect(source[name]).toBe(original);
    }
    const expected = [false, true].map(native => strong.factories.map(factory => renderDigest(factory(native))));
    for (const native of [false, true, false]) {
      CollectableReference.collect();
      expect(weak.factories.map(factory => renderDigest(factory(native)))).toEqual(expected[native ? 1 : 0]);
    }
    CollectableReference.collect();
  }, 90_000);
});
