/** Test-only views of published additions; original objects/buffers are never changed. */
import { expect } from "bun:test";
import { createHash } from "node:crypto";
import { Group, InstancedBufferAttribute, InstancedMesh, type Object3D } from "three";
import receipt from "../fixtures/alexander-retention-v281.json";
import { staticGeometryAudit } from "./staticGeometryAudit";

function historicalView(root: Group, omitted?: Object3D, prefixes = new Map<InstancedMesh, number>()): Object3D {
  // staticGeometryAudit consumes only these two methods. A thin traversal view
  // keeps the original parent/world transforms, geometry, materials and order.
  // Prefix attributes share the original buffers with explicit byte lengths.
  return {
    updateMatrixWorld: (force: boolean) => root.updateMatrixWorld(force),
    traverse: (visit: (object: Object3D) => void) => root.traverse(object => {
      if (object === omitted) return;
      const count = prefixes.get(object as InstancedMesh);
      if (count === undefined) { visit(object); return; }
      const mesh = object as InstancedMesh, view = Object.create(mesh) as InstancedMesh;
      view.count = count;
      view.instanceMatrix = new InstancedBufferAttribute(mesh.instanceMatrix.array.subarray(0, count * 16), 16);
      view.instanceColor = new InstancedBufferAttribute(mesh.instanceColor!.array.subarray(0, count * 3), 3);
      visit(view);
    }),
  } as unknown as Object3D;
}

export function verifyAlexanderNorthRetentionV281(root: Group, native: boolean) {
  const frozen = receipt.north[native ? "native" : "drawn"];
  const addition = root.getObjectByName("Schoenhauser Tor built crown and street entries v274") as InstancedMesh;
  expect(addition).toBeInstanceOf(InstancedMesh);
  expect(addition.parent).toBe(root);
  expect(addition.children).toHaveLength(0);
  expect(root.children.at(-1)).toBe(addition);
  expect(staticGeometryAudit(addition)).toEqual(frozen.addition);
  const full = staticGeometryAudit(root), retained = staticGeometryAudit(historicalView(root, addition));
  expect(full).toEqual(frozen.current);
  expect(retained).toEqual(frozen.before);
  expect(full.budget.draws - retained.budget.draws).toBe(1);
  expect(full.budget.bytes - retained.budget.bytes).toBe(frozen.addition.budget.bytes);
  return { full, retained };
}

export function verifyAlexanderRealmRetentionV281(root: Group, native: boolean) {
  const frozen = receipt.realm[native ? "native" : "drawn"];
  const prefixes = new Map<InstancedMesh, number>();
  let addedBytes = 0;
  for (const suffix of frozen.suffixes) {
    const mesh = root.getObjectByName(suffix.name) as InstancedMesh;
    expect(mesh).toBeInstanceOf(InstancedMesh);
    expect(mesh.count).toBe(suffix.start + suffix.count);
    const digest = (array: ArrayBufferView, width: number) => createHash("sha256").update(
      new Uint8Array(array.buffer, array.byteOffset + suffix.start * width * 4, suffix.count * width * 4),
    ).digest("hex");
    expect(digest(mesh.instanceMatrix.array, 16)).toBe(suffix.matrices);
    expect(digest(mesh.instanceColor!.array, 3)).toBe(suffix.colours);
    prefixes.set(mesh, suffix.start); addedBytes += suffix.count * 76;
  }
  expect(addedBytes).toBe(native ? 659_300 : 112_784);
  const full = staticGeometryAudit(root), retained = staticGeometryAudit(historicalView(root, undefined, prefixes));
  expect(full).toEqual(frozen.current);
  expect(retained).toEqual(frozen.before);
  expect(full.budget.draws).toBe(retained.budget.draws);
  expect(full.budget.bytes - retained.budget.bytes).toBe(addedBytes);
  return { full, retained, addedBytes };
}
