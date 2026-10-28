import { expect } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { BufferAttribute, type Object3D } from "three";
import receipt from "../fixtures/expanded-retention-v281.json";
import { geometryPreservationV206 } from "./geometryPreservationV206";
import { staticGeometryAudit } from "./staticGeometryAudit";

const sha = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const verified = new Set<string>();
/** Project only independently captured changed buffers. Every retained object,
 * material and transform remains live and must reproduce the original audit.
 * Full source graph pins prevent treating an unrelated new change as accepted.
 */
export function withExpandedRetentionV281<T>(root: Object3D, family: "expanded" | "diplomatic", inspect: () => T): T {
  const proof = receipt.families[family];
  if (!verified.has(family)) {
    for (const [path, digest] of Object.entries(proof.sourceGraphs.current)) {
      expect(sha(readFileSync(resolve(import.meta.dir, "../../../..", path)))).toBe(digest);
    }
    verified.add(family);
  }
  const nodes: any[] = []; root.traverse(o => nodes.push(o));
  const records = geometryPreservationV206(root), byKey = new Map(records.map((r, i) => [r.key, { record:r, node:nodes[i] }]));
  expect(records.length).toBe(proof.current.objects);
  const changed = new Set(proof.changes.map(c => c.key));
  expect(records.filter(r => !changed.has(r.key))).toEqual(proof.unchanged);
  const undo: (() => void)[] = [];
  try {
    for (const change of proof.changes) {
      const found = byKey.get(change.key); expect(found).toBeDefined();
      const { node, record } = found!;
      expect(record).toEqual(change.after);
      for (const [name, delta] of Object.entries(change.attributes)) {
        const live = name === "index" ? node.geometry.index : node.geometry.getAttribute(name);
        expect(live.array.constructor.name).toBe(delta.after.type);
        expect(live.itemSize).toBe(delta.after.itemSize);
        expect(live.normalized).toBe(delta.after.normalized);
        expect(sha(new Uint8Array(live.array.buffer, live.array.byteOffset, live.array.byteLength))).toBe(delta.after.sha256);
        const raw = gunzipSync(Buffer.from(delta.before.gzip,"base64"));
        expect(raw.byteLength).toBe(delta.before.bytes); expect(sha(raw)).toBe(delta.before.sha256);
        const buffer = new ArrayBuffer(raw.byteLength); new Uint8Array(buffer).set(raw);
        const restored = new BufferAttribute(new live.array.constructor(buffer), delta.before.itemSize, delta.before.normalized);
        if (name === "index") { undo.push(() => node.geometry.setIndex(live)); node.geometry.setIndex(restored); }
        else { undo.push(() => node.geometry.setAttribute(name,live)); node.geometry.setAttribute(name,restored); }
      }
    }
    const historical = geometryPreservationV206(root);
    expect(sha(JSON.stringify(historical))).toBe(proof.before.recordsSha256);
    expect(staticGeometryAudit(root)).toEqual(proof.before.static);
    return inspect();
  } finally { for (const restore of undo.reverse()) restore(); }
}

export const auditDiplomaticBeforeV246 = (root: Object3D) =>
  withExpandedRetentionV281(root, "diplomatic", () => staticGeometryAudit(root));
