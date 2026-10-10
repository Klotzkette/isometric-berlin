import manifest from "./data/altMitteAppearanceV213.json";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

export type AltMitteAppearanceReceiptV213 = {
  mesh: number;
  /** FNV-1a of the immutable encoded positions, colours and indices, in order. */
  fingerprint: number;
  /** Base64 little-endian U32 [first local vertex, count, palette] triples. */
  runs: string;
};
export type AltMitteAppearanceSourceV213 = {
  schemaVersion: 1;
  /** Packed linear RGB bytes, including the source-plane/native-face shade. */
  palette: readonly number[];
  packets: Readonly<Record<string, readonly AltMitteAppearanceReceiptV213[]>>;
};

const source = manifest as AltMitteAppearanceSourceV213;
const SLICE = 4096;
const ENCODED_SLICE = SLICE * 16;
const uint32 = (bytes: string, at: number): number => (bytes.charCodeAt(at) |
  bytes.charCodeAt(at + 1) << 8 | bytes.charCodeAt(at + 2) << 16 | bytes.charCodeAt(at + 3) << 24) >>> 0;

function decodeRuns(encoded: string): string {
  let bytes: string;
  try { bytes = atob(encoded); } catch { throw new Error("Invalid Alt-Mitte appearance encoding"); }
  if (bytes.length % 12 !== 0 || bytes.length * 4 !== encoded.length * 3)
    throw new Error("Invalid Alt-Mitte appearance encoding");
  return bytes;
}

/** Compile-time source ownership selects each existing vertex. Runtime never
 * guesses a surface role from a colour, a roof height or a footprint corner.
 * Only final colour cells change; original packet bytes still guard all later
 * exact-owner transfers. No geometry, buffer or draw call is added. */
export function* applyAltMitteAppearanceV213(
  tile: string, native: boolean, part: SurroundingPackedMesh, mesh: number,
  vertices: Uint16Array, vertexOffset: number, vertexCount: number,
  evidence: AltMitteAppearanceSourceV213 = source,
): Generator<void, number> {
  if (part.kind !== "alt-mitte-v169") return 0;
  const key = `${native ? "minecraft" : "drawn"}:${tile}`;
  if (!Object.prototype.hasOwnProperty.call(evidence.packets, key)) return 0;
  const receipt = evidence.packets[key].find(value => value.mesh === mesh);
  if (!receipt) return 0;
  if (evidence.schemaVersion !== 1) throw new Error("Invalid Alt-Mitte appearance schema");

  // A changed source packet keeps its complete original appearance until its
  // exact source bindings have been rebuilt. Hashing shares the decode yields.
  let fingerprint = 2166136261;
  for (const encoded of [part.positions, part.colors, part.indices]) {
    for (let start = 0; start < encoded.length; start += 65_536) {
      const end = Math.min(encoded.length, start + 65_536);
      for (let at = start; at < end; at++) {
        fingerprint = Math.imul(fingerprint ^ encoded.charCodeAt(at), 16777619) >>> 0;
      }
      yield;
    }
  }
  if (receipt.fingerprint !== fingerprint) return 0;

  const { runs } = receipt;
  if (!Number.isSafeInteger(vertexOffset) || vertexOffset < 0 ||
      !Number.isSafeInteger(vertexCount) || vertexCount < 0 ||
      (vertexOffset + vertexCount) * 6 > vertices.length || typeof runs !== "string" ||
      runs.length % 16 !== 0 || runs.length > vertexCount * 16) {
    throw new Error("Invalid Alt-Mitte appearance bounds");
  }
  // Validate every range before writing, including the entire palette lookup.
  // An invalid late range must not leave an earlier, partially painted owner.
  let previousEnd = 0;
  for (let start = 0; start < runs.length; start += ENCODED_SLICE) {
    const bytes = decodeRuns(runs.slice(start, start + ENCODED_SLICE));
    for (let at = 0; at < bytes.length; at += 12) {
      const first = uint32(bytes, at), count = uint32(bytes, at + 4), colour = uint32(bytes, at + 8);
      const tone = evidence.palette[colour];
      if (first < previousEnd || count === 0 || first + count > vertexCount ||
          !Number.isSafeInteger(tone) || tone < 0 || tone > 0xffffff) {
        throw new Error("Invalid Alt-Mitte appearance range");
      }
      previousEnd = first + count;
    }
    yield;
  }

  // Re-decode at most 48 KiB at a time instead of retaining a second full
  // district-sized number graph or override buffer alongside the city.
  let changed = 0, checkpoint = 0;
  for (let encodedStart = 0; encodedStart < runs.length; encodedStart += ENCODED_SLICE) {
    const bytes = decodeRuns(runs.slice(encodedStart, encodedStart + ENCODED_SLICE));
    for (let at = 0; at < bytes.length; at += 12) {
      const tone = evidence.palette[uint32(bytes, at + 8)];
      const red = (tone >>> 16) * 257;
      const green = ((tone >>> 8) & 255) * 257;
      const blue = (tone & 255) * 257;
      const start = (vertexOffset + uint32(bytes, at)) * 6 + 3;
      const end = start + uint32(bytes, at + 4) * 6;
      for (let to = start; to < end; to += 6) {
        vertices[to] = red; vertices[to + 1] = green; vertices[to + 2] = blue;
        changed++;
        if (++checkpoint === SLICE) { checkpoint = 0; yield; }
      }
    }
  }
  return changed;
}
