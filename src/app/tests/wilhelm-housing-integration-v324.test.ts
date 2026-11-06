/** Actual small production JSON bundles and the viewer's finite owner transfer.
 * No full city, browser, source mutation, or product-only test hook is needed. */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import ts from "typescript";
import { Group, InstancedMesh, InterleavedBufferAttribute, LineSegments, Material, Mesh } from "three";
import { losslessJsonData, READONLY_CONSTRUCTION_JSON_FIELDS } from "../losslessJsonData";
import { completeCooperatively } from "../src/cooperativeWork";

const dataPath = (name: string) => fileURLToPath(new URL(`../src/data/${name}.json`, import.meta.url));
const raw = (name: string) => JSON.parse(readFileSync(dataPath(name), "utf8"));
async function production(entry: string): Promise<{ fixture: any; decoded: unknown[]; code: string }> {
  const directory = await mkdtemp(join(tmpdir(), "isometric-wilhelm-v324-"));
  try {
    const input = join(directory, "entry.js"); await writeFile(input, entry);
    const result = await build({ configFile: false, root: directory, publicDir: false, logLevel: "silent",
      plugins: [losslessJsonData([])], build: { write: false, minify: true, rolldownOptions: { input } } });
    if (Array.isArray(result) || !("output" in result)) throw Error("Expected one production fixture");
    const chunks = result.output.filter(item => item.type === "chunk");
    expect(chunks).toHaveLength(1);
    const code = chunks[0].code, window: { fixture?: any } = {}, decoded: unknown[] = [];
    new Function("window", "JSON", code)(window, { parse(text: string) {
      const value = JSON.parse(text); decoded.push(value); return value;
    } });
    return { fixture: window.fixture, decoded, code };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
function ordinary(object: any, key: string) {
  expect(Object.getOwnPropertyDescriptor(object, key)).toEqual({
    value: object[key], writable: true, enumerable: true, configurable: true,
  });
}

test("production default housing import keeps runs ordinary and decodes only the selected mode", async () => {
  const expected = raw("wilhelmHousingV324"), path = JSON.stringify(dataPath("wilhelmHousingV324"));
  for (const selected of ["drawn", "native"] as const) {
    const { fixture: value, decoded } = await production(`import data from ${path};window.fixture=data;`);
    expect(decoded).toHaveLength(0);
    ordinary(value, "runs"); expect(value.runs).toEqual(expected.runs);
    expect(Object.getOwnPropertyDescriptor(value, "drawn")?.get).toBeFunction();
    expect(Object.getOwnPropertyDescriptor(value, "native")?.get).toBeFunction();
    const rows = value[selected]; expect(rows).toEqual(expected[selected]);
    expect(decoded).toHaveLength(1); expect(decoded[0]).toBe(rows);
    expect(value[selected]).toBe(rows); expect(decoded).toHaveLength(1);
    const other = selected === "drawn" ? "native" : "drawn";
    expect(Object.getOwnPropertyDescriptor(value, other)?.get).toBeFunction();
    expect(rows).not.toBe(expected[other]);
    Object.freeze(value); expect(value[selected]).toBe(rows); expect(decoded).toHaveLength(1);
  }
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["wilhelmHousingV324.json"]).toEqual(["drawn", "native"]);
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["wilhelmHousingV324Sources.json"]).toBeUndefined();
});

test("production named/default aliases preserve eager runs and one selected constructor value", async () => {
  const expected = raw("wilhelmHousingV324"), path = JSON.stringify(dataPath("wilhelmHousingV324"));
  for (const selected of ["drawn", "native"] as const) {
    const { fixture: [value, runs, rows], decoded } = await production(
      `import data,{runs,${selected} as selected} from ${path};window.fixture=[data,runs,selected];`);
    expect(decoded).toHaveLength(1); expect(decoded[0]).toBe(rows);
    ordinary(value, "runs"); expect(value.runs).toBe(runs); expect(runs).toEqual(expected.runs);
    expect(value[selected]).toBe(rows); expect(rows).toEqual(expected[selected]);
    runs.probe = { exact: -0 }; expect(value.runs.probe).toBe(runs.probe);
    value.runs = []; expect(runs.probe.exact).toBe(-0); expect(value.runs).not.toBe(runs);
  }
});

