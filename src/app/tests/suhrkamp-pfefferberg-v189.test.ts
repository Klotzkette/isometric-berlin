import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh, Texture } from "three";
import { createSuhrkampPfefferbergV189 } from "../src/SuhrkampPfefferbergV189";
import source from "../src/data/suhrkampPfefferbergV189.json";

describe("source-bound Suhrkamp and Pfefferberg", () => {
  for (const native of [false, true]) test(native ? "separate axis-aligned native reading" : "full static drawn reading", () => {
    const root = createSuhrkampPfefferbergV189(native);
    expect(root.userData.sourcePartCount).toBe(22);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.sourceGeometryRetained).toBe(true);
    expect(root.children).toHaveLength(2);
    let count = 0, bytes = 0;
    root.traverse(object => {
      expect(object.matrixAutoUpdate).toBe(false);
      if (!(object instanceof InstancedMesh)) return;
      count += object.count;
      expect(object.geometry.getAttribute("uv")).toBeUndefined();
      expect(object.boundingBox!.max.x - object.boundingBox!.min.x).toBeLessThan(125);
      expect(object.boundingBox!.max.z - object.boundingBox!.min.z).toBeLessThan(120);
      expect(object.boundingBox!.min.y).toBeGreaterThanOrEqual(2.99);
      for (const attribute of Object.values(object.geometry.attributes)) bytes += attribute.array.byteLength;
      bytes += object.geometry.index!.array.byteLength + object.instanceMatrix.array.byteLength + object.instanceColor!.array.byteLength;
      if (native) for (let i = 0; i < object.count; i++) {
        const array = object.instanceMatrix.array;
        for (const j of [1, 2, 4, 6, 8, 9]) expect(array[i * 16 + j]).toBe(0);
      }
      const materials = [object.userData.dayMaterial, object.userData.nightMaterial];
      for (const material of materials) for (const value of Object.values(material)) expect(value instanceof Texture).toBe(false);
    });
    expect(count).toBe(native ? 6806 : 2029);
    expect(bytes).toBeLessThan(native ? 530000 : 170000);
    console.log(JSON.stringify({ native, batches: root.children.length, count, renderedVertices: count * 24, bytes }));
    root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      object.userData.dayMaterial.dispose(); object.userData.nightMaterial.dispose();
    });
  });
  test("all ten Suhrkamp facings cover old relief on the measured outward wall side", () => {
    const root = createSuhrkampPfefferbergV189();
    const mesh = root.children.find(object => object.userData.site === "suhrkamp") as InstancedMesh;
    const ranges = mesh.userData.sourceFaceRanges as { faceIndex: number; first: number; skinCount: number; count: number }[];
    expect(ranges).toHaveLength(10);
    const matrix = new Matrix4();
    for (const range of ranges) {
      const face = source.faces[range.faceIndex];
      const length = Math.hypot(face.b[0] - face.a[0], face.b[1] - face.a[1]);
      const tx = (face.b[0] - face.a[0]) / length, tz = (face.b[1] - face.a[1]) / length;
      expect(face.kind.startsWith("suhrkamp")).toBe(true);
      expect(range.skinCount).toBe(1);
      mesh.getMatrixAt(range.first, matrix);
      const m = matrix.elements;
      const outward = (m[12] - face.a[0]) * face.normal[0] + (m[14] - face.a[1]) * face.normal[1];
      const along = (m[12] - face.a[0]) * tx + (m[14] - face.a[1]) * tz;
      // Full bounded backing, with a 2 cm inset inside the accepted source wall.
      expect(outward).toBeCloseTo(.52, 3);
      expect(along).toBeCloseTo(length / 2, 3);
      expect(Math.hypot(m[0], m[2])).toBeCloseTo(length - .04, 3);
      expect(Math.hypot(m[8], m[10])).toBeCloseTo(.10, 4);
      expect(m[13] - m[5] / 2).toBeCloseTo(face.bottom + .02, 4);
      expect(m[13] + m[5] / 2).toBeCloseTo(face.top - .02, 4);
      expect(Math.abs(m[0] * face.normal[0] + m[2] * face.normal[1])).toBeLessThan(.001);
      // No new pane, frame or ribbon intersects the backing front at 0.57 m.
      for (let i = range.first + 1; i < range.first + range.count; i++) {
        mesh.getMatrixAt(i, matrix);
        const e = matrix.elements;
        const center = (e[12] - face.a[0]) * face.normal[0] + (e[14] - face.a[1]) * face.normal[1];
        const halfDepth = (Math.abs(e[0] * face.normal[0] + e[2] * face.normal[1])
          + Math.abs(e[8] * face.normal[0] + e[10] * face.normal[1])) / 2;
        expect(center - halfDepth).toBeGreaterThan(.62);
      }
    }
    root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      object.userData.dayMaterial.dispose(); object.userData.nightMaterial.dispose();
    });
  });
});
