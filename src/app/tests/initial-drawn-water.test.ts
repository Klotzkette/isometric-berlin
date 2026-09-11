import { describe, expect, test } from "bun:test";
import { Box3, Group, LineSegments, Mesh, type Material } from "three";
import { createInitialDrawnWater, drawnWaterMonumentKeys, SUNKEN_WALL_OSM_KEY } from "../src/initialDrawnWater";
import { createSmoothSurfaces, setIsoNightPresentation, type SurfacePayload } from "../src/IsometricCityWorld";
import { smoothGroundTopSampler, WATER_TOP_Y, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import { surfaceFamilyPayload } from "../src/progressiveWorld";
import { createTiergartenMonuments } from "../src/TiergartenMonuments";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import { deserializeTransferredObject3D, serializeObject3DForTransfer } from "../src/transferableObject3D";
import groundPayload from "../public/mesh/regierungsviertel/ground-context.json";
import surfacePayload from "../public/mesh/regierungsviertel/surface-polygons.json";
import streetPayload from "../public/mesh/regierungsviertel/street-details.json";

const ground = groundPayload as unknown as VoxelPayload;
const surfaces = surfacePayload as unknown as SurfacePayload;
const street = streetPayload as unknown as StreetDetailsPayload;

function geometryFingerprint(root: Group): string {
  const hash = new Bun.CryptoHasher("sha256");
  root.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    hash.update(object.name);
    for (const [name, attribute] of Object.entries(object.geometry.attributes)) {
      hash.update(name);
      hash.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    }
    if (object.geometry.index) hash.update(new Uint8Array(object.geometry.index.array.buffer));
  });
  return hash.digest("hex");
}