test("production source descriptors stay ordinary and metadata imports decode no mode", async () => {
  const sources = JSON.stringify(dataPath("wilhelmHousingV324Sources"));
  const { fixture: [value, nativeVoxels], decoded } = await production(
    `import data,{nativeVoxels} from ${sources};window.fixture=[data,nativeVoxels];`);
  expect(decoded).toHaveLength(0); ordinary(value, "nativeVoxels");
  expect(value.nativeVoxels).toBe(nativeVoxels); expect(nativeVoxels).toEqual(raw("wilhelmHousingV324Sources").nativeVoxels);
  nativeVoxels.probe = { exact: true }; expect(value.nativeVoxels.probe).toBe(nativeVoxels.probe);
  value.nativeVoxels = {}; expect(nativeVoxels.probe.exact).toBeTrue();
  const housing = JSON.stringify(dataPath("wilhelmHousingV324"));
  const metadata = await production(`import {schemaVersion,estimates} from ${housing};window.fixture=[schemaVersion,estimates];`);
  expect(metadata.decoded).toHaveLength(0); expect(metadata.fixture).toEqual([1, raw("wilhelmHousingV324").estimates]);
  expect(metadata.code.length).toBeLessThan(500); expect(metadata.code).not.toContain("WeakRef");
});

test("production Core plan default reads leave both unselected constructors undecoded", async () => {
  const expected = raw("wilhelmHousingV324Core"), path = JSON.stringify(dataPath("wilhelmHousingV324Core"));
  for (const selected of ["drawn", "nativeFull", "nativeMobile"] as const) {
    const { fixture, decoded } = await production(`import data from ${path};window.fixture=()=>data[${JSON.stringify(selected)}];`);
    expect(decoded).toHaveLength(0); const plan = fixture(); expect(plan).toEqual(expected[selected]);
    // The small nativeMobile plan already remains a direct literal. Larger
    // constructor plans enter exactly one existing weak codec on selected read.
    expect(decoded).toHaveLength(JSON.stringify(expected[selected]).length >= 65536 ? 1 : 0);
    expect(fixture()).toBe(plan);
  }
});

const viewer = readFileSync(new URL("../src/ThreeViewer.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("ThreeViewer.tsx", viewer, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function compile(names: string[], dependencies: Record<string, unknown>): any {
  const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node) && !!node.name && names.includes(node.name.text));
  expect(nodes).toHaveLength(names.length);
  const code = ts.transpileModule(nodes.map(node => node.getText(ast)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(dependencies), code + `;return {${names.join(",")}};`)(...Object.values(dependencies));
}
function ownerFixture() {
  const world = new Group(), housing = new Group(), press = new Group(), preview = new Group();
  press.name = "Press quarter v272 complete measured architecture"; preview.name = "Startup complete building coverage";
  world.add(housing, press, preview);
  const runtime = { disposed: false, loadSignal: { aborted: false } }, events: string[] = [], calls: any[] = [];
  const controls = { create: [true, true, true], previous: true, press: true, preview: true, attach: true };
  const bundles: any[] = []; let gate: (() => boolean) | undefined;
  const module = {
    getWilhelmHousingModelV324: () => housing,
    releaseWilhelmHousingRuntimeV324: () => { events.push("housing-release"); housing.removeFromParent(); },
    attachWilhelmHousingCoreGateV324: (_world: Group, _native: boolean, callback: () => boolean) => {
      events.push("core-attach"); gate = callback; return controls.attach && callback();
    },
    createGovernmentOfficesV321Steps: function* (options: any) {
      const index = calls.length; calls.push(options); events.push(`create:${index}`); yield;
      if (controls.create[index] === false) return null;
      const bundle = { root: new Group(), closed: false,
        complete: () => !bundle.closed && bundle.root.parent === world,
        rollback: () => { if (bundle.closed) return; bundle.closed = true; events.push(`rollback:${index}`); options.onWilhelmRevokeV324?.(); },
        stagePreviousSteps: function* () { events.push(`previous:${index}`); yield; return controls.previous; },
        stagePressQuarterSteps: function* (target: Group) { expect(target).toBe(press); yield; return controls.press; },
        stagePreviewSteps: function* (target: Group) { expect(target).toBe(preview); yield; return controls.preview; },
      }; bundles.push(bundle); return bundle;
    },
  };
  const api = compile(["prepareGovernmentOfficesV321Steps", "preparePublicOfficesV322Steps"], {
    governmentSwapHooksV321: () => ({}), disposeObject3D: (_runtime: unknown, root: Group) => { events.push("dispose"); root.clear(); },
  });
  const steps = () => api.preparePublicOfficesV322Steps(runtime, world, { sourcePrisms: [], native: false, mobileLike: false }, module) as Generator<void, any>;
  return { world, housing, runtime, events, calls, controls, bundles, steps, gate: () => gate };
}
function drain<T>(steps: Generator<void, T>): T { for (;;) { const next = steps.next(); if (next.done) return next.value; } }

