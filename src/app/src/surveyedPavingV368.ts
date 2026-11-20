import { houseCurbGroundGuardV233 } from "./houseCurbsV233";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import palette from "./data/surveyedPavingPaletteV368.json";
import { surroundingPacketFingerprint } from "./surroundingPacketFingerprint";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

export type SurveyedPavingPlan = readonly [
  x: number, z: number, cityMeshes: readonly (readonly [index: number, hash: number])[],
  vertices: string, triangles: string, groundGuard: number, requiresIslandPaths: boolean, terrainHeights?: string,
];
export type SurveyedPavingBank = Readonly<Record<string, SurveyedPavingPlan>>;

function encode(array: ArrayBufferView): string {
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  const blocks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    blocks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return btoa(blocks.join(""));
}

/** Attach only to the centimetre-exact original Drawn floor. This tail uses
 * the existing city draw and cannot change walkable height or collision. */
export function* surveyedPavingPart(
  chunk: SurroundingCityChunk, plan: SurveyedPavingPlan | undefined, southwestActive = false,
): Generator<void, SurroundingPackedMesh | undefined> {
  if (!plan || chunk.origin[0] !== plan[0] || chunk.origin[1] !== -10 ||
      chunk.origin[2] !== plan[1] || chunk.nav.groundY !== 3 ||
      (plan[6] && !southwestActive) || houseCurbGroundGuardV233(chunk.nav.ground) !== plan[5]) return;
  for (const [index, hash] of plan[2]) {
    const part = chunk.meshes[index];
    if (!part || part.kind !== "city" || (yield* surroundingPacketFingerprint(part)) !== hash) return;
  }
  const vertices = decodeBase64Bytes(plan[3]);
  const indices = new Uint16Array(decodeBase64Bytes(plan[4]).buffer);
  const count = vertices.length / 5;
  if (!Number.isInteger(count) || !count || count > 65535 || indices.length % 3) return;
  const view = new DataView(vertices.buffer, vertices.byteOffset, vertices.byteLength);
  const heights = plan[7] ? new Uint16Array(decodeBase64Bytes(plan[7]).buffer) : undefined;
  if (heights && heights.length !== count) return;
  const positions = new Uint16Array(count * 3);
  const colors = new Uint8Array(count * 3);
  for (let i = 0; i < count; i++) {
    const style = vertices[5 * i + 4];
    const color = palette[style & 15];
    if (!color || style >= 32) return;
    positions[i * 3] = view.getUint16(i * 5, true);
    positions[i * 3 + 1] = heights ? heights[i] : style >= 16 ? 1314 : 1305;
    positions[i * 3 + 2] = view.getUint16(i * 5 + 2, true);
    colors.set(color, i * 3);
  }
  return {
    kind: "surveyed-paving-v368", positionType: "u16cm", positions: encode(positions),
    colors: encode(colors), indices: encode(Uint32Array.from(indices)),
  };
}
