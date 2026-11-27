import { BufferAttribute, BufferGeometry, Uint16BufferAttribute, Uint32BufferAttribute } from "three";
import { coreParkReliefSupports } from "./parkReliefV182";

const BLOCK_ROWS = 16_384;

function intersectsRelief(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): boolean {
  const west = Math.min(ax, bx, cx), east = Math.max(ax, bx, cx);
  const north = Math.min(az, bz, cz), south = Math.max(az, bz, cz);
  for (const bounds of coreParkReliefSupports) {
    if (east >= bounds[0] - 16 && west <= bounds[2] + 16 &&
        south >= bounds[1] - 16 && north <= bounds[3] + 16) return true;
  }
  return false;
}

/** Refine only hill triangles; preserve every original vertex and the source face order. */
export function refineCoreParkReliefSurface(source: BufferGeometry): BufferGeometry {
  const position = source.getAttribute("position"), index = source.getIndex();
  const count = index?.count ?? position.count;
  const at = (offset: number) => index ? index.getX(offset) : offset;
  const sourceValues = position.array, sourceVertices = sourceValues.length / 3;

  // Keep the source in place. Recursive midpoints require the original double
  // precision until the final Float32 conversion; indices are exact integers.
  const pointBlocks: Float64Array[] = [], faceBlocks: Uint32Array[] = [];
  const midpoints = new Map<number | string, number>();
  let addedVertices = 0, faceCount = 0, maxIndex = 0;
  const coordinate = (vertex: number, axis: number): number => {
    if (vertex < sourceVertices) return sourceValues[vertex * 3 + axis];
    const row = vertex - sourceVertices;
    return pointBlocks[Math.floor(row / BLOCK_ROWS)][(row % BLOCK_ROWS) * 3 + axis];
  };
  const midpoint = (a: number, b: number): number => {
    const high = Math.max(a, b), low = Math.min(a, b);
    // For 26-bit indices this ordered pair fits exactly in a JS number.
    const key = high < 2 ** 26 ? high * high + low : low + ":" + high;
    const existing = midpoints.get(key);
    if (existing !== undefined) return existing;
    const slot = addedVertices % BLOCK_ROWS;
    if (slot === 0) pointBlocks.push(new Float64Array(3 * BLOCK_ROWS));
    const block = pointBlocks[pointBlocks.length - 1];
    for (let axis = 0; axis < 3; axis++) {
      block[3 * slot + axis] = (coordinate(a, axis) + coordinate(b, axis)) / 2;
    }
    const id = sourceVertices + addedVertices++;
    midpoints.set(key, id);
    return id;
  };
  const addFace = (a: number, b: number, c: number) => {
    const slot = faceCount % BLOCK_ROWS;
    if (slot === 0) faceBlocks.push(new Uint32Array(3 * BLOCK_ROWS));
    const block = faceBlocks[faceBlocks.length - 1], offset = 3 * slot;
    block[offset] = a;
    block[offset + 1] = b;
    block[offset + 2] = c;
    faceCount++;
    maxIndex = Math.max(maxIndex, a, b, c);
  };

  const stack: number[] = [];
  for (let i = 0; i < count; i += 3) {
    const a = at(i), b = at(i + 1), c = at(i + 2);
    if (!intersectsRelief(position.getX(a), position.getZ(a), position.getX(b), position.getZ(b), position.getX(c), position.getZ(c))) {
      if (addedVertices) addFace(a, b, c);
      continue;
    }
    stack.push(a, b, c);
    while (stack.length) {
      const third = stack.pop()!, second = stack.pop()!, first = stack.pop()!;
      const ax = coordinate(first, 0), az = coordinate(first, 2);
      const bx = coordinate(second, 0), bz = coordinate(second, 2);
      const cx = coordinate(third, 0), cz = coordinate(third, 2);
      if (intersectsRelief(ax, az, bx, bz, cx, cz)) {
        const ab = (ax - bx) ** 2 + (az - bz) ** 2;
        const bc = (bx - cx) ** 2 + (bz - cz) ** 2;
        const ca = (cx - ax) ** 2 + (cz - az) ** 2;
        const longest = Math.max(ab, bc, ca);
        if (longest > 16.000001) {
          // Until the first split all output is exactly the original prefix.
          if (!addedVertices) {
            for (let j = 0; j < i; j += 3) addFace(at(j), at(j + 1), at(j + 2));
          }
          // Retain the first longest edge on a tie and process the right child first.
          let start = first, end = second, opposite = third;
          if (ab !== longest) {
            if (bc === longest) { start = second; end = third; opposite = first; }
            else { start = third; end = first; opposite = second; }
          }
          const middle = midpoint(start, end);
          stack.push(start, middle, opposite, middle, end, opposite);
          continue;
        }
      }
      if (addedVertices) addFace(first, second, third);
    }
  }
  if (!addedVertices) return source;
  midpoints.clear();

  const points = new Float32Array(sourceValues.length + 3 * addedVertices);
  points.set(sourceValues);
  for (let i = 0; i < pointBlocks.length; i++) {
    const offset = i * 3 * BLOCK_ROWS;
    points.set(pointBlocks[i].subarray(0, 3 * addedVertices - offset), sourceValues.length + offset);
  }
  // Match Three's primitive-restart handling for GPU indices at 65535.
  const indices = maxIndex >= 65535 ? new Uint32BufferAttribute(3 * faceCount, 1) : new Uint16BufferAttribute(3 * faceCount, 1);
  for (let i = 0; i < faceBlocks.length; i++) {
    const offset = i * 3 * BLOCK_ROWS;
    indices.array.set(faceBlocks[i].subarray(0, indices.array.length - offset), offset);
  }
  const result = new BufferGeometry();
  result.setAttribute("position", new BufferAttribute(points, 3));
  result.setIndex(indices);
  return result;
}