test("actual viewer commits one housing/Core bundle and links its current complete callback", () => {
  const f = ownerFixture(), bundle = drain(f.steps());
  expect(bundle).toBe(f.bundles[0]); expect(f.calls).toHaveLength(1);
  expect(f.calls[0].wilhelmHousingV324).toBe(f.housing); expect(f.calls[0].includeUniversitiesV322).toBeTrue();
  expect(f.gate()?.()).toBeTrue(); bundle.rollback(); expect(f.gate()?.()).toBeFalse();
  expect(f.events.filter(event => event === "housing-release")).toHaveLength(1);
});

test("actual viewer closes the failed housing transfer before the complete original fallback", () => {
  for (const attach of [true, false]) {
    const f = ownerFixture(); f.controls.attach = attach;
    if (attach) f.controls.create[0] = false;
    const result = drain(f.steps()); expect(result).not.toBeNull(); expect(f.calls).toHaveLength(2);
    expect(f.calls[1].wilhelmHousingV324).toBeUndefined(); expect(f.calls[1].includeUniversitiesV322).toBeTrue();
    expect(f.events.indexOf("housing-release")).toBeLessThan(f.events.indexOf("create:1"));
    if (!attach) {
      expect(f.bundles[0].closed).toBeTrue(); expect(f.bundles[0].root.parent).toBeNull();
      expect(f.events.indexOf("rollback:0")).toBeLessThan(f.events.indexOf("create:1"));
      expect(f.events.indexOf("dispose")).toBeLessThan(f.events.indexOf("create:1"));
    }
  }
  const f = ownerFixture(); f.controls.create = [false, false, true];
  expect(drain(f.steps())).not.toBeNull(); expect(f.calls.map(call => call.includeUniversitiesV322)).toEqual([true, true, false]);
});

test("actual viewer cancellation rolls the current Gov bundle back before caller disposal", () => {
  const f = ownerFixture(), steps = f.steps();
  steps.next(); steps.next(); expect(f.bundles[0].root.parent).toBe(f.world);
  steps.return(null); expect(f.bundles[0].closed).toBeTrue(); expect(f.bundles[0].root.parent).toBeNull();
  expect(f.events).toContain("housing-release"); expect(f.events).toContain("dispose");
  const aborted = ownerFixture(); aborted.controls.create[0] = false; aborted.runtime.loadSignal.aborted = true;
  expect(drain(aborted.steps())).toBeNull(); expect(aborted.calls).toHaveLength(1); expect(aborted.events).toContain("housing-release");
});

test("actual late cultural staging closes on disposal, world/host replacement, and rejected scheduling", async () => {
  for (const change of ["disposed", "world", "cultural", "scheduler"] as const) {
    const world = new Group(), cultural = new Group(), legacy = new Group();
    legacy.name = "Wilhelmstrasse Stresemannstrasse recognition facades"; cultural.add(legacy);
    const runtime = { disposed: false, isoWorld: world, culturalDetails: cultural };
    let yields = 0, restored = false, started = false;
    const api = compile(["ensureWilhelmHousingLegacyV324"], {
      wilhelmHousingModuleV324: { getWilhelmHousingModelV324: () => new Group(),
        stageWilhelmHousingLegacyV324Steps: function* (_world: Group, native: boolean, target: Group) {
          expect(native).toBeFalse(); expect(target).toBe(cultural); started = true;
          try { yield; yield; } finally { restored = true; }
          return true;
        } },
      governmentSwapHooksV321: () => ({}),
      completeCooperatively: (steps: Generator<void, boolean>, options: any) => completeCooperatively(steps, { ...options, budgetMs: 0, now: () => 0 }),
      yieldStartupWork: async () => {
        if (++yields !== 2) return;
        if (change === "disposed") runtime.disposed = true;
        if (change === "world") runtime.isoWorld = new Group();
        if (change === "cultural") runtime.culturalDetails = new Group();
        if (change === "scheduler") throw Error("scheduler rejected");
      },
    });
    await expect(api.ensureWilhelmHousingLegacyV324(runtime)).resolves.toBeUndefined();
    expect(started).toBeTrue(); expect(restored).toBeTrue();
  }
});

