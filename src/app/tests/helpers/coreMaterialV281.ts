/** Test-only per-object receipt, matching the independently captured HEAD audit. */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import type { Group, InstancedMesh } from "three";

export const hashCoreV281 = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const bytesHash = (value: ArrayBufferView): string => createHash("sha256")
  .update(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)).digest("hex");
export async function fileHashCoreV281(path: URL): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

/** Reuse the core audit's exact inverse hunks without accepting source drift. */
export function replaySourceV281(source: string, receipt: {
  beforeSha256: string; currentSha256: string; replacements: { before: string; current: string }[];
}): string {
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== receipt.currentSha256) throw new Error("Current audited source changed");
  for (const replacement of receipt.replacements) {
    if (source.split(replacement.current).length !== 2) throw new Error("Ambiguous source replay");
    source = source.replace(replacement.current, replacement.before);
  }
  if (hash(source) !== receipt.beforeSha256) throw new Error("Historical source complement changed");
  return source;
}

export function coreRecordsV281(root: Group) {
  root.updateMatrixWorld(true);
  const records: { key: string; instances: number; bytes: number; bufferRecords: number; completeSha256: string }[] = [];
  const occurrences = new Map<string, number>();
  const attribute = (a: any): any => a ? {
    itemSize: a.itemSize, count: a.count, normalized: a.normalized, arrayType: a.array.constructor.name,
    bytes: a.array.byteLength, sha256: bytesHash(a.array),
  } : null;
  const mat = (m: any): any => Array.isArray(m) ? m.map(mat) : m ? {
    color: m.color?.getHex(), emissive: m.emissive?.getHex(), emissiveIntensity: m.emissiveIntensity,
    opacity: m.opacity, roughness: m.roughness, metalness: m.metalness, transparent: m.transparent, side: m.side,
    vertexColors: m.vertexColors, alphaTest: m.alphaTest, depthTest: m.depthTest, depthWrite: m.depthWrite,
    wireframe: m.wireframe, toneMapped: m.toneMapped, blending: m.blending, polygonOffset: m.polygonOffset,
    polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits,
    map: m.map ? { name: m.map.name, width: m.map.image?.width, height: m.map.image?.height,
      wrapS: m.map.wrapS, wrapT: m.map.wrapT, minFilter: m.map.minFilter, magFilter: m.map.magFilter } : null,
  } : null;
  root.traverse((object: any) => {
    if (!object.isMesh && !object.isLineSegments) return;
    const attributes = Object.fromEntries(Object.entries(object.geometry.attributes).map(([name, a]) => [name, attribute(a)]));
    const index = attribute(object.geometry.index), instanceMatrix = object.isInstancedMesh ? attribute(object.instanceMatrix) : null;
    const instanceColor = object.isInstancedMesh ? attribute(object.instanceColor) : null;
    const geometry = { name: object.name, attributes: Object.fromEntries(Object.entries(attributes).filter(([name]) => name !== "color")), index,
      matrix: object.matrix.toArray(), matrixWorld: object.matrixWorld.toArray(), count: object.isInstancedMesh ? object.count : null,
      instanceMatrix, instanceColorBytes: instanceColor?.bytes ?? 0 };
    const colours = { attribute: attributes.color ?? null, instance: instanceColor };
    const materials = { active: (Array.isArray(object.material) ? object.material : [object.material]).map(mat),
      day: mat(object.userData.dayMaterial), night: mat(object.userData.nightMaterial), moonlit: mat(object.userData.moonlitMaterial) };
    const presentation = { visible: object.visible, groups: object.geometry.groups, drawRange: object.geometry.drawRange, materials };
    const lineage: string[] = []; for (let p = object.parent; p; p = p.parent) lineage.unshift(p.name);
    const path = JSON.stringify([...lineage, object.name]), occurrence = occurrences.get(path) ?? 0;
    occurrences.set(path, occurrence + 1);
    records.push({ key: JSON.stringify([...lineage, object.name, occurrence]), instances: object.isInstancedMesh ? object.count : 0,
      bytes: Object.values(attributes).reduce((sum: number, a: any) => sum + a.bytes, 0) + (index?.bytes ?? 0) + (instanceMatrix?.bytes ?? 0) + (instanceColor?.bytes ?? 0),
      bufferRecords: object.isInstancedMesh ? 2 : 1, completeSha256: hashCoreV281({ geometry, colours, presentation }) });
  });
  return records;
}

/** Hash actual retained rows in their original order without allocating another world. */
export function retainedInstanceRowsV281(mesh: InstancedMesh, keep: readonly boolean[]) {
  if (keep.length !== mesh.count || !mesh.instanceColor) throw new Error("Incomplete retained-row mask");
  const matrices = createHash("sha256"), colours = createHash("sha256");
  let count = 0;
  for (let i = 0; i < mesh.count; i++) if (keep[i]) {
    const m = mesh.instanceMatrix.array.subarray(i * 16, i * 16 + 16), c = mesh.instanceColor.array.subarray(i * 3, i * 3 + 3);
    matrices.update(new Uint8Array(m.buffer, m.byteOffset, m.byteLength));
    colours.update(new Uint8Array(c.buffer, c.byteOffset, c.byteLength)); count++;
  }
  return { count, matrices: matrices.digest("hex"), colours: colours.digest("hex") };
}
