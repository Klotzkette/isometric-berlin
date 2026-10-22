import data from "./data/outerFacadesV262.json";
import { houseDoorNavigationGuardV233 } from "./houseDoorsV233";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

type Plan = { origin: number[]; guard: number; records: { mesh: number; fingerprint: number }[]; windows: number[][] };
export type OuterFacadeSourceV262 = { schemaVersion: number; packets: Record<string, Plan> };
const source = data as OuterFacadeSourceV262;
const MAX_VERTICES = 400_000;
const bytes = (encoded: string) => encoded.length / 4 * 3 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
const linear = (rgb: number[]) => rgb.map(v => Math.round((v <= 10.31475 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4) * 255));
const FRAME = linear([192, 188, 173]), REVEAL = linear([69, 79, 79]);
const GLASS_LOW = linear([108, 130, 132]), GLASS_HIGH = linear([151, 168, 169]);
const NATIVE_GLASS = linear([123, 145, 147]), SILL = linear([183, 181, 168]);

function encoded(values: ArrayBufferView): string {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let value = "";
  for (let i = 0; i < bytes.length; i += 8192) value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(value);
}

/** One small append in the existing source packet transaction. The original
 * city, prior details and navigation are retained by identity, not copied. */
export function* prepareOuterFacadesV262(
  chunk: SurroundingCityChunk, id: string, native = false, evidence: OuterFacadeSourceV262 = source,
): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if (!Object.prototype.hasOwnProperty.call(evidence.packets, key) ||
      chunk.meshes.some(part => part.kind === "outer-facades-v262")) return chunk;
  const plan = evidence.packets[key], quads = native ? 3 : 5;
  if (evidence.schemaVersion !== 1 || !plan.windows.length || plan.windows.length > (native ? 64 : 96) ||
      chunk.meshes.length >= 16 || plan.origin.length !== 3 ||
      chunk.origin.some((v, i) => v !== plan.origin[i]) ||
      houseDoorNavigationGuardV233(chunk.nav) !== plan.guard || !plan.records.length) return chunk;
  const vertexCount = plan.windows.length * quads * 4;
  if (chunk.meshes.reduce((sum, part) => sum + bytes(part.positions) / 6, vertexCount) > MAX_VERTICES ||
      chunk.meshes.reduce((sum, part) => sum + bytes(part.indices) / 4, plan.windows.length * quads * 6) > 2_400_000) return chunk;
  const cityMeshes = chunk.meshes.flatMap((part, index) => part.kind === "city" ? [index] : []);
  if (plan.records.length !== cityMeshes.length ||
      new Set(plan.records.map(record => record.mesh)).size !== cityMeshes.length ||
      plan.records.some(record => !cityMeshes.includes(record.mesh))) return chunk;
  for (const row of plan.windows) {
    if (row.length !== 7 || !row.every(Number.isFinite) ||
        Math.abs(Math.hypot(row[3], row[4]) - 1) > .000001 ||
        Math.abs(Math.hypot(row[5], row[6]) - 1) > .000001 ||
        Math.abs(row[3] * row[5] + row[4] * row[6]) > .000001 ||
        (native && !(row[3] === 0 || row[4] === 0))) return chunk;
  }
  // Bind every source city mesh, including original colours and exact indices.
  // A changed source cannot acquire fittings from an older wall interpretation.
  for (const record of plan.records) {
    const part = chunk.meshes[record.mesh];
    if (!part || part.kind !== "city") return chunk;
    let hash = 2166136261;
    for (const text of [part.positions, part.colors, part.indices]) {
      for (let start = 0; start < text.length; start += 65_536) {
        for (let at = start; at < Math.min(start + 65_536, text.length); at++)
          hash = Math.imul(hash ^ text.charCodeAt(at), 16777619) >>> 0;
        yield;
      }
    }
    if (hash !== record.fingerprint) return chunk;
  }
  const positions = new Uint16Array(vertexCount * 3), colours = new Uint8Array(vertexCount * 3);
  const indices = new Uint32Array(plan.windows.length * quads * 6);
  let vertex = 0, index = 0, valid = true;
  for (let i = 0; i < plan.windows.length; i++) {
    const [x, y, z, dx, dz, nx, nz] = plan.windows[i];
    const pane = (offsetY: number, width: number, height: number, depth: number, bottom: number[], top = bottom) => {
      const first = vertex;
      for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const point = [x + dx * s * width / 2 + nx * depth, y + offsetY + t * height / 2,
          z + dz * s * width / 2 + nz * depth];
        for (let axis = 0; axis < 3; axis++) {
          const value = Math.round(point[axis] * 100);
          if (value < 0 || value > 65535) valid = false;
          positions[vertex * 3 + axis] = value;
          colours[vertex * 3 + axis] = (t < 0 ? bottom : top)[axis];
        }
        vertex++;
      }
      for (const offset of [0, 1, 2, 0, 2, 3]) indices[index++] = first + offset;
    };
    if (native) {
      pane(0, 1.31, 1.56, .04, FRAME);
      pane(0, 1.10, 1.34, .06, NATIVE_GLASS);
      pane(-.79, 1.43, .12, .10, SILL);
    } else {
      pane(0, 1.48, 1.98, .035, FRAME);
      pane(0, 1.32, 1.82, .055, REVEAL);
      pane(0, 1.19, 1.69, .075, GLASS_LOW, GLASS_HIGH);
      pane(0, .055, 1.70, .095, FRAME);
      pane(-1.01, 1.60, .13, .13, SILL);
    }
    if (i % 16 === 15) yield;
  }
  if (!valid) return chunk;
  const part: SurroundingPackedMesh = { kind: "outer-facades-v262", positionType: "u16cm",
    positions: encoded(positions), colors: encoded(colours), indices: encoded(indices) };
  return { ...chunk, meshes: [...chunk.meshes, part] };
}
