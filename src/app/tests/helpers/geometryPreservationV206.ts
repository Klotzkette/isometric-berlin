import { createHash } from "node:crypto";
import type { Object3D } from "three";
import type { OutlineManifest } from "./outlineConstructionSignature";

/** Only the two retired v188 Urania renderables, never the garden or parent. */
export function outlineUraniaSubstitutionKeysV206(mode: "day" | "minecraft") {
  const prefix = '["Group","Berlin outline landmark additions v182"]/["Group","Urania and Luetzowplatz source refinements v188"]:0';
  return [
    `${prefix}/["Mesh","Urania measured upper walls, mirror joints and yellow sign"]:0`,
    ...(mode === "day" ? [`${prefix}/["Mesh","Urania exact higher official roof ring"]:0`] : []),
  ];
}

export function retainedOutlineManifestV206(manifest: OutlineManifest, mode: "day" | "minecraft"): OutlineManifest {
  const keys = new Set(outlineUraniaSubstitutionKeysV206(mode));
  if (manifest.nodes.filter(node => keys.has(node.key)).length !== keys.size)
    throw new Error("The exact old Urania substitution inventory changed");
  return { ...manifest, nodes: manifest.nodes.filter(node => !keys.has(node.key)) };
}

/** Independent object digests: no historical geometry is substituted at test time. */
export function geometryPreservationV206(root: Object3D) {
  // The legacy City West star pivot is deliberately dynamic. Canonicalize its
  // initial local matrix exactly as the existing staticGeometryAudit does.
  root.updateMatrixWorld(true);
  const records: { key: string; sha256: string; bytes: number }[] = [];
  const visit = (node: Object3D, key: string) => {
    const n = node as any, hash = createHash("sha256");
    hash.update(JSON.stringify([n.name,n.type,n.visible,n.matrix.elements,n.position.toArray(),
      n.rotation.toArray(),n.scale.toArray(),n.renderOrder,n.frustumCulled,n.count ?? null]));
    const attributes: [string, any][] = Object.entries(n.geometry?.attributes ?? {});
    if (n.geometry?.index) attributes.push(["index", n.geometry.index]);
    if (n.instanceMatrix) attributes.push(["instanceMatrix", n.instanceMatrix]);
    if (n.instanceColor) attributes.push(["instanceColor", n.instanceColor]);
    let bytes = 0;
    for (const [name, attribute] of attributes) {
      hash.update(JSON.stringify([name, attribute.itemSize, attribute.normalized, attribute.count]));
      const data = new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
      hash.update(data); bytes += data.byteLength;
    }
    records.push({ key, sha256: hash.digest("hex"), bytes });
    const siblings = new Map<string, number>();
    for (const child of node.children) {
      const id = JSON.stringify([child.type, child.name]), ordinal = siblings.get(id) ?? 0;
      siblings.set(id, ordinal + 1); visit(child, `${key}/${id}:${ordinal}`);
    }
  };
  visit(root, JSON.stringify([root.type, root.name]));
  return records;
}
