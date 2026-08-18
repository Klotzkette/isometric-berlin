import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import {
  type ReichstagModelSignature,
  REICHSTAG_WEST_FACADE_PROFILE,
  REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE,
  createArchitecturalSignature,
} from "../src/ArchitecturalLandmarks";
import {
  MINECRAFT_ARCHITECTURAL_PROFILES,
  createMinecraftArchitecturalLandmarks,
} from "../src/MinecraftArchitecturalLandmarks";
import { applyMaterialLighting } from "../src/ThreeViewer";
import {
  FINE_DETAIL_LAYER_NAMES,
  FINE_DETAIL_HIDE_DISTANCE_M,
  FINE_DETAIL_SHOW_DISTANCE_M,
  nextFineDetailVisible,
} from "../src/fineDetailFade";

const signature: ReichstagModelSignature = {
  anchor_world: [0, 0, 0],
  body_height_m: 28.06,
  depth_m: 138,
  focus_camera: {
    azimuth_degrees: 45,
    distance_m: 200,
    polar_degrees: 60,
    target_height_m: 18,
  },
  geometry_status: "metric test",
  id: "reichstag-model",
  kind: "reichstag_model",
  landmark_name: "Reichstagsgebäude",
  rotation_y_degrees: 0,
  source_url: "https://www.bundestag.de/",
  width_m: 100,
};

function reichstag(): Group {
  return createArchitecturalSignature(signature) as Group;
}

function instancePositions(instances: InstancedMesh): Vector3[] {
  const matrix = new Matrix4();
  return Array.from({ length: instances.count }, (_, index) => {
    instances.getMatrixAt(index, matrix);
    return new Vector3().setFromMatrixPosition(matrix);
  });
}

function instanceFingerprint(instances: InstancedMesh): string {
  const matrix = new Matrix4();
  const rows: string[] = [];
  for (let index = 0; index < instances.count; index += 1) {
    instances.getMatrixAt(index, matrix);
    rows.push(matrix.elements.map((value) => value.toFixed(6)).join(","));
  }
  return rows.join("|");
}

function cueInstanceRange(
  mesh: InstancedMesh,
  cue: string,
): readonly [number, number] {
  let start = 0;
  for (const [name, count] of Object.entries(
    mesh.userData.cueCounts as Record<string, number>,
  )) {
    if (name === cue) return [start, start + count];
    start += count;
  }
  throw new Error(`Missing Minecraft cue: ${cue}`);
}

