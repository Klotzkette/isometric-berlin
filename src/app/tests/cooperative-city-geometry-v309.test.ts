import { afterAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { BufferGeometry, Group, InstancedMesh, type Material, type Object3D } from "three";
import { createIsometricCityCore, createIsometricCityCoreStepsV309, type IsometricCityBuildOptions, type PrismPayload } from "../src/IsometricCityWorld";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

const repository = resolve(import.meta.dir, "../../..");
const sourcePath = "src/app/src/IsometricCityWorld.ts";
const sha = (v: string | Uint8Array) => createHash("sha256").update(v).digest("hex");
const proof = readFileSync(new URL("./fixtures/source-history-v303.json", import.meta.url));
if (sha(proof) !== "299981a770ce72ec05d507ab60b5e88a3c3da49cc068a9f3a0f831d0526cadb0") throw Error("Changed immutable published-city proof");
const published = Bun.spawnSync(["git", "show", `9727870f79db9c6a6e9d6437668e5ac13229522f:${sourcePath}`], { cwd: repository });
if (published.exitCode !== 0 || sha(published.stdout) !== JSON.parse(proof.toString()).currentGraph[sourcePath]) throw Error("Published city differs from its immutable complete-source proof");
const original = published.stdout.toString();
const tree = ts.createSourceFile(sourcePath, original, ts.ScriptTarget.Latest, true);
const edits: { start: number; end: number; text: string }[] = [];
for (const statement of tree.statements) {
  if ((!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
  const value = statement.moduleSpecifier.text;
  const url = value.startsWith(".") ? pathToFileURL(resolve(repository, dirname(sourcePath), value)).href : import.meta.resolve(value);
  edits.push({ start: statement.moduleSpecifier.getStart(tree), end: statement.moduleSpecifier.end, text: JSON.stringify(url) });
}
let reference = original;
for (const edit of edits.sort((a, b) => b.start - a.start)) reference = reference.slice(0, edit.start) + edit.text + reference.slice(edit.end);
const folder = mkdtempSync(resolve(tmpdir(), "berlin-city-v309-"));
const controlPath = resolve(folder, "published-city.ts"); writeFileSync(controlPath, reference);
afterAll(() => rmSync(folder, { recursive: true, force: true }));
const control = await import(pathToFileURL(controlPath).href) as typeof import("../src/IsometricCityWorld");
const prisms = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8")) as PrismPayload;
const buildings = prisms.buildings.filter((_, i) => i % Math.max(1, Math.floor(prisms.buildings.length / 128)) === 0).slice(0, 128);
const finish = <T>(steps: Generator<void, T>): T => { let result = steps.next(); while (!result.done) result = steps.next(); return result.value; };
function arrayFingerprint(array: ArrayLike<number> & { buffer?: ArrayBufferLike; byteOffset?: number; byteLength?: number }) {
  if (array.buffer) return sha(new Uint8Array(array.buffer, array.byteOffset ?? 0, array.byteLength));
  return sha(JSON.stringify(Array.from(array)));
}
function materialView(material: Material): unknown {
  const result: Record<string, unknown> = { type: material.type };
  for (const [key, value] of Object.entries(material)) {
    if (["uuid", "id", "version"].includes(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value) || value === null) result[key] = value;
    else if (value?.isColor) result[key] = [value.r, value.g, value.b];
    else if (value?.isVector2) result[key] = [value.x, value.y];
  }
  return result;
}
function snapshot(root: Object3D): unknown {
  const node = root as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
  const geometry = node.geometry;
  return {
    type: node.type, name: node.name, position: node.position.toArray(), quaternion: node.quaternion.toArray(), scale: node.scale.toArray(), visible: node.visible, renderOrder: node.renderOrder, frustumCulled: node.frustumCulled,
    geometry: geometry && {
      attributes: Object.entries(geometry.attributes).map(([name, a]) => [name, a.itemSize, a.count, a.normalized, a.array.constructor.name, arrayFingerprint(a.array), "data" in a ? [a.data.stride, a.offset] : null]),
      index: geometry.index && [geometry.index.array.constructor.name, arrayFingerprint(geometry.index.array)],
      groups: geometry.groups, drawRange: geometry.drawRange, bounds: geometry.boundingBox?.toArray?.() ?? (geometry.boundingBox && [geometry.boundingBox.min.toArray(), geometry.boundingBox.max.toArray()]), sphere: geometry.boundingSphere && [geometry.boundingSphere.center.toArray(), geometry.boundingSphere.radius],
    },
    instances: node instanceof InstancedMesh ? { count: node.count, matrix: arrayFingerprint(node.instanceMatrix.array), color: node.instanceColor && arrayFingerprint(node.instanceColor.array) } : null,
    material: Array.isArray(node.material) ? node.material.map(materialView) : node.material && materialView(node.material),
    children: node.children.map(snapshot),
  };
}

for (const profile of ["full", "mobile"] as const) test(`real ${profile} cooperative core retains every published geometry byte and material`, () => {
  const options: IsometricCityBuildOptions = { buildings, includeContext: false, detailProfile: profile };
  const expected = control.createIsometricCityCore(prisms, null, null, null, options);
  const sync = createIsometricCityCore(prisms, null, null, null, options);
  let provisional: Group | undefined; const progress: { phase: string; completed: number; total: number }[] = [];
  const actual = finish(createIsometricCityCoreStepsV309(prisms, null, null, null, options, root => { provisional = root; }, work => { progress.push(work); }));
  try {
    expect(actual).toBe(provisional); expect(snapshot(sync)).toEqual(snapshot(expected)); expect(snapshot(actual)).toEqual(snapshot(expected));
    expect(progress.filter(p => p.phase === "buildings").at(-1)).toEqual({ phase: "buildings", completed: buildings.length, total: buildings.length });
    expect(progress.every(p => p.completed >= 0 && p.completed <= p.total)).toBeTrue();
  } finally { for (const root of [expected, sync, actual]) disposeSurroundingCityRoot(root); }
});

test("cancelling real partially constructed buildings frees all unpublished scratch geometries once", () => {
  const previousSet = BufferGeometry.prototype.setAttribute, previousDispose = BufferGeometry.prototype.dispose;
  const constructed = new Set<BufferGeometry>(), disposed = new Map<BufferGeometry, number>();
  BufferGeometry.prototype.setAttribute = function (...args: Parameters<BufferGeometry["setAttribute"]>) { constructed.add(this); return previousSet.apply(this, args); };
  BufferGeometry.prototype.dispose = function () { disposed.set(this, (disposed.get(this) ?? 0) + 1); return previousDispose.call(this); };
  let root: Group | undefined;
  const steps = createIsometricCityCoreStepsV309(prisms, null, null, null, { buildings, includeContext: false }, value => { root = value; });
  try {
    for (let i = 0; i < 5; i++) expect(steps.next().done).toBeFalse();
    expect(constructed.size).toBeGreaterThan(3); expect(root).toBeDefined();
    steps.return(undefined as never);
    const attached = new Set<BufferGeometry>(); root!.traverse(object => { if ("geometry" in object) attached.add(object.geometry as BufferGeometry); });
    for (const geometry of constructed) if (!attached.has(geometry)) expect(disposed.get(geometry)).toBe(1);
    disposeSurroundingCityRoot(root!);
    expect([...disposed.values()].every(count => count === 1)).toBeTrue();
  } finally {
    steps.return(undefined as never); BufferGeometry.prototype.setAttribute = previousSet; BufferGeometry.prototype.dispose = previousDispose;
  }
});


test("the complete production ground yields between source rows and keeps all published instance bytes", () => {
  const ground = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url), "utf8"));
  const options: IsometricCityBuildOptions = { buildings: [], includeContext: false, retainRasterAsphalt: true, retainRasterWater: true, bridgeStructures: false, parliamentaryDiningV296: true, waterfrontV296: true };
  const expected = control.createIsometricCityCore(prisms, ground, null, null, options);
  const steps = createIsometricCityCoreStepsV309(prisms, ground, null, null, options);
  let count = 0, result = steps.next(); while (!result.done) { count++; result = steps.next(); }
  const actual = result.value;
  try {
    expect(count).toBeGreaterThan(100);
    expect((actual.getObjectByName("Drawn ground slabs") as InstancedMesh).count).toBeGreaterThan(100_000);
    expect(snapshot(actual)).toEqual(snapshot(expected));
  } finally { disposeSurroundingCityRoot(expected); disposeSurroundingCityRoot(actual); }
});
