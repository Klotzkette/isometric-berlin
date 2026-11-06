/** Run the actual Viewer and both private runtime lifetimes with tiny branded
 * model/source and host doubles. Real source/geometry receipts have separate
 * bounded suites; no full city or product test hook is constructed here. */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from "three";

const drain = <T>(steps: Generator<void, T>): T => { for (;;) { const n = steps.next(); if (n.done) return n.value; } };
function compile(file: string, dependencies: Record<string, unknown>, names?: string[]): any {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const nodes = ast.statements.filter(node => names ? ts.isFunctionDeclaration(node) && !!node.name && names.includes(node.name.text) : !ts.isImportDeclaration(node));
  if (names) expect(nodes).toHaveLength(names.length);
  const code = ts.transpileModule(nodes.map(node => node.getText(ast)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  return new Function("exports", ...Object.keys(dependencies), code + (names ? `;return {${names.join(",")}};` : ";return exports;"))(exports, ...Object.values(dependencies));
}
function fixture(native = false, includeStreet = true) {
  const events: string[] = [], calls: any[] = [], previousCalls: boolean[] = [], bundles: any[] = [];
  const world = new Group(), press = new Group(), preview = new Group();
  press.name = native ? "Press quarter v272 independent native architecture" : "Press quarter v272 complete measured architecture";
  preview.name = "Startup complete building coverage";
  const original = new BufferAttribute(Uint16Array.from([0, 1, 2]), 1);
  const oldMesh = new Mesh(new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(9), 3)).setIndex(original), new MeshBasicMaterial());
  world.add(oldMesh, press); if (!native) world.add(preview);
  const runtime = { disposed: false, loadSignal: { aborted: false } };
  const controls = { failCreate: -1, failPrevious: -1, failPress: -1, failStreetAttach: false, failHousingAttach: false, failRestage: false };
  const receipts = new WeakMap<object, boolean>(), models = new Map<Group, { ready: boolean; disposed: boolean; native: boolean; receipt: object }>();
  let oldApi: any, newApi: any;
  function modelComplete(root: Group, mode: boolean) {
    const state = models.get(root); return !!state && state.ready && !state.disposed && state.native === mode && receipts.get(state.receipt) === mode && root.visible;
  }
  function dispose(root: Group) {
    const state = models.get(root); if (!state || state.disposed) return;
    state.disposed = true; root.removeFromParent(); root.clear(); events.push(root.name + "-dispose");
  }
  const sourceValid = (receipt: object, mode: boolean) => receipts.has(receipt) && receipts.get(receipt) === mode;
  function* bind(_prisms: unknown[], _native: unknown, mode: boolean) { yield; const receipt = Object.freeze({}); receipts.set(receipt, mode); return receipt; }
  const factory = (name: string) => function* (options: any, onCreate: (root: Group) => void) {
    const root = new Group(); root.name = name;
    models.set(root, { ready: false, disposed: false, native: options.native, receipt: options.sourceReceipt });
    let delivered = false;
    try { onCreate(root); yield; models.get(root)!.ready = true; delivered = true; return root; }
    finally { if (!delivered) dispose(root); }
  };
  const additionalValid = (input: any, target: Group) => !!input && target === world && input.model.parent === target && modelComplete(input.model, true) && sourceValid(input.sourceReceipt, true);
  oldApi = compile("WilhelmHousingV324Runtime.ts", {
    Group, bindWilhelmHousingV324SourcesSteps: bind, hasWilhelmHousingV324Sources: sourceValid,
    createWilhelmHousingV324Steps: factory("housing"), hasCompleteWilhelmHousingV324: modelComplete, disposeWilhelmHousingV324: dispose,
    hasWilhelmStreetFrontsPreviousInputV325: additionalValid,
    prepareWilhelmHousingLegacyV324Steps: function* () { throw Error("No late Drawn host in this fixture"); },
    prepareWilhelmHousingPreviousV324Steps: function* (_world: Group, mode: boolean, model: Group, _receipt: object, hooks: any = {}, additional?: any) {
      previousCalls.push(!!additional); events.push(additional ? "previous-union-prepare" : "previous-old-prepare"); yield;
      if (controls.failRestage && previousCalls.length > 1) return null;
      let active = false, closed = false, gate: (() => boolean) | undefined;
      const transaction = {
        prepared: () => !closed,
        complete: () => {
          const ready = active && !closed && gate?.() === true && modelComplete(model, mode) && (!additional || additionalValid(additional, world));
          if (!ready && active) transaction.rollback(); return ready;
        },
        commit(next: () => boolean) { gate = next; if (!gate() || additional && !additionalValid(additional, world)) return false;
          oldMesh.geometry.setIndex(additional ? [2, 2, 2] : [1, 1, 1]); active = true;
          events.push(additional ? "previous-union-commit" : "previous-old-commit"); hooks.afterSwap?.(); return transaction.complete(); },
        rollback() { if (closed) return; closed = true; if (active) oldMesh.geometry.setIndex(original); active = false;
          events.push(additional ? "previous-union-rollback" : "previous-old-rollback"); hooks.afterSwap?.(); },
        *parkRetiredSourcesSteps() { yield; return 12; },
      }; return transaction;
    },
  });
  newApi = compile("WilhelmStreetFrontsV325Runtime.ts", {
    Group, bindWilhelmStreetFrontsV325SourcesSteps: bind, hasWilhelmStreetFrontsV325Sources: sourceValid,
    createWilhelmStreetFrontsV325Steps: factory("street"), hasCompleteWilhelmStreetFrontsV325: modelComplete, disposeWilhelmStreetFrontsV325: dispose,
  });
  const housing = drain(oldApi.createWilhelmHousingRuntimeV324Steps(world, [], {}, native, false, {})) as Group;
  const street = includeStreet ? drain(newApi.createWilhelmStreetFrontsRuntimeV325Steps(world, [], {}, native, false, {})) as Group : undefined;
  const additional = native && street ? newApi.getWilhelmStreetFrontsPreviousInputV325(world, true) : undefined;
  expect(drain(oldApi.prepareWilhelmHousingRuntimePreviousV324Steps(world, native, {}, additional))).toBeTrue();
  if (native && street) expect(newApi.attachWilhelmStreetFrontsPreviousGateV325(world, true, () => oldApi.hasWilhelmHousingRuntimePreviousV324(world, true))).toBeTrue();
  const module = {
    ...oldApi, ...newApi,
    attachWilhelmStreetFrontsCoreGateV325: (...args: any[]) => { events.push("street-attach"); return !controls.failStreetAttach && newApi.attachWilhelmStreetFrontsCoreGateV325(...args); },
    attachWilhelmHousingCoreGateV324: (...args: any[]) => { events.push("housing-attach"); if (controls.failHousingAttach) { controls.failHousingAttach = false; return false; } return oldApi.attachWilhelmHousingCoreGateV324(...args); },
    resetWilhelmHousingRuntimePreviousV324: (...args: any[]) => { events.push("previous-reset"); return oldApi.resetWilhelmHousingRuntimePreviousV324(...args); },
    createGovernmentOfficesV321Steps: function* (options: any) {
      const index = calls.length; calls.push(options); events.push(`create:${index}`); yield;
      if (controls.failCreate === index) return null;
      const bundle = { root: new Group(), closed: false,
        complete: () => {
          const ready = !bundle.closed && bundle.root.parent === world &&
            (!options.wilhelmStreetFrontsV325 || newApi.getWilhelmStreetFrontsModelV325(world, native) === options.wilhelmStreetFrontsV325) &&
            (!options.wilhelmHousingV324 || oldApi.getWilhelmHousingModelV324(world, native) === options.wilhelmHousingV324);
          if (!ready && !bundle.closed) bundle.rollback(); return ready;
        },
        rollback: () => { if (bundle.closed) return; bundle.closed = true; events.push(`rollback:${index}`);
          options.onWilhelmStreetRevokeV325?.(); options.onWilhelmRevokeV324?.(); },
        *stagePreviousSteps() { yield; return controls.failPrevious !== index; },
        *stagePressQuarterSteps(target: Group) { expect(target).toBe(press); yield; return controls.failPress !== index; },
        *stagePreviewSteps(target: Group) { expect(target).toBe(preview); yield; return true; },
      }; bundles.push(bundle); return bundle;
    },
  };
  const viewer = compile("ThreeViewer.tsx", { governmentSwapHooksV321: () => ({}),
    disposeObject3D: (_runtime: unknown, root: Group) => { events.push("gov-dispose"); root.clear(); } },
    ["prepareGovernmentOfficesV321Steps", "preparePublicOfficesV322Steps"]);
  return { world, runtime, oldApi, newApi, module, controls, events, calls, previousCalls, bundles, housing, street, original, oldMesh,
    steps: () => viewer.preparePublicOfficesV322Steps(runtime, world, { sourcePrisms: [], native, mobileLike: false }, module) as Generator<void, any> };
}

