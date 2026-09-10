import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import {
  createKonradAdenauerHaus,
  createMinecraftKonradAdenauerHaus,
  konradAdenauerFootprintContains,
} from "../src/KonradAdenauerHaus";
import { KONRAD_ADENAUER_HAUS_PROFILE as profile } from "../src/expandedCityProfiles";
import { PRISM_SUPPRESSED_IDS } from "../src/IsometricCityWorld";
import { decodeVoxelBuildingColumns, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

describe("source-bound CDU headquarters", () => {
  const model = createKonradAdenauerHaus();

  test("retains the exact mapped hull and contiguous six-level office body", () => {
    expect(profile.osmWayId).toBe("25999445");
    expect(profile.innerBodyLowerHeightM).toBe(profile.eavesHeightM);
    expect(profile.buildingStoreys).toBe(6);
    const c = Math.cos(profile.innerBodyRotationY), s = Math.sin(profile.innerBodyRotationY);
    const body = model.getObjectByName("Konrad-Adenauer-Haus glass envelope bodies") as Mesh;
    // These upper lower-body floors were formerly an empty 2.4 m gap beneath
    // the unsupported two upper decks. Test real facade intersections there.
    for (const y of [16.2, 17.1, 17.8, 18.3, 22.5]) {
      const ray = new Raycaster(new Vector3(-1405 + 33 * c, profile.groundY + y, 1338 - 33 * s), new Vector3(-c, 0, s));
      expect(ray.intersectObject(body).length).toBeGreaterThan(0);
    }
    const bounds = new Box3().setFromObject(model);
    expect(bounds.min.x).toBeCloseTo(-1436.983, 2);
    expect(bounds.max.x).toBeCloseTo(-1378.664, 2);
    expect(bounds.min.z).toBeCloseTo(1299.129, 2);
    expect(bounds.max.z).toBeCloseTo(1379.685, 2);
  });

  test("renders real transparent winter-garden walls and roof without a texture", () => {
    const glass = model.getObjectByName("Konrad-Adenauer-Haus transparent winter garden glazing") as Mesh;
    expect(glass.geometry.getAttribute("position").count).toBe(30);
    const material = glass.material as MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(.2);
    expect(material.depthWrite).toBe(false);
    expect(material.map).toBeNull();
    expect(profile.identificationSign.text).toBe("CDU");
    expect(profile.signageRendered).toBe(true);
  });

  test("keeps all facades and slabs inside the source hull apart from its 10 cm frame", () => {
    let maximumOutside = 0;
    model.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const points = object.geometry.getAttribute("position");
      for (let i = 0; i < points.count; i++) {
        const x = points.getX(i), z = points.getZ(i);
        if (konradAdenauerFootprintContains(x, z)) continue;
        let nearest = Infinity;
        profile.footprintWorldM.forEach((a, edge) => {
          const b = profile.footprintWorldM[(edge + 1) % profile.footprintWorldM.length];
          const dx = b[0] - a[0], dz = b[1] - a[1];
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
          nearest = Math.min(nearest, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
        });
        maximumOutside = Math.max(maximumOutside, nearest);
      }
    });
    expect(maximumOutside).toBeLessThan(.101);
  });

  test("replaces the 149 actual obsolete source columns and no adjacent building footprint", () => {
    const payload = voxelPayload as unknown as VoxelPayload;
    const removed = decodeVoxelBuildingColumns(payload).filter(([x, z]) =>
      konradAdenauerFootprintContains((x + .5) * payload.cell_m, (z + .5) * payload.cell_m));
    expect(removed).toHaveLength(149);
    expect(new Set(removed.map(column => column[3]))).toEqual(new Set([212]));
    expect(konradAdenauerFootprintContains(-1380, 1390)).toBe(false);
    expect(konradAdenauerFootprintContains(-1440, 1330)).toBe(false);
    expect(PRISM_SUPPRESSED_IDS.has("25999445")).toBe(true);
    expect(PRISM_SUPPRESSED_IDS.has("MwfoOvua")).toBe(true);
  });

  test("stays bounded to two drawn calls and one deterministic surface-only block batch", () => {
    let calls = 0, vertices = 0, bytes = 0;
    model.traverse(object => {
      if (!(object instanceof Mesh)) return;
      calls++; vertices += object.geometry.getAttribute("position").count;
      for (const attribute of Object.values(object.geometry.attributes)) bytes += attribute.array.byteLength;
      if (object.geometry.index) bytes += object.geometry.index.array.byteLength;
      expect((object.material as MeshBasicMaterial).map).toBeNull();
    });
    expect({ calls, vertices, bytes }).toEqual({ calls: 2, vertices: 36_924, bytes: 664_950 });
    const blocks = createMinecraftKonradAdenauerHaus();
    expect(blocks).toBeInstanceOf(InstancedMesh);
    expect(blocks.count).toBe(2_539);
    expect(blocks.geometry.getAttribute("position").count).toBe(24);
    // Instance colours need a white material base, not a missing vertex-color
    // attribute that turns this unit cube black in the browser shader.
    expect((blocks.material as MeshBasicMaterial).vertexColors).toBe(false);
    expect(blocks.userData.nightMaterial.vertexColors).toBe(false);
    expect(blocks.instanceColor).not.toBeNull();
    expect(blocks.instanceMatrix.array).toEqual(createMinecraftKonradAdenauerHaus().instanceMatrix.array);
  });
});
