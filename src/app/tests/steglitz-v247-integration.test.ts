import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  BufferAttribute, BufferGeometry, Color, EdgesGeometry, Group,
  InstancedMesh, LineSegments, Matrix4, Mesh, Quaternion, Vector3,
} from "three";
import { createMinecraftSteglitzV182, createSteglitzV182 } from "../src/SteglitzV182";
import old from "../src/data/steglitzV182Source.json";
import oldNative from "../src/data/steglitzV182Native.json";
import v246 from "../src/data/steglitzV246Details.json";
import plaza from "../src/data/hermannEhlersV247Details.json";
import street from "../src/data/schlossstrasseV247Details.json";

function hash(a: ArrayBufferView): string {
  return createHash("sha256").update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)).digest("hex");
}

function expectedRows(rows: number[][], native: boolean): { matrices: Float32Array; colors: Float32Array } {
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const m = new Matrix4(), c = new Color(), scale = new Vector3();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (native) m.identity(); else m.makeRotationY(row[6]);
    m.scale(scale.set(row[3], row[4], row[5])).setPosition(row[0], row[1], row[2]);
    matrices.set(m.elements, i * 16);
    c.setHex(row[native ? 6 : 7]).toArray(colors, i * 3);
  }
  return { matrices, colors };
}

function expectPrefix(mesh: InstancedMesh, rows: number[][], native: boolean): void {
  const expected = expectedRows(rows, native);
  expect(hash(mesh.instanceMatrix.array.subarray(0, expected.matrices.length))).toBe(hash(expected.matrices));
  expect(hash(mesh.instanceColor!.array.subarray(0, expected.colors.length))).toBe(hash(expected.colors));
}

function dispose(root: Group): void {
  root.traverse(o => {
    if (!(o instanceof Mesh || o instanceof LineSegments)) return;
    o.geometry.dispose();
    for (const material of new Set([
      ...(Array.isArray(o.material) ? o.material : [o.material]),
      o.userData.dayMaterial, o.userData.nightMaterial,
    ])) material?.dispose();
  });
}

function signature(root: Group): { bytes: number; draws: number; buffers: string[] } {
  let bytes = 0, draws = 0;
  const buffers: string[] = [];
  root.traverse(o => {
    if (!(o instanceof Mesh || o instanceof LineSegments)) return;
    draws++;
    for (const [name, attr] of Object.entries(o.geometry.attributes)) {
      bytes += attr.array.byteLength; buffers.push(name + hash(attr.array));
    }
    if (o.geometry.index) { bytes += o.geometry.index.array.byteLength; buffers.push(hash(o.geometry.index.array)); }
    if (o instanceof InstancedMesh) {
      bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
      buffers.push(hash(o.instanceMatrix.array), hash(o.instanceColor!.array));
    }
    expect(o.matrixAutoUpdate).toBe(false);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) expect((m as any).map).toBeNull();
  });
  return { bytes, draws, buffers };
}

test("v247 retains every earlier Steglitz source triangle, colour, normal and architectural edge", () => {
  const root = createSteglitzV182();
  const mesh = root.children[0] as Mesh, edges = root.children[1] as LineSegments;
  const oldPositions = new Float32Array(old.surfaces.flatMap(s => s.triangles.flat(2)));
  const oldColors = new Float32Array(oldPositions.length), color = new Color();
  let offset = 0;
  for (const s of old.surfaces) {
    color.setHex(s.color);
    for (const t of s.triangles) for (const _p of t) { color.toArray(oldColors, offset); offset += 3; }
  }
  const expected = new BufferGeometry();
  expected.setAttribute("position", new BufferAttribute(oldPositions, 3));
  expected.computeVertexNormals();
  const expectedEdges = new EdgesGeometry(expected, 20);
  for (const [name, array] of [
    ["position", oldPositions], ["color", oldColors], ["normal", expected.getAttribute("normal").array],
  ] as const) expect(hash(mesh.geometry.getAttribute(name).array.subarray(0, array.length))).toBe(hash(array));
  expect(hash(edges.geometry.getAttribute("position").array)).toBe(hash(expectedEdges.getAttribute("position").array));
  // The new mapped plaza must actually be delivered, not just retained in JSON.
  const positions = mesh.geometry.getAttribute("position").array;
  const firstPlazaTriangle = new Float32Array(plaza.surfaces[0].triangles[0].flat());
  let found = false;
  for (let n = oldPositions.length; n < positions.length; n += 9) {
    if (hash(positions.subarray(n, n + 9)) === hash(firstPlazaTriangle)) { found = true; break; }
  }
  expect(found).toBe(true);
  expectedEdges.dispose(); expected.dispose(); dispose(root);
});

test("v247 preserves the complete prior drawn/native instance prefixes and every scaffold/memorial rod", () => {
  const drawn = createSteglitzV182(), native = createMinecraftSteglitzV182();
  const dm = drawn.children[2] as InstancedMesh, nm = native.children[0] as InstancedMesh;
  expectPrefix(dm, [...old.boxes, ...v246.boxes, ...plaza.boxes, ...street.boxes], false);
  expectPrefix(nm, [...oldNative.boxes, ...v246.nativeRows, ...plaza.nativeRows, ...street.nativeRows], true);
  const matrices = new Float32Array(old.rods.length * 16), colors = new Float32Array(old.rods.length * 3);
  const a = new Vector3(), b = new Vector3(), direction = new Vector3(), size = new Vector3();
  const q = new Quaternion(), m = new Matrix4(), up = new Vector3(0, 1, 0), color = new Color();
  old.rods.forEach((r, i) => {
    a.fromArray(r); b.fromArray(r, 3); direction.subVectors(b, a);
    const length = direction.length(); q.setFromUnitVectors(up, direction.normalize());
    m.compose(a.add(b).multiplyScalar(.5), q, size.set(r[6], length, r[6]));
    matrices.set(m.elements, i * 16); color.setHex(r[7]).toArray(colors, i * 3);
  });
  const firstRod = dm.count - old.rods.length;
  expect(hash(dm.instanceMatrix.array.subarray(firstRod * 16))).toBe(hash(matrices));
  expect(hash(dm.instanceColor!.array.subarray(firstRod * 3))).toBe(hash(colors));
  expect(nm.count).toBeGreaterThanOrEqual(oldNative.boxes.length + v246.nativeRows.length + plaza.nativeRows.length);
  dispose(drawn); dispose(native);
});

test("v247 keeps complete touch detail, three/one draw calls and original total byte limits", () => {
  for (const [factory, cap, draws] of [
    [createSteglitzV182, 900_000, 3], [createMinecraftSteglitzV182, 2_250_000, 1],
  ] as const) {
    const desktop = factory(), touch = factory({ mobileLike: true });
    const a = signature(desktop), b = signature(touch);
    expect(a).toEqual(b); expect(a.draws).toBe(draws); expect(a.bytes).toBeLessThan(cap);
    if (factory === createMinecraftSteglitzV182) {
      const mesh = desktop.children[0] as InstancedMesh;
      for (let i = 0; i < mesh.count; i++) for (const axis of [1, 2, 4, 6, 8, 9]) {
        expect(mesh.instanceMatrix.array[i * 16 + axis]).toBe(0);
      }
    }
    dispose(desktop); dispose(touch);
  }
});
