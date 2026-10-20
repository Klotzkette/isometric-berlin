import anchors from "./data/zooRecognitionV255Source.json";

/** Exact horizontal boxes used by the existing v165 orthogonal row builder. */
function withinBox(
  x: number, z: number, cx: number, cz: number,
  width: number, depth: number, yaw: number, native: boolean,
): boolean {
  const dx = x - cx, dz = z - cz;
  if (!native || yaw === 0) {
    const u = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
    const v = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
    return Math.abs(u) <= width / 2 && Math.abs(v) <= depth / 2;
  }
  const n = Math.ceil(width / .65), m = Math.ceil(depth / .65);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const u = (i + .5) * width / n - width / 2, v = (j + .5) * depth / m - depth / 2;
    if (Math.abs(dx - Math.cos(yaw) * u - Math.sin(yaw) * v) <= width / n / 2 &&
      Math.abs(dz + Math.sin(yaw) * u - Math.cos(yaw) * v) <= depth / m / 2) return true;
  }
  return false;
}

/** Only the additive tower's represented solids; complete v165 roofs stay below. */
export function zooRecognitionV255TowerRoofAt(x: number, z: number, native = false): number | null {
  const t = anchors.tower, dx = x - t.centre[0], dz = z - t.centre[1];
  if (Math.abs(dx) > 6 || Math.abs(dz) > 6) return null;
  const r = Math.hypot(dx, dz), square = Math.max(Math.abs(dx), Math.abs(dz));
  if (native) {
    if (square <= .115) return 30.2;
    if (square <= .305) return 29.75;
    if (square <= .46) return 28.96;
    if (square <= .92) return 28.94;
    if (square <= .625) return 28.2;
    if (square <= 1.25) return 28.18;
  } else {
    if (r <= .23) return 30.2 - r / .23 * .45;
    if (r <= .38) return 29.75 - (r - .23) / .15 * .39;
    if (r <= .92) return 28.96 - r / .92 * .02;
    if (r <= 1.25) return 28.2 - r / 1.25 * .02;
  }
  const at = (u: number, v: number): [number, number] =>
    [t.centre[0] + Math.cos(t.yaw) * u + Math.sin(t.yaw) * v,
      t.centre[1] - Math.sin(t.yaw) * u + Math.cos(t.yaw) * v];
  let top: number | null = null;
  for (let level = t.levels - 1; level >= 0; level--) {
    const w = t.width - level * .185, y = anchors.groundY + 3 + level * 1.095;
    if (top !== null && y + 1.1 < top) break;
    for (let side = 0; side < 4; side++) {
      const [cx, cz] = at(Math.sin(side * Math.PI / 2) * (w / 2 - .18), Math.cos(side * Math.PI / 2) * (w / 2 - .18));
      const yaw = t.yaw + side * Math.PI / 2;
      if (withinBox(x, z, cx, cz, w, .36, yaw, native)) top = Math.max(top ?? 0, y + .58);
      if (withinBox(x, z, cx, cz, w - .12, .3, yaw, native)) top = Math.max(top ?? 0, y + .775);
    }
    for (const u of [-1, 1]) for (const v of [-1, 1]) {
      const [cx, cz] = at(u * (w / 2 - .55), v * (w / 2 - .55));
      if (withinBox(x, z, cx, cz, .3, .3, t.yaw, native)) top = Math.max(top ?? 0, y + 1.1);
    }
  }
  return top;
}
