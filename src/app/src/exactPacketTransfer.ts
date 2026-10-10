import type { SurroundingPackedLines, SurroundingPackedMesh } from "./SurroundingCityGeometry";

export type ExactTriangleTransfer = {
  tile: string; kind: string; mode: string; fingerprint: number; triangles: number[];
};
export type ExactLineTransfer = {
  tile: string; mode: string; fingerprint: number; segments: number[];
};

/** Immutable encoded packet identity; bounded work shares the decode scheduler. */
function* packetFingerprint(parts: readonly string[]): Generator<void, number> {
  let value = 2166136261;
  for (const text of parts) {
    for (let start = 0; start < text.length; start += 65536) {
      for (let i = start; i < Math.min(text.length, start + 65536); i++) {
        value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
      }
      yield;
    }
  }
  return value;
}

/** Transfer only audited triangles to required complete replacement models.
 * Every source attribute and unrelated index is retained. A changed packet
 * conservatively renders its original geometry until a new audit is supplied.
 */
export function* transferExactPacketTriangles(
  records: readonly ExactTriangleTransfer[], tile: string, native: boolean,
  part: SurroundingPackedMesh, indices: Uint16Array | Uint32Array, offset: number,
): Generator<void, number> {
  const selected = records.filter(r => r.tile === tile && r.kind === part.kind &&
    r.mode === (native ? "minecraft" : "drawn"));
  if (!selected.length) return 0;
  const fingerprint = yield* packetFingerprint([part.positions, part.colors, part.indices]);
  const triangleCount = (part.indices.length / 4 * 3 - (part.indices.endsWith("==") ? 2 : part.indices.endsWith("=") ? 1 : 0)) / 12;
  let transferred = 0;
  for (const record of selected) {
    if (record.fingerprint !== fingerprint) continue;
    for (const triangle of record.triangles) {
      const i = offset + triangle * 3;
      if (!Number.isSafeInteger(triangle) || triangle < 0 || triangle >= triangleCount || i + 2 >= indices.length) {
        throw new Error("Invalid audited packet triangle transfer");
      }
      indices[i + 1] = indices[i]; indices[i + 2] = indices[i];
      transferred++;
    }
    yield;
  }
  return transferred;
}

/** Retire only corresponding old ink; new measured roofs must not leave ghosts. */
export function* transferExactPacketLines(
  records: readonly ExactLineTransfer[], tile: string, part: SurroundingPackedLines,
  values: Uint16Array, stride: number,
): Generator<void, number> {
  const selected = records.filter(r => r.tile === tile && r.mode === "drawn");
  if (!selected.length) return 0;
  const fingerprint = yield* packetFingerprint([part.positions, part.colors ?? ""]);
  let transferred = 0;
  for (const record of selected) {
    if (record.fingerprint !== fingerprint) continue;
    for (const segment of record.segments) {
      const i = segment * 2 * stride;
      if (!Number.isSafeInteger(segment) || segment < 0 || i + stride + 2 >= values.length) {
        throw new Error("Invalid audited packet line transfer");
      }
      values[i + stride] = values[i];
      values[i + stride + 1] = values[i + 1];
      values[i + stride + 2] = values[i + 2];
      transferred++;
    }
    yield;
  }
  return transferred;
}
