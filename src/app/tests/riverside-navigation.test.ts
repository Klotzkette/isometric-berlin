import { describe, expect, test } from "bun:test";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import ts from "typescript";
import { createBridgeStructures, type PrismPayload } from "../src/IsometricCityWorld";
import { type VoxelPayload } from "../src/MinecraftVoxelWorld";
import { createZollpackhofDetails, createMinecraftZollpackhofDetails } from "../src/ZollpackhofDetails";
import { ZOLLPACKHOF_PARTS, zollpackhofDisplayTopAt } from "../src/zollpackhofProfile";
import { fitZollpackhofRoof } from "../src/zollpackhofRoof";
import { compilePedestrianObstacles, createPedestrianState, pedestrianPointIsBlocked,
  type PedestrianEnvironment, type PedestrianPolygonObstacle } from "../src/pedestrianNavigation";
import type { VisualMode } from "../src/visualMode";

const prisms = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
const viewer = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();

describe("riverside represented floors and roofs", () => {
  test("Zollpackhof retains source plans but no invisible tall wall in any mode", () => {
    let mode: VisualMode = "day";
    const obstacles = compilePedestrianObstacles(prisms, () => mode);
    const indexed = [...new Set([...obstacles.cells.values()].flat())]
      .filter((o): o is PedestrianPolygonObstacle => o.kind === "polygon");
    const environment: PedestrianEnvironment = {
      bounds: { minX: -400, maxX: -200, minZ: -400, maxZ: -200 },
      groundAt: () => 5.5, obstacles, water: [],
    };
    for (const part of ZOLLPACKHOF_PARTS) {
      const source = prisms.buildings.find(({ id }) => id === part.id)!;
      const obstacle = indexed.find(({ sourceId }) => sourceId === part.id)!;
      expect(obstacle.ring).toBe(source.ring);
      expect(source.h_dm / 10).toBeGreaterThan(part.wallHeightM + part.roofRiseM + 8);
      const rect = fitZollpackhofRoof(part.ring.map(([x, z]) => [x, z]))!;
      const [x, z] = rect.center;
      for (mode of ["day", "night", "snowstorm", "minecraft", "schwellenraum"] as const) {
        const top = zollpackhofDisplayTopAt(x, z, mode === "minecraft")!;
        expect(top).toBeLessThan(15);
        expect(pedestrianPointIsBlocked(x, z, 6, obstacles)).toBeTrue();
        expect(pedestrianPointIsBlocked(x, z, 20, obstacles)).toBeFalse();
        const state = createPedestrianState(environment,
          { x, z, yaw: 0, groundYHint: 40, preserveHorizontalPosition: true });
        expect([state.x, state.z]).toEqual([x, z]);
        expect(state.groundY).toBeCloseTo(top, 5);
      }
    }
  });

  test("roof collision agrees with actual drawn and block roof surfaces", () => {
    for (const minecraft of [false, true]) {
      const root = minecraft ? createMinecraftZollpackhofDetails() : createZollpackhofDetails();
      root.updateMatrixWorld(true);
      for (const part of ZOLLPACKHOF_PARTS) {
        const rect = fitZollpackhofRoof(part.ring.map(([x, z]) => [x, z]))!;
        for (const u of [-0.3, 0.1, 0.35]) for (const v of [-0.4, 0.15, 0.45]) {
          const x = rect.center[0] + rect.axis[0] * u * rect.halfLength - rect.axis[1] * v * rect.halfWidth;
          const z = rect.center[1] + rect.axis[1] * u * rect.halfLength + rect.axis[0] * v * rect.halfWidth;
          const height = zollpackhofDisplayTopAt(x, z, minecraft)!;
          const hit = new Raycaster(new Vector3(x, 25, z), new Vector3(0, -1, 0)).intersectObject(root, true)
            .find((entry) => entry.object instanceof Mesh);
          expect(hit).toBeDefined();
          expect(hit!.point.y).toBeCloseTo(height, 3);
        }
      }
      root.traverse((o) => { if (o instanceof Mesh) o.geometry.dispose(); });
    }
  });

  test("shared decks survive cold Minecraft startup, with only Sandkrug's smooth replacement hidden", () => {
    const source = ts.createSourceFile("ThreeViewer.tsx", viewer, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const presentation = source.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "setSandkrugBridgePresentation")!;
    const code = ts.transpileModule(presentation.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const apply = new Function(`${code}; return setSandkrugBridgePresentation;`)() as (root: Group, mode: VisualMode) => void;
    const root = createBridgeStructures(ground, "mobile")!;
    const bridge = root.getObjectByName("Sandkrugbrücke drawn architecture")!;
    expect(bridge).toBeDefined();
    for (const mode of ["minecraft", "day", "night", "minecraft", "snowstorm", "schwellenraum"] as const) {
      apply(root, mode);
      expect(root.visible).toBeTrue();
      expect(bridge.visible).toBe(mode !== "minecraft");
      expect(root.children.filter((child) => child !== bridge).every((child) => child.visible)).toBeTrue();
    }
    const cold = viewer.slice(viewer.indexOf("function ensureVoxelWorld("));
    expect(cold.indexOf("provisionalBridges = createBridgeStructures(")).toBeLessThan(cold.indexOf("runtime.voxelWorld = provisionalVoxelWorld"));
    expect(cold.indexOf("runtime.signatures.add(provisionalBridges)")).toBeLessThan(cold.indexOf("setSceneLighting(runtime"));
    expect(cold).toContain("disposeObject3D(runtime, provisionalBridges)");
    expect(viewer).toContain('bridgeStructures: !runtime.signatures.getObjectByName("drawn bridge structures")');
  });
});
