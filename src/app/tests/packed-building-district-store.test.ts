import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { InstancedMesh, LineSegments, Mesh, type Object3D } from "three";
import {
  createIsometricCity, type PrismBuilding, type PrismPayload,
} from "../src/IsometricCityWorld";
import { MOBILE_DETAIL_BATCH_SIZE, buildingDetailDistricts } from "../src/buildingDetailStreaming";
import { PackedBuildingDistrictStore } from "../src/packedBuildingDistrictStore";
import { MOBILE_INITIAL_BUILDING_COUNT, splitProgressiveBuildings } from "../src/progressiveWorld";
import { objectMaterialsIncludingTransferredAlternates } from "../src/transferableObject3D";

const source = await Bun.file(new URL(
  "../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url,
)).json() as PrismPayload;

function partitionSource() {
  return splitProgressiveBuildings(source.buildings, MOBILE_INITIAL_BUILDING_COUNT,
    MOBILE_DETAIL_BATCH_SIZE, Number.POSITIVE_INFINITY);
}

/** Hash every rendered attribute/index byte, including per-instance buffers. */
function geometrySignature(root: Object3D): string {
  root.updateMatrixWorld(true);
  const hash = createHash("sha256");
  root.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    hash.update(JSON.stringify([object.type, object.name, object.geometry.drawRange,
      object.geometry.groups, object.matrix.toArray()]));
    const attributes = Object.entries(object.geometry.attributes);
    if (object.geometry.index) attributes.push(["index", object.geometry.index]);
    if (object instanceof InstancedMesh) {
      hash.update(String(object.count));
      attributes.push(["instanceMatrix", object.instanceMatrix]);
      if (object.instanceColor) attributes.push(["instanceColor", object.instanceColor]);
    }
    for (const [name, attribute] of attributes) {
      hash.update(JSON.stringify([name, attribute.itemSize, attribute.normalized,
        attribute.array.constructor.name, attribute.count]));
      hash.update(new Uint8Array(attribute.array.buffer,
        attribute.array.byteOffset, attribute.array.byteLength));
    }
  });
  return hash.digest("hex");
}

function dispose(root: Object3D): void {
  root.traverse((object) => {
    if (object instanceof Mesh || object instanceof LineSegments) object.geometry.dispose();
    for (const material of objectMaterialsIncludingTransferredAlternates(object)) material.dispose();
  });
  root.clear();
}

describe("lossless mobile building district source storage", () => {
  test("round-trips every source field and district boundary in the shipped city", () => {
    const partition = partitionSource();
    const originals = partition.remaining.map((buildings) => [...buildings]);
    const boundaries = buildingDetailDistricts(originals);
    const store = new PackedBuildingDistrictStore(partition.remaining);
    expect(partition.remaining.every((buildings) => buildings.length === 0)).toBeTrue();
    expect(store.size).toBe(originals.length);
    expect(store.sourceBuildingCount).toBe(source.buildings.length - partition.initial.length);
    expect(store.encodedCodeUnits).toBe(originals.reduce(
      (total, buildings) => total + JSON.stringify(buildings).length, 0));
    const restoredBoundaries = [];
    originals.forEach((original, index) => {
      const restored = store.read(`buildings-${index + 1}`);
      expect(restored).toEqual(original);
      // Compute with original IDs rather than renumbering singleton batches.
      const [boundary] = buildingDetailDistricts([restored]);
      restoredBoundaries.push({ ...boundary,
        id: `buildings-${index + 1}`, previewId: `buildings-preview-${index + 1}` });
    });
    expect(restoredBoundaries).toEqual(boundaries);
    expect(store.encodedCodeUnits).toBeLessThan(7 * 1024 * 1024);
    console.info(JSON.stringify({ packedDistricts: store.size,
      sourceBuildings: store.sourceBuildingCount,
      encodedCodeUnits: store.encodedCodeUnits,
      maxUtf16StringBytes: store.encodedCodeUnits * 2,
      maxDecodedDistrictBuildings: MOBILE_DETAIL_BATCH_SIZE }));
  });

  test("rebuilding an evicted district returns independent exact source records", () => {
    const partition = partitionSource();
    const expected = [...partition.remaining[0]];
    const store = new PackedBuildingDistrictStore(partition.remaining);
    const first = store.read("buildings-1");
    first[0].ring[0][0] += 100;
    first[0].h_dm += 50;
    first.length = 0;
    expect(store.read("buildings-1")).toEqual(expected);
    expect(() => store.read("buildings-missing")).toThrow("Unknown building district");
  });

  test("retains empty district IDs without shifting subsequent batches", () => {
    const building = source.buildings[0];
    const batches: PrismBuilding[][] = [[], [building], []];
    const store = new PackedBuildingDistrictStore(batches);
    expect(store.size).toBe(3);
    expect(store.read("buildings-1")).toEqual([]);
    expect(store.read("buildings-2")).toEqual([building]);
    expect(store.read("buildings-3")).toEqual([]);
  });

  test("representative near, middle and outer districts produce identical geometry bytes", () => {
    const partition = partitionSource();
    const originals = partition.remaining.map((buildings) => [...buildings]);
    const store = new PackedBuildingDistrictStore(partition.remaining);
    for (const index of [0, Math.floor(originals.length / 2), originals.length - 1]) {
      const build = (buildings: PrismBuilding[]) => createIsometricCity(
        source, null, null, null, { buildings, includeContext: false, smoothSurfaces: null },
      );
      const expected = build(originals[index]);
      const actual = build(store.read(`buildings-${index + 1}`));
      expect(geometrySignature(actual)).toBe(geometrySignature(expected));
      dispose(expected);
      dispose(actual);
    }
  });
});
