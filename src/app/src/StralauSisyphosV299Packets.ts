import data from "./data/stralauSisyphosV299Packets.json";
import type { SurroundingCityChunk, SurroundingNavigation, SurroundingPackedMesh, SurroundingPolygon } from "./SurroundingCityGeometry";
import { releaseScratchBuffer } from "./releaseScratchBuffer";

type Plan = {
  origin: number[]; guard: number; records: { mesh: number; kind: string; fingerprint: number }[];
  lineGuard: number | null; boxes: number[][]; edgeMesh: SurroundingPackedMesh | null;
  floors: (SurroundingPolygon & { y: number })[];
  solids: (SurroundingPolygon & { low: number; high: number })[];
};
export type StralauPacketSourceV299 = { schemaVersion: number; keys: string[]; packets: Record<string, Plan> };
const source = data as unknown as StralauPacketSourceV299;
const known = /* @__PURE__ */ (() => new Set(source.keys))();
export const STRALAU_DETAILS_KIND_V299 = "stralau-v299-source-exterior-details";
export const STRALAU_BOX_LIMIT_V299 = 20_000;
const bytes = (s: string): number => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);

function* fingerprint(texts: readonly string[]): Generator<void, number> {
  let hash = 2166136261;
  for (const text of texts) for (let start = 0; start < text.length; start += 65536) {
    for (let at = start; at < Math.min(start + 65536, text.length); at++) hash = Math.imul(hash ^ text.charCodeAt(at), 16777619) >>> 0;
    yield;
  }
  return hash;
}
const faces = [
  [[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],
  [[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]],
  [[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]],
  [[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]],
  [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
  [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],
];
function encoded(array: ArrayBufferView): string {
  const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let text = "";
  for (let at = 0; at < view.length; at += 8192) text += String.fromCharCode(...view.subarray(at, at + 8192));
  return btoa(text);
}

/** A finite private closure, never a global ticket cache or published-root field. */
export type StralauTicketV299 = (prepared: SurroundingCityChunk) => Generator<void, SurroundingCityChunk>;

function completeOriginalMeshesRemain(original: readonly SurroundingPackedMesh[], prepared: SurroundingCityChunk): boolean {
  return original.every(old => prepared.meshes.some(next => next === old ||
    (old.kind === next.kind && old.positionType === next.positionType && old.positions === next.positions && old.colors === next.colors && old.indices === next.indices)));
}

/** First phase: validate the immutable unmodified source, without mutation.
 * Root runs this before the existing packet preparers; those keep their original
 * whole-packet guards and publication/disposal lifetimes. */
export function* captureStralauSisyphosV299(
  original: SurroundingCityChunk, id: string, native = false, enabled = false,
  evidence: StralauPacketSourceV299 = source,
): Generator<void, StralauTicketV299 | undefined> {
  if (!enabled || original.schemaVersion !== 1) return undefined;
  const key = (native ? "minecraft:" : "drawn:") + id;
  if (evidence === source && !known.has(key)) return undefined;
  if (evidence.schemaVersion !== 1 || !Object.prototype.hasOwnProperty.call(evidence.packets, key)) return undefined;
  const plan = evidence.packets[key];
  if (plan.origin.length !== 3 || original.origin.some((v, i) => v !== plan.origin[i]) ||
    (!plan.boxes.length && !plan.edgeMesh) || plan.boxes.length > STRALAU_BOX_LIMIT_V299 ||
    plan.records.length !== original.meshes.length || new Set(plan.records.map(r => r.mesh)).size !== original.meshes.length ||
    (yield* fingerprint([JSON.stringify(original.nav)])) !== plan.guard) return undefined;
  for (const record of plan.records) {
    const mesh = original.meshes[record.mesh];
    if (!mesh || mesh.kind !== record.kind || mesh.positionType !== "u16cm" ||
      (yield* fingerprint([mesh.positions, mesh.colors, mesh.indices])) !== record.fingerprint) return undefined;
  }
  if (plan.lineGuard === null ? !!original.lines : !original.lines ||
    (yield* fingerprint([original.lines.positions, original.lines.colors ?? ""])) !== plan.lineGuard) return undefined;
  for (let at = 0; at < plan.boxes.length; at++) {
    const row = plan.boxes[at];
    if (row.length !== 11 || !row.every(Number.isFinite) || row.slice(7, 10).some(v => v <= 0 || v > 180) ||
      Math.abs(Math.hypot(row[3], row[4]) - 1) > 1e-8 || Math.abs(Math.hypot(row[5], row[6]) - 1) > 1e-8 ||
      Math.abs(row[3] * row[5] + row[4] * row[6]) > 1e-8 || !Number.isInteger(row[10]) || row[10] < 0 || row[10] > 0xffffff ||
      (native && !(row[3] === 0 || row[4] === 0))) return undefined;
    if (at % 128 === 127) yield;
  }
  const originalMeshes = original.meshes.map(mesh => ({ ...mesh }));
  // The captured complete source and plan are strongly owned only by this
  // closure while one existing serial decode is running. Published roots own
  // typed geometry and small navigation, never the construction recipe graph.
  return function* (prepared: SurroundingCityChunk): Generator<void, SurroundingCityChunk> {
    if (prepared.origin.some((v, i) => v !== plan.origin[i]) || !completeOriginalMeshesRemain(originalMeshes, prepared) ||
      prepared.meshes.some(m => m.kind === STRALAU_DETAILS_KIND_V299)) return prepared;
    const vertexCount = plan.boxes.length * 24, indexCount = plan.boxes.length * 36;
    const edgeVertices = plan.edgeMesh ? bytes(plan.edgeMesh.positions) / 6 : 0;
    const edgeIndices = plan.edgeMesh ? bytes(plan.edgeMesh.indices) / 4 : 0;
    if (prepared.meshes.length + (plan.edgeMesh ? 1 : 0) + (plan.boxes.length ? 1 : 0) > 16 ||
      prepared.meshes.reduce((n, m) => n + bytes(m.positions) / 6, vertexCount + edgeVertices) > 400_000 ||
      prepared.meshes.reduce((n, m) => n + bytes(m.indices) / 4, indexCount + edgeIndices) > 2_400_000) return prepared;
    const positions = new Uint16Array(vertexCount * 3), colors = new Uint8Array(vertexCount * 3), indices = new Uint32Array(indexCount);
    try {
      const palette = new Map<number, number[]>();
      let vertex = 0, index = 0;
      for (let at = 0; at < plan.boxes.length; at++) {
        const [x,y,z,dx,dz,nx,nz,w,h,depth,rgb] = plan.boxes[at];
        let color = palette.get(rgb);
        if (!color) {
          color = [rgb >> 16, (rgb >> 8) & 255, rgb & 255].map(v => Math.round((v <= 10.31475 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4) * 255));
          palette.set(rgb, color);
        }
        const positive = dx * nz - dz * nx > 0;
        for (const face of faces) {
          const first = vertex;
          for (const [u,v,q] of face) {
            const p = [x + dx * u * w / 2 + nx * q * depth / 2, y + v * h / 2, z + dz * u * w / 2 + nz * q * depth / 2];
            for (let axis = 0; axis < 3; axis++) {
              const value = Math.round(p[axis] * 100);
              if (value < 0 || value > 65535) return prepared;
              positions[vertex * 3 + axis] = value; colors[vertex * 3 + axis] = color[axis];
            }
            vertex++;
          }
          for (const offset of positive ? [0,1,2,0,2,3] : [0,2,1,0,3,2]) indices[index++] = first + offset;
        }
        if (at % 16 === 15) yield;
      }
      const detail: SurroundingPackedMesh = { kind: STRALAU_DETAILS_KIND_V299, positionType: "u16cm", positions: encoded(positions), colors: encoded(colors), indices: encoded(indices) };
      const previous = prepared.nav.spreeBridgesV242;
      const nav: SurroundingNavigation = plan.floors.length || plan.solids.length ? { ...prepared.nav,
        spreeBridgesV242: { floors: [...(previous?.floors ?? []), ...plan.floors], solids: [...(previous?.solids ?? []), ...plan.solids] },
      } : prepared.nav;
      return { ...prepared, nav, meshes: [...prepared.meshes, ...(plan.boxes.length ? [detail] : []), ...(plan.edgeMesh ? [plan.edgeMesh] : [])] };
    } finally {
      releaseScratchBuffer(positions.buffer); releaseScratchBuffer(colors.buffer); releaseScratchBuffer(indices.buffer);
    }
  };
}

/** Last phase: append complete details after every retained source preparer.
 * Missing/failed admission leaves the exact existing prepared object intact. */
export function* prepareStralauSisyphosV299(prepared: SurroundingCityChunk, ticket?: StralauTicketV299): Generator<void, SurroundingCityChunk> {
  return ticket ? yield* ticket(prepared) : prepared;
}
