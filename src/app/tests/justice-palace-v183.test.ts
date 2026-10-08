import { describe, expect, test } from "bun:test";
import { BufferGeometry, InstancedMesh, LineSegments, Material, Mesh } from "three";
import { createJusticePalaceV183 } from "../src/JusticePalaceV183";
import { createMinecraftJusticePalaceV183 } from "../src/MinecraftJusticePalaceV183";
import { CHARLOTTENBURG_CUPOLA_V183, createCharlottenburgCupolaV183 } from "../src/CharlottenburgCupolaV183";
import source from "../src/data/justicePalaceV183.json";

describe("courthouses and palace v183", () => {
  for (const native of [false, true]) test(`bounded independent ${native ? "native" : "drawn"} addition`, () => {
    const root = native ? createMinecraftJusticePalaceV183() : createJusticePalaceV183();
    expect(root.userData.additiveOnly).toBe(true);
    expect(root.userData.sourceGeometryRetained).toBe(true);
    expect(root.children.length).toBe(native ? 2 : 4);
    expect(root.children.some(c => c instanceof LineSegments)).toBe(!native);
    let bytes = 0, count = 0;
    const materials = new Set<Material>();
    root.children.forEach(child => {
      expect(child.matrixAutoUpdate).toBe(false);
      const drawable = child as LineSegments | Mesh;
      const geo = drawable.geometry as BufferGeometry;
      expect(geo.getAttribute("uv")).toBeUndefined();
      expect(geo.boundingSphere).not.toBeNull();
      expect(Number.isFinite(geo.boundingSphere!.radius)).toBe(true);
      Object.values(geo.attributes).forEach(a => { bytes += a.array.byteLength; });
      if (drawable instanceof InstancedMesh) {
        count += drawable.count;
        bytes += drawable.instanceMatrix.array.byteLength + drawable.instanceColor!.array.byteLength;
        expect(drawable.instanceMatrix.count).toBe(drawable.count);
        if (native) {
          expect(drawable.userData.blockNative).toBe(true);
          const data = drawable.instanceMatrix.array;
          for (let i = 0; i < drawable.count; i++) for (const n of [1,2,4,6,8,9]) expect(data[i*16+n]).toBe(0);
        }
        drawable.dispose();
      }
      for (const candidate of [drawable.material, child.userData.dayMaterial, child.userData.nightMaterial]) {
        for (const material of Array.isArray(candidate) ? candidate : [candidate]) if (material instanceof Material) materials.add(material);
      }
      geo.dispose();
    });
    expect(count).toBe(native ? 57217 : 15407);
    expect(bytes).toBeLessThan(native ? 4360000 : 3080000);
    for (const material of materials) material.dispose();
    root.clear();
  });
  test("palace opaque skin stays on its retained wire profile and leaves the lantern open", () => {
    const { center: [cx, cz], profile } = CHARLOTTENBURG_CUPOLA_V183;
    for (const [y, radius] of profile) expect(source.segments.some(s =>
      Math.abs(s[0] - cx - radius) < .001 && Math.abs(s[1] - y) < .001 && Math.abs(s[2] - cz) < .001)).toBe(true);
    for (const native of [false, true]) {
      const mesh = createCharlottenburgCupolaV183(native);
      expect(mesh.userData.surfaceOnly).toBe(true);
      expect(mesh.userData.hiddenSolidInfill).toBe(false);
      expect(mesh.userData.openLantern).toBe(true);
      expect((mesh.material as Material).transparent).toBe(false);
      const points: number[][] = [];
      if (mesh instanceof InstancedMesh) {
        const values = mesh.instanceMatrix.array;
        for (let i = 0; i < mesh.count; i++) {
          const o = i * 16;
          for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) {
            points.push([values[o + 12] + dx * values[o] / 2, values[o + 13] + dy * values[o + 5] / 2, values[o + 14] + dz * values[o + 10] / 2]);
          }
        }
      } else {
        const p = mesh.geometry.getAttribute("position");
        for (let i = 0; i < p.count; i++) points.push([p.getX(i), p.getY(i), p.getZ(i)]);
      }
      for (const [x, y, z] of points) {
        expect(y).toBeGreaterThanOrEqual(20.7 - .001);
        expect(y).toBeLessThanOrEqual(45.3 + .001);
        expect(y > 41.001 && y < 44.299).toBe(false);
        const segment = profile.findIndex((p, i) => i < profile.length - 1 && y >= p[0] - .001 && y <= profile[i + 1][0] + .001);
        const [y0, r0] = profile[segment], [y1, r1] = profile[segment + 1];
        const radius = r0 + (r1 - r0) * (y - y0) / (y1 - y0);
        expect(Math.hypot(x - cx, z - cz)).toBeLessThanOrEqual(radius + .002);
        if (y < 31) expect(Math.hypot(x - cx, z - cz)).toBeGreaterThan(6);
      }
      if (mesh instanceof InstancedMesh) mesh.dispose();
      mesh.geometry.dispose();
      mesh.userData.dayMaterial.dispose(); mesh.userData.nightMaterial.dispose();
    }
  });
});
