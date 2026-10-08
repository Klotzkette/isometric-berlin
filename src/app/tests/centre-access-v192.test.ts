import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh, Vector3 } from "three";
import { BRANDENBURG_GATE_SUBWAY_ENTRANCE_WORLD } from "../src/CentralCivicDetails";
import { POTSDAMER_DETAIL_PROFILE } from "../src/expandedCityProfiles";
import {
  CENTRE_ACCESS_V192_PROFILE as profile, centreAccessV192Members,
  centreAccessV192NativeRows, createCentreAccessV192,
} from "../src/CentreAccessV192";

function local(point: readonly number[], centre: readonly number[], yaw: number): number[] {
  const x = point[0] - centre[0], z = point[2] - centre[2];
  return [x * Math.cos(yaw) - z * Math.sin(yaw), point[1], x * Math.sin(yaw) + z * Math.cos(yaw)];
}

test("source entrance anchors and complete hall footprints stay unchanged", () => {
  expect(profile.pariser.centre).toEqual(BRANDENBURG_GATE_SUBWAY_ENTRANCE_WORLD);
  const halls = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls.halls;
  const source = JSON.stringify(halls);
  expect(halls.map(h => h.sourceBuildingId)).toEqual(["DEBE01YYK0002SCt", "DEBE01YYK0000BRX"]);
  const members = centreAccessV192Members();
  for (const h of halls) {
    const selected = members.filter(m => m.site === `potsdamer-${h.key}`);
    const centre = [h.centerWorldM[0], h.groundY, h.centerWorldM[1]];
    expect(selected.filter(m => m.role === "stair-rail-support")).toHaveLength(12);
    expect(selected.filter(m => m.role === "DB-sign-backing")).toHaveLength(1);
    for (const m of selected) {
      for (const p of [m.a, ...(m.b ? [m.b] : [])]) {
        const q = local(p, centre, h.rotationY);
        expect(Math.abs(q[0])).toBeLessThan(h.footprintSizeM[0] / 2 - 2);
        expect(Math.abs(q[2])).toBeLessThan(h.footprintSizeM[1] / 2 - 1);
        expect(q[1]).toBeLessThan(h.groundY + h.officialHeightM);
      }
    }
    const support = selected.filter(m => m.role === "DB-sign-support");
    for (const m of support) {
      expect(m.a[1] - m.size![1] / 2).toBeCloseTo(h.groundY, 8);
      expect(m.a[1] + m.size![1] / 2).toBeCloseTo(h.groundY + 4.05 - 1.12 / 2, 8);
    }
  }
  createCentreAccessV192(); createCentreAccessV192(true);
  expect(JSON.stringify(halls)).toBe(source);
});

test("frames stay on retained glass edges and stair approaches stay open in both forms", () => {
  const members = centreAccessV192Members();
  const pariser = members.filter(m => m.site === "pariser");
  const sideFrames = pariser.filter(m => m.role.startsWith("glass-") || m.role === "stone-side-cap");
  expect(sideFrames.filter(m => m.role === "glass-side-post")).toHaveLength(8);
  expect(sideFrames.filter(m => m.role === "glass-point-clamp")).toHaveLength(16);
  for (const m of sideFrames) {
    const p = local(m.a, profile.pariser.centre, profile.pariser.yaw);
    expect(Math.abs(p[0])).toBeGreaterThanOrEqual(4.449999);
    expect(Math.abs(p[0])).toBeLessThan(4.57);
  }
  expect(pariser.filter(m => m.role === "U-symbol")).toHaveLength(10);
  for (const site of profile.sites) {
    const rows = centreAccessV192NativeRows(members.filter(m => m.site === site));
    const hall = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls.halls.find(h => site === `potsdamer-${h.key}`);
    for (const row of rows) {
      if (row[1] > 7.4) continue;
      if (site === "pariser") {
        const p = local(row, profile.pariser.centre, profile.pariser.yaw);
        expect(Math.abs(p[0])).toBeGreaterThan(4.1);
      } else if (hall) {
        const p = local(row, [hall.centerWorldM[0], hall.groundY, hall.centerWorldM[1]], hall.rotationY);
        // Two retained stairs get an unobstructed 3.2m core in every sampled
        // native cell; there is no new front crossbar or glass mass.
        for (const bank of [-5, 5]) expect(Math.abs(p[0] - bank)).toBeGreaterThan(1.6);
      }
    }
  }
});

test("three independently culled batches stay static, texture-free and comfortably bounded", () => {
  for (const native of [false, true]) {
    const group = createCentreAccessV192(native);
    expect(group.userData.blockNative).toBe(native);
    expect(group.children.map(c => c.userData.siteKey)).toEqual(profile.sites);
    let draws = 0, bytes = 0, instances = 0;
    group.traverse(o => {
      expect(o.matrixAutoUpdate).toBe(false);
      if (!(o instanceof Mesh)) return;
      draws++;
      expect(o.frustumCulled).toBe(true);
      expect(o.geometry.getAttribute("uv")).toBeUndefined();
      for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
      if (o.geometry.index) bytes += o.geometry.index.array.byteLength;
      expect(o).toBeInstanceOf(InstancedMesh);
      const mesh = o as InstancedMesh;
      instances += mesh.count;
      bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
      const matrix = new Matrix4();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        expect(matrix.elements.every(Number.isFinite)).toBe(true);
        if (native) {
          for (const j of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[j]).toBe(0);
          const scale = new Vector3().setFromMatrixScale(matrix);
          expect(scale.x).toBeCloseTo(profile.nativeGridM, 6);
          expect(scale.y).toBeCloseTo(profile.nativeGridM, 6);
          expect(scale.z).toBeCloseTo(profile.nativeGridM, 6);
        }
      }
    });
    expect(draws).toBe(profile.budget.drawCalls);
    expect(bytes).toBeLessThan(profile.budget.bytesPerRepresentation);
    if (native) expect(instances).toBeLessThan(profile.budget.nativeBlocks);
  }
});
