import data from "./data/houseDoorsV233.json";
import type { SurroundingCityChunk, SurroundingNavigation, SurroundingPackedMesh } from "./SurroundingCityGeometry";

type Door = number[];
type Plan = { origin: number[]; guard: number; doors: Door[] };
export type HouseDoorSourceV233 = { schemaVersion: number; ids?: string[]; chunks: Record<string, { drawn: Plan; minecraft: Plan }> };
const source = data as HouseDoorSourceV233;
const knownChunks = new Set(source.ids ?? Object.keys(source.chunks));

/** Source navigation is retained verbatim by this additive presentation pass. */
export function houseDoorNavigationGuardV233(nav: SurroundingNavigation): number {
  let value = 2166136261;
  const feed = (text: string) => { for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0; };
  const numbers = (values: number[]) => feed(values.map(v => Math.floor(v * 1000 + .5)).join(",") + ";");
  numbers([nav.groundY]);
  for (const building of nav.buildings) {
    feed(building.sourceId + ";"); numbers([building.minHeight, building.height, building.groundOffset ?? 0]);
    for (const ring of [building.ring, ...building.holes]) { feed("["); for (const point of ring) numbers(point); feed("]"); }
  }
  return value;
}

const linear = (rgb: number[]) => rgb.map(v => Math.round((v <= 10.31475 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4) * 255));
const colours = {
  leaf: linear([104, 117, 113]), panel: linear([124, 133, 121]), glass: linear([130, 158, 163]),
  frame: linear([189, 183, 166]), seam: linear([78, 91, 91]), metal: linear([186, 184, 160]),
};
const QUADS_PER_DOOR = 12;
const MAX_DOORS_PER_CHUNK = 512;

function encoded(values: ArrayBufferView): string {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let value = "";
  for (let i = 0; i < bytes.length; i += 8192) value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(value);
}

/** One bounded extra mesh part, decoded/parked/disposed by the existing chunk
 * lifecycle. No separate resident root, animation, texture or navigation copy.
 * Both families follow independently verified existing source wall faces. */
export function* prepareHouseDoorsV233(
  chunk: SurroundingCityChunk, id: string, native = false, evidence: HouseDoorSourceV233 = source,
): Generator<void, SurroundingCityChunk> {
  if (evidence === source && !knownChunks.has(id)) return chunk;
  if (chunk.meshes.some(part => part.kind === "house-doors-v233")) return chunk;
  const entry = evidence.chunks[id];
  if (!entry) return chunk;
  const plan = native ? entry.minecraft : entry.drawn;
  if (!plan?.doors.length || plan.doors.length > MAX_DOORS_PER_CHUNK ||
    chunk.origin.some((v, i) => v !== plan.origin[i]) || houseDoorNavigationGuardV233(chunk.nav) !== plan.guard) return chunk;
  if (plan.doors.some(d => d.length !== 7 || !d.every(Number.isFinite) ||
    Math.abs(Math.hypot(d[3], d[4]) - 1) > .000001 || Math.abs(Math.hypot(d[5], d[6]) - 1) > .000001 ||
    Math.abs(d[3] * d[5] + d[4] * d[6]) > .000001 ||
    (native && !(d[3] === 0 || d[4] === 0)))) return chunk;
  const vertexCount = plan.doors.length * QUADS_PER_DOOR * 4;
  const positions = new Uint16Array(vertexCount * 3), rgb = new Uint8Array(vertexCount * 3);
  const indices = new Uint32Array(plan.doors.length * QUADS_PER_DOOR * 6);
  let vertex = 0, index = 0, valid = true;
  for (let i = 0; i < plan.doors.length; i++) {
    const [x, base, z, dx, dz, nx, nz] = plan.doors[i];
    const pane = (u: number, y: number, width: number, height: number, depth: number, colour: number[]) => {
      const first = vertex;
      for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const across = u + s * width / 2;
        const p = [x + dx * across + nx * depth, base + y + t * height / 2, z + dz * across + nz * depth];
        for (let axis = 0; axis < 3; axis++) {
          const v = Math.round(p[axis] * 100);
          if (v < 0 || v > 65535) valid = false;
          positions[vertex * 3 + axis] = v; rgb[vertex * 3 + axis] = colour[axis];
        }
        vertex++;
      }
      for (const offset of [0, 1, 2, 0, 2, 3]) indices[index++] = first + offset;
    };
    pane(0, 1.125, 1.1, 2.25, .045, colours.leaf);
    for (const u of [-.257, .257]) {
      pane(u, .55, .39, .78, .057, colours.panel);
      pane(u, 1.65, .39, .82, .057, colours.glass);
    }
    for (const u of [-.59, .59]) pane(u, 1.14, .08, 2.28, .065, colours.frame);
    pane(0, 2.29, 1.26, .08, .065, colours.frame);
    pane(0, .06, 1.26, .08, .065, colours.frame);
    pane(0, 1.125, .045, 2.25, .07, colours.seam);
    for (const u of [-.08, .08]) pane(u, 1.05, .035, .22, .085, colours.metal);
    if (i % 32 === 31) yield;
  }
  if (!valid) return chunk;
  const part: SurroundingPackedMesh = { kind: "house-doors-v233", positionType: "u16cm",
    positions: encoded(positions), colors: encoded(rgb), indices: encoded(indices) };
  return { ...chunk, meshes: [...chunk.meshes, part] };
}
