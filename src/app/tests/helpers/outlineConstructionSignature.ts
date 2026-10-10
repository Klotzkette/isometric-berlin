import { createHash } from "node:crypto";
import { InstancedMesh, type Object3D } from "three";

type Attribute = { name: string; itemSize: number; normalized: boolean; count: number; bytes: number };
export type OutlineManifest = { families: number; nodes: { key: string; header: unknown[]; attributes: Attribute[] }[] };

function nodes(root: Object3D): { key: string; node: any }[] {
  const result: { key: string; node: any }[] = [];
  const visit = (node: Object3D, key: string) => {
    result.push({ node, key });
    const siblings = new Map<string, number>();
    for (const child of node.children) {
      const id = JSON.stringify([child.type, child.name]), ordinal = siblings.get(id) ?? 0;
      siblings.set(id, ordinal + 1); visit(child, `${key}/${id}:${ordinal}`);
    }
  };
  visit(root, JSON.stringify([root.type, root.name])); return result;
}
function header(n: any): unknown[] {
  return [n.name,n.type,n.visible,n.matrix.elements,n.position.toArray(),n.rotation.toArray(),n.scale.toArray(),n.renderOrder,n.frustumCulled,n.count??null];
}
function attributes(n: any): [string, any][] {
  const result = Object.entries(n.geometry?.attributes ?? {});
  if (n.geometry?.index) result.push(["index", n.geometry.index]);
  if (n.instanceMatrix) result.push(["instanceMatrix", n.instanceMatrix]);
  if (n.instanceColor) result.push(["instanceColor", n.instanceColor]);
  return result;
}
export function outlineManifest(root: Object3D): OutlineManifest {
  return { families: root.children.length, nodes: nodes(root).map(({ key, node }) => ({ key, header: header(node),
    attributes: attributes(node).map(([name, a]) => ({ name, itemSize: a.itemSize, normalized: a.normalized, count: a.count, bytes: a.array.byteLength })) })) };
}
export function outlineSignature(root: Object3D) {
  const hash = createHash("sha256"); let objects = 0, bytes = 0;
  root.traverse((n: any) => {
    objects++; hash.update(JSON.stringify(header(n)));
    for (const [name, a] of attributes(n)) {
      hash.update(JSON.stringify([name, a.itemSize, a.normalized, a.count]));
      const data = new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength);
      hash.update(data); bytes += data.byteLength;
    }
  });
  return { sha256: hash.digest("hex"), objects, bytes, families: root.children.length };
}

/** Hash every historical byte from the live new tree, in historical order.
 * Only the declared v205 Ring instance suffixes may extend an existing buffer.
 * Header/geometry/attribute changes, missing nodes and shortened arrays fail.
 */
export function preservedOutlineSignature(root: Object3D, manifest: OutlineManifest) {
  const current = new Map(nodes(root).map(({ key, node }) => [key, node]));
  const hash = createHash("sha256"); let bytes = 0;
  for (const record of manifest.nodes) {
    const n = current.get(record.key);
    if (!n) throw new Error(`Lost historical outline node: ${record.key}`);
    const actualHeader = header(n), count = record.header.at(-1);
    const appendOnly = n instanceof InstancedMesh && n.parent?.userData.ringRefinementV205 === true;
    if (appendOnly) {
      if (typeof count !== "number" || n.count < count) throw new Error("Shortened Ring instance array");
      actualHeader[actualHeader.length - 1] = count;
    }
    if (JSON.stringify(actualHeader) !== JSON.stringify(record.header)) throw new Error(`Changed historical transform/header: ${record.key}`);
    hash.update(JSON.stringify(actualHeader));
    const actual = attributes(n);
    if (JSON.stringify(actual.map(([name]) => name)) !== JSON.stringify(record.attributes.map(a => a.name))) throw new Error("Changed historical attribute inventory");
    record.attributes.forEach((before, i) => {
      const [name, a] = actual[i];
      const suffix = appendOnly && (name === "instanceMatrix" || name === "instanceColor");
      if (a.itemSize !== before.itemSize || a.normalized !== before.normalized ||
        (suffix ? a.count < before.count || a.array.byteLength < before.bytes : a.count !== before.count || a.array.byteLength !== before.bytes))
        throw new Error(`Changed historical attribute shape: ${record.key}/${name}`);
      hash.update(JSON.stringify([name, a.itemSize, a.normalized, suffix ? before.count : a.count]));
      const data = new Uint8Array(a.array.buffer, a.array.byteOffset, before.bytes);
      hash.update(data); bytes += data.byteLength;
    });
  }
  return { sha256: hash.digest("hex"), objects: manifest.nodes.length, bytes, families: manifest.families };
}
