import source from './data/invalidenCivicV257.json';
type Vec = [number, number, number];
export type InvalidenEntryTread = { p: Vec; size: Vec; yaw: number };
const face = source.sites.dudlerC.faces.find(f => f.index === 3)!;
const dx0 = face.b[0] - face.a[0], dz0 = face.b[1] - face.a[1];
const length = Math.hypot(dx0, dz0), dx = dx0 / length, dz = dz0 / length;
function build(native: boolean): InvalidenEntryTread[] {
  const result: InvalidenEntryTread[] = [], n = native ? Math.ceil(19 / 1.1) : 1;
  for (let i = 0; i < 9; i++) for (let j = 0; j < n; j++) {
    const u = length * .56 - 19 / 2 + (j + .5) * 19 / n;
    const out = 4.5 - i * .44 + (native ? 1.05 : 0);
    result.push({ p: [face.a[0] + dx * u + face.normal[0] * out, 5.32 + i * .16, face.a[1] + dz * u + face.normal[1] * out],
      size: native ? [Math.max(.07, Math.abs(dx) * 19 / n + Math.abs(face.normal[0]) * .5), .16, Math.max(.07, Math.abs(dz) * 19 / n + Math.abs(face.normal[1]) * .5)] : [19, .16, .5], yaw: native ? 0 : -Math.atan2(dz, dx) });
  }
  return result;
}
const drawn = build(false), native = build(true);
export function invalidenEntryTreadsV257(isNative: boolean) { return isNative ? native : drawn; }
/** Exact rendered tread footprints, with no support in surrounding paths/courts. */
export function invalidenEntryFloorV257At(x: number, z: number, isNative = false): number | null {
  if (x < 405 || x > 430 || z < -1242 || z > -1218) return null;
  let floor: number | null = null;
  for (const tread of invalidenEntryTreadsV257(isNative)) {
    const x0 = x - tread.p[0], z0 = z - tread.p[2];
    const u = isNative ? x0 : x0 * dx + z0 * dz;
    const v = isNative ? z0 : x0 * face.normal[0] + z0 * face.normal[1];
    if (Math.abs(u) <= tread.size[0] / 2 && Math.abs(v) <= tread.size[2] / 2)
      floor = Math.max(floor ?? -Infinity, tread.p[1] + tread.size[1] / 2);
  }
  return floor;
}