describe("Reichstag west-portico crowned ornaments", () => {
  test("keeps the two pediment-corner finials symmetric and source-profiled", () => {
    const model = reichstag();
    const finials = model.getObjectByName(
      "Reichstag west pediment crowned corner finials",
    ) as Group;
    const shafts = finials.getObjectByName(
      "Reichstag west pediment corner-finial tapered shafts",
    ) as InstancedMesh;
    const positions = instancePositions(shafts);

    expect(finials).toBeInstanceOf(Group);
    expect(finials.userData).toMatchObject({
      fixedStaticGeometry: true,
      geometryStatus:
        REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE.geometryStatus,
      sourceUrls: [
        expect.stringContaining("bundestag.de"),
        expect.stringContaining("commons.wikimedia.org"),
      ],
    });
    expect(shafts.count).toBe(
      REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE.cornerFinialCount,
    );
    expect(positions[0]!.x).toBeCloseTo(positions[1]!.x, 8);
    expect(positions[0]!.y).toBeCloseTo(positions[1]!.y, 8);
    expect(positions[0]!.z).toBeCloseTo(-positions[1]!.z, 8);
    positions.forEach(({ z }, index) => {
      expect(z).toBeCloseTo(
        REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE.cornerFinialZ[index]!,
        6,
      );
    });

    // The west-tower platforms and their flags are a separate motif.  The
    // requested pair sits only at the two portico-pediment shoulders.
    expect(Math.max(...positions.map(({ z }) => Math.abs(z)))).toBeLessThan(20);
    expect(
      model.getObjectByName("Reichstag corner tower -1:-1"),
    ).not.toBeNull();
  });

  test("stays inside a bounded 9.36 m high silhouette without moving the portico", () => {
    const model = reichstag();
    const finials = model.getObjectByName(
      "Reichstag west pediment crowned corner finials",
    ) as Group;
    const bounds = new Box3().setFromObject(finials);
    const height = bounds.max.y - bounds.min.y;

    expect(bounds.min.y).toBeCloseTo(
      REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE.cornerFinialBaseY,
      2,
    );
    expect(height).toBeCloseTo(
      REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE.cornerFinialHeightM,
      2,
    );
    expect(bounds.max.y).toBeLessThan(30);
    expect(bounds.min.z).toBeCloseTo(-bounds.max.z, 5);
    expect(bounds.max.z - bounds.min.z).toBeLessThan(42);

    const portico = model.getObjectByName(
      "Reichstag west triangular pediment",
    ) as Mesh;
    expect(portico.position.toArray()).toEqual([-53.6, 20.2, 0]);
  });

  test("draws both Wappenbäume as a distinct pair of twenty crowned shields", () => {
    const model = reichstag();
    const trees = model.getObjectByName(
      "Reichstag west portico Wappenbaum fine detail",
    ) as Group;
    const trunks = trees.getObjectByName(
      "Reichstag west portico Wappenbaum trunks",
    ) as InstancedMesh;
    const shields = trees.getObjectByName(
      "Reichstag west portico twenty Wappenbaum shields",
    ) as InstancedMesh;
    const crowns = trees.getObjectByName(
      "Reichstag west portico Wappenbaum imperial crowns",
    ) as InstancedMesh;

    expect(trees).toBeInstanceOf(Group);
    expect(trunks.count).toBe(
      REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE.wappenTreeCount,
    );
    expect(shields.count).toBe(
      REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE.wappenShieldCount,
    );
    expect(crowns.count).toBe(
      REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE.wappenCrownCount,
    );
    const trunkPositions = instancePositions(trunks);
    expect(trunkPositions.map(({ z }) => z)).toEqual(
      REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE.wappenTreeZ,
    );
    expect(Math.abs(trunkPositions[0]!.z)).toBeLessThan(
      Math.abs(REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE.cornerFinialZ[0]),
    );

    // The tree reliefs occupy the two outer bays, centred halfway between
    // the ±10.5 m and ±17.5 m column axes. Every carved instance retains a
    // visible radial gap to the 1.25 m column shafts.
    const columnAxesZ = [-17.5, -10.5, -3.5, 3.5, 10.5, 17.5];
    const columnX = -signature.width_m / 2 - 3.6;
    const matrix = new Matrix4();
    trees.traverse((object) => {
      if (!(object instanceof InstancedMesh)) return;
      object.geometry.computeBoundingBox();
      const sourceBounds = object.geometry.boundingBox!;
      for (let index = 0; index < object.count; index += 1) {
        object.getMatrixAt(index, matrix);
        const bounds = sourceBounds.clone().applyMatrix4(matrix);
        for (const columnZ of columnAxesZ) {
          const dx = Math.max(
            bounds.min.x - columnX,
            columnX - bounds.max.x,
            0,
          );
          const dz = Math.max(
            bounds.min.z - columnZ,
            columnZ - bounds.max.z,
            0,
          );
          expect(Math.hypot(dx, dz)).toBeGreaterThan(1.25);
        }
      }
    });
  });

  test("replaces the intersecting generic panel figures with the Wappenbäume", () => {
    const model = reichstag();
    const panels = model.children.filter(
      ({ name }) => name === "Reichstag west portico sculptural relief panel",
    );

    expect(REICHSTAG_WEST_FACADE_PROFILE.porticoReliefFigureCount).toBe(0);
    expect(panels).toHaveLength(
      REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE.wappenTreeCount,
    );
    expect(
      model.getObjectByName("Reichstag west portico relief figures"),
    ).toBeUndefined();
    expect(
      model.getObjectByName("Reichstag west portico relief figure heads"),
    ).toBeUndefined();
    expect(
      model.getObjectByName("Reichstag west portico Wappenbaum fine detail"),
    ).toBeInstanceOf(Group);
  });

  test("keeps the Minecraft Wappenbäume block-native in the same clear outer bays", () => {
    const mesh = createMinecraftArchitecturalLandmarks().getObjectByName(
      "Minecraft Reichstag block signature",
    ) as InstancedMesh;
    const profile = MINECRAFT_ARCHITECTURAL_PROFILES.reichstag;
    const [start, end] = cueInstanceRange(
      mesh,
      "paired crowned Wappenbaum reliefs",
    );
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const angle = (profile.rotationDegrees * Math.PI) / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const columnAxesZ = [-17.5, -10.5, -3.5, 3.5, 10.5, 17.5];

    expect(profile.wappenTreeZ).toEqual(
      REICHSTAG_WEST_PORTICO_ORNAMENT_PROFILE.wappenTreeZ,
    );
    expect(end - start).toBe(28);
    for (let index = start; index < end; index += 1) {
      mesh.getMatrixAt(index, matrix);
      matrix.decompose(position, rotation, scale);
      const dx = position.x - profile.anchorWorld[0];
      const dz = position.z - profile.anchorWorld[2];
      const localZ = sine * dx + cosine * dz;
      const treeZ = profile.wappenTreeZ.reduce((nearest, candidate) =>
        Math.abs(candidate - localZ) < Math.abs(nearest - localZ)
          ? candidate
          : nearest,
      );

      expect(Math.abs(localZ - treeZ)).toBeLessThanOrEqual(1.42 + 1e-6);
      for (const columnZ of columnAxesZ) {
        expect(Math.abs(localZ - columnZ)).toBeGreaterThan(
          1.05 + scale.z / 2,
        );
      }
    }
  });

  test("round-trips Day, Schwellenraum and Night without changing geometry", () => {
    const model = reichstag();
    const shafts = model.getObjectByName(
      "Reichstag west pediment corner-finial tapered shafts",
    ) as InstancedMesh;
    const material = shafts.material as MeshStandardMaterial;
    const color = material.color.getHex();
    const matrices = instanceFingerprint(shafts);

    applyMaterialLighting(material, "day");
    applyMaterialLighting(material, "schwellenraum");
    expect(material.emissive.getHex()).toBe(0x000000);
    applyMaterialLighting(material, "night");
    expect(material.emissive.getHex()).toBe(0x65778d);
    applyMaterialLighting(material, "day");

    expect(material.color.getHex()).toBe(color);
    expect(material.emissive.getHex()).toBe(0x000000);
    expect(instanceFingerprint(shafts)).toBe(matrices);
  });

  test("keeps solid silhouettes while distance-fading only carved microdetail", () => {
    const model = reichstag();
    const finials = model.getObjectByName(
      "Reichstag west pediment crowned corner finials",
    ) as Group;
    const crownDetail = finials.getObjectByName(
      "Reichstag west pediment crowned-finial fine detail",
    ) as Group;

    expect(FINE_DETAIL_LAYER_NAMES).toContain(crownDetail.name);
    expect(FINE_DETAIL_LAYER_NAMES).toContain(
      "Reichstag west portico Wappenbaum fine detail",
    );
    expect(FINE_DETAIL_LAYER_NAMES).not.toContain(finials.name);
    expect(
      nextFineDetailVisible({
        distanceM: FINE_DETAIL_HIDE_DISTANCE_M,
        visible: true,
      }),
    ).toBe(false);
    expect(
      nextFineDetailVisible({
        distanceM: FINE_DETAIL_SHOW_DISTANCE_M,
        visible: false,
      }),
    ).toBe(true);

    finials.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      expect(object).toBeInstanceOf(InstancedMesh);
      const material = object.material as MeshStandardMaterial;
      expect(material.transparent).toBe(false);
      expect(material.depthWrite).toBe(true);
      expect(material.map).toBeNull();
    });
  });
});