test("integration keeps native fetching in the existing native preload and releases both worlds", () => {
  const imports = ast.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.getText(ast));
  expect(imports.some(name => /WilhelmHousingV324/.test(name))).toBeFalse();
  const native = readFileSync(new URL("../src/AltMitteNativeCoreV169.ts", import.meta.url), "utf8");
  const nativeAst = ts.createSourceFile("native.ts", native, ts.ScriptTarget.Latest, true);
  const accessor = nativeAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "preparedWilhelmHousingNativeSourceV324");
  expect(accessor?.getText(nativeAst)).toContain("return preparedSource()"); expect(accessor?.getText(nativeAst)).not.toContain("import(");
  expect(viewer).toContain("releaseWilhelmHousingRuntimeV324(provisionalIsoWorld,false)");
  expect(viewer).toContain("releaseWilhelmHousingRuntimeV324(provisionalVoxelWorld,true)");
  expect(viewer).toContain("releaseWilhelmHousingRuntimeV324(runtime.isoWorld,false)");
  expect(viewer).toContain("releaseWilhelmHousingRuntimeV324(runtime.voxelWorld,true)");
});

test("actual bounded Drawn Core retires exactly 352 fittings behind the private model gate and restores on source revoke", async () => {
  const [{ createIsometricCityCore }, { runtimeConstructorOptionsV310 }, owners, housing, sources, { wilhelmHousingCorePlanV324 }] = await Promise.all([
    import("../src/IsometricCityWorld"), import("./helpers/northRuntimeActualV310"), import("../src/ExactOwnersV321"),
    import("../src/WilhelmHousingV324"), import("../src/WilhelmHousingV324Sources"), import("../src/WilhelmHousingV324Core"),
  ]);
  const p = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8"));
  const specification = raw("wilhelmHousingV324"), retained = new Set(["DEBE01AL1H500005", "DEBE01AL1H500002", "DEBE01YYK00005zY"]);
  const ids = new Set(specification.families.filter((f: any) => retained.has(f.id)).flatMap((f: any) => f.parts.map((id: string) => id.slice(-8))));
  const selected = p.buildings.filter((b: any) => ids.has(b.id)); expect(selected).toHaveLength(41);
  // Exposure keeps the complete original P input. Only these 41 actual source
  // bodies construct; unrelated context, Native city and browser never run.
  const root = createIsometricCityCore(p, null, null, null, { ...runtimeConstructorOptionsV310(false, false, p),
    buildings: selected, includeContext: false, moabitMitteV300: false, westKiezV302: false });
  const world = new Group().add(root), { plan, control } = wilhelmHousingCorePlanV324();
  const bytes = (array: ArrayBufferView) => Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64");
  const renderables: (Mesh | LineSegments)[] = []; root.traverse(o => { if (o instanceof Mesh || o instanceof LineSegments) renderables.push(o); });
  const snapshot = renderables.map(object => ({ object, geometry: object.geometry, index: object.geometry.index,
    indexWords: object.geometry.index ? Array.from(object.geometry.index.array) : null,
    attributes: Object.entries(object.geometry.attributes).map(([key, attribute]) => ({ key, attribute,
      words: bytes(attribute instanceof InterleavedBufferAttribute ? attribute.data.array : attribute.array) })),
    matrix: object instanceof InstancedMesh ? object.instanceMatrix : null,
    matrixWords: object instanceof InstancedMesh ? Array.from(object.instanceMatrix.array) : null,
    color: object instanceof InstancedMesh ? object.instanceColor : null,
    colorWords: object instanceof InstancedMesh && object.instanceColor ? bytes(object.instanceColor.array) : null,
  }));
  let model: Group | null = null, transaction: ReturnType<typeof owners.stageExactOwnersV321> = null;
  try {
    expect(plan.owners).toHaveLength(22);
    expect(plan.owners.filter(o => o.components.some(c => Array.isArray(c.retire) && c.retire.length))).toHaveLength(20);
    expect(plan.owners.filter(o => ["A7hQkD61", "bYXvpXur"].includes(o.id)).every(o => o.components.every(c => c.retire === false || Array.isArray(c.retire) && c.retire.length === 0))).toBeTrue();
    expect(plan.owners.every(o => o.retireBody === false)).toBeTrue();
    expect(plan.owners.flatMap(o => o.components).filter(c => c.name === "LoD2 prism buildings" || c.name === "LoD2 prism ink lines").every(c => c.retire === false)).toBeTrue();
    const receipt = drain(owners.createExactOwnersSourceV321Steps(plan, p.buildings, control)); expect(receipt).not.toBeNull();
    expect(owners.stageExactOwnersV321(root, receipt!, () => housing.hasCompleteWilhelmHousingV324(new Group(), false))).toBeNull();
    const source = drain(sources.bindWilhelmHousingV324SourcesSteps(p.buildings)); expect(source).not.toBeNull();
    model = drain(housing.createWilhelmHousingV324Steps({ native: false, sourceReceipt: source! })); expect(model).not.toBeNull(); world.add(model!);
    const gate = () => model?.parent === world && housing.hasCompleteWilhelmHousingV324(model!, false) && sources.hasWilhelmHousingV324Sources(source, false);
    expect(gate()).toBeTrue(); transaction = owners.stageExactOwnersV321(root, receipt!, gate); expect(transaction).not.toBeNull();
    expect(transaction!.activeOwners).toHaveLength(22); expect(transaction!.commit(gate)).toBeTrue(); expect(transaction!.complete()).toBeTrue();
    let retired = 0, retiredLines = 0, retiredInstances = 0;
    for (const s of snapshot) {
      for (const a of s.attributes) {
        expect(s.object.geometry.getAttribute(a.key)).toBe(a.attribute);
        expect(bytes(a.attribute instanceof InterleavedBufferAttribute ? a.attribute.data.array : a.attribute.array)).toBe(a.words);
      }
      if (s.object instanceof InstancedMesh) {
        expect(s.object.instanceColor).toBe(s.color); if (s.color) expect(bytes(s.color.array)).toBe(s.colorWords);
        const now = s.object.instanceMatrix.array, old = s.matrixWords!; expect(now.length).toBe(old.length);
        for (let row = 0; row < old.length / 16; row++) {
          const changed = Array.from({ length: 16 }, (_, i) => i).some(i => !Object.is(now[row * 16 + i], old[row * 16 + i]));
          if (!changed) continue; retired++; retiredInstances++;
          for (let i = 0; i < 16; i++) expect(now[row * 16 + i]).toBe([0, 1, 2, 4, 5, 6, 8, 9, 10].includes(i) ? 0 : old[row * 16 + i]);
        }
      } else if (s.object.geometry !== s.geometry) {
        expect(s.object).toBeInstanceOf(LineSegments);
        const now = s.object.geometry.index!.array, old = s.indexWords ?? Array.from({ length: s.geometry.getAttribute("position").count }, (_, i) => i);
        expect(now.length).toBe(old.length);
        for (let row = 0; row < old.length / 2; row++) {
          expect(now[row * 2]).toBe(old[row * 2]);
          if (!Object.is(now[row * 2 + 1], old[row * 2 + 1])) { retired++; retiredLines++; expect(now[row * 2 + 1]).toBe(old[row * 2]); }
        }
      }
      if (s.object.name === "LoD2 prism buildings" || s.object.name === "LoD2 prism ink lines") {
        expect(s.object.geometry).toBe(s.geometry); expect(s.object.geometry.index).toBe(s.index);
      }
    }
    expect(retired).toBe(352); expect(retiredLines).toBe(123); expect(retiredInstances).toBe(229);
    // An actual original source word revokes both private housing proof and
    // the live Core gate; the exact old body/roof/ink/fitting refs return.
    const changed = p.buildings.find((b: any) => b.id === plan.owners[0].id), originalHeight = changed.h_dm;
    changed.h_dm++; expect(gate()).toBeFalse(); expect(transaction!.complete()).toBeFalse(); changed.h_dm = originalHeight;
    for (const s of snapshot) {
      expect(s.object.geometry).toBe(s.geometry); expect(s.object.geometry.index).toBe(s.index);
      if (s.object instanceof InstancedMesh) { expect(s.object.instanceMatrix).toBe(s.matrix); expect(Array.from(s.object.instanceMatrix.array)).toEqual(s.matrixWords); }
    }
  } finally {
    transaction?.rollback(); if (model) housing.disposeWilhelmHousingV324(model);
    const resources = new Set<{ dispose(): void }>(); root.traverse(o => {
      if (o instanceof Mesh || o instanceof LineSegments) {
        resources.add(o.geometry); if (o instanceof InstancedMesh) resources.add(o);
        for (const material of [o.material, o.userData.dayMaterial, o.userData.nightMaterial].flat()) if (material instanceof Material) resources.add(material);
      }
    }); for (const resource of resources) resource.dispose(); root.clear(); world.clear();
  }
}, 30000);
