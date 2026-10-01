import { describe, expect, test } from "bun:test";
import { createMitteHeritageOrnamentRows, MITTE_HERITAGE_ORNAMENT_V166_PROFILE as profile } from "../src/MitteHeritageOrnamentsV166";

function contains(row: number[], x: number, y: number, z: number): boolean {
  const [cx, cy, cz, w, h, d, yaw] = row, dx = x - cx, dz = z - cz;
  const u = Math.cos(yaw) * dx - Math.sin(yaw) * dz, v = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
  return Math.abs(u) < w / 2 && Math.abs(y - cy) < h / 2 && Math.abs(v) < d / 2;
}
function churchPoint(u: number, y: number, v: number): [number, number, number] {
  const p = profile.elisabeth, [a, b] = [p.frontA, p.frontB], yaw = Math.atan2(a[1] - b[1], b[0] - a[0]);
  return [(a[0] + b[0]) / 2 + Math.cos(yaw) * u + Math.sin(yaw) * v, y, (a[1] + b[1]) / 2 - Math.sin(yaw) * u + Math.cos(yaw) * v];
}

describe("source-bound Heine, Elisabeth and Jandorf exterior ornaments", () => {
  test("six square Doric piers leave all five column gaps and rear porch open", () => {
    for (const native of [false, true]) {
      const rows = createMitteHeritageOrnamentRows(native);
      for (const u of profile.elisabeth.pierAxes) expect(rows.boxes.some(r => contains(r, ...churchPoint(u, 7, 2.6)))).toBe(true);
      for (let i = 0; i < 5; i++) {
        const u = (profile.elisabeth.pierAxes[i] + profile.elisabeth.pierAxes[i + 1]) / 2;
        for (const v of [.6, 1.6, 2.6, 3.3]) expect(rows.boxes.some(r => contains(r, ...churchPoint(u, 7, v)))).toBe(false);
      }
      if (!native) {
        const columns = rows.boxes.filter(r => Math.abs(r[4] - 7.9) < 1e-8);
        expect(columns).toHaveLength(6);
        expect(columns.every(r => r[3] === .72 && r[5] === .72)).toBe(true);
      }
    }
  });
  test("seated bronze has an open stool, spread legs, relief stone plinth and head", () => {
    const { heine } = profile;
    const at = (u: number, y: number, v: number): [number, number, number] => [heine.x - Math.cos(heine.yaw) * u + Math.sin(heine.yaw) * v, y, heine.z + Math.sin(heine.yaw) * u + Math.cos(heine.yaw) * v];
    const drawn = createMitteHeritageOrnamentRows(false);
    const heineBoxes = drawn.boxes.filter(r => Math.abs(r[0] - heine.x) < 3);
    expect(heineBoxes.filter(r => r[3] === .065 && r[4] === .56 && r[5] === .065)).toHaveLength(4);
    expect(heineBoxes.some(r => contains(r, ...at(0, 3.4, 0)))).toBe(true);
    const points = drawn.surfaces.flatMap(s => s.triangles.flat()).filter(p => Math.abs(p[0] - heine.x) < 3);
    expect(Math.max(...points.map(p => p[1]))).toBeCloseTo(6.38, 6);
    for (const native of [false, true]) {
      const rows = createMitteHeritageOrnamentRows(native);
      expect(rows.boxes.some(r => contains(r, ...at(0, 4.65, .31)))).toBe(false);
    }
    expect(heine.osmNode).toBe("1884384977");
  });
  test("native is independently authored bounded orthogonal blocks without smooth sheets", () => {
    const native = createMitteHeritageOrnamentRows(true);
    expect(native.surfaces).toHaveLength(0);
    expect(native.boxes.length).toBeLessThan(19000);
    expect(native.boxes.every(r => r[6] === 0 && r.slice(0, 8).every(Number.isFinite) && r[3] > 0 && r[4] > 0 && r[5] > 0)).toBe(true);
    const drawn = createMitteHeritageOrnamentRows(false);
    expect(drawn.boxes).toHaveLength(700);
    expect(drawn.surfaces.reduce((n, s) => n + s.triangles.length, 0)).toBe(9346);
    expect(drawn.boxes.some(r => r[6] !== 0)).toBe(true);
    expect(JSON.stringify(native)).toBe(JSON.stringify(createMitteHeritageOrnamentRows(true)));
  });
  test("Jandorf uses the correct curved source corner, bounded crown and 37 round street window heads", () => {
    const j = profile.jandorf, drawn = createMitteHeritageOrnamentRows(false);
    expect(j.osmWay).toBe("33791235");
    expect(j.parentId).toBe("DEBE01YYK0000Dia");
    expect(j.mainPartId).toBe("DEBE3Dqh9NPHTUx9");
    expect(j.cornerX).toBeCloseTo(1916.027, 3);
    const arches = drawn.surfaces.filter(s => s.color === 0x526560 && s.triangles.length === 11);
    expect(arches).toHaveLength(37);
    expect(arches.every(s => s.triangles.flat().every(p => p[1] >= 18.829 && p[1] < 19.65))).toBe(true);
    const crown = drawn.surfaces.flatMap(s => s.triangles.flat()).filter(p => p[1] > j.sourceRidgeY);
    expect(crown.length).toBeGreaterThan(500);
    expect(crown.every(p => Math.hypot(p[0] - j.cornerX, p[2] - j.cornerZ) < 3.15)).toBe(true);
    expect(Math.max(...crown.map(p => p[1]))).toBeCloseTo(43.4, 5);
    expect(drawn.boxes.some(r => r[0] === j.cornerX && r[2] === j.cornerZ && r[1] + r[4] / 2 === j.crownTopY)).toBe(true);
  });
});
