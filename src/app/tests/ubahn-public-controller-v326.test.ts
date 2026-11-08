import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import ts from "typescript";
import {
  Group, InstancedMesh, Line, Material, Mesh, Object3D, OrthographicCamera,
  Points, Raycaster, Scene, ShaderLib, Texture, Vector3, type WebGLRenderer,
} from "three";
import { createSurroundingCity, type SurroundingCityManifest, type SurroundingCityOptions } from "../src/SurroundingCity";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import { ubahnGroundApproachAtV326 } from "../src/UbahnGroundApproachesV326";
import { hasCompleteUbahnAccessV326, ubahnAccessGroundAtV326, ubahnAccessOpeningsV326 } from "../src/UbahnAccessV326";
import index from "../src/data/ubahnGroundApproachesV326Index.json";
import source from "../src/data/ubahnAccessV326.json";
import { createSceneGeometryGpuResidency } from "../src/sceneGeometryGpuResidency";
import { createSceneGpuResidency } from "../src/sceneGpuResidency";
import { createSceneGpuWarmup } from "../src/sceneGpuWarmup";
import { createMinecraftMaterialState, disposeMinecraftMaterialState, releaseMinecraftMaterialBindings } from "../src/visual-modes/minecraft/materialMode";
import { createZooAnimalRuntimeV282 } from "../src/ZooAnimalsV282";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { objectMaterialsIncludingTransferredAlternates } from "../src/transferableObject3D";

const viewer = ts.createSourceFile("ThreeViewer.tsx", readFileSync(new URL("../src/ThreeViewer.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = (name: string) => {
  const node = viewer.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  if (!node) throw Error(`Missing actual viewer function ${name}`);
  return node;
};
function actualCallbacks(runtime: object): Pick<SurroundingCityOptions, "onAttach" | "onBeforeRelease" | "onRelease"> {
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(viewer) === "createSurroundingCity") calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(declaration("startSurroundingCity"));
  if (calls.length !== 1 || !ts.isObjectLiteralExpression(calls[0].arguments[0])) throw Error("Ambiguous actual controller call");
  const options = calls[0].arguments[0];
  const enabled = options.properties.find(node => ts.isPropertyAssignment(node) && node.name.getText(viewer) === "publicSitesV326");
  expect(enabled && ts.isPropertyAssignment(enabled) && enabled.initializer.kind === ts.SyntaxKind.TrueKeyword).toBe(true);
  const callbacks = ["onAttach", "onBeforeRelease", "onRelease"].map(name => {
    const property = options.properties.find(node => ts.isPropertyAssignment(node) && node.name.getText(viewer) === name);
    if (!property || !ts.isPropertyAssignment(property)) throw Error(`Missing actual callback ${name}`);
    return property.getText(viewer);
  });
  const dependencies = { runtime, Mesh, Line, Points, InstancedMesh, Material, Texture, releaseMinecraftMaterialBindings,
    objectMaterialsIncludingTransferredAlternates, createZooAnimalRuntimeV282, setIsoNightPresentation };
  const code = declaration("disposeObject3D").getText(viewer) + "\nreturn ({" + callbacks.join(",") + "});";
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(dependencies), js)(...Object.values(dependencies));
}

const descriptor = [...index.chunks].sort((a, b) => {
  const count = (id: string) => index.entries.filter(e => e.key === id.replace("ubahnApproach326-", "") && e.drawnPoint && e.nativePoint && e.hasSourceStair).length;
  return count(b.id) - count(a.id);
})[0];
const packetEntries = index.entries.filter(e => e.key === descriptor.id.replace("ubahnApproach326-", "") && e.drawnPoint && e.nativePoint);
const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const drain = <T>(steps: Generator<void, T>): T => { for (;;) { const n = steps.next(); if (n.done) return n.value; } };
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 2));
async function settled(done: () => boolean, errors: string[]) {
  for (let i = 0; i < 2_000; i++) { if (errors.length) throw Error(errors.join("\n")); if (done()) return; await pause(); }
  throw Error("Actual bounded controller did not settle");
}
function resources(root: Object3D) {
  const objects: Object3D[] = [], attributes: object[] = [];
  root.traverse(o => {
    objects.push(o);
    if (!(o instanceof Mesh || o instanceof Line || o instanceof Points)) return;
    attributes.push(...Object.values(o.geometry.attributes));
    if (o.geometry.index) attributes.push(o.geometry.index);
    if (o instanceof InstancedMesh) attributes.push(o.instanceMatrix, ...(o.instanceColor ? [o.instanceColor] : []));
  });
  return { objects, attributes };
}
function words(meshes: readonly Mesh[]) {
  return meshes.map(mesh => {
    const attributes = [...Object.entries(mesh.geometry.attributes), ["index", mesh.geometry.index] as const];
    return attributes.filter(([, a]) => a).map(([name, a]) => {
      const storage = "data" in a! ? a!.data : a!, array = storage.array;
      return { name, type: array.constructor.name, itemSize: a!.itemSize, normalized: a!.normalized,
        sha: sha(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)) };
    });
  });
}

