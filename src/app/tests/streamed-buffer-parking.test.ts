import { expect, test } from "bun:test";
import { BufferAttribute, BufferGeometry, Group, InstancedMesh, Mesh } from "three";
import { hasParkedStaticStorageBackingV323, parkAttachedWorldBuffers } from "../src/losslessStaticStorage";

function terrain(values: Float32Array) {
  const position = new BufferAttribute(values, 3);
  const geometry = new BufferGeometry().setAttribute("position", position);
  geometry.userData.losslessStaticBacking = true;
  return { mesh: new Mesh(geometry), position };
}

for (const fallback of [false, true]) {
  test(`streamed geometry retains exact bits, including shared storage, fallback=${fallback}`, async () => {
    const native = globalThis.CompressionStream;
    if (fallback) globalThis.CompressionStream = undefined as unknown as typeof CompressionStream;
    try {
      const source = new Uint32Array(180_000);
      for (let i = 0; i < source.length; i++) source[i] = 0x3f80_0000 + i % 32;
      source[1] = 0x8000_0000;
      source[2] = 0x7fc0_1234;
      const original = source.slice();
      const owned = terrain(new Float32Array(source.buffer));
      const shared = terrain(new Float32Array(source.slice().buffer));
      const borrowed = shared.position.array;
      const alias = new BufferAttribute(borrowed.subarray(0, 3), 3);
      const root = new Group();
      root.add(owned.mesh, shared.mesh, new Mesh(new BufferGeometry().setAttribute("position", alias)));
      await parkAttachedWorldBuffers(root, true, false, () => false, async () => {});
      expect(hasParkedStaticStorageBackingV323(owned.position)).toBe(true);
      expect(source.byteLength).toBe(0);
      expect(Buffer.from(owned.position.array.buffer)).toEqual(Buffer.from(original.buffer));
      expect(shared.position.array).toBe(borrowed);
      expect(borrowed.byteLength).toBe(original.byteLength);
      expect(alias.getX(0)).toBe(borrowed[0]);
    } finally {
      globalThis.CompressionStream = native;
    }
  });
}

test("cancelling an attached root in flight preserves its original backing", async () => {
  const root = new Group();
  const { mesh, position } = terrain(new Float32Array(180_000));
  const original = position.array;
  root.add(mesh);
  let cancelled = false;
  const pending = parkAttachedWorldBuffers(root, true, false, () => cancelled, async () => {});
  cancelled = true;
  await expect(pending).rejects.toThrow("cancelled");
  expect(position.array).toBe(original);
  expect(original.byteLength).toBe(720_000);
  expect(hasParkedStaticStorageBackingV323(position)).toBe(false);
});

test("only finalized instance matrices join attached geometry parking", async () => {
  const root = new Group();
  const mesh = new InstancedMesh(undefined, undefined, 4096);
  root.add(mesh);
  const original = new Float32Array(mesh.instanceMatrix.array);
  await parkAttachedWorldBuffers(root, false, false, () => false, async () => {});
  expect(hasParkedStaticStorageBackingV323(mesh.instanceMatrix)).toBe(false);
  await parkAttachedWorldBuffers(root, false, true, () => false, async () => {});
  expect(hasParkedStaticStorageBackingV323(mesh.instanceMatrix)).toBe(true);
  expect(Buffer.from(mesh.instanceMatrix.array.buffer)).toEqual(Buffer.from(original.buffer));
});
