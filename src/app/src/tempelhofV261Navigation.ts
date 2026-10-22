import source from "./data/tempelhofV261.json";

const [ax, baseY, az] = source.monument.anchor;
function baseAt(x: number, z: number): boolean {
  const dx = x - ax, dz = z - az;
  return Math.abs(dx) <= 2.1105 && dz >= -2.5 && dz <= 3.5175 * Math.sqrt(Math.max(0, 1 - (dx / 2.1105) ** 2));
}
/** Shallow plinth only; nearby park and all approaches keep their earlier ground. */
export function tempelhofV261GroundAt(x: number, z: number, native = false): number | null {
  if (Math.abs(x - ax) > 8 || Math.abs(z - az) > 5) return null;
  if (!native) return baseAt(x, z) ? baseY + .42 : null;
  return source.blocks.some(b => b[1] < baseY + .43 && Math.abs(x - b[0]) <= b[3] / 2 && Math.abs(z - b[2]) <= b[5] / 2) ? baseY + .42 : null;
}
/** Collision matches the web and separated tips; never blocks the whole park. */
export function tempelhofV261SolidAt(x: number, y: number, z: number, radius = 0, native = false): boolean {
  if (Math.abs(x - ax) > 8 + radius || Math.abs(z - az) > 5 + radius || y < baseY || y > baseY + 20) return false;
  if (native) return source.blocks.some(b => Math.abs(x - b[0]) <= b[3] / 2 + radius && Math.abs(y - b[1]) <= b[4] / 2 && Math.abs(z - b[2]) <= b[5] / 2 + radius);
  const h = y - baseY;
  if (h <= .42) return [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]].some(([dx, dz]) => baseAt(x + dx, z + dz));
  const t = (h - .42) / 19.58, back = .60 - 4.08 * t ** 2.35, front = back - (.62 - .20 * t), width = 2.4 + 1.1 * t;
  if (x < ax + front - .1 - radius || x > ax + back + radius) return false;
  if (h <= 17.2) return Math.abs(z - az) <= width + radius;
  return [-.9, 0, .9].some(f => Math.abs(z - az - f * width) <= width * .1 + radius);
}
