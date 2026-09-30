import { BufferGeometry, Float32BufferAttribute } from "three";
import { UNTER_DEN_LINDEN_ENTRANCE_REGIONS } from "./unterDenLindenEntrancesProfile";

type Point = [number, number, number];
type Polygon = Point[];

/** Keep a convex polygon on one side of a plane, interpolating source height. */
function clip(poly: Polygon, distance: (p: Point) => number): Polygon {
  const result: Polygon = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = distance(a), db = distance(b);
    if (da >= 0) result.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return result;
}

/**
 * The source metal family also contains flat OSM escalator footprints. Cut only
 * the five existing station paving regions from its already smoothed/draped
 * triangles. Source triangles outside these bounded patches remain unchanged;
 * intersecting triangles retain their exact outside complement and height.
 * No polygon source records, other material families or draw counts change.
 */
export function cutUnterDenLindenSurfaceApertures(source: BufferGeometry): BufferGeometry {
  const positions = source.getAttribute("position"), index = source.getIndex();
  const count = index?.count ?? positions.count;
  const output: number[] = [];
  let changed = false;
  const point = (i: number): Point => {
    const j = index ? index.getX(i) : i;
    return [positions.getX(j), positions.getY(j), positions.getZ(j)];
  };
  for (let i = 0; i < count; i += 3) {
    const triangle: Polygon = [point(i), point(i + 1), point(i + 2)];
    let pieces = [triangle];
    const minX = Math.min(...triangle.map(p => p[0])), maxX = Math.max(...triangle.map(p => p[0]));
    const minZ = Math.min(...triangle.map(p => p[2])), maxZ = Math.max(...triangle.map(p => p[2]));
    for (const region of UNTER_DEN_LINDEN_ENTRANCE_REGIONS) {
      if (maxX <= region.minX || minX >= region.maxX || maxZ <= region.minZ || minZ >= region.maxZ) continue;
      changed = true;
      const next: Polygon[] = [];
      for (const piece of pieces) {
        let inside = piece;
        const planes = [(p: Point) => p[0] - region.minX, (p: Point) => region.maxX - p[0],
          (p: Point) => p[2] - region.minZ, (p: Point) => region.maxZ - p[2]];
        for (const plane of planes) {
          const outside = clip(inside, p => -plane(p));
          if (outside.length >= 3) next.push(outside);
          inside = clip(inside, plane);
          if (inside.length < 3) break;
        }
      }
      pieces = next;
    }
    for (const poly of pieces) for (let j = 1; j + 1 < poly.length; j++) {
      const a = poly[0], b = poly[j], c = poly[j + 1];
      if (Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) < 1e-10) continue;
      output.push(...a, ...b, ...c);
    }
  }
  if (!changed) return source;
  const result = new BufferGeometry();
  result.setAttribute("position", new Float32BufferAttribute(output, 3));
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}
