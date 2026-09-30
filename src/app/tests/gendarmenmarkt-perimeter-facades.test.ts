import { afterAll, describe, expect, test } from "bun:test";
import {
  Box3, BufferGeometry, Group, InstancedMesh, Material, Matrix4, Mesh,
  Raycaster, Vector3,
} from "three";
import source from "../src/gendarmenmarktPerimeterSource.json";
import {
  GendarmenmarktFacadeBuilder,
  perimeterEdgeLength,
  type PerimeterFacadeEdge,
} from "../src/GendarmenmarktFacadeBuilder";
import { createGendarmenmarktPerimeterFacades } from "../src/GendarmenmarktPerimeterFacades";
import {
  createGendarmenmarktPerimeterShells,
  createMinecraftGendarmenmarktPerimeterShells,
} from "../src/GendarmenmarktPerimeterShells";
import {
  gendarmenmarktPerimeterRoofAt,
  isGendarmenmarktPerimeterReplacementColumn,
} from "../src/gendarmenmarktPerimeterProfile";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import type { PrismPayload } from "../src/IsometricCityWorld";

type Probe = { edge: PerimeterFacadeEdge; center: [number, number, number]; width: number; height: number };
const probes: Probe[] = [];
const nativeProbes: Probe[] = [];
// Capture the real constructor's probes, then test its actual rendered geometry
// against the independent official shell. Restore the method even on failure.
const originalWindow = GendarmenmarktFacadeBuilder.prototype.window;
let drawn: Group;
let native: Group;
try {
  GendarmenmarktFacadeBuilder.prototype.window = function (...args: Parameters<typeof originalWindow>) {
    const before = this.windowProbes.length;
    originalWindow.apply(this, args);
    if (this.windowProbes.length > before) (this.minecraft ? nativeProbes : probes).push(this.windowProbes.at(-1)!);
  };
  drawn = createGendarmenmarktPerimeterFacades();
  native = createGendarmenmarktPerimeterFacades(true);
} finally {
  GendarmenmarktFacadeBuilder.prototype.window = originalWindow;
}
const shells = createGendarmenmarktPerimeterShells();
const nativeShells = createMinecraftGendarmenmarktPerimeterShells();
const roots = [drawn, native, shells, nativeShells];
for (const root of roots) root.updateMatrixWorld(true);

function meshes(root: Group): Mesh[] {
  const result: Mesh[] = [];
  root.traverse(object => { if (object instanceof Mesh) result.push(object); });
  return result;
}

function geometryBudget(root: Group) {
  let instances = 0, bytes = 0;
  const geometries = new Set<BufferGeometry>();
  for (const mesh of meshes(root)) {
    if (mesh instanceof InstancedMesh) {
      instances += mesh.count;
      bytes += mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0);
    }
    if (geometries.has(mesh.geometry)) continue;
    geometries.add(mesh.geometry);
    bytes += Object.values(mesh.geometry.attributes).reduce((sum, a) => sum + a.array.byteLength, 0);
    bytes += mesh.geometry.index?.array.byteLength ?? 0;
  }
  return { draws: meshes(root).length, instances, bytes };
}

