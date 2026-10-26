export type StreetPointV276 = readonly [number, number];

/** Offset a kerb cross-section at its unchanged source point. Equal unit
 * tangents, rather than the chord across unequal adjacent edges, meet both
 * sides at the correct angle. Limit acute mitres to twice the half-width;
 * a true reversal stays a cusp rather than inventing a long spike. */
export function streetKerbJoinOffsetV276(
  line: readonly StreetPointV276[], index: number, halfWidth: number,
  result: [number, number],
): [number, number] {
  const count = line.length;
  const closed = count > 2 && line[0][0] === line[count - 1][0] && line[0][1] === line[count - 1][1];
  const at = closed && index === count - 1 ? 0 : index;
  const [x, z] = line[at];
  const last = closed ? count - 2 : count - 1;
  // Centimetre quantisation can repeat a source point, including across a
  // closed seam. Every copy needs the same two distinct neighbours, otherwise
  // the retained zero-length segment joins different, crossing cross-sections.
  let previousIndex = at, nextIndex = at;
  for (;;) {
    const candidate = previousIndex > 0 ? previousIndex - 1 : closed ? last : previousIndex;
    if (candidate === previousIndex || candidate === at) break;
    previousIndex = candidate;
    if (line[candidate][0] !== x || line[candidate][1] !== z) break;
  }
  for (;;) {
    const candidate = nextIndex < last ? nextIndex + 1 : closed ? 0 : nextIndex;
    if (candidate === nextIndex || candidate === at) break;
    nextIndex = candidate;
    if (line[candidate][0] !== x || line[candidate][1] !== z) break;
  }
  const previous = line[previousIndex], next = line[nextIndex];
  let ux = x - previous[0], uz = z - previous[1];
  let vx = next[0] - x, vz = next[1] - z;
  const before = Math.hypot(ux, uz), after = Math.hypot(vx, vz);
  if (before === 0 && after === 0) { result[0] = result[1] = 0; return result; }
  if (before > 0) { ux /= before; uz /= before; }
  if (after > 0) { vx /= after; vz /= after; }
  if (before === 0) { ux = vx; uz = vz; }
  if (after === 0) { vx = ux; vz = uz; }
  const tx = ux + vx, tz = uz + vz, length = Math.hypot(tx, tz);
  if (length < 1e-12) { result[0] = result[1] = 0; return result; }
  const nx = -tz / length, nz = tx / length;
  const projection = nx * -vz + nz * vx;
  const scale = Math.min(halfWidth * 2, halfWidth / Math.max(1e-12, projection));
  result[0] = nx * scale;
  result[1] = nz * scale;
  return result;
}