test("actual Viewer links both private models to one Gov gate and one shared Native Previous owner", () => {
  for (const native of [false, true]) {
    const f = fixture(native), bundle = drain(f.steps()); expect(bundle).not.toBeNull(); expect(f.calls).toHaveLength(1);
    expect(f.calls[0].wilhelmStreetFrontsV325).toBe(f.street); expect(f.calls[0].wilhelmHousingV324).toBe(f.housing);
    expect(f.events.indexOf("street-attach")).toBeLessThan(f.events.indexOf("housing-attach"));
    expect(f.oldApi.hasWilhelmHousingRuntimeV324(f.world, native)).toBeTrue(); expect(f.newApi.hasWilhelmStreetFrontsRuntimeV325(f.world, native)).toBeTrue();
    expect(f.previousCalls).toEqual([native]); bundle.rollback();
    expect(f.newApi.getWilhelmStreetFrontsModelV325(f.world, native)).toBeUndefined(); expect(f.oldApi.getWilhelmHousingModelV324(f.world, native)).toBeUndefined();
    expect(f.oldMesh.geometry.index).toBe(f.original); expect(f.events.filter(e => e === "housing-dispose")).toHaveLength(1);
  }
});

test("every optional street failure restores the shared owner and preserves the complete old housing fallback", () => {
  for (const native of [false, true]) for (const failure of ["create", "previous", "press", "streetGate", "housingGate"] as const) {
    const f = fixture(native); if (failure === "create") f.controls.failCreate = 0;
    if (failure === "previous") f.controls.failPrevious = 0; if (failure === "press") f.controls.failPress = 0;
    if (failure === "streetGate") f.controls.failStreetAttach = true; if (failure === "housingGate") f.controls.failHousingAttach = true;
    const bundle = drain(f.steps()); expect(bundle).not.toBeNull(); expect(f.calls).toHaveLength(2);
    expect(f.calls[1].wilhelmStreetFrontsV325).toBeUndefined(); expect(f.calls[1].wilhelmHousingV324).toBe(f.housing);
    expect(f.newApi.getWilhelmStreetFrontsModelV325(f.world, native)).toBeUndefined(); expect(f.oldApi.getWilhelmHousingModelV324(f.world, native)).toBe(f.housing);
    expect(f.events).not.toContain("housing-dispose"); expect(f.oldApi.hasWilhelmHousingRuntimeV324(f.world, native)).toBeTrue();
    if (native) { expect(f.previousCalls).toEqual([true, false]); expect(f.events.indexOf("previous-union-rollback")).toBeLessThan(f.events.indexOf("previous-old-prepare")); }
    else expect(f.previousCalls).toEqual([false]);
    if (failure !== "create") { expect(f.bundles[0].closed).toBeTrue(); expect(f.bundles[0].root.parent).toBeNull(); expect(f.events.indexOf("gov-dispose")).toBeLessThan(f.events.indexOf("create:1")); }
    bundle.rollback(); expect(f.oldMesh.geometry.index).toBe(f.original);
  }
});

