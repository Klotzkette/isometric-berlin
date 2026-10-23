import data from "./data/allotmentsV264.json";
import type { SurroundingCityChunk, SurroundingNavigation, SurroundingPackedMesh } from "./SurroundingCityGeometry";

type Plan = { origin: number[]; guard: number; groups: number[][] };
export type AllotmentSourceV264 = { schemaVersion: number; keys?: string[]; chunks: Record<string, { drawn?: Plan; minecraft?: Plan }> };
const source = data as AllotmentSourceV264;
const knownChunks = /* @__PURE__ */ (() => new Set(source.keys ?? Object.keys(source.chunks)))();
const KIND = "allotments-v264";
export const ALLOTMENT_GROUP_LIMIT_V264 = 48;

/** Includes the delivered ground, all path/water holes and every existing hut.
 * A changed source packet never receives an older placement recipe. */
export function* allotmentNavigationGuardStepsV264(nav: SurroundingNavigation): Generator<void, number> {
  let value = 2166136261, points = 0;
  const feed = (text: string) => { for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0; };
  const numbers = (values: number[]) => feed(values.map(v => Math.floor(v * 1000 + .5)).join(",") + ";");
  numbers([nav.groundY]);
  for (const key of ["ground", "roads", "water", "bridges", "buildings"] as const) {
    feed(key);
    for (const polygon of nav[key] ?? []) {
      if (key === "buildings") {
        const building = polygon as SurroundingNavigation["buildings"][number];
        feed(building.sourceId); numbers([building.minHeight, building.height]);
      }
      for (const ring of [polygon.ring, ...polygon.holes]) {
        feed("[");
        for (const point of ring) { numbers(point); if (++points % 512 === 0) yield; }
        feed("]");
      }
    }
  }
  return value;
}

export function allotmentNavigationGuardV264(nav: SurroundingNavigation): number {
  const steps = allotmentNavigationGuardStepsV264(nav);
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}

const bytes = (s: string) => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);
const linear = (rgb: number[]) => rgb.map(v => Math.round((v <= 10.31475 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4) * 255));
const SOIL = linear([132, 112, 83]), LEAVES = [linear([101, 139, 73]), linear([142, 153, 83]), linear([118, 147, 87])];
const HEDGE = linear([102, 131, 78]), HEDGE_TOP = linear([127, 153, 91]);
function encoded(values: ArrayBufferView): string {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}

/** Sparse cultivation illustrations, never surveyed parcels or invented huts.
 * Preparation runs only with its existing streamed packet, yields every four
 * groups and keeps no decoded cache, scene root, texture or per-frame work.
 * Native beds/hedges are independently placed orthogonal block-shaped forms. */
export function* prepareAllotmentsV264(
  chunk: SurroundingCityChunk, id: string, native = false,
  evidence: AllotmentSourceV264 = source,
): Generator<void, SurroundingCityChunk> {
  if (evidence === source && !knownChunks.has(id)) return chunk;
  if (chunk.meshes.some(part => part.kind === KIND)) return chunk;
  if (!Object.prototype.hasOwnProperty.call(evidence.chunks, id)) return chunk;
  const plan = evidence.chunks[id][native ? "minecraft" : "drawn"];
  if (!plan?.groups.length || evidence.schemaVersion !== 1 ||
      plan.groups.length > ALLOTMENT_GROUP_LIMIT_V264 || chunk.meshes.length >= 16 ||
      plan.origin.length !== 3 || chunk.origin.some((v, i) => v !== plan.origin[i])) return chunk;
  if ((yield* allotmentNavigationGuardStepsV264(chunk.nav)) !== plan.guard) return chunk;
  if (plan.groups.some(row => row.length !== 6 || !row.every(Number.isFinite) ||
      Math.abs(Math.hypot(row[3], row[4]) - 1) > .000001 ||
      !Number.isInteger(row[5]) || row[5] < 0 || row[5] > 2 ||
      (native && !(row[3] === 0 || row[4] === 0)))) return chunk;
  const quads = native ? 25 : 19;
  const vertexCount = plan.groups.length * quads * 4, indexCount = plan.groups.length * quads * 6;
  if (chunk.meshes.reduce((n, mesh) => n + bytes(mesh.positions) / 6, vertexCount) > 400_000 ||
      chunk.meshes.reduce((n, mesh) => n + bytes(mesh.indices) / 4, indexCount) > 2_400_000) return chunk;
  const positions = new Uint16Array(vertexCount * 3), colours = new Uint8Array(vertexCount * 3);
  const indices = new Uint32Array(indexCount);
  let vertex = 0, index = 0, valid = true;
  for (let at = 0; at < plan.groups.length; at++) {
    const [x, y, z, dx, dz, variant] = plan.groups[at];
    const quad = (corners: number[][], colour: number[]) => {
      const first = vertex;
      for (const [u, h, v] of corners) {
        const point = [x + dx * u - dz * v, y + h, z + dz * u + dx * v];
        for (let axis = 0; axis < 3; axis++) {
          const value = Math.round(point[axis] * 100);
          if (value < 0 || value > 65535) valid = false;
          positions[vertex * 3 + axis] = value; colours[vertex * 3 + axis] = colour[axis];
        }
        vertex++;
      }
      for (const offset of [0, 1, 2, 0, 2, 3]) indices[index++] = first + offset;
    };
    const top = (u: number, v: number, w: number, d: number, h: number, colour: number[]) =>
      quad([[u-w/2,h,v-d/2],[u-w/2,h,v+d/2],[u+w/2,h,v+d/2],[u+w/2,h,v-d/2]], colour);
    const box = (u: number, v: number, w: number, d: number, h: number, side: number[], cap: number[]) => {
      top(u,v,w,d,h,cap);
      for (const [a,b] of [[[u-w/2,v-d/2],[u+w/2,v-d/2]],[[u+w/2,v-d/2],[u+w/2,v+d/2]],
        [[u+w/2,v+d/2],[u-w/2,v+d/2]],[[u-w/2,v+d/2],[u-w/2,v-d/2]]])
        quad([[a[0],.07,a[1]],[a[0],h,a[1]],[b[0],h,b[1]],[b[0],.07,b[1]]], side);
    };
    for (let bed = 0; bed < 3; bed++) {
      const v = (bed - 1) * 1.9, leaf = LEAVES[(bed + variant) % 3];
      if (native) box(0,v,5.4,1.3,.22,SOIL,leaf);
      else {
        top(0,v,5.4,1.3,.10,SOIL);
        for (const row of [-.36,.36]) top(0,v+row,5.1,.35,.15,leaf);
      }
    }
    box(-3.65,-1.1,.45,1.8,.62,HEDGE,HEDGE_TOP);
    box(3.65,1.1,.45,1.8,.62,HEDGE,HEDGE_TOP);
    if (at % 4 === 3) yield;
  }
  if (!valid || vertex !== vertexCount || index !== indexCount) return chunk;
  const part: SurroundingPackedMesh = { kind: KIND, positionType: "u16cm",
    positions: encoded(positions), colors: encoded(colours), indices: encoded(indices) };
  return { ...chunk, meshes: [...chunk.meshes, part] };
}