afterAll(() => {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
  for (const root of roots) for (const mesh of meshes(root)) {
    geometries.add(mesh.geometry);
    for (const material of [mesh.userData.dayMaterial, mesh.userData.nightMaterial]) {
      if (material instanceof Material) materials.add(material);
    }
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
});

describe("Gendarmenmarkt perimeter facades and retained source envelopes", () => {
  test("constructs every source family in both representations without dropping fronts", () => {
    const keys = source.buildings.map(b => b.key).sort();
    for (const root of [drawn, native]) {
      expect(root.children.map(c => c.userData.buildingKey).sort()).toEqual(keys);
      expect(root.userData.sourceBound).toBeTrue();
      expect(root.userData.fullAndMobileIdentical).toBeTrue();
      expect(root.userData.photographsBundled).toBeFalse();
      for (const child of root.children) {
        const building = source.buildings.find(b => b.key === child.userData.buildingKey)!;
        expect(child.userData.sourcePrismIds).toEqual(building.prismIds);
        expect(child.userData.sourceFacadeCount).toBeGreaterThanOrEqual(building.streetFronts.filter(e =>
          perimeterEdgeLength(e) > 1.7 && e.wallTopY - e.wallBaseY > 2).length);
        expect(child.userData.sourceFacadeCount).toBeLessThanOrEqual(building.streetFronts.length);
        expect(child.userData.sourceFacadeCount).toBe(native.children.find(c =>
          c.userData.buildingKey === building.key)!.userData.sourceFacadeCount);
        expect(child.userData.windowCount).toBeGreaterThan(0);
      }
    }
    expect(native.userData.blockNative).toBeTrue();
    expect(native.userData.keepInMinecraft).toBeTrue();
    expect(nativeShells.userData.surfaceOnly).toBeTrue();
    expect(nativeShells.userData.hiddenSolidInfill).toBeFalse();
  });

  test("has finite static geometry, positive instances, and no photographic or generated textures", () => {
    const matrix = new Matrix4();
    for (const root of roots) {
      root.traverse(object => expect(object.matrixAutoUpdate).toBeFalse());
      for (const mesh of meshes(root)) {
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        for (const attribute of Object.values(mesh.geometry.attributes)) {
          expect(Array.from(attribute.array).every(Number.isFinite)).toBeTrue();
        }
        for (const material of [mesh.userData.dayMaterial, mesh.userData.nightMaterial]) {
          expect(material).toBeInstanceOf(Material);
          expect(Object.values(material).some(value => value?.isTexture === true)).toBeFalse();
        }
        expect(mesh.frustumCulled).toBeTrue();
        if (!(mesh instanceof InstancedMesh)) continue;
        expect(mesh.count).toBeGreaterThan(0);
        expect(mesh.instanceMatrix.count).toBe(mesh.count);
        expect(mesh.instanceColor?.count).toBe(mesh.count);
        expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix);
          expect(Math.abs(matrix.determinant())).toBeGreaterThan(1e-8);
        }
      }
    }
  });

  test("keeps each facade close to its measured family instead of bridging adjacent blocks", () => {
    for (const root of [drawn, native]) for (const child of root.children) {
      const building = source.buildings.find(b => b.key === child.userData.buildingKey)!;
      const bounds = new Box3().setFromObject(child);
      const [x0, z0, x1, z1] = building.sourceBbox;
      // Includes the measured-entry canopy, cornices and native skin clearance.
      expect(bounds.min.x).toBeGreaterThan(x0 - 5);
      expect(bounds.min.z).toBeGreaterThan(z0 - 5);
      expect(bounds.max.x).toBeLessThan(x1 + 5);
      expect(bounds.max.z).toBeLessThan(z1 + 5);
      const top = Math.max(...building.officialParts.map(p => p.top_y_m)) + building.displayYTranslationM;
      const base = Math.min(...building.officialParts.map(p => p.ground_y_m)) + building.displayYTranslationM;
      expect(bounds.min.y).toBeGreaterThanOrEqual(base - .1);
      expect(bounds.max.y).toBeLessThan(top + 1.1);
    }
  });

  test("retains every official family roof height in the full shell", () => {
    for (const building of source.buildings) {
      const family = shells.children.filter(c => c.userData.buildingKey === building.key);
      expect(family.length).toBeGreaterThan(0);
      const bounds = new Box3();
      for (const child of family) bounds.union(new Box3().setFromObject(child));
      const top = Math.max(...building.officialParts.map(p => p.top_y_m)) + building.displayYTranslationM;
      expect(bounds.max.y).toBeCloseTo(top, 3);
      expect(bounds.min.x).toBeCloseTo(building.sourceBbox[0], 3);
      expect(bounds.max.z).toBeCloseTo(building.sourceBbox[3], 3);
    }
  });

  test("street panes are visible from outside before the official source wall", () => {
    const familyByEdge = new Map<PerimeterFacadeEdge, string>(source.buildings.flatMap(building =>
      building.streetFronts.map(edge => [edge, building.key] as const)));
    const byEdge = new Map<PerimeterFacadeEdge, Probe[]>();
    for (const probe of probes) {
      const list = byEdge.get(probe.edge) ?? [];
      list.push(probe); byEdge.set(probe.edge, list);
    }
    const checkedFamilies = new Set<string>();
    const failures: string[] = [];
    for (const [edge, list] of byEdge) {
      const key = familyByEdge.get(edge)!;
      const family = drawn.children.find(c => c.userData.buildingKey === key)!;
      const glass = meshes(family as Group).filter(m => m.name.endsWith("glass"));
      const sourceFamily = shells.children.filter(c => c.userData.buildingKey === key);
      const length = perimeterEdgeLength(edge);
      const tangent = new Vector3((edge.endXZ[0] - edge.startXZ[0]) / length, 0,
        (edge.endXZ[1] - edge.startXZ[1]) / length);
      const normal = new Vector3(-tangent.z * edge.outwardSide, 0, tangent.x * edge.outwardSide);
      // First/middle/last samples catch clipped upper walls and both edge ends.
      for (const probe of new Set([list[0], list[Math.floor(list.length / 2)], list.at(-1)!])) {
        const point = new Vector3(...probe.center).addScaledVector(tangent, probe.width * .18);
        point.y -= probe.height * .28; // Avoid crossbars and the narrowing arch crown.
        const ray = new Raycaster(point.clone().addScaledVector(normal, 3), normal.clone().negate(), 0, 8);
        const pane = ray.intersectObjects(glass, false)[0];
        const wall = ray.intersectObjects(sourceFamily, false)[0];
        if (!pane || (wall && pane.distance >= wall.distance - .04)) {
          failures.push(`${key}:${edge.prismId} y=${point.y.toFixed(2)} pane=${pane?.distance} wall=${wall?.distance}`);
        }
        checkedFamilies.add(key);
      }
    }
    expect(checkedFamilies.size).toBeGreaterThanOrEqual(14); // Ribbon facades bypass individual windows.
    expect(failures).toEqual([]);
  });

  test("native panes stay outside the retained voxel skin, including curved corner frontages", () => {
    const glass = native.children.flatMap(family => meshes(family as Group).filter(m => m.name.endsWith("glass")));
    const byEdge = new Map<PerimeterFacadeEdge, Probe[]>();
    for (const probe of nativeProbes) {
      const list = byEdge.get(probe.edge) ?? [];
      list.push(probe); byEdge.set(probe.edge, list);
    }
    const failures: string[] = [];
    let count = 0;
    for (const [edge, list] of byEdge) {
      const length = perimeterEdgeLength(edge);
      const tangent = new Vector3((edge.endXZ[0] - edge.startXZ[0]) / length, 0,
        (edge.endXZ[1] - edge.startXZ[1]) / length);
      const normal = new Vector3(-tangent.z * edge.outwardSide, 0, tangent.x * edge.outwardSide);
      for (const probe of new Set([list[0], list[Math.floor(list.length / 2)], list.at(-1)!])) {
        const point = new Vector3(...probe.center).addScaledVector(tangent, probe.width * .18);
        point.y -= probe.height * .28;
        const ray = new Raycaster(point.clone().addScaledVector(normal, 3), normal.clone().negate(), 0, 8);
        const pane = ray.intersectObjects(glass, false)[0];
        const wall = ray.intersectObject(nativeShells, true)[0];
        if (!pane || (wall && pane.distance >= wall.distance - .04)) {
          failures.push(`${edge.prismId} y=${point.y.toFixed(2)} pane=${pane?.distance} wall=${wall?.distance}`);
        }
        count++;
      }
    }
    expect(count).toBeGreaterThan(350);
    expect(failures).toEqual([]);
  });

  test("suppresses legacy coarse skins even where their footprints differ from the new source", () => {
    // Inside former dm-prisms 57099374 and -1988439, outside the new metre rings.
    expect(isGendarmenmarktPerimeterReplacementColumn(1332.5, 431.5)).toBeTrue();
    expect(isGendarmenmarktPerimeterReplacementColumn(1491.425, 799.425)).toBeTrue();
    // The public square, neighbouring streets, and unrelated city remain intact.
    for (const [x, z] of [[1415, 590], [1450, 715], [1350, 875], [0, 0]]) {
      expect(isGendarmenmarktPerimeterReplacementColumn(x, z)).toBeFalse();
    }
  });

  test("pedestrian replacement preserves three open courts and the covered Hotel Luc court", () => {
    const buildings = source.buildings.flatMap(b => b.previousDisplayPrisms) as PrismPayload["buildings"];
    const obstacles = compilePedestrianObstacles({ buildings });
    expect(obstacles.buildingCount).toBe(source.buildings.reduce((n, b) => n + b.officialParts.length, 0));
    for (const [key, x, z] of [
      ["dentons", 1530, 820], ["quartier206", 1242, 631], ["hannsEisler", 1303, 638],
    ] as const) {
      const building = source.buildings.find(b => b.key === key)!;
      expect(gendarmenmarktPerimeterRoofAt(building, x, z)).toBeNull();
      expect(pedestrianPointIsBlocked(x, z, 5.2, obstacles)).toBeFalse();
    }
    const luc = source.buildings.find(b => b.key === "charlottenNorthwest")!;
    const x = 1299.2485, z = 522.002;
    const roof = gendarmenmarktPerimeterRoofAt(luc, x, z)!;
    const ray = new Raycaster(new Vector3(x, 60, z), new Vector3(0, -1, 0));
    const hit = ray.intersectObjects(shells.children.filter(c => c.userData.buildingKey === luc.key), false)[0];
    expect(hit.point.y).toBeCloseTo(roof, 3);
    expect(pedestrianPointIsBlocked(x, z, 5.2, obstacles)).toBeFalse();
    expect(pedestrianPointIsBlocked(x, z, roof - .5, obstacles)).toBeTrue();
    // An occupied Dentons street wing is blocked at its true metre location.
    expect(pedestrianPointIsBlocked(1495, 810, 5.2, obstacles)).toBeTrue();
    expect(pedestrianPointIsBlocked(149.5, 81, 5.2, obstacles)).toBeFalse();
  });

  test("keeps native geometry box-based and budgets bounded for all sixteen families", () => {
    for (const root of [native, nativeShells]) for (const mesh of meshes(root)) {
      expect(mesh).toBeInstanceOf(InstancedMesh);
      expect(mesh.geometry.type).toBe("BoxGeometry");
      expect(mesh.geometry.getAttribute("position").count).toBe(24);
      expect(mesh.geometry.index?.count).toBe(36);
    }
    const full = geometryBudget(drawn), blocks = geometryBudget(native);
    const shell = geometryBudget(shells), blockShell = geometryBudget(nativeShells);
    expect(full.draws).toBeLessThanOrEqual(50);
    expect(full.instances).toBeLessThan(32_000);
    expect(full.bytes).toBeLessThan(2_600_000);
    expect(blocks.draws).toBeLessThanOrEqual(32);
    expect(blocks.instances).toBeLessThan(25_000);
    expect(blocks.bytes).toBeLessThan(1_900_000);
    expect(shell.draws).toBeLessThanOrEqual(18);
    expect(shell.bytes).toBeLessThan(500_000);
    expect(blockShell.draws).toBe(1);
    expect(blockShell.instances).toBeLessThan(24_000);
    expect(blockShell.bytes).toBeLessThan(1_850_000);
  });
});
