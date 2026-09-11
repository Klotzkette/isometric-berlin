import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh, Vector3 } from "three";
import { createRosengarten, createRosengartenMinecraft, ROSENGARTEN_PROFILE, rosengartenInsideRing, rosengartenPlanting } from "../src/Rosengarten";
import { ROSENGARTEN_PERGOLA_PRISM_ID, rosengartenPergolaVoxelReplacementAt } from "../src/rosengartenProfile";
import { compilePedestrianObstacles } from "../src/pedestrianNavigation";
import { createIsometricCity, type PrismPayload } from "../src/IsometricCityWorld";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";

describe("source-bound Rosengarten recognition", () => {
  test("flower envelopes stay within the nine mapped planting beds and off the central lawn", () => {
    const plants = rosengartenPlanting();
    expect(ROSENGARTEN_PROFILE.beds).toHaveLength(9);
    expect(plants.length).toBeGreaterThan(150);
    expect(plants.length).toBeLessThan(330);
    expect(new Set(plants.map((plant) => plant.bedId)).size).toBe(9);
    const beds = new Map(ROSENGARTEN_PROFILE.beds.map((bed) => [bed.osmWayId, bed]));
    for (const plant of plants) {
      const ring = beds.get(plant.bedId)!.ring as [number, number][];
      for (const dx of [-0.5, 0, 0.5]) for (const dz of [-0.5, 0, 0.5]) {
        expect(rosengartenInsideRing(plant.x + dx, plant.z + dz, ring)).toBe(true);
      }
      expect(rosengartenInsideRing(plant.x, plant.z, ROSENGARTEN_PROFILE.centralLawn.ring as [number, number][])).toBe(false);
    }
  });

  test("both styles retain an open southeast pergola with bounded shared buffers and no textures", () => {
    for (const create of [createRosengarten, createRosengartenMinecraft]) {
      const group = create();
      const geometryBuffers = new Set<ArrayBufferLike>();
      let bytes = 0, calls = 0, instances = 0;
      group.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        calls++;
        const mesh = object as InstancedMesh;
        if (object instanceof InstancedMesh) instances += mesh.count;
        else expect(object.name).toBe("Rosengarten exact mapped Minecraft gravel paths");
        for (const attribute of [...Object.values(mesh.geometry.attributes), mesh.geometry.index, mesh.instanceMatrix, mesh.instanceColor]) {
          if (!attribute || geometryBuffers.has(attribute.array.buffer)) continue;
          geometryBuffers.add(attribute.array.buffer);
          bytes += attribute.array.byteLength;
        }
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) expect((material as { map?: unknown }).map ?? null).toBeNull();
      });
      expect(calls).toBe(create === createRosengarten ? 3 : 2);
      expect(instances).toBeLessThan(1500);
      expect(bytes).toBeLessThan(120_000);
      expect(group.userData.pergolaPostCount).toBe(18);
      expect(group.userData.centralLawnUnplanted).toBe(true);
      const bounds = new Box3().setFromObject(group);
      const size = bounds.getSize(new Vector3());
      expect(size.x).toBeLessThan(95);
      expect(size.z).toBeLessThan(105);
      expect(size.y).toBeLessThan(3.5);
    }
  });

  test("only the closed pergola roof envelope and exact matching building columns are replaced", () => {
    const payload = prisms as unknown as PrismPayload;
    const building = payload.buildings.find((item) => item.id === ROSENGARTEN_PERGOLA_PRISM_ID)!;
    expect(building).toEqual(ROSENGARTEN_PROFILE.pergola.sourcePrism);
    expect(createIsometricCity(payload, null, null, null, { buildings: [building], includeContext: false }).children).toHaveLength(0);
    expect(compilePedestrianObstacles({ buildings: [building] }).buildingCount).toBe(0);
    expect(ROSENGARTEN_PROFILE.pergola.sourceVoxelColumns).toHaveLength(21);
    for (const [x, z, bottom, top] of ROSENGARTEN_PROFILE.pergola.sourceVoxelColumns) {
      expect(rosengartenPergolaVoxelReplacementAt(x, z, bottom, top)).toBe(true);
      expect(rosengartenPergolaVoxelReplacementAt(x, z, bottom, bottom)).toBe(false);
      expect(rosengartenPergolaVoxelReplacementAt(x + 0.1, z, bottom, top)).toBe(false);
      expect(rosengartenPergolaVoxelReplacementAt(x, z, bottom, top + 4)).toBe(false);
    }
  });

  test("Minecraft gravel stays on retained paths and does not fill planted beds or the lawn", () => {
    const root = createRosengartenMinecraft();
    const mesh = root.getObjectByName("Rosengarten exact mapped Minecraft gravel paths") as Mesh;
    const positions = mesh.geometry.getAttribute("position"), indices = mesh.geometry.index!;
    let area = 0;
    for (let i = 0; i < indices.count; i += 3) {
      const points = [0, 1, 2].map((offset) => {
        const index = indices.getX(i + offset);
        return [positions.getX(index), positions.getZ(index)];
      });
      const x = points.reduce((sum, point) => sum + point[0], 0) / 3;
      const z = points.reduce((sum, point) => sum + point[1], 0) / 3;
      expect(rosengartenInsideRing(x, z, ROSENGARTEN_PROFILE.gardenRing)).toBe(true);
      expect(rosengartenInsideRing(x, z, ROSENGARTEN_PROFILE.centralLawn.ring)).toBe(false);
      expect(ROSENGARTEN_PROFILE.beds.some((bed) => rosengartenInsideRing(x, z, bed.ring))).toBe(false);
      area += Math.abs((points[1][0] - points[0][0]) * (points[2][1] - points[0][1]) -
        (points[2][0] - points[0][0]) * (points[1][1] - points[0][1])) / 2;
    }
    expect(area).toBeGreaterThan(1100);
    expect(area).toBeLessThan(1170);
  });
});