test("failed Native housing-only restage falls back to complete generic Gov with no stale admission", () => {
  const f = fixture(true); f.controls.failCreate = 0; f.controls.failRestage = true;
  const bundle = drain(f.steps()); expect(bundle).not.toBeNull(); expect(f.calls).toHaveLength(2);
  expect(f.calls[1].wilhelmHousingV324).toBeUndefined(); expect(f.calls[1].wilhelmStreetFrontsV325).toBeUndefined();
  expect(f.oldApi.hasWilhelmHousingRuntimeV324(f.world, true)).toBeFalse(); expect(f.newApi.hasWilhelmStreetFrontsRuntimeV325(f.world, true)).toBeFalse();
  expect(f.oldMesh.geometry.index).toBe(f.original); expect(f.events).toContain("housing-dispose");
});

test("Viewer cancellation closes every provisional Gov and street model without discarding the old housing model", () => {
  for (const native of [false, true]) for (const checkpoint of [1, 2, 3]) {
    const f = fixture(native), steps = f.steps(); for (let i = 0; i < checkpoint; i++) expect(steps.next().done).toBeFalse();
    steps.return(null); expect(f.bundles.every(b => b.closed && b.root.parent === null)).toBeTrue();
    if (f.bundles.length) { expect(f.newApi.getWilhelmStreetFrontsModelV325(f.world, native)).toBeUndefined(); expect(f.oldApi.getWilhelmHousingModelV324(f.world, native)).toBe(f.housing); }
    f.newApi.releaseWilhelmStreetFrontsRuntimeV325(f.world, native); f.oldApi.releaseWilhelmHousingRuntimeV324(f.world, native);
    expect(f.oldMesh.geometry.index).toBe(f.original);
  }
});

