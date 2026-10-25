import packetKeys from "./data/legacyHouseMaterialsV273Index.json";
import manifest from "./data/legacyHouseMaterialsV273.json";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

type Receipt = { mesh: number; kind: string; fingerprint: number; runs: string };
export type LegacyHouseMaterialsSourceV273 = {
  schemaVersion: 1;
  palette: readonly number[];
  packets: Readonly<Record<string, readonly Receipt[]>>;
};

const source = manifest as LegacyHouseMaterialsSourceV273;
const keys: ReadonlySet<string> = new Set(packetKeys);
const kinds = new Set(["city-west-street-fronts-v163", "mitte-street-fronts-v166", "oranien-corridors-v167", "scheunenviertel-v168"]);
const SLICE = 4096;
const ENCODED_SLICE = SLICE * 16;
const uint32 = (bytes: string, at: number): number => (bytes.charCodeAt(at) |
  bytes.charCodeAt(at + 1) << 8 | bytes.charCodeAt(at + 2) << 16 | bytes.charCodeAt(at + 3) << 24) >>> 0;
const invalid = () => new Error("Invalid legacy house material receipt");

function decodeRuns(encoded: string): string {
  let bytes: string;
  try { bytes = atob(encoded); } catch { throw invalid(); }
  if (bytes.length % 12 !== 0 || bytes.length * 4 !== encoded.length * 3) throw invalid();
  return bytes;
}

/** All positively ordinary complete families in the four legacy shell layers. Place
 * before later explicit material writers. A tiny eager index rejects unrelated
 * packets before accessing the weak construction field. Drawn/native selectors
 * were compiled independently from exact immutable source streams. No geometry,
 * GPU buffer, draw call or per-frame work is added. Unknown hues are estimates. */
export function* applyLegacyHouseMaterialsV273(
  tile: string, native: boolean, part: SurroundingPackedMesh, mesh: number,
  vertices: Uint16Array, vertexOffset: number, vertexCount: number,
  evidence: LegacyHouseMaterialsSourceV273 = source,
): Generator<void, number> {
  if (!kinds.has(part.kind)) return 0;
  const key = `${native ? "minecraft" : "drawn"}:${tile}`;
  if (!keys.has(key) || !Object.prototype.hasOwnProperty.call(evidence.packets, key)) return 0;
  const receipt = evidence.packets[key].find(value => value.mesh === mesh && value.kind === part.kind);
  if (!receipt) return 0;
  if (evidence.schemaVersion !== 1) throw invalid();

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
      runs.length % 16 !== 0 || runs.length > vertexCount * 16) throw invalid();

  // Validate all ranges before changing even one colour cell. A malformed late
  // range must not leave a partially painted owner; geometry cells are excluded.
  let previousEnd = 0;
  for (let start = 0; start < runs.length; start += ENCODED_SLICE) {
    const bytes = decodeRuns(runs.slice(start, start + ENCODED_SLICE));
    for (let at = 0; at < bytes.length; at += 12) {
      const first = uint32(bytes, at), count = uint32(bytes, at + 4);
      const tone = evidence.palette[uint32(bytes, at + 8)];
      if (first < previousEnd || count === 0 || first + count > vertexCount ||
          !Number.isSafeInteger(tone) || tone < 0 || tone > 0xffffff) throw invalid();
      previousEnd = first + count;
    }
    yield;
  }

  let changed = 0, checkpoint = 0;
  for (let encodedStart = 0; encodedStart < runs.length; encodedStart += ENCODED_SLICE) {
    const bytes = decodeRuns(runs.slice(encodedStart, encodedStart + ENCODED_SLICE));
    for (let at = 0; at < bytes.length; at += 12) {
      const tone = evidence.palette[uint32(bytes, at + 8)];
      const red = (tone >>> 16) * 257, green = ((tone >>> 8) & 255) * 257, blue = (tone & 255) * 257;
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
