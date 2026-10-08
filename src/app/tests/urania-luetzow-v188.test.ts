import { expect, test } from "bun:test";
import { Color, InstancedMesh, Mesh, Matrix4, Vector3 } from "three";
import { createUraniaLuetzowV188 } from "../src/UraniaLuetzowV188";
import source from "../src/data/uraniaLuetzowV188.json";

test("Urania upper supplement keeps the exact official roof and old entrance below it", () => {
  expect(source.urania.id).toBe("DEBE07YY900005Dq");
  expect(source.urania.additionFloorY).toBe(5.2 + 9);
  expect(source.urania.sourceTopY).toBe(19.935);
  const root = createUraniaLuetzowV188();
  const roof = root.children[2] as Mesh;
  expect(Array.from(roof.geometry.attributes.position.array)).toEqual(
    Array.from(new Float32Array(source.urania.highRoof.slice(0, -1).flat())),
  );
  for (let i = 1; i < roof.geometry.attributes.normal.array.length; i += 3) {
    expect(roof.geometry.attributes.normal.array[i]).toBe(1);
  }
  expect(root.userData.sourceGeometryRetained).toBe(true);
  expect(root.userData.basinSourceIds).toEqual(["node/4360435502", "node/4360435503", "node/4360435504"]);
});

test("both source sites have exact-size texture-free buffers with independent culling", () => {
  for (const native of [false, true]) {
    const root = createUraniaLuetzowV188(native);
    expect(root.children).toHaveLength(native ? 2 : 3);
    let bytes = 0, count = 0;
    for (const object of root.children) {
      const mesh = object as Mesh;
      expect(mesh.frustumCulled).toBe(true);
      expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      for (const attribute of Object.values(mesh.geometry.attributes)) bytes += attribute.array.byteLength;
      if (mesh.geometry.index) bytes += mesh.geometry.index.array.byteLength;
      if (!(mesh instanceof InstancedMesh)) continue;
      count += mesh.count;
      expect(mesh.instanceMatrix.count).toBe(mesh.count);
      expect(mesh.instanceColor!.count).toBe(mesh.count);
      bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
      expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBe(true);
      expect(mesh.boundingSphere!.radius).toBeLessThan(90);
      expect(mesh.userData.blockNative).toBe(native);
      if (native) for (let i = 0; i < mesh.count; i++) {
        for (const k of [1, 2, 4, 6, 8, 9]) expect(mesh.instanceMatrix.array[i * 16 + k]).toBe(0);
      }
    }
    expect(count).toBe(native ? 2708 : 458);
    expect(bytes).toBeLessThan(native ? 210_000 : 38_000);
  }
});

test("three basins stay hollow with distinct water surfaces at their actual OSM anchors", () => {
  const root = createUraniaLuetzowV188();
  const mesh = root.children[1] as InstancedMesh, matrix = new Matrix4(), point = new Vector3();
  const centers: number[][] = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix);
    if (Math.abs(point.y - 5.46) < .0001) centers.push([point.x, point.z]);
  }
  expect(centers).toHaveLength(3);
  centers.forEach((xz, i) => {
    expect(xz[0]).toBeCloseTo(source.fountains[i].xz[0], 3);
    expect(xz[1]).toBeCloseTo(source.fountains[i].xz[1], 3);
  });
});

test("URANIA reads left to right for an observer on the street outside the west wall", () => {
  // Looking towards the wall with world-up fixed, screen-right points south.
  const outward = new Vector3(-.933, 0, -.359).normalize();
  const observerRight = new Vector3(0, 1, 0).cross(outward).normalize();
  const ink = new Color(0x29363a), tint = new Color(), matrix = new Matrix4();
  for (const native of [false, true]) {
    const mesh = createUraniaLuetzowV188(native).children[0] as InstancedMesh;
    const strokes: Vector3[] = [];
    for (let i = 0; i < mesh.count; i++) {
      mesh.getColorAt(i, tint);
      if (Math.abs(tint.r - ink.r) + Math.abs(tint.g - ink.g) + Math.abs(tint.b - ink.b) > .00001) continue;
      mesh.getMatrixAt(i, matrix);
      strokes.push(new Vector3().setFromMatrixPosition(matrix));
    }
    expect(strokes.length).toBeGreaterThan(100);
    // Stroke emission follows the inscription U…A. Its first U must be left
    // of the final A in the outside observer's frame, in both representations.
    const readingDirection = strokes.at(-1)!.clone().sub(strokes[0]);
    expect(readingDirection.dot(observerRight)).toBeGreaterThan(5);
  }
});
