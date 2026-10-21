import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createHbfNorthApproach } from "../src/HbfNorthApproach";
import { appendReichstagPublicRealmV256, REICHSTAG_PUBLIC_REALM_V256 } from "../src/ReichstagPublicRealmV256";
import data from "../src/data/reichstagPublicRealmV256.json";

describe("Source-bound Reichstag and Forum public realm v256", () => {
  test("samples each retained location against the shared terrain in both independent modes", () => {
    for (const native of [false, true]) {
      const members: number[][] = [];
      const rows = native ? data.nativeRows : data.boxes;
      const terrain = (x: number, z: number) => 4 + x * 0.002 + z * 0.001;
      const count = appendReichstagPublicRealmV256({
        native,
        box(position, size, tint, yaw = 0) { members.push([...position, ...size, yaw, tint]); },
      }, terrain);
      expect(count).toBe(native ? 2353 : 1202);
      expect(members).toHaveLength(rows.length);
      for (let i = 0; i < count; i++) {
        const input = rows[i], output = members[i];
        expect(output[0]).toBe(input[0]);
        expect(output[2]).toBe(input[2]);
        expect(output[1]).toBe(terrain(input[0], input[2]) + input[1]);
        expect(output.slice(3, 6)).toEqual(input.slice(3, 6));
        expect(output[6]).toBe(native ? 0 : input[6]);
      }
    }
  });

  test("uses the existing static public-space batches without extra draws or textures", () => {
    for (const native of [false, true]) {
      const root = createHbfNorthApproach(() => 3.025, native);
      expect(root.userData.reichstagPublicRealmV256).toBe(REICHSTAG_PUBLIC_REALM_V256);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.children).toHaveLength(native ? 1 : 2);
      let bytes = 0;
      root.traverse(object => {
        if (!(object instanceof Mesh)) return;
        for (const attribute of Object.values(object.geometry.attributes)) bytes += attribute.array.byteLength;
        bytes += object.geometry.index?.array.byteLength ?? 0;
        if (object instanceof InstancedMesh) {
          bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
        }
        expect((object.material as { map?: unknown }).map ?? null).toBeNull();
        expect(object.matrixAutoUpdate).toBe(false);
      });
      expect(bytes).toBeLessThan(5_000_000);
      expect(root.userData.unityVisitorV256.bronzePlaque).toBe(true);
    }
  });
});
