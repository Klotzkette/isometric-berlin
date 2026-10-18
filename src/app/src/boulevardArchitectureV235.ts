import data from "./data/boulevardArchitectureV235.json";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

type Guard = { mesh: number; kind: string; fingerprint: number };
type Plan = { origin: number[]; guards: Guard[]; fields: number[][] };
export type BoulevardArchitectureSourceV235 = { schema: number; ids: string[]; packets: Record<string, Plan> };
const source = data as BoulevardArchitectureSourceV235;
const known = new Set(source.ids);
const KIND = "boulevard-architecture-v235";
const MAX_FIELDS = 2400;
const QUADS = 9;
const linear = (rgb: number[]) => rgb.map(v => Math.round((v <= 10.31475 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4) * 255));
const palette = {
  sky: linear([123, 151, 155]), low: linear([91, 118, 121]),
  reveal: linear([161, 166, 157]), edge: linear([199, 202, 188]),
};
function encoded(view: ArrayBufferView): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
function* fingerprint(parts: string[]): Generator<void, number> {
  let value = 2166136261;
  for (const text of parts) for (let start = 0; start < text.length; start += 65_536) {
    for (let i = start; i < Math.min(text.length, start + 65_536); i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
    yield;
  }
  return value;
}

/** Refine only verified existing street-facing opening planes. The original
 * packet remains byte-identical for prior ownership/material guards. One added
 * part shares the normal decode/park/dispose lifetime; no root or texture cache.
 * Native plans bind actual orthogonal delivered cell faces independently. */
export function* prepareBoulevardArchitectureV235(
  chunk: SurroundingCityChunk, id: string, native = false,
  evidence: BoulevardArchitectureSourceV235 = source,
): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if (evidence === source && !known.has(key)) return chunk;
  if (!Object.prototype.hasOwnProperty.call(evidence.packets, key) || chunk.meshes.some(p => p.kind === KIND)) return chunk;
  const plan = evidence.packets[key];
  if (evidence.schema !== 1 || plan.origin.length !== 3 || plan.origin.some((v, i) => v !== chunk.origin[i]) ||
      !plan.fields.length || plan.fields.length > MAX_FIELDS || !plan.guards.length) return chunk;
  for (const guard of plan.guards) {
    const part = chunk.meshes[guard.mesh];
    if (!part || part.kind !== guard.kind || !["city-west-street-fronts-v163", "tauentzien-street-fronts-v165"].includes(part.kind) ||
        (yield* fingerprint([part.positions, part.colors, part.indices])) !== guard.fingerprint) return chunk;
  }
  for (const p of plan.fields) {
    if (p.length !== 10 || !p.every(Number.isFinite) || p[7] < .2 || p[7] > 3 || p[8] < .2 || p[8] > 3 ||
        Math.abs(Math.hypot(p[3], p[4]) - 1) > .000001 || Math.abs(Math.hypot(p[5], p[6]) - 1) > .000001 ||
        Math.abs(p[3] * p[5] + p[4] * p[6]) > .000001 || (native && !(p[3] === 0 || p[4] === 0)) ||
        !(p[9] === 0 || p[9] === 1)) return chunk;
  }
  const vertices = plan.fields.length * QUADS * 4;
  const positions = new Uint16Array(vertices * 3), colours = new Uint8Array(vertices * 3);
  const indices = new Uint32Array(plan.fields.length * QUADS * 6);
  let vertex = 0, index = 0, valid = true;
  for (let field = 0; field < plan.fields.length; field++) {
    const [x, y, z, ux, uz, nx, nz, width, height] = plan.fields[field];
    const rim = palette.reveal;
    const quad = (corners: number[][], colour: number[]) => {
      const first = vertex;
      for (const [u, v, depth] of corners) {
        const p = [x + ux * u + nx * depth, y + v, z + uz * u + nz * depth];
        for (let axis = 0; axis < 3; axis++) {
          const value = Math.round(p[axis] * 100);
          if (value < 0 || value > 65535) valid = false;
          positions[vertex * 3 + axis] = value; colours[vertex * 3 + axis] = colour[axis];
        }
        vertex++;
      }
      for (const offset of [0, 1, 2, 0, 2, 3]) indices[index++] = first + offset;
    };
    const pane = (left: number, bottom: number, right: number, top: number, colour: number[]) =>
      quad([[left, bottom, .015], [right, bottom, .015], [right, top, .015], [left, top, .015]], colour);
    const a = width / 2 - .055, b = height / 2 - .055;
    for (const [left, right] of [[-a, -.055], [.055, a]]) {
      pane(left, -b, right, -.09, palette.low);
      pane(left, -.09, right, b, palette.sky);
    }
    // Four shallow reveals have real depth; all old sills/axes remain visible.
    quad([[-a, -b, .015], [-a, b, .015], [-a, b, .065], [-a, -b, .065]], rim);
    quad([[a, b, .015], [a, -b, .015], [a, -b, .065], [a, b, .065]], rim);
    quad([[-a, b, .015], [a, b, .015], [a, b, .065], [-a, b, .065]], rim);
    quad([[a, -b, .015], [-a, -b, .015], [-a, -b, .065], [a, -b, .065]], rim);
    quad([[-.027, -b, .035], [.027, -b, .035], [.027, b, .035], [-.027, b, .035]], palette.edge);
    if (field % 32 === 31) yield;
  }
  if (!valid) return chunk;
  const part: SurroundingPackedMesh = { kind: KIND, positionType: "u16cm", positions: encoded(positions), colors: encoded(colours), indices: encoded(indices) };
  return { ...chunk, meshes: [...chunk.meshes, part] };
}
