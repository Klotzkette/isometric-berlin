import type { SurroundingNavigation } from "./SurroundingCityGeometry";

// The navigation geometry is in metres. Both coordinates must fit an actual
// packet word before using the pair as a unique key. The exporter rounds
// exact half-centimetres to even.
function centimetres(value: number): number {
  const scaled = value * 100;
  const nearest = Math.round(scaled);
  return nearest - scaled === 0.5 && nearest % 2 !== 0 ? nearest - 1 : nearest;
}
function groundPoint(point: readonly number[]): number {
  const x = centimetres(point[0]), z = centimetres(point[1]);
  return x >= 0 && x <= 65535 && z >= 0 && z <= 65535 ? x * 65536 + z : -1;
}

/** Mark absolute vertex indices belonging exclusively to drawn exterior walls
 * with the same footprint edge and vertical extent as a mapped building.
 * Positions and indices are the decoder's existing interleaved, rebased arrays.
 * The edge index and usage flags live only during this part's admission. */
export function* markMappedBuildingWalls(
  vertices: Uint16Array, indices: Uint16Array | Uint32Array,
  indexStart: number, indexCount: number, vertexOffset: number, count: number,
  nav: SurroundingNavigation, originY: number, mark: (vertex: number) => void,
): Generator<void> {
  if (indexCount < 3 || count < 3) return;
  // At each lower endpoint store pairs of (other endpoint, height interval).
  const edges = new Map<number, number[]>();
  let work = 0;
  for (const building of nav.buildings) {
    if (++work % 1024 === 0) yield;
    if (building.ring.length < 3) continue;
    const base = nav.groundY + (building.groundOffset ?? 0) - originY;
    const bottom = centimetres(base + building.minHeight), top = centimetres(base + building.height);
    if (bottom < 0 || top > 65535 || top - bottom < 100) continue;
    const interval = bottom * 65536 + top;
    for (const ring of [building.ring, ...building.holes]) {
      if (ring.length < 3) continue;
      let previous = groundPoint(ring[ring.length - 1]);
      for (const point of ring) {
        const current = groundPoint(point);
        if (previous >= 0 && current >= 0 && current !== previous) {
          const start = Math.min(previous, current), end = Math.max(previous, current);
          const matches = edges.get(start);
          if (matches) matches.push(end, interval);
          else edges.set(start, [end, interval]);
        }
        previous = current;
        if (++work % 1024 === 0) yield;
      }
    }
  }
  if (!edges.size) return;

  const usage = new Uint8Array(count);
  const endIndex = indexStart + indexCount;
  for (let block = indexStart; block < endIndex; block += 6144) {
    const stop = Math.min(endIndex, block + 6144);
    for (let i = block; i < stop; i += 3) {
      const a = indices[i] * 6, b = indices[i + 1] * 6, c = indices[i + 2] * 6;
      const ay = vertices[a + 1], by = vertices[b + 1], cy = vertices[c + 1];
      const low = Math.min(ay, by, cy), high = Math.max(ay, by, cy);
      let flag = 2; // Any use by a roof, ground or unrelated triangle vetoes this vertex.
      if (high - low >= 100) {
        const p = vertices[a] * 65536 + vertices[a + 2];
        const q = vertices[b] * 65536 + vertices[b + 2];
        const r = vertices[c] * 65536 + vertices[c + 2];
        // A nondegenerate vertical face has one pair on the same upright,
        // with different heights, and the third vertex on the other upright.
        if ((p === q && ay !== by && p !== r) ||
            (p === r && ay !== cy && p !== q) ||
            (q === r && by !== cy && q !== p)) {
          const matches = edges.get(Math.min(p, q, r));
          if (matches) {
            const other = Math.max(p, q, r), interval = low * 65536 + high;
            for (let n = 0; n < matches.length; n += 2) {
              if (matches[n] === other && matches[n + 1] === interval) { flag = 1; break; }
            }
          }
        }
      }
      usage[indices[i] - vertexOffset] |= flag;
      usage[indices[i + 1] - vertexOffset] |= flag;
      usage[indices[i + 2] - vertexOffset] |= flag;
    }
    yield;
  }
  for (let block = 0; block < count; block += 8192) {
    const stop = Math.min(count, block + 8192);
    for (let i = block; i < stop; i++) if (usage[i] === 1) mark(vertexOffset + i);
    yield;
  }
}
