import { CircleGeometry, ConeGeometry, CylinderGeometry, PlaneGeometry, RingGeometry, SphereGeometry, TorusGeometry } from "three";
import { describe, expect, test } from "bun:test";
import {
  BoxGeometry, BufferAttribute, BufferGeometry, DynamicDrawUsage,
  Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh,
  IntType, InterleavedBufferAttribute, Matrix4, Mesh, MeshBasicMaterial,
  Raycaster, Uint8BufferAttribute, Vector3,
} from "three";
import { WebGLAttributes } from "three/src/renderers/webgl/WebGLAttributes.js";
import { WebGLGeometries } from "three/src/renderers/webgl/WebGLGeometries.js";
import { interleaveStaticGeometry, STATIC_INTERLEAVE_MAX_BYTES } from "../src/interleaveStaticGeometry";

function fixture(): BufferGeometry {
  const geometry = new BufferGeometry().copy(new BoxGeometry());
  geometry.userData = { exactIndexPending: false, source: { id: "unchanged" } };
  geometry.setAttribute("color", new Float32BufferAttribute(
    Array.from({ length: 24 * 3 }, (_, i) => (i % 17) / 16), 3, true));
  geometry.setDrawRange(3, 27); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  for (const [name, a] of Object.entries(geometry.attributes)) a.name = `authored ${name}`;
  return geometry;
}

/** Inspect raw bits using the actual vertex stride, without numeric conversion. */
function bits(geometry: BufferGeometry): Record<string, number[]> {
  const output: Record<string, number[]> = {};
  for (const [name, a] of Object.entries(geometry.attributes)) {
    const words = new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.byteLength / 4);
    const stride = a instanceof InterleavedBufferAttribute ? a.data.stride : a.itemSize;
    const offset = a instanceof InterleavedBufferAttribute ? a.offset : 0;
    output[name] = [];
    for (let v = 0; v < a.count; v++) for (let c = 0; c < a.itemSize; c++) output[name].push(words[v * stride + offset + c]);
  }
  return output;
}

function backend() {
  const uploads: ArrayBufferView[] = [], removed: unknown[] = []; let id = 0;
  const gl = {
    ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963, FLOAT: 5126, UNSIGNED_SHORT: 5123, UNSIGNED_INT: 5125,
    createBuffer: () => ({ id: ++id }), bindBuffer: () => {},
    bufferData: (_target: number, array: ArrayBufferView) => uploads.push(array),
    deleteBuffer: (buffer: unknown) => removed.push(buffer),
  };
  const attributes = WebGLAttributes(gl);
  const geometries = WebGLGeometries(gl, attributes, { memory: { geometries: 0 } }, { releaseStatesOfGeometry: () => {} });
  const upload = (mesh: Mesh) => {
    const geometry = geometries.get(mesh, mesh.geometry); geometries.update(geometry);
    if (geometry.index) attributes.update(geometry.index, gl.ELEMENT_ARRAY_BUFFER);
  };
  return { uploads, removed, upload };
}

