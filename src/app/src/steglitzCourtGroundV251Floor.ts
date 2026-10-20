import floors from "./data/steglitzCourtGroundV251Floor.json";

/** Navigation-only finite lookup. No renderer, model or geometry-helper imports.
 * It covers only the actual slab tops, never paint, furniture or the whole site. */
export function steglitzCourtGroundV251Height(
  x: number, z: number, native = false,
): number | undefined {
  const [x0, z0, x1, z1] = floors.bounds;
  if (!Number.isFinite(x) || !Number.isFinite(z)
    || x < x0 || x > x1 || z < z0 || z > z1) return undefined;
  const localX = x - floors.origin[0], localZ = z - floors.origin[1];
  for (const r of native ? floors.native : floors.drawn) {
    const dx = localX - r[0], dz = localZ - r[1];
    const yaw = native ? 0 : r[4], c = Math.cos(yaw), s = Math.sin(yaw);
    const u = c * dx - s * dz, v = s * dx + c * dz;
    if (Math.abs(u) <= r[2] / 2 && Math.abs(v) <= r[3] / 2) return floors.topY;
  }
  return undefined;
}
