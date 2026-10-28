import type { BufferGeometry } from 'three';

type V = readonly [number, number, number];
export type AnimalConvexHullV282 = {
  points: V[]; axes: V[]; edges: V[]; min: number[]; max: number[];
};
const subtract = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function axisInto(axes: Map<string, V>, axis: V): void {
  const length = Math.hypot(...axis);
  if (length < 1e-10) return;
  const sign = axis.find(value => Math.abs(value) > 1e-10)! < 0 ? -1 : 1;
  const normal = axis.map(value => sign * value / length) as unknown as V;
  const key = normal.map(value => Math.round(value * 1e6)).join(',');
  axes.set(key, normal);
}

/** Recover each convex member from the submitted drawn triangles. Triangle
 * edges include coplanar diagonals, which merely add redundant SAT axes. */
export function animalConvexHullV282(geometry: BufferGeometry, start: number,
  count: number): AnimalConvexHullV282 {
  const position = geometry.getAttribute('position'), index = geometry.index!;
  const unique = new Map<string, V>(), axes = new Map<string, V>(), edges = new Map<string, V>();
  for (let i = start; i < start + count; i += 3) {
    const points = [0, 1, 2].map(offset => {
      const k = index.getX(i + offset);
      const p: V = [position.getX(k), position.getY(k), position.getZ(k)];
      unique.set(p.join(','), p); return p;
    });
    const a = subtract(points[1], points[0]), b = subtract(points[2], points[0]);
    axisInto(axes, cross(a, b));
    axisInto(edges, a); axisInto(edges, b); axisInto(edges, subtract(points[2], points[1]));
  }
  const points = [...unique.values()];
  return { points, axes: [...axes.values()], edges: [...edges.values()],
    min: [0, 1, 2].map(axis => Math.min(...points.map(p => p[axis]))),
    max: [0, 1, 2].map(axis => Math.max(...points.map(p => p[axis]))) };
}

/** Convex-polytope SAT: all face normals and every edge cross-product. AABB
 * overlap alone would incorrectly connect limbs touching a cut-away corner. */
export function animalHullsTouchV282(a: AnimalConvexHullV282, b: AnimalConvexHullV282,
  epsilon = .0015): boolean {
  if ([0, 1, 2].some(axis => a.min[axis] > b.max[axis] + epsilon || b.min[axis] > a.max[axis] + epsilon))
    return false;
  const separated = (axis: V): boolean => {
    let alo = Infinity, ahi = -Infinity, blo = Infinity, bhi = -Infinity;
    for (const p of a.points) { const value = dot(p, axis); alo = Math.min(alo, value); ahi = Math.max(ahi, value); }
    for (const p of b.points) { const value = dot(p, axis); blo = Math.min(blo, value); bhi = Math.max(bhi, value); }
    return alo > bhi + epsilon || blo > ahi + epsilon;
  };
  if (a.axes.some(separated) || b.axes.some(separated)) return false;
  const axes = new Map<string, V>();
  for (const ae of a.edges) for (const be of b.edges) axisInto(axes, cross(ae, be));
  return ![...axes.values()].some(separated);
}
