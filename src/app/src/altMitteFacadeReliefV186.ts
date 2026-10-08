/** Light/shadow on existing estimated window quads, not new facade geometry.
 * Exact recipe colours AND rectangular dimensions are required. Source walls,
 * roofs, authored models, clipped fragments and native blocks remain intact. */
type Rgb = readonly [number, number, number];
// Match v169's linear directional shade -> rounded sRGB -> packed linear
// byte conversion, including its intermediate byte rounding.
const linear = (rgb: Rgb, shade = 1): Rgb => rgb.map(value => {
  const c = value / 255;
  const lit = (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4) * shade;
  const quantized = Math.round((lit <= .0031308 ? lit * 12.92 : 1.055 * lit ** (1 / 2.4) - .055) * 255) / 255;
  return Math.round((quantized <= .04045 ? quantized / 12.92 : ((quantized + .055) / 1.055) ** 2.4) * 255) * 257;
}) as [number, number, number];
const definitions: { source: Rgb; width: number; height: number; top: Rgb; bottom: Rgb }[] = [
  { source: [221,216,200], width: 152, height: 203, top: [233,227,209], bottom: [176,175,161] },
  { source: [82,108,115], width: 125, height: 179, top: [66,91,101], bottom: [113,138,144] },
  { source: [91,92,87], width: 7.5, height: 178, top: [140,146,137], bottom: [106,117,110] },
  { source: [221,216,200], width: 163, height: 11, top: [234,226,205], bottom: [148,153,141] },
];
const recipes = [.95,.89,.92,.98,1].flatMap(shade => definitions.map(recipe => ({
  ...recipe, source: linear(recipe.source,shade), top: linear(recipe.top,shade), bottom: linear(recipe.bottom,shade),
})));
const colourKey = (r: number,g: number,b: number): number => (r/257 << 16) | (g/257 << 8) | b/257;
const byColour = new Map<number, typeof recipes>();
for (const recipe of recipes) {
  const key=colourKey(...recipe.source), candidates=byColour.get(key);
  if(candidates) candidates.push(recipe); else byColour.set(key,[recipe]);
}

/** Reuse the final interleaved colour cells. Four scratch indices only; work
 * yields every 4,096 source indices and introduces no GPU buffers or shaders. */
export function* shadeAltMitteFacadeV186(
  vertices: Uint16Array, indices: Uint16Array | Uint32Array,
  start: number, count: number,
): Generator<void, number> {
  const unique = new Uint32Array(4);
  const end = start + count;
  let changed = 0, checkpoint = start;
  for (let at = start; at + 5 < end;) {
    if (at - checkpoint >= 4096) { checkpoint = at; yield; }
    const first = indices[at] * 6;
    // Most triangles are source geometry. Reject them before rectangle work.
    const candidates = byColour.get(colourKey(vertices[first+3],vertices[first+4],vertices[first+5]));
    if (!candidates) { at += 3; continue; }
    const original = candidates[0].source;
    let n = 0, valid = true;
    for (let j = 0; j < 6; j++) {
      const index = indices[at + j];
      let seen = false;
      for (let k = 0; k < n; k++) if (unique[k] === index) seen = true;
      if (!seen) {
        if (n === 4) { valid = false; break; }
        unique[n++] = index;
      }
    }
    if (!valid || n !== 4) { at += 3; continue; }
    let diagonalA = -1, diagonalB = -1;
    for (let j = 0; j < 3; j++) {
      const index = indices[at + j];
      if (index !== indices[at + 3] && index !== indices[at + 4] && index !== indices[at + 5]) continue;
      if (diagonalA < 0) diagonalA = index * 6; else diagonalB = index * 6;
    }
    if (diagonalA < 0 || diagonalB < 0 || vertices[diagonalA + 1] === vertices[diagonalB + 1] ||
        (vertices[diagonalA] === vertices[diagonalB] && vertices[diagonalA + 2] === vertices[diagonalB + 2])) { at += 3; continue; }
    let low = Infinity, high = -Infinity;
    for (const index of unique) {
      const v = index * 6;
      if (vertices[v + 3] !== original[0] || vertices[v + 4] !== original[1] || vertices[v + 5] !== original[2]) valid = false;
      low = Math.min(low, vertices[v + 1]); high = Math.max(high, vertices[v + 1]);
    }
    if (!valid) { at += 3; continue; }
    let a = -1, b = -1, upperCount = 0;
    for (const index of unique) {
      const v = index * 6;
      if (vertices[v + 1] === low) { if (a < 0) a = v; else if (b < 0) b = v; else valid = false; }
      else if (vertices[v + 1] === high) upperCount++;
      else valid = false;
    }
    if (!valid || a < 0 || b < 0 || upperCount !== 2) { at += 3; continue; }
    const width = Math.hypot(vertices[a] - vertices[b], vertices[a + 2] - vertices[b + 2]);
    let recipe: typeof recipes[number] | undefined;
    for (const candidate of candidates) if ( Math.abs(candidate.width - width) <= 1.6 && Math.abs(candidate.height - (high - low)) <= 1.1) recipe = candidate;
    if (!recipe) { at += 3; continue; }
    for (const index of unique) {
      const v = index * 6;
      if (vertices[v + 1] !== high) continue;
      if (!(vertices[v] === vertices[a] && vertices[v + 2] === vertices[a + 2]) &&
          !(vertices[v] === vertices[b] && vertices[v + 2] === vertices[b + 2])) valid = false;
    }
    if (!valid) { at += 3; continue; }
    for (const index of unique) {
      const v = index * 6, tone = vertices[v + 1] === high ? recipe.top : recipe.bottom;
      for (let channel = 0; channel < 3; channel++) vertices[v + 3 + channel] = tone[channel];
    }
    changed++; at += 6;
  }
  return changed;
}