describe("lossless immutable vertex-buffer interleaving", () => {
  test("preserves all Float32 bits, index order, metadata, bounds, draw groups and material", () => {
    const g = fixture(), raw = new Uint32Array(g.getAttribute("position").array.buffer);
    raw[0] = 0x80000000; raw[1] = 0x7fc00001; raw[2] = 0x7fc00002;
    const before = bits(g), data = g.userData, index = g.index, groups = g.groups;
    const range = g.drawRange, box = g.boundingBox, sphere = g.boundingSphere;
    const material = new MeshBasicMaterial({ vertexColors: true }), mesh = new Mesh(g, material);
    mesh.visible = false; mesh.position.set(12, 5, -9); mesh.updateMatrix(); const matrix = mesh.matrix.clone();
    expect(interleaveStaticGeometry(mesh)).toEqual({ geometries: 1, savedBuffers: 3, bytes: 24 * 11 * 4 });
    expect(bits(g)).toEqual(before); expect(g.index).toBe(index); expect(g.groups).toBe(groups);
    expect(g.drawRange).toBe(range); expect(g.userData).toBe(data); expect(g.boundingBox).toBe(box); expect(g.boundingSphere).toBe(sphere);
    expect(mesh.material).toBe(material); expect(mesh.visible).toBeFalse(); expect(mesh.matrix.equals(matrix)).toBeTrue();
    const shared = (g.getAttribute("position") as InterleavedBufferAttribute).data;
    for (const [name, a] of Object.entries(g.attributes)) {
      expect(a).toBeInstanceOf(InterleavedBufferAttribute); expect((a as InterleavedBufferAttribute).data).toBe(shared);
      expect(a.name).toBe(`authored ${name}`); expect(a.normalized).toBe(name === "color");
    }
  });

  test("stock Three backend uploads two instead of five buffers, same bytes, one disposal each", () => {
    const original = new Mesh(fixture(), new MeshBasicMaterial()), packed = new Mesh(original.geometry.clone(), original.material);
    const before = backend(); before.upload(original); expect(before.uploads).toHaveLength(5);
    expect(interleaveStaticGeometry(packed).savedBuffers).toBe(3);
    const after = backend(); after.upload(packed); after.upload(packed); expect(after.uploads).toHaveLength(2);
    expect(after.uploads.reduce((n, a) => n + a.byteLength, 0)).toBe(before.uploads.reduce((n, a) => n + a.byteLength, 0));
    packed.geometry.dispose(); expect(after.removed).toHaveLength(2); expect(new Set(after.removed).size).toBe(2);
  });

  test("packs shared geometry once and leaves instance transforms/colours contiguous", () => {
    const g = new BoxGeometry(), mesh = new InstancedMesh(g, new MeshBasicMaterial(), 2);
    const matrix = new Matrix4().makeTranslation(20, 4, 1); mesh.setMatrixAt(1, matrix);
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0]), 3);
    const instances = mesh.instanceMatrix, colours = mesh.instanceColor, root = new Group(); root.add(mesh, new Mesh(g, mesh.material));
    expect(interleaveStaticGeometry(root)).toEqual({ geometries: 1, savedBuffers: 2, bytes: 24 * 8 * 4 });
    const position = g.getAttribute("position"); expect(interleaveStaticGeometry(root).geometries).toBe(0); expect(g.getAttribute("position")).toBe(position);
    expect(mesh.instanceMatrix).toBe(instances); expect(mesh.instanceColor).toBe(colours);
    const restored = new Matrix4(); mesh.getMatrixAt(1, restored); expect(restored.equals(matrix)).toBeTrue();
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    expect(mesh.boundingBox!.min.toArray()).toEqual([-0.5, -0.5, -0.5]); expect(mesh.boundingBox!.max.toArray()).toEqual([20.5, 4.5, 1.5]);
  });

  test("stock getters, bounds, raycasting and cloning see identical geometry", () => {
    const original = new Mesh(new BoxGeometry(2, 4, 6), new MeshBasicMaterial()), packed = new Mesh(original.geometry.clone(), original.material);
    interleaveStaticGeometry(packed);
    for (const g of [original.geometry, packed.geometry]) { g.computeBoundingBox(); g.computeBoundingSphere(); }
    expect(packed.geometry.boundingBox!.equals(original.geometry.boundingBox!)).toBeTrue(); expect(packed.geometry.boundingSphere!.equals(original.geometry.boundingSphere!)).toBeTrue();
    const ray = new Raycaster(new Vector3(0, 0, 10), new Vector3(0, 0, -1));
    expect(ray.intersectObject(packed).map(h => [h.distance, h.point.toArray(), h.faceIndex])).toEqual(ray.intersectObject(original).map(h => [h.distance, h.point.toArray(), h.faceIndex]));
    expect(bits(packed.geometry.clone())).toEqual(bits(original.geometry));
  });

  test("skips unowned, pending, dynamic, custom, morph, integer and mismatched streams", () => {
    const changes: Array<(g: BufferGeometry) => void> = [
      g => { delete g.userData.exactIndexPending; }, g => { g.userData.exactIndexPending = true; },
      g => { (g.getAttribute("position") as BufferAttribute).setUsage(DynamicDrawUsage); },
      g => { (g.getAttribute("normal") as BufferAttribute).onUpload(() => {}); },
      g => { (g.getAttribute("color") as BufferAttribute).addUpdateRange(0, 3); },
      g => { (g.getAttribute("position") as BufferAttribute).gpuType = IntType; },
      g => { g.setAttribute("color", new Uint8BufferAttribute(new Uint8Array(24 * 3), 3, true)); },
      g => { g.setAttribute("color", new InstancedBufferAttribute(new Float32Array(24 * 3), 3)); },
      g => { g.setAttribute("normal", new Float32BufferAttribute([0, 1, 0], 3)); },
      g => { g.morphAttributes.position = [g.getAttribute("position") as BufferAttribute]; },
      g => { g.userData.flatColorsBuilt = true; }, g => { g.index!.setUsage(DynamicDrawUsage); },
    ];
    for (const change of changes) {
      const g = fixture(); change(g); const attributes = { ...g.attributes };
      expect(interleaveStaticGeometry(new Mesh(g, new MeshBasicMaterial())).geometries).toBe(0);
      for (const [name, a] of Object.entries(attributes)) expect(g.getAttribute(name)).toBe(a);
    }
    const flag = new BoxGeometry(); (flag.getAttribute("position") as BufferAttribute).setUsage(DynamicDrawUsage);
    expect(interleaveStaticGeometry(new Mesh(flag, new MeshBasicMaterial())).geometries).toBe(0);
    const animated = new Mesh(fixture(), new MeshBasicMaterial()); animated.userData.modeColours = [];
    expect(interleaveStaticGeometry(animated).geometries).toBe(0);
  });

  test("bounds temporary allocation without changing oversized source buffers", () => {
    const count = Math.ceil(STATIC_INTERLEAVE_MAX_BYTES / 24) + 1, g = new BufferGeometry(); g.userData.exactIndexPending = false;
    g.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3)); g.setAttribute("normal", new BufferAttribute(new Float32Array(count * 3), 3));
    const positions = g.getAttribute("position"); expect(interleaveStaticGeometry(new Mesh(g, new MeshBasicMaterial())).geometries).toBe(0); expect(g.getAttribute("position")).toBe(positions);
  });
});

// These stock curved constructors have no post-publication vertex mutation in
// the viewer; animation moves their Object3D/instances, never these streams.
test("audited curved stock geometry preserves every vertex/index bit", () => {
  for (const geometry of [new SphereGeometry(), new CylinderGeometry(), new ConeGeometry(), new TorusGeometry(), new PlaneGeometry(), new RingGeometry(), new CircleGeometry()]) {
    const before = bits(geometry), index = geometry.index;
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    expect(interleaveStaticGeometry(mesh).savedBuffers).toBe(2);
    expect(bits(geometry)).toEqual(before);
    expect(geometry.index).toBe(index);
  }
  const dynamic = new SphereGeometry();
  (dynamic.getAttribute("position") as BufferAttribute).setUsage(DynamicDrawUsage);
  expect(interleaveStaticGeometry(new Mesh(dynamic, new MeshBasicMaterial())).geometries).toBe(0);
});
