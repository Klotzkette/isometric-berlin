import { describe, expect, test } from "bun:test";
import { BufferAttribute, BufferGeometry, EdgesGeometry } from "three";
import paving from "../src/data/hermannEhlersV247Details.json";

describe("Hermann-Ehlers-Platz v247 bounded existing-batch addition", () => {
  test("complete contour contributes a finite plane and its real hole boundaries", () => {
    const positions = new Float32Array(paving.surfaces.flatMap(s => s.triangles.flat(2)));
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(positions.length), 3));
    geometry.computeVertexNormals();
    const edges = new EdgesGeometry(geometry, 20);
    const bytes = Object.values(geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0)
      + edges.getAttribute("position").array.byteLength;
    expect(positions.length / 9).toBe(81);
    expect(bytes).toBeLessThan(11_000);
    expect(edges.getAttribute("position").count).toBeGreaterThan(100);
    geometry.dispose(); edges.dispose();
  });

  test("native rows remain orthogonal and use only shared instance capacity", () => {
    expect(paving.boxes).toEqual([]);
    expect(paving.nativeRows).toHaveLength(143);
    expect(paving.nativeRows.length * (16 + 3) * 4).toBeLessThan(11_000);
    for (const [x, y, z, w, h, d] of paving.nativeRows) {
      expect(Number.isInteger(x - w / 2)).toBe(true);
      expect(Number.isInteger(z - d / 2)).toBe(true);
      expect(w).toBeGreaterThan(0); expect(d).toBeGreaterThan(0);
      expect(y + h / 2).toBeCloseTo(3.025, 6);
    }
  });
});
