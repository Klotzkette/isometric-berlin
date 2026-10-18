import profile from "./data/parkTerrainV229Profile.json";

/** Exact bounded eight-metre DGM correction. No render payload is imported here. */
export function parkTerrainOffsetV229(x: number, z: number, native = false): number {
  if (native) { x = Math.floor(x / 16) * 16 + 8; z = Math.floor(z / 16) * 16 + 8; }
  const [w, n, e, s] = profile.bounds;
  if (x <= w || x >= e || z <= n || z >= s) return 0;
  const u = (x - w) / profile.step, v = (z - n) / profile.step;
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
  const r = profile.offsets, nw = r[j][i], ne = r[j][i + 1], sw = r[j + 1][i], se = r[j + 1][i + 1];
  return a >= b ? nw * (1 - a) + ne * (a - b) + se * b : nw * (1 - b) + sw * (b - a) + se * a;
}
