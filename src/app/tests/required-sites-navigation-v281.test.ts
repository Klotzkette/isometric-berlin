import { expect, test } from "bun:test";
import ts from "typescript";

// Run the production navigation closures without importing the complete city.
const navigation = ts.createSourceFile("pedestrianNavigation.ts",
  await Bun.file(new URL("../src/pedestrianNavigation.ts", import.meta.url)).text(),
  ts.ScriptTarget.Latest, true);
const viewer = ts.createSourceFile("ThreeViewer.tsx",
  await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text(),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function declaration(source: ts.SourceFile, name: string): ts.FunctionDeclaration {
  const result = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  if (!result || !ts.isFunctionDeclaration(result)) throw new Error(`Missing ${name}`);
  return result;
}

function bind(names: string[], values: Record<string, unknown>) {
  const code = ts.transpileModule(names.map(name =>
    declaration(navigation, name).getText(navigation).replace(/^export\s+/, "")).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(values), `${code}\nreturn ${names.at(-1)}`)(...Object.values(values));
}

test("absent required sites never add global solids; present sites receive the current family and capsule", () => {
  for (const native of [false, true]) for (const target of ["welt", "pekinger", "coal", "prison"]) {
    const calls: [string, number[]][] = [];
    const blocked = bind(["pedestrianBodyTouchesInteriorSolid", "pedestrianPointIsBlocked"], {
      PEDESTRIAN_EYE_HEIGHT_M: 1.8, PEDESTRIAN_BODY_RADIUS_M: .42,
      weltkugelBodyBlockedV281: (...args: number[]) => {
        calls.push(["welt", args]); return target === "welt";
      },
      moabitCoalBodyBlockedV281: (...args: number[]) => {
        calls.push(["coal", args]); return target === "coal";
      },
      pekingerTablesBlockedV281: (...args: number[]) => {
        calls.push(["pekinger", args]); return target === "pekinger";
      },
      prisonEnclosuresV281SolidAt: (...args: number[]) => {
        calls.push(["prison", args]); return Math.abs(args[1] - 7.9) < .001;
      },
    });
    const access = { requiredSitesV281: false, visualMode: () => native ? "minecraft" : "day" };
    expect(blocked(20, 30, 7, undefined)).toBe(false);
    expect(blocked(20, 30, 7, undefined, {})).toBe(false);
    expect(blocked(20, 30, 7, undefined, access)).toBe(false);
    expect(calls).toHaveLength(0);
    access.requiredSitesV281 = true;
    expect(blocked(20, 30, 7, undefined, access)).toBe(true);
    const last = calls.at(-1)!;
    expect(last[0]).toBe(target);
    if (target === "prison") {
      expect(last[1]).toEqual([20, 7.9, 30, .42, native]);
      expect(calls.filter(([kind]) => kind === "prison")).toHaveLength(2);
    } else {
      expect(last[1]).toEqual(target === "welt"
        ? [20, 30, 7, 8.8, .42] : [20, 30, 7, 8.8, .42, native]);
    }
    calls.length = 0;
    access.requiredSitesV281 = false;
    expect(blocked(20, 30, 7, undefined, access)).toBe(false);
    expect(calls).toHaveLength(0);
  }
});

test("partial environments retain their ground and holes until required sites are present", () => {
  for (const native of [false, true]) for (const outer of [false, true]) {
    let base = 4, coal: number | null = 9, memorial = 7, pekinger = 6;
    const families: boolean[] = [];
    const create = bind(["createPedestrianEnvironment"], {
      PEDESTRIAN_BODY_RADIUS_M: .42,
      smoothGroundTopSampler: () => () => base,
      compilePedestrianWater: () => [], createPedestrianBridgeGround: () => () => null,
      hbfNorthRailGroundAt: () => null, topographySiteSurfaceAt: () => null,
      invalidenEntryFloorV257At: () => null,
      steglitzGroundV247At: () => null, steglitzCourtGroundV251Height: () => null,
      spreebogenTerrainYAt: (_x: number, _z: number, y: number) => y,
      moabitCoalFloorV281At: (_x: number, _z: number, isNative: boolean) => {
        families.push(isNative); return coal;
      },
      bmfForecourtFloorV281: (_x: number, _z: number, isNative: boolean) => {
        families.push(isNative); return memorial;
      },
      pekingerPlatzFloorV281At: (_x: number, _z: number, isNative: boolean) => {
        families.push(isNative); return pekinger;
      },
    });
    const ground = { cell_m: 1, grid: { cols: 10, rows: 10, min_x_idx: 0, min_z_idx: 0 } };
    const extension = outer ? {
      bounds: { minX: 0, minZ: 0, maxX: 20, maxZ: 20 },
      groundAt: (x: number, z: number) => x < 20 && z < 20 ? base : null,
    } : undefined;
    const environment = create(ground, { water: [] }, undefined, undefined, extension);
    const x = outer ? 15 : 5;
    environment.visualMode = () => native ? "minecraft" : "day";
    expect(environment.requiredSitesV281).toBe(false);
    expect(environment.groundAt(x, x)).toBe(4);
    expect(families).toHaveLength(0);
    environment.requiredSitesV281 = true;
    expect(environment.groundAt(x, x)).toBe(9);
    expect(families.every(value => value === native)).toBe(true);
    coal = null;
    expect(environment.groundAt(x, x)).toBe(outer ? 4 : 7);
    pekinger = 8;
    expect(environment.groundAt(x, x)).toBe(outer ? 4 : 8);
    base = 12;
    expect(environment.groundAt(x, x)).toBe(12);
    expect(environment.groundAt(25, 25)).toBeNull();
    base = 4; memorial = 15; coal = 16;
    environment.requiredSitesV281 = false;
    expect(environment.groundAt(x, x)).toBe(4);
    const explicit = create(ground, { water: [] }, undefined, undefined, undefined,
      { requiredSitesV281: true });
    expect(explicit.requiredSitesV281).toBe(true);
    expect(explicit.groundAt(5, 5)).toBe(16);
  }
});

test("both real prepare paths activate required navigation only inside completed world transactions", () => {
  for (const name of ["prepareIsoNavigation", "prepareVoxelNavigation"]) {
    const body = declaration(viewer, name).getText(viewer);
    expect(body).toContain("{ requiredSitesV281: true,");
  }
  const isoPrepare = declaration(viewer, "prepareIsoNavigation").getText(viewer);
  expect(isoPrepare).toContain("pedestrianEnvironment.requiredSitesV281 = false;");
  const ordered = (fragments: string[]) => {
    let position = -1;
    for (const fragment of fragments) {
      const next = viewer.text.indexOf(fragment, position + 1);
      expect(next).toBeGreaterThan(position);
      position = next;
    }
  };
  ordered([
    "provisionalPedestrianEnvironment = navigation.environment;",
    "yield* sitesV209.addRequiredSiteEnvelopesV209Steps(isoWorld);",
    "provisionalPedestrianEnvironment.requiredSitesV281 = true;",
    "runtime.isoWorld = isoWorld;",
    "runtime.pedestrian.environment = provisionalPedestrianEnvironment;",
  ]);
  ordered([
    "await completeCooperatively(sitesV209.addRequiredSiteEnvelopesV209Steps(provisionalVoxelWorld, true)",
    "provisionalEnvironment = prepareVoxelNavigation(runtime, payload, prisms);",
    "runtime.voxelWorld = provisionalVoxelWorld;",
    "runtime.pedestrian.environment = provisionalEnvironment;",
  ]);
  const compile = declaration(navigation, "compilePedestrianObstacles").getText(navigation);
  expect(compile).toContain("if (options.requiredSitesV281 && isWeltkugelSourceV281(sourceBuilding)) continue;");
  expect(compile).toContain("for (const wall of options.requiredSitesV281 ? UBAHN_BARRIERS_V281 : [])");
});
