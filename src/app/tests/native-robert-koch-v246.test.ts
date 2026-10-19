import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Box3, InstancedMesh, Matrix4 } from "three";
import { createNativeRobertKochV246, NATIVE_ROBERT_KOCH_V246 } from "../src/NativeRobertKochV246";
import { type VoxelPayload, worldGroundSampler } from "../src/terrainPayload";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

const payload: VoxelPayload = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json", import.meta.url), "utf8"));

describe("native Robert Koch v246", () => {
  test("keeps the protected OSM anchor on actual terrain without overlapping old columns", () => {
    const street = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/street-details.json", import.meta.url), "utf8"));
    const source = street.monuments.find((m: any) => m.osm_key === NATIVE_ROBERT_KOCH_V246.sourceKey);
    expect(source).toMatchObject({ x_dm: 5380, z_dm: -9922, schwellenraum_protected: true });
    const [x, z] = NATIVE_ROBERT_KOCH_V246.anchor;
    expect(worldGroundSampler(payload)(x, z)).toBe(5.2);
    let overlaps = 0;
    for (let row = 0; row < payload.building_rows!.length; row++) {
      const lowZ = (payload.grid.min_z_idx + row) * payload.cell_m;
      if (lowZ >= z + 2.15 || lowZ + payload.cell_m <= z - 2.15) continue;
      for (const [start, length] of payload.building_rows![row]) {
        const lowX = (payload.grid.min_x_idx + start) * payload.cell_m;
        if (lowX < x + 2.5 && lowX + length * payload.cell_m > x - 2.5) overlaps++;
      }
    }
    expect(overlaps).toBe(0);
    const group = createNativeRobertKochV246(payload);
    expect(group.userData.schwellenraumGeschuetzt).toBe(true);
    expect(group.userData.renderedSourceKeys).toEqual([source.osm_key]);
    const bounds = new Box3().setFromObject(group);
    expect(bounds.min.y).toBeCloseTo(5.2, 4);
    expect(bounds.max.y).toBeCloseTo(5.2 + 5.45, 4);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(5, 4);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(4.3, 4);
    disposeStaticAudit(group);
  });

  test("one tiny orthogonal batch faces west and follows changed supplied ground", () => {
    const group = createNativeRobertKochV246(payload);
    expect(group.children).toHaveLength(1);
    const mesh = group.children[0] as InstancedMesh;
    expect(mesh.isInstancedMesh).toBe(true);
    expect(mesh.count).toBe(24);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect((mesh.material as any).map).toBeNull();
    const m = new Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      for (const j of [1, 2, 4, 6, 8, 9]) expect(m.elements[j]).toBe(0);
    }
    mesh.getMatrixAt(6, m); const seatBackX = m.elements[12];
    mesh.getMatrixAt(12, m); expect(m.elements[12]).toBeLessThan(seatBackX); // beard
    mesh.getMatrixAt(15, m); expect(m.elements[12]).toBeLessThan(seatBackX); // feet
    const budget = staticGeometryAudit(group).budget;
    expect(budget.draws).toBe(1);
    expect(budget.bytes).toBeLessThanOrEqual(3_000);
    const shifted: VoxelPayload = { ...payload, ground_height: { ...payload.ground_height, y_dm: payload.ground_height.y_dm.map(y => y + 10) } };
    const raised = createNativeRobertKochV246(shifted);
    expect(new Box3().setFromObject(raised).min.y).toBeCloseTo(6.2, 4);
    console.log("native Koch v246", budget);
    disposeStaticAudit(group); disposeStaticAudit(raised);
    const outside = createNativeRobertKochV246({ ...payload, grid: { ...payload.grid, cols: 1, rows: 1 } });
    expect(outside.children).toHaveLength(0);
  });
});
