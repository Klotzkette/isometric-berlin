import { beforeAll, describe, expect, test } from "bun:test";
import {
  Box3,
  BufferGeometry,
  Group,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";

import groundJson from "../public/mesh/regierungsviertel/ground-context.json";
import {
  smoothGroundTopSampler,
  type VoxelPayload,
} from "../src/MinecraftVoxelWorld";
import { createDistrictStreets } from "../src/DistrictStreets";

const ground = groundJson as unknown as VoxelPayload;
const sample = smoothGroundTopSampler(ground);
const terrainAt = (x: number, z: number): number =>
  sample(
    x / ground.cell_m - ground.grid.min_x_idx,
    z / ground.cell_m - ground.grid.min_z_idx,
  );

function geometryBytes(geometry: BufferGeometry): number {
  return (
    Object.values(geometry.attributes).reduce(
      (sum, attribute) => sum + attribute.array.byteLength,
      0,
    ) + (geometry.index?.array.byteLength ?? 0)
  );
}

function groundClearance(geometry: BufferGeometry): [number, number] {
  const position = geometry.getAttribute("position");
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    expect(Number.isFinite(x + y + z)).toBeTrue();
    const height = y - terrainAt(x, z);
    minimum = Math.min(minimum, height);
    maximum = Math.max(maximum, height);
  }
  return [minimum, maximum];
}

describe("bounded District streets in the drawn city", () => {
  let streets: Group;
  beforeAll(() => {
    streets = createDistrictStreets(ground);
  });

  test("retains continuous carriageways, mapped walkways and real kerb faces", () => {
    expect(streets.name).toBe("District streets and roadside paths");
    for (const name of [
      "District asphalt carriageways",
      "District mapped paved walkways",
      "District raised kerbstones",
    ]) {
      const mesh = streets.getObjectByName(name) as Mesh;
      expect(mesh).toBeInstanceOf(Mesh);
      expect(mesh.geometry.getAttribute("position").count).toBeGreaterThan(100);
      expect(mesh.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(mesh.userData.nightMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(mesh.material).toBe(mesh.userData.dayMaterial);
    }
    expect(streets.getObjectByName("District kerb ink")).toBeInstanceOf(
      LineSegments,
    );
    expect(streets.getObjectByName("District lane markings")).toBeDefined();
  });

  test("follows the retained terrain instead of using a floating flat plate", () => {
    const asphalt = streets.getObjectByName(
      "District asphalt carriageways",
    ) as Mesh;
    const walkways = streets.getObjectByName(
      "District mapped paved walkways",
    ) as Mesh;
    for (const mesh of [asphalt, walkways]) {
      const [minimum, maximum] = groundClearance(mesh.geometry);
      expect(minimum).toBeGreaterThan(0.04);
      expect(maximum).toBeLessThan(0.4);
      expect(maximum - minimum).toBeLessThan(0.01);
    }
    const bounds = new Box3().setFromObject(asphalt);
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(0.3);
  });

  test("makes the kerb an upstand above the road, with ink on its upper edge", () => {
    const asphalt = streets.getObjectByName(
      "District asphalt carriageways",
    ) as Mesh;
    const kerbs = streets.getObjectByName("District raised kerbstones") as Mesh;
    const ink = streets.getObjectByName("District kerb ink") as LineSegments;
    const [, roadTop] = groundClearance(asphalt.geometry);
    const [kerbBottom, kerbTop] = groundClearance(kerbs.geometry);
    const [inkBottom, inkTop] = groundClearance(ink.geometry);
    expect(kerbBottom).toBeLessThanOrEqual(roadTop + 0.03);
    expect(kerbTop - roadTop).toBeGreaterThan(0.05);
    expect(kerbTop - roadTop).toBeLessThan(0.3);
    expect(kerbTop - kerbBottom).toBeGreaterThan(0.05);
    // The upstand samples its centre grade; its two side faces are 11cm
    // away and can differ over sloping surveyed terrain. Ink stays on the
    // centre arris at road lift + 14cm + 8mm.
    expect(inkBottom).toBeCloseTo(0.328, 4);
    expect(inkTop).toBeCloseTo(0.328, 4);
    expect(inkTop).toBeLessThan(kerbTop + 0.04);
  });

  test("keeps the full street reading in five static, image-free batches", () => {
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    let drawables = 0;
    streets.traverse((object) => {
      if (!(object instanceof Mesh || object instanceof LineSegments)) return;
      drawables += 1;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        materials.add(material);
      }
    });
    const bytes = [...geometries].reduce(
      (sum, geometry) => sum + geometryBytes(geometry),
      0,
    );
    expect(drawables).toBe(5);
    expect(bytes).toBeGreaterThan(10_000);
    expect(bytes).toBeLessThan(25 * 1024 * 1024);
    for (const material of materials) {
      if (material instanceof MeshBasicMaterial || material instanceof MeshStandardMaterial) {
        expect(material.map).toBeNull();
      }
    }
  });
});

import { createPathGeometry, type ParkPath } from "../src/ParkDetails";
import { districtPathMayFollowTerrain, districtStreetTerrainSampler } from "../src/DistrictStreets";
import { pointInDistrictStreetScope } from "../src/districtStreetScope";
import parkJson from "../public/mesh/regierungsviertel/park-details.json";
import streetSource from "../src/data/districtStreets.json";

test("keeps the Bellevueallee ribbon above its surveyed ground without moving its plan", () => {
  const path = parkJson.paths.find((entry) => entry.id === "359234589:0") as ParkPath;
  const original = JSON.stringify(path);
  const source = createPathGeometry([path], 2.4);
  const sample = districtStreetTerrainSampler(ground);
  const corrected = createPathGeometry([path], 2.4, (entry, x, z, y) =>
    entry.kind !== "steps" && districtPathMayFollowTerrain(entry.id) && pointInDistrictStreetScope(x, z)
      ? Math.max(y, sample(x, z)) : y);
  const a = source.getAttribute("position"), b = corrected.getAttribute("position");
  let raised = 0;
  for (let i = 0; i < a.count; i += 1) {
    expect(b.getX(i)).toBe(a.getX(i));
    expect(b.getZ(i)).toBe(a.getZ(i));
    expect(b.getY(i)).toBeGreaterThanOrEqual(a.getY(i));
    expect(b.getY(i) - sample(b.getX(i), b.getZ(i))).toBeGreaterThan(0.1199);
    if (b.getY(i) - a.getY(i) > 0.05) raised += 1;
  }
  expect(raised).toBeGreaterThan(0);
  expect(JSON.stringify(path)).toBe(original);
  for (const id of streetSource.elevated_path_ids) {
    expect(districtPathMayFollowTerrain(`${id}:0`)).toBeFalse();
  }
  expect(pointInDistrictStreetScope(3000, 3000)).toBeFalse();
});
