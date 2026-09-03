import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Box3, BufferGeometry, Group, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createMinecraftSpreeMuseumDetails } from "../src/MinecraftSpreeMuseumDetails";
import { createSpreeMuseumDetails } from "../src/SpreeMuseumDetails";
import {
  BODE_SOURCE, GRILL_SOURCE, BODE_MAIN, BODE_DOMES,
  SPREE_RECOGNITION_FINE_LAYER_NAME, SPREE_RECOGNITION_GROUP_NAME,
  SPREE_RECOGNITION_PRISM_IDS, sourcePartContains, sourcePartBounds,
  isSpreeRecognitionReplacementColumn,
} from "../src/spreeRecognitionProfile";
import { PRISM_SUPPRESSED_IDS, setIsoNightPresentation, type PrismPayload } from "../src/IsometricCityWorld";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import { FINE_DETAIL_LAYER_NAMES } from "../src/fineDetailFade";
import { isCompleteRecognitionVoxelColumn } from "../src/MinecraftVoxelWorld";

const prisms = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8")) as PrismPayload;
const courtCentres = BODE_MAIN.holes.map((ring) => ring.reduce((p, v) => [p[0] + v[0] / ring.length, p[1] + v[1] / ring.length], [0, 0]));

function budget(root: Group): { bytes: number; draws: number; instances: number } {
  const geometries = new Set<BufferGeometry>();
  let bytes = 0, draws = 0, instances = 0;
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    draws += 1;
    expect(o.matrixAutoUpdate).toBeFalse();
    expect(o.frustumCulled).toBeTrue();
    const material = o.userData.dayMaterial;
    expect(material.map).toBeNull();
    expect(o.userData.nightMaterial.map).toBeNull();
    if (!geometries.has(o.geometry)) {
      geometries.add(o.geometry);
      for (const attribute of Object.values(o.geometry.attributes)) {
        bytes += attribute.array.byteLength;
        expect(Array.from(attribute.array).every(Number.isFinite)).toBeTrue();
      }
      bytes += o.geometry.index?.array.byteLength ?? 0;
    }
    if (o instanceof InstancedMesh) {
      expect(material.vertexColors).toBeFalse();
      expect(material.color.getHex()).toBe(0xffffff);
      expect(o.instanceColor?.count).toBe(o.count);
      bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
      instances += o.count;
    }
  });
  return { bytes, draws, instances };
}

describe("source-bound Spree museum and restaurant", () => {
  test("retains twelve official parts, five courts and both measured dome tops", () => {
    expect(BODE_SOURCE.parts).toHaveLength(4);
    expect(GRILL_SOURCE.parts).toHaveLength(8);
    expect(BODE_MAIN.holes).toHaveLength(5);
    expect(BODE_DOMES.map((p) => p.top_y_m).sort()).toEqual([38.639, 49.512]);
    for (const source of [BODE_SOURCE, GRILL_SOURCE]) {
      expect(source.source_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(source.source_created).toBe("2026-03-02");
      for (const part of source.parts) {
        expect(part.top_y_m - part.ground_y_m).toBeCloseTo(part.height_m, 2);
        expect(part.ring.every((p) => p.length === 2 && p.every(Number.isFinite))).toBeTrue();
      }
    }
  });

  test("replaces only the old fallback buildings, never the river or neighbouring blocks", () => {
    for (const id of SPREE_RECOGNITION_PRISM_IDS) expect(PRISM_SUPPRESSED_IDS.has(id)).toBeTrue();
    for (const p of [[1160, -400], [1555, -300]]) {
      expect(isSpreeRecognitionReplacementColumn(...p as [number, number])).toBeTrue();
      expect(isCompleteRecognitionVoxelColumn(...p as [number, number])).toBeTrue();
    }
    for (const p of [[1162, -382], [1120, -410], [1580, -345], [1700, -265], ...courtCentres])
      expect(isSpreeRecognitionReplacementColumn(...p as [number, number])).toBeFalse();
  });

  test("keeps source courtyard openings unroofed and its entire main structure persistent", () => {
    const root = createSpreeMuseumDetails();
    root.updateMatrixWorld(true);
    const body = root.getObjectByName("Bode official five-court envelope")!;
    const ray = new Raycaster();
    for (const [x, z] of courtCentres) {
      expect(sourcePartContains(BODE_MAIN, x, z)).toBeFalse();
      ray.set(new Vector3(x, 100, z), new Vector3(0, -1, 0));
      expect(ray.intersectObject(body)).toHaveLength(0);
    }
    expect(FINE_DETAIL_LAYER_NAMES).not.toContain(SPREE_RECOGNITION_GROUP_NAME);
    expect(FINE_DETAIL_LAYER_NAMES).toContain(SPREE_RECOGNITION_FINE_LAYER_NAME);
    const bounds = new Box3().setFromObject(root.getObjectByName("Bode-Museum source-bound architecture")!);
    expect(bounds.max.y).toBeCloseTo(49.512, 1);
    expect(bounds.min.y).toBeCloseTo(0.812, 2);
  });

  test("bounds memory and draw calls without textures or reduced mobile geometry", () => {
    const root = createSpreeMuseumDetails();
    const stats = budget(root);
    expect(stats.draws).toBe(14);
    expect(stats.bytes).toBeLessThan(600_000);
    expect(stats.instances).toBeGreaterThan(5900);
    for (const mode of ["night", "snowstorm", "schwellenraum", "day"] as const) {
      setIsoNightPresentation(root, mode === "night", true, mode);
      root.traverse((o) => { if (o instanceof Mesh) {
        expect(o.visible).toBeTrue();
        expect(o.material).toBeDefined();
        if (mode === "night") expect(o.material).toBe(o.userData.nightMaterial);
        if (mode === "day") expect(o.material).toBe(o.userData.dayMaterial);
      } });
    }
  });

  test("Minecraft stores one block batch and no invisible solid interior fill", () => {
    const root = createMinecraftSpreeMuseumDetails();
    const stats = budget(root);
    expect(root.children).toHaveLength(1);
    expect(stats.draws).toBe(1);
    expect(stats.bytes).toBeLessThan(360_000);
    expect(stats.instances).toBe(4638);
    expect(root.userData.keepInMinecraft).toBeTrue();
    expect((root.children[0] as InstancedMesh).geometry.getAttribute("position").count).toBe(24);
  });

  test("walking collision follows the new official heights and leaves all courts and the quay free", () => {
    const selected = prisms.buildings.filter((p) => SPREE_RECOGNITION_PRISM_IDS.has(p.id));
    const obstacles = compilePedestrianObstacles({ buildings: selected });
    expect(obstacles.buildingCount).toBe(12);
    expect(pedestrianPointIsBlocked(1555, -300, 30, obstacles)).toBeTrue();
    expect(pedestrianPointIsBlocked(1160, -400, 22, obstacles)).toBeTrue();
    for (const [x, z] of [[1162, -382], ...courtCentres])
      expect(pedestrianPointIsBlocked(x, z, 5, obstacles)).toBeFalse();
    const ids = new Set([...obstacles.cells.values()].flat().map((o) => o.kind === "polygon" ? o.sourceId : ""));
    expect(ids.size).toBe(12);
    expect(sourcePartBounds(BODE_MAIN)[0]).toBeGreaterThan(1534);
  });
});
