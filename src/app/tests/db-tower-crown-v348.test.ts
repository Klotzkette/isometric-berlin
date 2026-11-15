import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Matrix4, Mesh, Vector3 } from "three";
import { createDbTowerArchitecture, createMinecraftDbTowerArchitecture, planDbTowerArchitecture } from "../src/DbTowerArchitecture";
import { planDbTowerCrownV348 } from "../src/DbTowerCrownV348";
import { DB_TOWER_PROFILE as P, DB_TOWER_SOURCE as S } from "../src/dbTowerProfile";
import { deserializeTransferredObject3D, serializeObject3DForTransfer } from "../src/transferableObject3D";

function hash(value: unknown): number {
  const text = JSON.stringify(value); let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

describe("V348 source-bound BahnTower crown steelwork", () => {
  test("retains every original fitting and source-body coordinate from published227", () => {
    // Independently captured by executing DbTowerArchitecture.ts from 00cc1ce0.
    for (const [native, mobile, count, fingerprint] of [
      [false, false, 12549, 2356644558], [false, true, 12549, 2356644558],
      [true, false, 10637, 3615890822], [true, true, 5655, 464684952],
    ] as const) {
      const previous = planDbTowerArchitecture(native, mobile).filter(b => !b.role.startsWith("v348 "));
      expect(previous.length).toBe(count); expect(hash(previous)).toBe(fingerprint);
    }
    const body = createDbTowerArchitecture().getObjectByName("BahnTower exact LoD2 roof and body planes") as Mesh;
    expect(hash(Array.from(body.geometry.getAttribute("position").array))).toBe(125990231);
    expect(S.parts.reduce((n, p) => n + p.surfaces.length, 0)).toBe(99);
  });

  test("adds only open crown braces with complete cardinal Native and equal mobile detail", () => {
    const drawn = planDbTowerCrownV348(), native = planDbTowerCrownV348(true);
    expect(drawn.length).toBe(42); expect(native.length).toBeGreaterThan(drawn.length);
    expect(native.length).toBeLessThan(500);
    expect(drawn.filter(b => b.tilt !== 0)).toHaveLength(20);
    for (const b of [...drawn, ...native]) {
      expect(b.family).toBe("frame"); expect(b.size.every(n => n > 0 && Number.isFinite(n))).toBe(true);
      expect(b.position[1]).toBeGreaterThan(P.mainTop); expect(b.position[1]).toBeLessThan(P.crownTop);
    }
    for (const b of native) { expect(b.yaw).toBe(0); expect(b.tilt).toBe(0); }
    for (const mc of [false, true]) {
      const full = planDbTowerArchitecture(mc).filter(b => b.role.startsWith("v348 "));
      expect(planDbTowerArchitecture(mc, true).filter(b => b.role.startsWith("v348 "))).toEqual(full);
    }
  });

  test("unknown or changed measured sources close the additive construction gate", () => {
    const original = S.parts[1].ring[0][0];
    try {
      S.parts[1].ring[0][0] += .001;
      expect(planDbTowerCrownV348()).toEqual([]); expect(planDbTowerCrownV348(true)).toEqual([]);
    } finally { S.parts[1].ring[0][0] = original; }
    expect(planDbTowerCrownV348()).toHaveLength(42);
  });

  test("production construction reuses existing batches, bounds and transfer lifecycle", () => {
    for (const mc of [false, true]) for (const mobileLike of [false, true]) {
      const root = mc ? createMinecraftDbTowerArchitecture({ mobileLike }) : createDbTowerArchitecture({ mobileLike });
      const meshes: Mesh[] = []; root.traverse(o => { if (o instanceof Mesh) meshes.push(o); });
      expect(meshes.length).toBe(mc ? 5 : 6);
      expect(meshes.reduce((n, m) => n + (m instanceof InstancedMesh ? m.count : 0), 0)).toBeLessThan(13000);
      expect(new Box3().setFromObject(root).max.y).toBeLessThanOrEqual(P.top + .02);
      const frame = root.getObjectByName("BahnTower frame") as InstancedMesh;
      const firstNew = planDbTowerArchitecture(mc, mobileLike).filter(b => b.family === "frame" && !b.role.startsWith("v348 ")).length;
      const matrix = new Matrix4(), position = new Vector3(); frame.getMatrixAt(firstNew, matrix);
      position.setFromMatrixPosition(matrix);
      const expected = planDbTowerCrownV348(mc)[0];
      expect(position.distanceTo(new Vector3(...expected.position))).toBeLessThan(.0001);
      if (!mc) expect(Math.abs(matrix.elements[1])).toBeGreaterThan(1);
      const copy = deserializeTransferredObject3D(structuredClone(serializeObject3DForTransfer(root).object));
      const restored = copy.getObjectByName("BahnTower frame") as InstancedMesh;
      expect(restored.count).toBe(frame.count);
      expect(Array.from(restored.instanceMatrix.array)).toEqual(Array.from(frame.instanceMatrix.array));
      expect(restored.userData.nightMaterial).toBeDefined(); expect(restored.userData.moonlitMaterial).toBeDefined();
      expect(frame.geometry.getAttribute("uv")).toBeUndefined();
    }
  });
});
