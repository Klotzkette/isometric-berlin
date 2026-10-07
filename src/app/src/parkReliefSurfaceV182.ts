import { BufferAttribute, BufferGeometry } from "three";
import relief from "./data/parkReliefV182.json";

const bounds = relief.profiles.find(p => p.name === "Volkspark Humboldthain")!.support;

/** Refine only hill triangles; all old vertices and outside faces remain exact. */
export function refineCoreParkReliefSurface(source: BufferGeometry): BufferGeometry {
  const position = source.getAttribute("position"), index = source.getIndex();
  const count = index?.count ?? position.count;
  const at = (i: number) => index ? index.getX(i) : i;
  const affected = new Set<number>();
  for (let i = 0; i < count; i += 3) {
    const a = at(i), b = at(i + 1), c = at(i + 2);
    if (Math.max(position.getX(a), position.getX(b), position.getX(c)) < bounds[0] - 16 ||
        Math.min(position.getX(a), position.getX(b), position.getX(c)) > bounds[2] + 16 ||
        Math.max(position.getZ(a), position.getZ(b), position.getZ(c)) < bounds[1] - 16 ||
        Math.min(position.getZ(a), position.getZ(b), position.getZ(c)) > bounds[3] + 16) continue;
    affected.add(i);
  }
  if (!affected.size) return source;
  const points = Array.from(position.array);
  const faces: number[] = [];
  const midpoints = new Map<string, number>();
  const midpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const old = midpoints.get(key);
    if (old !== undefined) return old;
    const id = points.length / 3;
    for (let axis = 0; axis < 3; axis++) points.push((points[a * 3 + axis] + points[b * 3 + axis]) / 2);
    midpoints.set(key, id);
    return id;
  };
  for (let i = 0; i < count; i += 3) {
    if (!affected.has(i)) { faces.push(at(i), at(i + 1), at(i + 2)); continue; }
    const stack: number[][] = [[at(i), at(i + 1), at(i + 2)]];
    while (stack.length) {
      const t = stack.pop()!;
      const xs = t.map(n => points[n * 3]), zs = t.map(n => points[n * 3 + 2]);
      if (Math.max(...xs) < bounds[0] - 16 || Math.min(...xs) > bounds[2] + 16 ||
          Math.max(...zs) < bounds[1] - 16 || Math.min(...zs) > bounds[3] + 16) {
        faces.push(...t); continue;
      }
      const lengths = [0, 1, 2].map(j => (xs[j] - xs[(j + 1) % 3]) ** 2 + (zs[j] - zs[(j + 1) % 3]) ** 2);
      const longest = Math.max(...lengths);
      if (longest <= 16.000001) { faces.push(...t); continue; }
      const j = lengths.indexOf(longest), a = t[j], b = t[(j + 1) % 3], c = t[(j + 2) % 3];
      const m = midpoint(a, b);
      stack.push([a, m, c], [m, b, c]);
    }
  }
  if (!midpoints.size) return source;
  // Smooth ground uses unlit materials, so its only live attribute is position.
  const result = new BufferGeometry();
  result.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
  result.setIndex(faces);
  return result;
}