test("the old-only Viewer path needs no optional street methods and still commits its complete correction", () => {
  const f = fixture(false, false); delete (f.module as any).getWilhelmStreetFrontsModelV325;
  const bundle = drain(f.steps()); expect(bundle).not.toBeNull(); expect(f.calls).toHaveLength(1);
  expect(f.calls[0].wilhelmHousingV324).toBe(f.housing); expect(f.calls[0].wilhelmStreetFrontsV325).toBeUndefined();
  expect(f.oldApi.hasWilhelmHousingRuntimeV324(f.world, false)).toBeTrue(); bundle.rollback(); expect(f.oldMesh.geometry.index).toBe(f.original);
});

test("actual Native publication keeps its shared Previous witness after the provisional variable is released", async () => {
  const source = readFileSync(new URL("../src/ThreeViewer.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("viewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const anchors: ts.VariableStatement[] = [];
  const walk = (node: ts.Node) => {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === "streetPreviousWorldV325")) anchors.push(node);
    ts.forEachChild(node, walk);
  }; walk(ast); expect(anchors).toHaveLength(1);
  const block = anchors[0].parent; expect(ts.isBlock(block)).toBeTrue(); if (!ts.isBlock(block)) throw Error("Actual Native publication block missing");
  const statements = [...block.statements], start = statements.indexOf(anchors[0]);
  const end = statements.findIndex((s, i) => i >= start && ts.isIfStatement(s) && s.getText(ast).includes("attachWilhelmStreetFrontsPreviousGateV325"));
  expect(end).toBeGreaterThan(start);
  const releases = statements.filter(s => ts.isExpressionStatement(s) && ts.isBinaryExpression(s.expression) &&
    s.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken && s.expression.left.getText(ast) === "provisionalVoxelWorld" && s.expression.right.kind === ts.SyntaxKind.NullKeyword);
  expect(releases).toHaveLength(1);
  const text = `async function publish(provisionalVoxelWorld){${statements.slice(start, end + 1).map(s => s.getText(ast)).join("\n")}\n${releases[0].getText(ast)}\nreturn provisionalVoxelWorld;}`;
  const code = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const world = new Group(), input = Object.freeze({ model: new Group(), sourceReceipt: Object.freeze({}) });
  let witness: (() => boolean) | undefined, ready = true, resets = 0;
  const seen: unknown[] = [];
  const governmentV323 = {
    getWilhelmStreetFrontsPreviousInputV325: (owner: Group, native: boolean) => { expect(owner).toBe(world); expect(native).toBeTrue(); return input; },
    *prepareWilhelmHousingRuntimePreviousV324Steps(owner: Group, native: boolean, _hooks: unknown, additional: unknown) { expect(owner).toBe(world); expect(native).toBeTrue(); expect(additional).toBe(input); yield; return true; },
    attachWilhelmStreetFrontsPreviousGateV325: (owner: Group, native: boolean, gate: () => boolean) => { expect(owner).toBe(world); expect(native).toBeTrue(); witness = gate; return gate(); },
    hasWilhelmHousingRuntimePreviousV324: (owner: Group, native: boolean) => { seen.push(owner); return owner === world && native && ready; },
    resetWilhelmHousingRuntimePreviousV324: () => { resets++; }, releaseWilhelmStreetFrontsRuntimeV325: () => { throw Error("Valid witness must not trigger fallback"); },
  };
  const deps = { governmentV323, runtime: { disposed: false }, completeCooperatively: async (g: Generator<void, boolean>) => drain(g),
    governmentSwapHooksV321: () => ({}), yieldStartupWork: async () => {}, voxelWorldIntentActive: () => true };
  const publish = new Function(...Object.keys(deps), code + ";return publish;")(...Object.values(deps));
  expect(await publish(world)).toBeNull(); expect(resets).toBe(0); expect(witness).toBeFunction();
  expect(witness!()).toBeTrue(); expect(seen.every(owner => owner === world)).toBeTrue();
  ready = false; expect(witness!()).toBeFalse();
});
