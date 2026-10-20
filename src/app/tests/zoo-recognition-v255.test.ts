import { describe, expect, test } from "bun:test";
import { Color, InstancedMesh, Mesh } from "three";
import { createZooGroundsV165, createMinecraftZooGroundsV165 } from "../src/ZooGroundsV165";
import { zooRecognitionV255TowerRoofAt } from "../src/zooRecognitionV255Profile";
import anchors from "../src/data/zooRecognitionV255Source.json";

describe("v255 Zoo Berlin additive recognition", () => {
  test("keeps the existing render calls and fixed buffer ceilings", () => {
    for (const native of [false, true]) {
      const root = native ? createMinecraftZooGroundsV165() : createZooGroundsV165();
      let calls = 0, bytes = 0;
      root.traverse(object => {
        if (!(object instanceof Mesh)) return;
        calls++;
        for (const a of Object.values(object.geometry.attributes)) bytes += a.array.byteLength;
        bytes += object.geometry.index?.array.byteLength ?? 0;
        if (object instanceof InstancedMesh) {
          bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
          if (native) for (let i = 0; i < object.count; i++)
            for (const index of [1, 2, 4, 6, 8, 9])
              expect(Math.abs(object.instanceMatrix.array[i * 16 + index])).toBe(0);
        }
      });
      expect(calls).toBe(native ? 3 : 6);
      expect(bytes).toBeLessThan(native ? 7_500_000 : 3_300_000);
      expect(root.userData.zooRecognitionV255).toBe(true);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    }
  });

  test("native pagoda roof follows the actual independent orthogonal solids", () => {
    const root = createMinecraftZooGroundsV165();
    const props = root.getObjectByName("Zoo native aviaries climbing rocks and furniture") as InstancedMesh;
    const accepted = [0xad6f59, 0xc58b70, 0xbea14e].map(c => new Color(c));
    const rows: number[][] = [];
    for (let i = 0; i < props.count; i++) {
      const offset = i * 16, c = new Color().fromArray(props.instanceColor!.array, i * 3);
      if (!accepted.some(v => Math.abs(v.r - c.r) + Math.abs(v.g - c.g) + Math.abs(v.b - c.b) < .00001)) continue;
      const m = props.instanceMatrix.array;
      const gold = Math.abs(accepted[2].r - c.r) + Math.abs(accepted[2].g - c.g) + Math.abs(accepted[2].b - c.b) < .00001;
      // Raised tiny lotus marks are decoration, as with the retained v165
      // facade fittings; roof support belongs to structural bands and crown.
      if (!gold && ![.58, .15, 1.08].some(h => Math.abs(h - m[offset + 5]) < .00001)) continue;
      rows.push([m[offset + 12], m[offset + 13], m[offset + 14], m[offset], m[offset + 5], m[offset + 10]]);
    }
    let matches = 0;
    for (let dx = -4; dx <= 4; dx += .37) for (let dz = -4; dz <= 4; dz += .43) {
      const x = anchors.tower.centre[0] + dx, z = anchors.tower.centre[1] + dz;
      if (rows.some(r =>
        Math.abs(Math.abs(x - r[0]) - r[3] / 2) < .003 && Math.abs(z - r[2]) < r[5] / 2 + .003 ||
        Math.abs(Math.abs(z - r[2]) - r[5] / 2) < .003 && Math.abs(x - r[0]) < r[3] / 2 + .003)) continue;
      let expected: number | null = null;
      for (const r of rows) if (Math.abs(x - r[0]) < r[3] / 2 && Math.abs(z - r[2]) < r[5] / 2)
        expected = Math.max(expected ?? 0, r[1] + r[4] / 2);
      if (expected === null || expected < 8.2) continue;
      const actual = zooRecognitionV255TowerRoofAt(x, z, true);
      expect(actual).not.toBeNull();
      expect(actual!).toBeCloseTo(expected, 2);
      matches++;
    }
    expect(matches).toBeGreaterThan(100);
    expect(zooRecognitionV255TowerRoofAt(0, 0)).toBeNull();
    expect(zooRecognitionV255TowerRoofAt(...anchors.tower.centre as [number, number])).toBe(30.2);
  });
});
