import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Vector3 } from "three";
import { createGendarmenBndContextV214, gendarmenBndContextV214Members } from "../src/GendarmenBndContextV214";
import { GENDARMEN_BND_CONTEXT_V214_PROFILE as profile } from "../src/gendarmenBndContextV214Profile";
import source from "../src/data/gendarmenBndContextV214Source.json";

function snapshot(native: boolean, mobileLike: boolean) {
  const root = createGendarmenBndContextV214(native, { mobileLike });
  let bytes = 0;
  const batches = root.children.map(c => c as InstancedMesh);
  for (const mesh of batches) {
    bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
    bytes += Object.values(mesh.geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0);
    bytes += mesh.geometry.index?.array.byteLength ?? 0;
  }
  return { root, batches, bytes };
}

describe("bounded Gendarmenmarkt and BND-neighbour context", () => {
  test("recognition is source attached and original owners remain retained", () => {
    const members = gendarmenBndContextV214Members();
    expect(new Set(members.map(m => m.site)).size).toBe(17);
    expect(members.length).toBeLessThan(4000);
    expect(source.replacementOwners).toEqual([]);
    expect(members.some(m => m.site === "living108" && m.role === "folded-aluminium-hood")).toBe(true);
    expect(members.some(m => m.site === "feuerland" && m.role === "balcony-top-rail")).toBe(true);
    // The 15 already authored Gendarmenmarkt facades keep every earlier opening.
    expect(members.filter(m => !["living108", "feuerland"].includes(m.site))
      .every(m => !m.role.includes("window") && !m.role.includes("cladding"))).toBe(true);
    for (const m of members) {
      expect(m.row.every(Number.isFinite)).toBe(true);
      expect(m.row.slice(3, 6).every(x => x > 0)).toBe(true);
      expect(Math.hypot(...m.outward)).toBeCloseTo(1, 5);
    }
  });

  test("both independent forms stay bounded with identical mobile static detail", () => {
    for (const native of [false, true]) {
      const desktop = snapshot(native, false), mobile = snapshot(native, true);
      expect(desktop.bytes).toBe(native ? profile.budget.nativeBytes : profile.budget.drawnBytes);
      expect(desktop.batches).toHaveLength(2);
      expect(desktop.root.userData.sourceGeometryRetained).toBe(true);
      expect(desktop.root.userData.replacementOwners).toEqual([]);
      for (let i = 0; i < 2; i++) {
        const a = desktop.batches[i], b = mobile.batches[i];
        expect(a.instanceMatrix.array).toEqual(b.instanceMatrix.array);
        expect(a.instanceColor!.array).toEqual(b.instanceColor!.array);
        expect(a.geometry.getAttribute("uv")).toBeUndefined();
        expect(a.material).toBeDefined();
        expect(a.matrixAutoUpdate).toBe(false);
      }
    }
  });

  test("native cells are independent orthogonal blocks rather than smooth clones", () => {
    const { batches } = snapshot(true, false), matrix = new Matrix4(), p = new Vector3();
    for (const mesh of batches) for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const e = matrix.elements;
      for (const index of [1, 2, 4, 6, 8, 9]) expect(e[index]).toBe(0);
      p.setFromMatrixPosition(matrix);
      expect(Number.isFinite(p.length())).toBe(true);
      expect(e[0]).toBeGreaterThan(0);
      expect(e[5]).toBe(.5);
      expect(e[10]).toBe(.5);
    }
  });
});
