/** Exact newly mapped path sheets; compact source expands only on requested hosts. */
import { ShapeUtils, Vector2 } from "three";
import type { SourceQuarterCatalogueEntryV309 } from "./SourceQuarterCatalogueV309";
import type { NeighbourhoodPlanV300, NeighbourhoodSourceV300 } from "./NeighbourhoodPacketV300";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { releaseScratchBuffer } from "./releaseScratchBuffer";
import index from "./data/facilityPathsV350Index.json";

const KIND = "facility-paths-v350";
type Sheet = ["r" | "b" | "t", number, number, number, number, number[][][] | number[]];
type CompactPlan = Omit<NeighbourhoodPlanV300, "append" | "appendFingerprint"> & { sheets: Sheet[] };
export type FacilityPathWireV350 = { schemaVersion: 1; keys: string[]; compressed: Uint8Array; decodedBytes: number };
function encoded(bytes: Uint8Array): string {
  let result = "";
  for (let at = 0; at < bytes.length; at += 8192) result += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return btoa(result);
}
function fingerprint(mesh: SurroundingPackedMesh): number {
  let hash = 2166136261;
  for (const value of [mesh.positions, mesh.colors, mesh.indices]) for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
  return hash;
}
export function facilityPathMeshV350(sheets: Sheet[]): SurroundingPackedMesh {
  if (!Array.isArray(sheets) || sheets.length > 512) throw Error("Unbounded facility path sheets");
  const positions: number[] = [], colors: number[] = [], indices: number[] = [], vertices = new Map<string, number>();
  const vertex = (x: number, y: number, z: number, rgb: number[]) => {
    const row = [x, y, z, ...rgb];
    if (row.some((v, i) => !Number.isSafeInteger(v) || v < 0 || v > (i < 3 ? 65535 : 255))) throw Error("Facility surface escaped centimetre source");
    const key = row.join(","), old = vertices.get(key);
    if (old !== undefined) return old;
    const n = positions.length / 3; positions.push(x, y, z); colors.push(...rgb); vertices.set(key, n); return n;
  };
  const triangle = (a: number[], b: number[], c: number[], y: number, rgb: number[]) => {
    if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0) [a, c] = [c, a];
    const face = [vertex(a[0], y, a[1], rgb), vertex(b[0], y, b[1], rgb), vertex(c[0], y, c[1], rgb)];
    if (new Set(face).size === 3) indices.push(...face);
  };
  for (const [kind, y, r, g, b, value] of sheets) {
    const rgb = [r, g, b];
    if (kind === "r") {
      for (const polygon of value as number[][][]) {
        const rings = polygon.map(delta => {
          if (delta.length < 6 || delta.length % 2) throw Error("Invalid facility surface ring");
          let x = 0, z = 0; const ring: Vector2[] = [];
          for (let i = 0; i < delta.length; i += 2) { x += delta[i]; z += delta[i + 1]; ring.push(new Vector2(x, z)); }
          return ring;
        });
        const points = rings.flat();
        for (const [a, b, c] of ShapeUtils.triangulateShape(rings[0], rings.slice(1))) triangle(points[a].toArray(), points[b].toArray(), points[c].toArray(), y, rgb);
      }
    } else if (kind === "b") {
      const boxes = value as number[]; let x = 0, z = 0;
      if (boxes.length % 4) throw Error("Invalid Native facility runs");
      for (let i = 0; i < boxes.length; i += 4) {
        x += boxes[i]; z += boxes[i + 1]; const w = boxes[i + 2], d = boxes[i + 3];
        if (w <= 0 || d <= 0 || [x, z, w, d].some(n => n % 50)) throw Error("Non-cardinal Native facility run");
        triangle([x, z], [x + w, z], [x + w, z + d], y, rgb); triangle([x, z], [x + w, z + d], [x, z + d], y, rgb);
      }
    } else if (kind === "t") {
      const triangles = value as number[];
      if (triangles.length % 6) throw Error("Invalid exact facility triangles");
      for (let i = 0; i < triangles.length; i += 6) triangle(triangles.slice(i, i + 2), triangles.slice(i + 2, i + 4), triangles.slice(i + 4, i + 6), y, rgb);
    } else throw Error("Unknown facility surface encoding");
  }
  if (positions.length / 3 > 45000 || indices.length > 240000) throw Error("Facility surface exceeds finite packet allowance");
  return { kind: KIND, positionType: "u16cm", positions: encoded(new Uint8Array(new Uint16Array(positions).buffer)), colors: encoded(new Uint8Array(colors)), indices: encoded(new Uint8Array(new Uint32Array(indices).buffer)) };
}
export function facilityPathSourceV350(wire: FacilityPathWireV350): NeighbourhoodSourceV300 {
  if (wire.schemaVersion !== 1 || wire.keys.length > 32 || new Set(wire.keys).size !== wire.keys.length || wire.decodedBytes > 2 * 1024 * 1024) throw Error("Invalid compact facility path envelope");
  let compact: WeakRef<{ packets: Record<string, CompactPlan> }> | undefined;
  const source = () => {
    let current = compact?.deref();
    if (!current) {
      if (wire.compressed.length < 18) throw Error("Truncated compact path source");
      const declared = new DataView(wire.compressed.buffer, wire.compressed.byteOffset, wire.compressed.byteLength).getUint32(wire.compressed.length - 4, true);
      if (declared !== wire.decodedBytes) throw Error("Compact path source size changed");
      const output = new Uint8Array(declared + 1);
      try {
        const bytes = gunzipSync(wire.compressed, {out: output});
        if (bytes.length !== declared) throw Error("Compact path decoded size changed");
        current = JSON.parse(new TextDecoder().decode(bytes)) as { packets: Record<string, CompactPlan> };
      } finally { releaseScratchBuffer(output.buffer); }
      if (Object.keys(current.packets).length !== wire.keys.length || wire.keys.some(k => !current!.packets[k])) throw Error("Incomplete compact facility path keys");
      compact = new WeakRef(current);
    }
    return current;
  };
  const packets: Record<string, NeighbourhoodPlanV300> = {};
  for (const key of wire.keys) {
    let cached: WeakRef<NeighbourhoodPlanV300> | undefined;
    Object.defineProperty(packets, key, { enumerable: true, get() {
      const old = cached?.deref(); if (old) return old;
      const { sheets, ...guards } = source().packets[key];
      if (guards.retire.length) throw Error("Facility paths may never retire an existing face");
      let expanded: SurroundingPackedMesh | undefined;
      let appendFingerprint = 0;
      const mesh = () => {
        let value = expanded;
        if (!value) { value = facilityPathMeshV350(sheets); appendFingerprint = fingerprint(value); expanded = value; }
        return value;
      };
      const plan = {...guards} as NeighbourhoodPlanV300;
      Object.defineProperties(plan, {
        append: {enumerable: true, get: mesh},
        appendFingerprint: {enumerable: true, get: () => { mesh(); return appendFingerprint; }},
      });
      cached = new WeakRef(plan); return plan;
    } });
  }
  return { schemaVersion: 1, keys: wire.keys.slice(), packets };
}
let loaders: Record<string, () => Promise<unknown>> = {};
try { loaders = import.meta.glob("./data/facilityPathsV350Packets*.json.gz", {query: "?url", import: "default"}); }
catch { /* Offline checks read the identical immutable compact surface records. */ }
export const facilityPathsEntriesV350: SourceQuarterCatalogueEntryV309[] = index.sources.map(({ file, keys, decodedBytes }) => ({
  kind: KIND, keys,
  load: async () => {
    const path = "./data/" + file, loader = loaders[path];
    const url = loader ? await loader() as string : new URL(path, import.meta.url).href;
    const response = await fetch(url);
    if (!response.ok) throw Error(`Facility path source ${response.status}`);
    const compressed = new Uint8Array(await response.arrayBuffer());
    return { default: facilityPathSourceV350({schemaVersion: 1, keys, decodedBytes, compressed}) };
  },
}));
