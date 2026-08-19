import { describe, expect, test } from "bun:test";
import {
  Box3,
  InstancedMesh,
  Mesh,
  Object3D,
  PointLight,
  Vector3,
} from "three";

import {
  CSD_ATTACK_MEMORIAL_OSM_KEY,
  CSD_ATTACK_MEMORIAL_PROFILE,
  createCsdAttackMemorial,
  csdAttackMemorialSolidAt,
  setCsdAttackMemorialSnow,
} from "../src/CsdAttackMemorial";

function worldFromLocal(
  localX: number,
  localY: number,
  localZ: number,
): [number, number, number] {
  const profile = CSD_ATTACK_MEMORIAL_PROFILE;
  const cosine = Math.cos(profile.rotationY);
  const sine = Math.sin(profile.rotationY);
  return [
    profile.worldM[0] + cosine * localX + sine * localZ,
    profile.worldM[1] + localY,
    profile.worldM[2] - sine * localX + cosine * localZ,
  ];
}

describe("CSD memorial place at Ahornsteig", () => {
  test("keeps the new exact OSM site separate from the older owner point", () => {
    const root = createCsdAttackMemorial();
    expect(root.name).toBe("Gedenkstelle CSD-Attentat vom 25.7.2026");
    expect(root.position.toArray()).toEqual([
      ...CSD_ATTACK_MEMORIAL_PROFILE.worldM,
    ]);
    expect(root.userData.osmKey).toBe(CSD_ATTACK_MEMORIAL_OSM_KEY);
    expect(CSD_ATTACK_MEMORIAL_OSM_KEY).toBe("node/14076715427");
    expect(CSD_ATTACK_MEMORIAL_PROFILE.wgs84).toEqual([
      13.3699797, 52.5124509,
    ]);
    expect(CSD_ATTACK_MEMORIAL_PROFILE.startDate).toBe("2026-08-06");
    expect(root.position.distanceTo(new Vector3(40.647, 4.479, 660.01))).toBeGreaterThan(160);
    expect(root.userData.geometryStatus).toContain("non-surveyed");
    expect(root.userData.visualReferenceStatus).toContain("no photograph");
  });

  test("renders the photographed source cues as a compact static ensemble", () => {
    const root = createCsdAttackMemorial();
    const requiredNames = [
      "CSD attack memorial young French maple leaves",
      "CSD attack memorial pale trunk protection wrap",
      "CSD attack memorial round metal guard lower collar",
      "CSD attack memorial round metal guard vertical rods",
      "CSD attack memorial round metal guard rings",
      "CSD attack memorial static Pride flag stripes",
      "CSD attack memorial hanging wreaths",
      "CSD attack memorial unlettered cards",
      "CSD attack memorial rainbow bench slats",
      "CSD attack memorial fine detail",
    ];
    for (const name of requiredNames) {
      expect(root.getObjectByName(name), name).not.toBeNull();
    }

    const guardRods = root.getObjectByName(
      "CSD attack memorial round metal guard vertical rods",
    ) as InstancedMesh;
    const flags = root.getObjectByName(
      "CSD attack memorial static Pride flag stripes",
    ) as InstancedMesh;
    const bench = root.getObjectByName(
      "CSD attack memorial rainbow bench slats",
    ) as InstancedMesh;
    expect(guardRods.count).toBe(CSD_ATTACK_MEMORIAL_PROFILE.guardRodCount);
    expect(flags.count).toBe(
      CSD_ATTACK_MEMORIAL_PROFILE.staticPrideFlagCount * 6,
    );
    expect(bench.count).toBe(12);
    expect(flags.userData.staticInSchwellenraum).toBeTrue();
    expect(flags.userData.windFlag).toBeUndefined();
    expect(flags.userData.windFlagInstances).toBeUndefined();
  });

  test("has leaves at sapling scale and places the bench across the path", () => {
    const root = createCsdAttackMemorial();
    const worldBounds = new Box3().setFromObject(root);
    const size = worldBounds.getSize(new Vector3());
    expect(size.y).toBeGreaterThan(4.8);
    expect(size.y).toBeLessThan(5.7);
    expect(size.x).toBeGreaterThan(6);
    expect(size.z).toBeGreaterThan(6);
    const bench = root.getObjectByName(
      "CSD attack memorial rainbow bench slats",
    )!;
    const localBenchBounds = new Box3().setFromObject(bench);
    expect(localBenchBounds.getCenter(new Vector3()).distanceTo(root.position)).toBeGreaterThan(7.5);
    const leaves = root.getObjectByName(
      "CSD attack memorial young French maple leaves",
    )!;
    const leafSize = new Box3().setFromObject(leaves).getSize(new Vector3());
    expect(leafSize.x).toBeGreaterThanOrEqual(
      CSD_ATTACK_MEMORIAL_PROFILE.crownDiameterM - 0.15,
    );
    expect(leafSize.x).toBeLessThanOrEqual(
      CSD_ATTACK_MEMORIAL_PROFILE.crownDiameterM + 0.1,
    );
    expect(leafSize.z).toBeGreaterThanOrEqual(
      CSD_ATTACK_MEMORIAL_PROFILE.crownDiameterM - 0.15,
    );
    expect(leafSize.z).toBeLessThanOrEqual(
      CSD_ATTACK_MEMORIAL_PROFILE.crownDiameterM + 0.1,
    );
  });

  test("uses no textures, lights, animation metadata or excessive drawables", () => {
    const root = createCsdAttackMemorial();
    const renderables: Object3D[] = [];
    const materials = new Set<unknown>();
    root.traverse((object) => {
      if (object instanceof Mesh) {
        renderables.push(object);
        const assigned = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const entry of assigned) {
          materials.add(entry);
          expect(entry.map).toBeNull();
        }
      }
      expect(object).not.toBeInstanceOf(PointLight);
      expect(object.userData.windFlag).toBeUndefined();
      expect(object.userData.windFlagInstances).toBeUndefined();
    });
    expect(renderables.length).toBeLessThanOrEqual(20);
    expect(materials.size).toBeLessThanOrEqual(20);
  });

  test("toggles only the static snow detail", () => {
    const root = createCsdAttackMemorial();
    const snow = root.getObjectByName("CSD attack memorial snow caps")!;
    const leaves = root.getObjectByName(
      "CSD attack memorial young French maple leaves",
    )!;
    const leafMatrix = leaves.matrix.toArray();
    expect(snow.visible).toBeFalse();
    setCsdAttackMemorialSnow(root, true);
    expect(snow.visible).toBeTrue();
    expect(leaves.matrix.toArray()).toEqual(leafMatrix);
    setCsdAttackMemorialSnow(root, false);
    expect(snow.visible).toBeFalse();
  });

  test("rests both bench snow caps directly on the slats", () => {
    const root = createCsdAttackMemorial();
    setCsdAttackMemorialSnow(root, true);
    const slats = root.getObjectByName(
      "CSD attack memorial rainbow bench slats",
    )!;
    const snow = root.getObjectByName(
      "CSD attack memorial bench and guard snow",
    )!;
    const slatBounds = new Box3().setFromObject(slats);
    const snowBounds = new Box3().setFromObject(snow);
    expect(snowBounds.min.z).toBeGreaterThanOrEqual(slatBounds.min.z - 0.01);
    expect(snowBounds.max.z).toBeLessThanOrEqual(slatBounds.max.z + 0.01);
    expect(snowBounds.min.y).toBeGreaterThanOrEqual(0.49);
    expect(snowBounds.min.y).toBeLessThanOrEqual(slatBounds.max.y + 0.001);
  });

  test("collides with guard, crown and bench but leaves the path gap open", () => {
    expect(
      csdAttackMemorialSolidAt(
        ...worldFromLocal(0.65, 1, 0),
        0.22,
      ),
    ).toBeTrue();
    expect(
      csdAttackMemorialSolidAt(
        ...worldFromLocal(0.25, 4.25, 0.15),
        0.22,
      ),
    ).toBeTrue();
    expect(
      csdAttackMemorialSolidAt(
        ...worldFromLocal(0.8, 0.5, 8.6),
        0.22,
      ),
    ).toBeTrue();
    expect(
      csdAttackMemorialSolidAt(
        ...worldFromLocal(0, 1.7, 4.4),
        0.22,
      ),
    ).toBeFalse();
    expect(csdAttackMemorialSolidAt(Number.NaN, 0, 0)).toBeFalse();
  });

  test("is deterministic between rebuilds", () => {
    const first = createCsdAttackMemorial();
    const second = createCsdAttackMemorial();
    const firstLeaves = first.getObjectByName(
      "CSD attack memorial young French maple leaves",
    ) as InstancedMesh;
    const secondLeaves = second.getObjectByName(
      "CSD attack memorial young French maple leaves",
    ) as InstancedMesh;
    expect(Array.from(firstLeaves.instanceMatrix.array)).toEqual(
      Array.from(secondLeaves.instanceMatrix.array),
    );
    expect(Array.from(firstLeaves.instanceColor!.array)).toEqual(
      Array.from(secondLeaves.instanceColor!.array),
    );
  });
});
