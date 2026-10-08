import { expect, test } from "bun:test";
import ts from "typescript";

const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function factory(name: string, overrides: Record<string, unknown>) {
  const node = parsed.statements.find(entry => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  if (!node) throw new Error(`Missing production factory ${name}`);
  const bindings: Record<string, unknown> = {};
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const key = node.expression.text;
      bindings[key] = /(?:FloorAt|GroundAt|SurfaceAt|HeightAt)$/.test(key) ? () => null : () => false;
    }
    ts.forEachChild(node, visit);
  };
  visit(node);
  Object.assign(bindings, overrides);
  const code = ts.transpileModule(node.getText(parsed), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), `${code}; return ${name};`)(...Object.values(bindings));
}

for (const native of [false, true]) {
  test(`${native ? "native" : "drawn"} navigation callbacks stay live after construction returns`, () => {
    const environment: any = { groundAt: () => 17, water: [] };
    const runtime: any = { lightingMode: native ? "minecraft" : "day", coarsePointer: true, tunnelPortalCourse: {}, schwellenraumPraesentation: {} };
    const ground = { cell_m: 4, grid: { min_x_idx: 5, min_z_idx: -8 } };
    const surfaces = { water: [] }, prisms = { buildings: [] };
    const argumentsSeen: unknown[][] = [], floorHints: number[] = [];
    let medianSampler: ((x: number, z: number) => number) | undefined;
    const prepare = factory(native ? "prepareVoxelNavigation" : "prepareIsoNavigation", {
      createPedestrianEnvironment: (...args: unknown[]) => { argumentsSeen.push(args); return environment; },
      surroundingPedestrianExtension: () => "surrounding exact policy",
      createSpreebogenLawnGroundAt: () => () => null,
      createPedestrianParkTreeSolidTester: (_cell: number, _profile: string, active: () => boolean) => active,
      createSchwellenraumMemorialProtectionIndex: () => ({}),
      createArdHauptstadtstudioRoofCollision: () => null,
      createHistoricParkBridgeCollision: () => ({ solidAt: () => false }),
      createSchwellenraumStaticPropCollision: () => () => false,
      smoothGroundTopSampler: () => (x: number, z: number) => x * 10 + z,
      deriveUnterDenLindenMedianSamples: () => ["median sample"],
      installUnterDenLindenMedianSamples: (_root: unknown, _samples: unknown, sampler: (x: number, z: number) => number) => { medianSampler = sampler; },
      publishedNavigationMode: (mode: string) => mode,
      voxelModeActive: (current: typeof runtime) => current.lightingMode === "minecraft",
      minecraftHeroCollisionEnabled: (mode: string) => mode === "minecraft",
      minecraftHeroSolidAt: () => true,
      minecraftHeroGroundAt: () => 20,
      visualModeWalkableInteriorAt: (_mode: string, x: number) => x === 3,
      spreebogenWalkSurfaceAt: (_x: number, _z: number, hint: number) => { floorHints.push(hint); return null; },
    });
    const result = native ? prepare(runtime, ground, prisms) : prepare(runtime, ground, surfaces, prisms, []);
    const published = native ? result : result.environment;
    expect(published).toBe(environment);
    expect(argumentsSeen[0][0]).toBe(ground);
    expect(argumentsSeen[0][2]).toBe(runtime.tunnelPortalCourse);
    expect(argumentsSeen[0][3]).toBe(prisms);
    expect(argumentsSeen[0][4]).toBe("surrounding exact policy");
    expect(published.visualMode()).toBe(runtime.lightingMode);
    runtime.lightingMode = "minecraft";
    expect(published.visualMode()).toBe("minecraft");
    expect(published.parkTreeSolidAt()).toBe(true);
    expect(published.interiorSolidAt(1, 2, 3, 0.5)).toBe(true);
    runtime.tunnelInteriorAt = () => true;
    expect(published.interiorSolidAt(1, 2, 3, 0.5)).toBe(false);
    expect(published.walkableInteriorAt(1, 2, 3, "building")).toBe(true);
    runtime.tunnelInteriorAt = () => false;
    expect(published.walkableInteriorAt(3, 2, 3, "building")).toBe(true);
    expect(published.walkableInteriorAt(4, 2, 3, "building")).toBe(false);
    expect(published.interiorGroundAt(1, 2)).toBe(20);
    expect(floorHints.at(-1)).toBe(17);
    runtime.lightingMode = "day";
    expect(published.interiorGroundAt(1, 2, 9)).toBe(null);
    expect(floorHints.at(-1)).toBe(9);
    if (!native) {
      result.installWorldDetails();
      expect(medianSampler!(24, -28)).toBe(11);
    }
  });
}

test("district path factory keeps steps, portals, out-of-scope paths and original higher surfaces", () => {
  const prepare = factory("prepareDistrictPathTerrain", {
    districtStreetTerrainSampler: () => () => 12,
    createCoreParkPathTerrainSampler: () => (_path: unknown, _x: number, _z: number, sourceY: number) => sourceY,
    createTunnelPortalApproachTester: () => (_x: number, z: number) => z === 0,
    districtPathMayFollowTerrain: (id: string) => id === "mapped",
    pointInDistrictStreetScope: (x: number) => x > 0,
  });
  const sample = prepare({}, {});
  expect(sample({ kind: "footway", id: "mapped" }, 1, 2, 3)).toBe(12);
  expect(sample({ kind: "footway", id: "mapped" }, 1, 2, 20)).toBe(20);
  for (const [path, x, z] of [
    [{ kind: "steps", id: "mapped" }, 1, 2], [{ kind: "footway", id: "other" }, 1, 2],
    [{ kind: "footway", id: "mapped" }, -1, 2], [{ kind: "footway", id: "mapped" }, 1, 0],
  ] as const) expect(sample(path, x, z, 3)).toBe(3);
});

for (const outcome of ["success", "disposed", "replaced", "failed"] as const) {
  test(`deferred shoreline ${outcome} requests once, prevents stale publication and releases the exact request`, async () => {
    const environment = { water: ["original"] }, runtime = { disposed: false, pedestrian: { environment } };
    let finish!: (value: unknown) => void, reject!: (error: Error) => void;
    const request = new Promise((resolve, rejectRequest) => { finish = resolve; reject = rejectRequest; });
    const released: unknown[] = [];
    let fetches = 0, compiles = 0;
    const create = factory("createDeferredPedestrianWater", {
      fetchSurfacePayload: () => { fetches++; return request; },
      compilePedestrianWater: (surfaces: unknown) => { expect(surfaces).toEqual({ water: ["shoreline"] }); compiles++; return ["compiled"]; },
      releaseCompiledSurfacePayload: (current: unknown, value: unknown) => { expect(current).toBe(runtime); released.push(value); },
    });
    const load = create(runtime, environment);
    expect(fetches).toBe(0);
    load(); load(); expect(fetches).toBe(1);
    if (outcome === "disposed") runtime.disposed = true;
    if (outcome === "replaced") runtime.pedestrian.environment = { water: ["replacement"] };
    if (outcome === "failed") reject(new Error("source unavailable"));
    else finish({ water: ["shoreline"] });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(compiles).toBe(outcome === "success" ? 1 : 0);
    expect(environment.water).toEqual(outcome === "success" ? ["compiled"] : ["original"]);
    expect(released).toEqual([request]);
    load(); expect(fetches).toBe(1);
  });
}
