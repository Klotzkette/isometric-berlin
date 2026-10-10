import { expect, test } from "bun:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const wrapperUrl = new URL("../src/AltMitteNativeCoreV169.ts", import.meta.url);

// Bun's virtual resolver needs an explicit extension for a generated module
// that does not exist yet. Change only this specifier in the child fixture;
// the production loader, cache, validation and constructor code run unchanged.
const wrapperFixtureSource = (await Bun.file(wrapperUrl).text()).replaceAll(
  '"./data/altMitteNativeV169Data"',
  '"./data/altMitteNativeV169Data.ts"',
);

test("importing the native wrapper for Day cannot evaluate its large source JSON", () => {
  const script = `
    import { plugin } from "bun";
    plugin({name:"reject-native-payload-evaluation",setup(build){
      build.onLoad({filter:/AltMitteNativeCoreV169\\.ts$/},()=>({loader:"ts",contents:${JSON.stringify(wrapperFixtureSource)}}));
      build.onResolve({filter:/altMitteNativeV169Data(?:\\.ts)?$/},args=>({path:args.path,namespace:"native-payload"}));
      build.onLoad({filter:/.*/,namespace:"native-payload"},()=>{throw new Error("Native JSON evaluated during wrapper import");});
    }});
    const wrapper=await import(${JSON.stringify(fileURLToPath(wrapperUrl))});
    let guarded=false;
    try{wrapper.assertAltMitteNativeV169SourceReady();}catch(error){guarded=error.message.includes("preloadAltMitteNativeV169Source");}
    if(!guarded)throw new Error("Synchronous native construction must require preparation");
    console.log("native payload stayed deferred");
  `;
  const result = Bun.spawnSync([process.execPath, "--eval", script]);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("native payload stayed deferred");
});

const source = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
).text();
const parsed = ts.createSourceFile(
  "ThreeViewer.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const declaration = parsed.statements.find(
  (node) =>
    ts.isFunctionDeclaration(node) && node.name?.text === "ensureVoxelWorld",
)!;
const compiled = ts.transpileModule(
  declaration.getText(parsed).replaceAll("import.meta.env.DEV", "false")
    .replace('import("./RequiredSiteEnvelopesV209")', 'loadRequiredSiteEnvelopesV209()'),
  {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  },
).outputText;

for (const phase of ["native", "required-sites"] as const)
for (const cancellation of ["mode", "disposed", "signal", "failure"] as const) {
  test(`a pending ${phase} preload allocates no world when cancelled by ${cancellation}`, async () => {
    let resolveSource!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveSource = resolve;
    });
    const controller = new AbortController();
    const runtime = {
      disposed: false,
      loadSignal: controller.signal,
      worldFailureReported: false,
      tunnelPortalCourse: {},
      voxelWorldState: "idle",
      lightingMode: "minecraft",
      reportCoreProgress: () => {},
    };
    let preloads = 0, siteImports = 0,
      allocations = 0;
    const bindings = {
      fetchVoxelPayload: async () => ({}),
      fetchPrismPayload: async () => null,
      voxelWorldIntentActive: () => runtime.lightingMode === "minecraft",
      preloadAltMitteNativeV169Source: () => {
        preloads++;
        return phase === "native" ? pending : Promise.resolve();
      },
      loadRequiredSiteEnvelopesV209: () => {
        siteImports++;
        return pending;
      },
      Group: class {
        constructor() {
          allocations++;
        }
      },
    };
    const ensure = new Function(
      ...Object.keys(bindings),
      `${compiled}; return ensureVoxelWorld;`,
    )(...Object.values(bindings));
    ensure(runtime, () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preloads).toBe(1);
    expect(siteImports).toBe(phase === "native" ? 0 : 1);
    expect(allocations).toBe(0);
    if (cancellation === "mode") runtime.lightingMode = "day";
    else if (cancellation === "disposed") runtime.disposed = true;
    else if (cancellation === "signal") controller.abort();
    else runtime.worldFailureReported = true;
    resolveSource();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(allocations).toBe(0);
    expect(siteImports).toBe(phase === "native" ? 0 : 1);
    if (cancellation === "mode") expect(runtime.voxelWorldState).toBe("idle");
  });
}

test("concurrent native preloads share one import and all later factories use that prepared source", () => {
  const script = `
    import { plugin } from "bun";
    let loads=0;
    plugin({name:"bounded-native-source-fixture",setup(build){
      build.onLoad({filter:/AltMitteNativeCoreV169\\.ts$/},()=>({loader:"ts",contents:${JSON.stringify(wrapperFixtureSource)}}));
      build.onResolve({filter:/altMitteNativeV169Data(?:\\.ts)?$/},args=>({path:args.path,namespace:"native-fixture"}));
      build.onLoad({filter:/.*/,namespace:"native-fixture"},()=>{loads++;return{loader:"js",contents:'export default {schemaVersion:1,sourceParents:["native-fixture"],drawnChunks:[],minecraftChunks:[]};'};});
    }});
    const wrapper=await import(${JSON.stringify(fileURLToPath(wrapperUrl))});
    if(loads)throw new Error("Native data loaded too early");
    const a=wrapper.preloadAltMitteNativeV169Source(),b=wrapper.preloadAltMitteNativeV169Source();
    if(a!==b)throw new Error("Duplicate pending source import");
    await Promise.all([a,b]);
    await wrapper.preloadAltMitteNativeV169Source();
    wrapper.assertAltMitteNativeV169SourceReady();
    const root=wrapper.createMinecraftAltMitteCoreV169();
    if(loads!==1||root.userData.sourceParents[0]!=="native-fixture")throw new Error("Prepared source was not retained exactly once");
    console.log("one native import");
  `;
  const result = Bun.spawnSync([process.execPath, "--eval", script]);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("one native import");
});

test("a rejected native preload publishes nothing and uses the existing failure recovery", async () => {
  let allocations = 0,
    failures = 0,
    restored = 0;
  const warnings: string[] = [];
  const runtime = {
    disposed: false,
    loadSignal: new AbortController().signal,
    worldFailureReported: false,
    tunnelPortalCourse: {},
    voxelWorldState: "idle",
    reportCoreProgress: () => {},
    reportWorldFailure: () => {
      failures++;
    },
    underside: false,
  };
  const bindings = {
    fetchVoxelPayload: async () => ({}),
    fetchPrismPayload: async () => null,
    voxelWorldIntentActive: () => true,
    preloadAltMitteNativeV169Source: async () => {
      throw new Error("source unavailable");
    },
    Group: class {
      constructor() {
        allocations++;
      }
    },
    invalidateScenePresentation: () => {},
    restoreWorldPresentationAfterRollback: () => {
      restored++;
    },
    releaseFailedWorldPayloads: () => {},
    notifyPresentationReadyWhenPossible: () => {},
  };
  const ensure = new Function(
    ...Object.keys(bindings),
    `${compiled}; return ensureVoxelWorld;`,
  )(...Object.values(bindings));
  ensure(runtime, (message: string) => warnings.push(message));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(allocations).toBe(0);
  expect(failures).toBe(1);
  expect(restored).toBe(1);
  expect(warnings).toHaveLength(1);
  expect(runtime.voxelWorldState).toBe("failed");
});
