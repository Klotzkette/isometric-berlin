import { describe, expect, test } from "bun:test";
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
} from "three";
import {
  createFiftyHertzArchitecture,
  createMinecraftFiftyHertzArchitecture,
  fiftyHertzWalls,
} from "../src/FiftyHertzArchitecture";
import {
  FIFTY_HERTZ_IDS,
  FIFTY_HERTZ_SOURCE as S,
  fiftyHertzExtensionSolidAt,
  fiftyHertzInRing,
  fiftyHertzRoofAt,
  fiftyHertzSourceColumnAt,
} from "../src/fiftyHertzProfile";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import sourcePrisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxels from "../public/mesh/regierungsviertel/minecraft-voxels.json";

type Column = { x: number; z: number; low: number; high: number };
const columns: Column[] = [];
voxels.building_rows.forEach((row, zi) => {
  const z = (voxels.grid.min_z_idx + zi + 0.5) * voxels.cell_m;
  if (z < -1145 || z > -1010) return;
  for (const [xi, n, low, high] of row)
    for (let i = 0; i < n; i += 1) {
      const x = (voxels.grid.min_x_idx + xi + i + 0.5) * voxels.cell_m;
      if (x < -96 || x > 10) continue;
      columns.push({ x, z, low: low / 10, high: high / 10 });
    }
});
function keptColumns(): InstancedMesh {
  const keep = columns.filter(
    (c) => !fiftyHertzSourceColumnAt(c.x, c.z, c.low, c.high, voxels.cell_m),
  );
  const mesh = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial(),
    keep.length,
  );
  const m = new Matrix4();
  keep.forEach((c, i) =>
    mesh.setMatrixAt(
      i,
      m
        .makeScale(4, c.high - c.low, 4)
        .setPosition(c.x, (c.high + c.low) / 2, c.z),
    ),
  );
  mesh.name = "retained actual source columns";
  mesh.computeBoundingSphere();
  return mesh;
}

describe("50Hertz source ownership and current architecture", () => {
  test("preserves the original extension record while replacing its complete older renderer", () => {
    const original = sourcePrisms.buildings.find((p) => p.id === "24022429")!;
    expect(S.extension_source).toEqual(original);
    expect(S.extension.id).toBe(original.id);
    expect(S.extension_source.h_dm).toBe(210);
    expect(S.extension.h_dm).toBe(310);
    expect(FIFTY_HERTZ_IDS.has("24022429")).toBe(true);
    let oldExtensionColumns = 0;
    for (const c of columns) {
      if (!fiftyHertzInRing(S.extension_source.ring, c.x * 10, c.z * 10))
        continue;
      expect(fiftyHertzSourceColumnAt(c.x, c.z, c.low, c.high, 4)).toBe(true);
      oldExtensionColumns += 1;
    }
    expect(oldExtensionColumns).toBeGreaterThan(60);
    // These four cells overlap the tower at their edges but belong to the independent low neighbour.
    for (const [x, z] of [
      [-34, -1026],
      [-30, -1026],
      [-42, -1022],
      [-50, -1018],
    ]) {
      const c = columns.find((p) => p.x === x && p.z === z)!;
      expect(c).toBeDefined();
      expect(fiftyHertzSourceColumnAt(c.x, c.z, c.low, c.high, 4)).toBe(false);
    }
    expect(fiftyHertzSourceColumnAt(-74, -1110, 4.4, 64.4, 4)).toBe(false);
  });

  test("glazing and braces remain in front of original source columns in both full/mobile renderings", () => {
    for (const mobileLike of [false, true])
      for (const minecraft of [false, true]) {
        const root = minecraft
          ? createMinecraftFiftyHertzArchitecture({
              mobileLike,
              diagnostics: true,
            })
          : createFiftyHertzArchitecture({ mobileLike, diagnostics: true });
        const scene = new Group();
        const columnsMesh = keptColumns();
        scene.add(root, columnsMesh);
        scene.updateMatrixWorld(true);
        const walls = fiftyHertzWalls();
        const selected = new Map<string, any>();
        for (const block of root.userData.blocks) {
          if (
            block.role !== "curtain wall pane" ||
            block.position[1] < 16 ||
            block.position[1] > 25
          )
            continue;
          const wall = walls.find(
            (w) =>
              w.part.id === block.sourceId &&
              Math.abs(
                (block.position[0] - w.a[0]) * w.nx +
                  (block.position[2] - w.a[1]) * w.nz -
                  0.07,
              ) < 0.015,
          );
          if (wall)
            selected.set(`${wall.part.id}:${wall.edge}`, { block, wall });
        }
        let checked = 0;
        for (const { block, wall } of selected.values()) {
          // Offset from the bay centre avoids the central mullion while remaining within the pane.
          const target = new Vector3(...block.position).add(
            new Vector3(wall.dx, 0, wall.dz).multiplyScalar(
              block.size[0] * 0.19,
            ),
          );
          const origin = target
            .clone()
            .add(new Vector3(wall.nx, 0, wall.nz).multiplyScalar(2.1));
          const ray = new Raycaster(
            origin,
            target.clone().sub(origin).normalize(),
            0,
            2.4,
          );
          const ownHits = ray.intersectObject(root, true);
          expect(ownHits.length).toBeGreaterThan(0);
          const retainedHits = ray.intersectObject(columnsMesh, false);
          if (retainedHits.length)
            expect(retainedHits[0].distance).toBeGreaterThan(
              ownHits[0].distance + 0.01,
            );
          checked += 1;
        }
        expect(checked).toBeGreaterThanOrEqual(10);
      }
  });

  test("Night and moonlight switch every material without making the white structure emissive", () => {
    const root = createFiftyHertzArchitecture();
    const meshes: Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof Mesh) meshes.push(o);
    });
    expect(meshes).toHaveLength(2);
    setIsoNightPresentation(root, true);
    for (const mesh of meshes) {
      expect(mesh.material).toBe(mesh.userData.nightMaterial);
      expect((mesh.material as MeshStandardMaterial).emissive.getHex()).toBe(0);
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    }
    setIsoNightPresentation(root, true, false);
    for (const mesh of meshes)
      expect(mesh.material).toBe(mesh.userData.moonlitMaterial);
    setIsoNightPresentation(root, false);
    for (const mesh of meshes)
      expect(mesh.material).toBe(mesh.userData.dayMaterial);
  });

  test("the extended height is solid but the adjacent street and open rear area remain accessible", () => {
    expect(fiftyHertzExtensionSolidAt(-70, 29, -1108, 1.8, 0.2)).toBe(true);
    expect(fiftyHertzRoofAt(-70, -1108, "24022429")).toBe(35.5);
    expect(fiftyHertzExtensionSolidAt(-100, 5.2, -1108, 1.8, 0.2)).toBe(false);
    expect(fiftyHertzExtensionSolidAt(-20, 5.2, -1108, 1.8, 0.2)).toBe(false);
  });
});