describe("complete initial mobile water", () => {
  const mobile = createInitialDrawnWater(ground, surfaces, true)!;

  test("has all 175 retained water polygons, including every basin and the exact wall", () => {
    expect(mobile.userData.waterPolygonCount).toBe(175);
    expect(mobile.userData.basinCount).toBe(37);
    expect(mobile.userData.sunkenWallCount).toBe(1);
    for (const name of ["basin water", "natural pond water", "smooth quay walls", "sunken walls", "sunken wall crown path", "basin and sunken wall ink"]) {
      expect(mobile.getObjectByName(name)).toBeDefined();
    }
    expect(mobile.getObjectByName("smooth parkland lawns")).toBeUndefined();
    expect(mobile.getObjectByName("smooth asphalt streets")).toBeUndefined();
  });

  test("is byte-identical to the desktop water family on the same surveyed terrain", () => {
    const sample = smoothGroundTopSampler(ground);
    const waterTop = ground.water_top_y_m ?? WATER_TOP_Y;
    const full = createSmoothSurfaces(surfaceFamilyPayload(surfaces, "water"), waterTop,
      waterTop + 5.35, (x, z) => sample(x / ground.cell_m - ground.grid.min_x_idx,
        z / ground.cell_m - ground.grid.min_z_idx), { excludeDistrictMarkings: true });
    expect(geometryFingerprint(mobile)).toBe(geometryFingerprint(full));
    expect(createInitialDrawnWater(ground, surfaces, false)).toBeNull();
  });

  test("keeps the nearly 39 metre wedge, complete crown and rail silhouette", () => {
    const slab = new Box3().setFromObject(mobile.getObjectByName("sunken walls")!);
    const crown = new Box3().setFromObject(mobile.getObjectByName("sunken wall crown path")!);
    const ink = new Box3().setFromObject(mobile.getObjectByName("basin and sunken wall ink")!);
    expect(slab.max.z - slab.min.z).toBeGreaterThan(38.8);
    expect(slab.max.z - slab.min.z).toBeLessThan(39.3);
    expect(slab.max.y - slab.min.y).toBeGreaterThan(6.5);
    expect(crown.max.z - crown.min.z).toBeGreaterThan(38.8);
    expect(ink.max.y).toBeGreaterThan(crown.max.y + 0.8);
  });

  test("preserves all geometry through Day, Night, Snowstorm and Schwellenraum", () => {
    const fingerprint = geometryFingerprint(mobile);
    const wall = mobile.getObjectByName("sunken walls") as Mesh;
    for (const mode of ["night", "snowstorm", "schwellenraum", "day"] as const) {
      setIsoNightPresentation(mobile, mode === "night", true, mode);
      expect(geometryFingerprint(mobile)).toBe(fingerprint);
      expect(wall.visible).toBeTrue();
      if (mode === "night") expect(wall.material).toBe(wall.userData.nightMaterial);
      if (mode === "day") expect(wall.material).toBe(wall.userData.dayMaterial);
    }
  });

  test("authored quay stone stays ahead of coplanar land in every drawn mode without changing a vertex", () => {
    const quay = mobile.getObjectByName("smooth quay walls") as Mesh;
    const geometry = quay.geometry;
    const fingerprint = (geometry = quay.geometry): string => {
      const hash = new Bun.CryptoHasher("sha256");
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        hash.update(name);
        hash.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
      }
      if (geometry.index) hash.update(new Uint8Array(geometry.index.array.buffer,
        geometry.index.array.byteOffset, geometry.index.array.byteLength));
      return hash.digest("hex");
    };
    // Captured from the complete retained water source before the material-only
    // depth correction; this protects positions, colours and index ordering.
    const original = "7aa5be7b0c81aeb9a0faefd48cdf2be93037141a837b47db458b3eb9845a4fbc";
    expect(geometry.getAttribute("position").count).toBe(114246);
    expect(geometry.index!.count).toBe(240816);
    for (const mode of ["day", "night", "snowstorm", "schwellenraum", "day"] as const) {
      for (const lightsOn of [true, false]) {
        setIsoNightPresentation(mobile, mode === "night", lightsOn, mode);
        const material = quay.material as Material;
        expect(quay.visible).toBeTrue();
        expect(material.polygonOffset).toBeTrue();
        expect(material.polygonOffsetFactor).toBe(-1);
        expect(material.polygonOffsetUnits).toBe(-1);
        expect(material.depthTest).toBeTrue();
        expect(material.depthWrite).toBeTrue();
        expect(fingerprint()).toBe(original);
      }
    }
    // Desktop receives this same source family through the progressive worker.
    const copy = deserializeTransferredObject3D(structuredClone(
      serializeObject3DForTransfer(quay).object,
    )) as Mesh;
    const workerRoot = new Group().add(copy);
    for (const mode of ["day", "night", "snowstorm", "schwellenraum", "day"] as const) {
      setIsoNightPresentation(workerRoot, mode === "night", true, mode);
      const material = copy.material as Material;
      expect(material.polygonOffset).toBeTrue();
      expect(material.polygonOffsetFactor).toBe(-1);
      expect(material.polygonOffsetUnits).toBe(-1);
      expect(fingerprint(copy.geometry)).toBe(original);
    }
  });

  test("suppresses only the inaccurate generic double when the exact source owns the work", () => {
    const entry = street.monuments.find((value) => value.osm_key === SUNKEN_WALL_OSM_KEY)!;
    const single = { ...street, monuments: [entry] };
    expect(createTiergartenMonuments(single, ground)).not.toBeNull();
    expect(createTiergartenMonuments(single, ground, {
      externallyModelledSourceKeys: drawnWaterMonumentKeys(surfaces),
    })).toBeNull();
    expect(drawnWaterMonumentKeys({ ...surfaces, sunken_walls: [] }).size).toBe(0);
    expect(drawnWaterMonumentKeys(null).size).toBe(0);
    expect(createInitialDrawnWater(null, surfaces, true)).toBeNull();
    expect(createInitialDrawnWater(ground, null, true)).toBeNull();
  });
});
