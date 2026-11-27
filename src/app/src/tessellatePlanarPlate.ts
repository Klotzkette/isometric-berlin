import { BufferGeometry, Float32BufferAttribute, type ShapeGeometry } from "three";

/** This path owns only ShapeGeometry's XY plane before rotation and draping.
 * Its normals are constant and the final unlit plate has no UVs or normals.
 * Visit each triangle's subdivisions in the order produced by Three r185's
 * TessellateModifier, interning each final vertex as mergeVertices(1e-4) does. */
export function tessellatePlanarPlate(source: ShapeGeometry, maxEdge: number, iterations: number): BufferGeometry {
  const position = source.getAttribute("position");
  const input = source.getIndex()!;
  const positions: number[] = [];
  const indices: number[] = [];
  const firstVertex = new Map<string, number>();
  const maxSquared = maxEdge * maxEdge;

  const emit = (x: number, y: number) => {
    // The stock tessellator creates a Float32 position attribute before
    // mergeVertices truncates to the tolerance grid. Keep the first sample.
    x = Math.fround(x);
    y = Math.fround(y);
    const key = `${(x * 10000 + 0.5) | 0},${(y * 10000 + 0.5) | 0}`;
    let vertex = firstVertex.get(key);
    if (vertex === undefined) {
      vertex = positions.length / 3;
      positions.push(x, y, 0);
      firstVertex.set(key, vertex);
    }
    indices.push(vertex);
  };

  function split(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, remaining: number) {
    const ab = (ax - bx) ** 2 + (ay - by) ** 2;
    const bc = (bx - cx) ** 2 + (by - cy) ** 2;
    const ac = (ax - cx) ** 2 + (ay - cy) ** 2;
    if (!remaining || !(ab > maxSquared || bc > maxSquared || ac > maxSquared)) {
      emit(ax, ay);
      emit(bx, by);
      emit(cx, cy);
      return;
    }
    // Keep the upstream tie-breaking and lerp expression. Rounding these
    // intermediate midpoints early would change terrain samples.
    if (ab >= bc && ab >= ac) {
      const mx = ax + (bx - ax) * 0.5, my = ay + (by - ay) * 0.5;
      split(ax, ay, mx, my, cx, cy, remaining - 1);
      split(mx, my, bx, by, cx, cy, remaining - 1);
    } else if (bc >= ab && bc >= ac) {
      const mx = bx + (cx - bx) * 0.5, my = by + (cy - by) * 0.5;
      split(ax, ay, bx, by, mx, my, remaining - 1);
      split(mx, my, cx, cy, ax, ay, remaining - 1);
    } else {
      const mx = ax + (cx - ax) * 0.5, my = ay + (cy - ay) * 0.5;
      split(ax, ay, bx, by, mx, my, remaining - 1);
      split(mx, my, bx, by, cx, cy, remaining - 1);
    }
  }
  for (let i = 0; i < input.count; i += 3) {
    const a = input.getX(i), b = input.getX(i + 1), c = input.getX(i + 2);
    split(position.getX(a), position.getY(a), position.getX(b), position.getY(b),
      position.getX(c), position.getY(c), iterations);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}
