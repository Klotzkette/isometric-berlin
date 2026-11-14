import { Group, Matrix4, Mesh, Vector3, type Object3D } from "three";
import { ALT_MITTE_V169_GROUP, ALT_MITTE_V169_NATIVE_GROUP } from "./AltMitteCoreV169";

/** Actual resident packet coordinates, never a declaration that a host exists. */
export type SourceWallHostReceiptV344 = {
  packetId: string;
  origin: readonly number[];
  triangles: readonly { offset: number; positions: readonly number[] }[];
};

/** Run before static geometry compaction/parking. A changed, retired, moved or
 * missing source face admits no decoration. This does not retain host buffers. */
export function createSourceWallHostVerifierV344(world: Group, native: boolean) {
  const name = native ? ALT_MITTE_V169_NATIVE_GROUP : ALT_MITTE_V169_GROUP;
  const root = world.getObjectByName(name);
  const hosts = new Map<string, Mesh>();
  if (root instanceof Group && root.userData.sourceEnvelopeResident === true) {
    for (const child of root.children) {
      if (child.userData.sourceEnvelopeResident !== true || !child.name.startsWith(`${name}: `)) continue;
      const id = child.name.slice(name.length + 2);
      const bodies = child.children.filter((o): o is Mesh => o instanceof Mesh &&
        o.name.endsWith(" mapped surfaces and massing") && !o.userData.facadeOnly);
      if (bodies.length === 1) hosts.set(id, bodies[0]);
    }
  }
  const point = new Vector3();
  const transform = new Matrix4();
  return (receipts: readonly SourceWallHostReceiptV344[]): boolean => {
    if (!receipts.length) return false;
    for (const receipt of receipts) {
      const mesh = hosts.get(receipt.packetId);
      if (!mesh || mesh.parent?.parent !== root || !receipt.triangles.length || receipt.origin.length !== 3) return false;
      const position = mesh.geometry.getAttribute("position"), index = mesh.geometry.index;
      if (!position || !index) return false;
      // Compose the actual local transform chain ourselves. A cached
      // matrixWorld can remain stale on a frozen staging ancestor, including
      // matrixWorldAutoUpdate=false; it must not admit a translated host.
      const ancestry: Object3D[] = [];
      for (let node: Object3D | null = mesh; node; node = node.parent) ancestry.push(node);
      transform.identity();
      for (let i = ancestry.length - 1; i >= 0; i--) {
        const node = ancestry[i];
        if (node.matrixAutoUpdate) node.updateMatrix();
        transform.multiply(node.matrix);
      }
      for (const triangle of receipt.triangles) {
        if (triangle.positions.length !== 9 || triangle.offset < 0 || triangle.offset + 2 >= index.count) return false;
        const ids = [index.getX(triangle.offset), index.getX(triangle.offset + 1), index.getX(triangle.offset + 2)];
        if (new Set(ids).size !== 3) return false;
        for (let k = 0; k < 3; k++) {
          const i = ids[k], p = triangle.positions.slice(k * 3, k * 3 + 3);
          if (position.getX(i) !== p[0] || position.getY(i) !== p[1] || position.getZ(i) !== p[2]) return false;
          point.fromBufferAttribute(position, i).applyMatrix4(transform);
          if (point.toArray().some((v, axis) => Math.abs(v - (receipt.origin[axis] + p[axis] / 100)) > .00001)) return false;
        }
      }
    }
    return true;
  };
}