for (const native of [false, true]) test(`real U-approach controller: ${native ? "Native" : "Drawn"} source, callbacks, ground and complete release`, async () => {
  const files = new Map<string, Uint8Array>();
  for (const family of ["drawn", "minecraft"] as const) {
    const asset = descriptor[family], bytes = readFileSync(new URL("../public/mesh/surrounding-berlin-v159/" + asset.url, import.meta.url));
    expect(bytes.byteLength).toBe(asset.bytes); expect(sha(bytes)).toBe(asset.sha256);
    expect(gunzipSync(bytes).byteLength).toBe(asset.decodedBytes); files.set(asset.url, bytes);
  }
  const packet = JSON.parse(gunzipSync(files.get(descriptor[native ? "minecraft" : "drawn"].url)!).toString()) as SurroundingCityChunk;
  const rawBefore = JSON.stringify(packet), baseline = drain(buildSurroundingCityChunk(packet, descriptor.id, native));
  const baselineHosts = baseline.root.children.filter((o): o is Mesh => o instanceof Mesh), baselineWords = words(baselineHosts);
  const baselineNav = JSON.stringify(baseline.nav);
  const manifest: SurroundingCityManifest = { schemaVersion: 1, groundY: baseline.nav.groundY,
    chunks: [descriptor], footprint: (native ? index.nativeFootprint : index.footprint) as SurroundingCityManifest["footprint"] };
  const camera = new OrthographicCamera(-300, 300, 300, -300, 1, 2_000);
  const x = (descriptor.bounds[0] + descriptor.bounds[2]) / 2, z = (descriptor.bounds[1] + descriptor.bounds[3]) / 2;
  camera.position.set(x, 500, z); camera.up.set(0, 0, -1); camera.lookAt(x, 0, z); camera.updateMatrixWorld();
  const scene = new Scene(), renderer = { domElement: new EventTarget(), info: { render: { frame: 0 } },
    shadowMap: { enabled: false, type: 0, needsUpdate: false }, localClippingEnabled: false, clippingPlanes: [],
    getContext: () => ({ isContextLost: () => false }) } as unknown as WebGLRenderer;
  const geometry = createSceneGeometryGpuResidency(renderer, camera), instances = createSceneGpuResidency(renderer, camera), warmup = createSceneGpuWarmup(renderer, scene, camera);
  const releaseSnapshots: ReturnType<typeof resources>[] = [], beforeSnapshots: ReturnType<typeof resources>[] = [];
  const observe = <T extends { release: (root: Object3D) => void }>(manager: T) => ({ ...manager, release(root: Object3D) { releaseSnapshots.push(resources(root)); manager.release(root); } });
  const runtime = { lightingMode: native ? "minecraft" : "day", nightLightsOn: true,
    geometryResidency: observe(geometry), gpuResidency: observe(instances), gpuWarmup: observe(warmup),
    minecraftMaterialState: createMinecraftMaterialState(), scheduleGpuWarmup() {} };
  const callbacks = actualCallbacks(runtime), errors: string[] = [], requested: string[] = [], attached: Group[] = [];
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input)), name = url.pathname.split("/").at(-1)!; requested.push(name);
    if (name === "manifest.json") return new Response(JSON.stringify(manifest));
    const bytes = files.get(name); if (!bytes) throw Error("Unexpected controller request " + name);
    return new Response(bytes);
  }) as typeof fetch;
  const create = (publicSitesV326?: boolean) => createSurroundingCity({ camera, mode: native ? "minecraft" : "day", manifestUrl: new URL("https://bounded.test/manifest.json"), fetch: fetcher,
    publicSitesV326, onError: e => errors.push(e), onAttach(root, mode) { callbacks.onAttach!(root, mode); attached.push(root); },
    onBeforeRelease(root) { beforeSnapshots.push(resources(root)); callbacks.onBeforeRelease!(root); }, onRelease: callbacks.onRelease });
  let city = create(true);
  try {
    scene.add(city.root); await city.ready; await settled(() => !city.pending && city.residentChunkCount === 1, errors);
    expect(attached).toHaveLength(1); const root = attached[0], hosts = root.children.filter((o): o is Mesh => o instanceof Mesh);
    expect(words(hosts)).toEqual(baselineWords); expect(JSON.stringify(city.navigationTiles[0].nav)).toBe(baselineNav);
    const access = root.getObjectByName("Source-bound U-Bahn accesses V326") as Group;
    expect(access).toBeInstanceOf(Group); expect(access.visible).toBe(true);
    const models = access.children.filter((o): o is Group => o instanceof Group && hasCompleteUbahnAccessV326(o, native));
    expect(models.length).toBeGreaterThan(0); const openings = models.flatMap(model => [...ubahnAccessOpeningsV326(model)]);
    expect(openings.length).toBeGreaterThan(0);
    const shader = { ...ShaderLib.basic, uniforms: { ...ShaderLib.basic.uniforms } };
    const material = hosts[0].material as Material; material.onBeforeCompile(shader as never, renderer);
    expect(shader.fragmentShader).toContain("if(ubahnCutV326");
    const uniforms = shader.uniforms as unknown as Record<string, { value: unknown }>;
    expect(uniforms.uUbahnApertureEnabledV326.value).toBe(1); expect(uniforms.uUbahnApertureDataV326.value).toBeInstanceOf(Texture);
    expect(hosts.every(m => !!m.customDepthMaterial && !!m.customDistanceMaterial)).toBe(true);
    baseline.root.updateMatrixWorld(true);
    for (const entry of packetEntries) {
      const original = source.entries.find(e => e.id === entry.id)!;
      const [px, pz] = original.point, terrain = ubahnGroundApproachAtV326(px, pz, native);
      expect(terrain).not.toBeNull(); expect(city.groundAt(px, pz)).toBe(terrain);
      const hit = new Raycaster(new Vector3(px, 1_000, pz), new Vector3(0, -1, 0)).intersectObjects(baselineHosts, false)[0];
      expect(hit).toBeDefined(); expect(Math.abs(hit.point.y - terrain!)).toBeLessThan(.011);
    }
    for (const opening of openings) {
      const a = opening.sourcePoints[0], b = opening.sourcePoints[1], cell = opening.nativeCells?.[0];
      const px = cell ? cell[0] + .125 : a[0] * .9 + b[0] * .1, pz = cell ? cell[1] + .125 : a[1] * .9 + b[1] * .1;
      const floor = models.map(model => ubahnAccessGroundAtV326(model, px, pz)).find(y => y !== null);
      expect(floor).toBeDefined(); expect(floor).not.toBeNull();
      expect(city.interiorGroundAt(px, pz)).toBe(floor!); expect(city.interiorGroundAt(px, pz, floor!)).toBe(floor!);
    }
    const live = resources(root); expect(live.objects.length).toBeGreaterThan(baseline.root.children.length); expect(live.attributes.length).toBeGreaterThan(0);
    city.dispose(); expect(beforeSnapshots).toHaveLength(1); expect(beforeSnapshots[0]).toEqual(live);
    for (const snapshot of releaseSnapshots) expect(snapshot).toEqual(live);
    expect(root.children).toHaveLength(0); expect(resources(root).attributes).toHaveLength(0); expect(access.parent).toBeNull();
    expect(models.every(model => !hasCompleteUbahnAccessV326(model, native))).toBe(true);
    expect(uniforms.uUbahnApertureEnabledV326.value).toBe(0); expect(uniforms.uUbahnApertureDataV326.value).toBeNull();
    expect(hosts.every(m => !m.customDepthMaterial && !m.customDistanceMaterial)).toBe(true);
    expect(words(hosts)).toEqual(baselineWords); expect(JSON.stringify(packet)).toBe(rawBefore);
    // The same real descriptor remains the exact pre-V326 result by default.
    attached.length = 0; city = create(false); scene.add(city.root); await city.ready; await settled(() => !city.pending && city.residentChunkCount === 1, errors);
    const closed = attached[0]; expect(closed.getObjectByName("Source-bound U-Bahn accesses V326")).toBeUndefined();
    expect(words(closed.children.filter((o): o is Mesh => o instanceof Mesh))).toEqual(baselineWords);
    expect(JSON.stringify(city.navigationTiles[0].nav)).toBe(baselineNav); expect(closed.children).toHaveLength(baseline.root.children.length);
    expect(requested.filter(name => name !== "manifest.json")).toEqual([descriptor[native ? "minecraft" : "drawn"].url, descriptor[native ? "minecraft" : "drawn"].url]);
    expect(errors).toEqual([]);
  } finally {
    city.dispose(); warmup.dispose(); geometry.dispose(); instances.dispose(); disposeMinecraftMaterialState(runtime.minecraftMaterialState); disposeSurroundingCityRoot(baseline.root);
  }
}, 30_000);
