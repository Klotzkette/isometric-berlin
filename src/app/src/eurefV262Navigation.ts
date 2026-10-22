import source from "./data/eurefV262.json";

type V = [number, number, number];
const [cx, base, cz] = source.gasometer.center;
const ring = source.buildings.find(b => b.kind === "gasometer")!.rings[0];

/** Only the shallow represented terrace-edge reconciliation gains support.
 * Existing building roofs, the campus ground, streets and courts are retained. */
export function eurefV262GroundAt(x: number, z: number, native = false): number | null {
  if (Math.abs(x - cx) > 33 || Math.abs(z - cz) > 33) return null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (native) {
      const n = Math.max(1, Math.ceil(length / 1.5));
      for (let j = 0; j < n; j++) if (Math.abs(x - a[0] - dx * (j + .5) / n) <= (Math.abs(dx) / n + 1.5) / 2 &&
        Math.abs(z - a[1] - dz * (j + .5) / n) <= (Math.abs(dz) / n + 1.5) / 2) return base + 66;
    } else {
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, r = Math.hypot(mx - cx, mz - cz);
      const px = x - mx + (mx - cx) / r * .34, pz = z - mz + (mz - cz) / r * .34;
      if (Math.abs((px * dx + pz * dz) / length) <= (length + .04) / 2 && Math.abs((px * dz - pz * dx) / length) <= .6) return base + 66;
    }
  }
  return null;
}

function segmentHit(p: V, a: V, b: V, width: number, radius: number, native: boolean): boolean {
  const d = b.map((v, i) => v - a[i]);
  if (native) {
    const n = Math.max(1, Math.ceil(Math.max(...d.map(Math.abs)) / .95));
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n;
      if (d.every((v, axis) => Math.abs(p[axis] - a[axis] - v * t) <= (Math.abs(v) / n + width) / 2 + (axis === 1 ? 0 : radius))) return true;
    }
    return false;
  }
  const length2 = d.reduce((s, v) => s + v * v, 0);
  const t = Math.max(0, Math.min(1, d.reduce((s, v, i) => s + v * (p[i] - a[i]), 0) / length2));
  return p.reduce((s, v, i) => s + (v - a[i] - d[i] * t) ** 2, 0) <= (width * Math.SQRT2 / 2 + radius) ** 2;
}

/** Open steel cage: only its represented members collide, never a second solid
 * 78 m cylinder or a campus-wide protected rectangle. */
export function eurefV262SolidAt(x: number, y: number, z: number, radius = 0, native = false): boolean {
  // The visible terrace parapet is separate from the open outer steel cage.
  if (Math.abs(y - base - 66.6) <= .55) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, radial = Math.hypot(mx - cx, mz - cz), nx = (mx - cx) / radial, nz = (mz - cz) / radial;
    const offset = native ? 1.81 : .27, px = x - mx - nx * offset, pz = z - mz - nz * offset;
    if (native ? Math.abs(px) <= Math.max(.17, Math.abs(dx) + Math.abs(nx) * .14) / 2 + radius &&
      Math.abs(pz) <= Math.max(.17, Math.abs(dz) + Math.abs(nz) * .14) / 2 + radius :
      Math.abs((px * dx + pz * dz) / length) <= length / 2 + radius && Math.abs((px * dz - pz * dx) / length) <= .05 + radius) return true;
  }
  const r = native ? source.gasometer.nativeFrameRadiusEstimateM : source.gasometer.frameRadiusEstimateM;
  if (y < base - .1 || y > base + 78.5 || Math.abs(Math.hypot(x - cx, z - cz) - r) > 2 + radius) return false;
  const point = (i: number, h: number): V => [cx + Math.cos(2 * Math.PI * i / 24) * r, base + h, cz + Math.sin(2 * Math.PI * i / 24) * r];
  const p: V = [x, y, z], levels = [0, 13, 26, 39, 52, 65, 78];
  for (let i = 0; i < 24; i++) {
    const post = point(i, 39);
    if (Math.abs(x - post[0]) <= .24 + radius && Math.abs(z - post[2]) <= .24 + radius && y <= base + 78) return true;
    for (const h of levels) {
      if (Math.abs(y - base - h) > 1.1) continue;
      if (segmentHit(p, point(i, h + .14), point(i + 1, h + .14), .30, radius, native)) return true;
      if (h > 0 && segmentHit(p, point(i, h - .28), point(i + 1, h - .28), .12, radius, native)) return true;
      if (h > 0 && Math.abs(x - post[0]) <= .415 + radius && Math.abs(z - post[2]) <= .415 + radius && Math.abs(y - base - h) <= .35) return true;
    }
    const j = Math.max(0, Math.min(5, Math.floor((y - base) / 13)));
    if (segmentHit(p, point(i, levels[j] + .55), point(i + 1, levels[j + 1] - .55), .12, radius, native) ||
      segmentHit(p, point(i + 1, levels[j] + .55), point(i, levels[j + 1] - .55), .12, radius, native)) return true;
  }
  return false;
}
