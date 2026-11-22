import { BufferAttribute, BufferGeometry, InstancedBufferAttribute, InstancedMesh, LineSegments, Mesh } from "three";
import { hbfPolygonComplementV291, hbfSegmentComplementV291, type HbfOpeningV291 } from "./HbfGeometryOpeningsV291";
import { invalidenBoundsV371 } from "./invalidenBoundsV371";

const [west, north, east, south] = invalidenBoundsV371;
const opening: HbfOpeningV291 = {
  id: "Invalidenpark and Charité surveyed ground",
  bounds: { min: [west, -Infinity, north], max: [east, Infinity, south] },
  planes: [[1,0,0,-west], [-1,0,0,east], [0,0,1,-north], [0,0,-1,south]],
};
const cuts = [opening];

export function insideInvalidenGroundV371(x: number, z: number): boolean {
  return x >= west && x <= east && z >= north && z <= south;
}

/** Retain the original elevation and colour on both ends of any long run.
 * The survey boundary is on the 4 m cell edges, so only X splits are needed. */
export function cutInvalidenGroundRunsV371(slabs: InstancedMesh): void {
  const transforms = slabs.instanceMatrix.array, paints = slabs.instanceColor?.array;
  const changed: number[] = [];
  let kept = slabs.count;
  for (let i = 0; i < slabs.count; i++) {
    const m = i*16, x = transforms[m+12], z = transforms[m+14];
    const left = x-transforms[m]/2, right = x+transforms[m]/2;
    if (z <= north || z >= south || right <= west || left >= east) continue;
    changed.push(i);
    kept += Number(left < west) + Number(right > east) - 1;
  }
  if (!changed.length) return;
  const next = new Float32Array(kept*16), colours = paints && new Float32Array(kept*3);
  let start = 0, target = 0;
  const copy = (first: number, end: number) => {
    next.set(transforms.subarray(first*16, end*16), target*16);
    if (colours && paints) colours.set(paints.subarray(first*3, end*3), target*3);
    target += end - first;
  };
  const fragment = (i: number, left: number, right: number) => {
    const m = target*16;
    copy(i, i+1);
    next[m] = right-left;
    next[m+12] = (right+left)/2;
  };
  for (const i of changed) {
    copy(start, i);
    const m = i*16, x = transforms[m+12];
    const left = x-transforms[m]/2, right = x+transforms[m]/2;
    if (left < west) fragment(i, left, west);
    if (right > east) fragment(i, east, right);
    start = i+1;
  }
  copy(start, slabs.count);
  slabs.instanceMatrix = new InstancedBufferAttribute(next, 16);
  if (colours) slabs.instanceColor = new InstancedBufferAttribute(colours, 3);
  slabs.count = kept;
  slabs.boundingBox = slabs.boundingSphere = null;
}

/** Preserve outside triangles/segments, including crossings of the survey edge.
 * Vertex outcodes avoid allocating per-primitive polygons while traversing the
 * large shared city plates. Only crossing primitives need interpolated vertices. */
export function cutInvalidenGeometryV371(source: BufferGeometry, lines = false, retainedRanges: readonly [number, number][] = []): BufferGeometry {
  if (!source.boundingBox) source.computeBoundingBox();
  const box = source.boundingBox!;
  if (box.max.x < west || box.min.x > east || box.max.z < north || box.min.z > south) return source;
  const pos = source.getAttribute("position"), index = source.index;
  const count = index?.count ?? pos.count, stride = lines ? 2 : 3;
  const attributes = ["position", ...Object.keys(source.attributes).filter(n => n !== "position")];
  const attrs = attributes.map(k => source.getAttribute(k));
  const offsets: number[] = [];
  let components = 0;
  for (const a of attrs) { offsets.push(components); components += a.itemSize; }
  const vertex = (k: number) => attrs.flatMap(a => Array.from({length: a.itemSize}, (_, j) => a.getComponent(k,j)));
  const codes = new Uint8Array(pos.count);
  for (let i = 0; i < codes.length; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    codes[i] = (x < west ? 1 : x > east ? 2 : 0) | (z < north ? 4 : z > south ? 8 : 0);
  }
  // Step ribbons are separate surveyed flights, each with its own vertex range.
  for (const [first, end] of retainedRanges) codes.fill(16, first, end);
  const fragments = new Map<number, number[][]>();
  let retained = 0, added = 0;
  for (let i = 0; i < count; i += stride) {
    const a=index?.getX(i) ?? i, b=index?.getX(i+1) ?? i+1, c=lines?b:index?.getX(i+2) ?? i+2;
    if (codes[a] & codes[b] & codes[c]) { retained += stride; continue; }
    if (!(codes[a] | codes[b] | codes[c])) continue;
    const outside = lines
      ? hbfSegmentComplementV291(vertex(a), vertex(b), cuts)
      : hbfPolygonComplementV291([vertex(a), vertex(b), vertex(c)], cuts);
    if (!outside) { retained += stride; continue; }
    const replacement: number[][] = [];
    for (const piece of outside) {
      if (lines) replacement.push(piece[0], piece[1]);
      else for (let k=1; k+1<piece.length; k++) replacement.push(piece[0],piece[k],piece[k+1]);
    }
    fragments.set(i, replacement);
    added += replacement.length;
  }
  if (retained === count && !fragments.size) return source;
  const result = new BufferGeometry();
  result.userData = { ...source.userData };
  const outAttrs = attrs.map((a,k) => {
    if (!added) { result.setAttribute(attributes[k],a); return a; }
    const Ctor=a.array.constructor as {new(length:number):BufferAttribute["array"]};
    const out=new BufferAttribute(new Ctor((a.count+added)*a.itemSize),a.itemSize,a.normalized);
    out.array.set(a.array);
    result.setAttribute(attributes[k],out);
    return out;
  });
  const I = pos.count+added > 65535 ? Uint32Array : Uint16Array;
  const indices = new I(retained+added);
  const boundaries = new Map<number, number>();
  for (const group of source.groups) { boundaries.set(group.start,0); boundaries.set(group.start+group.count,0); }
  boundaries.set(source.drawRange.start,0);
  if (Number.isFinite(source.drawRange.count)) boundaries.set(source.drawRange.start+source.drawRange.count,0);
  let target = 0, newVertex=pos.count;
  for (let i=0; i<count; i+=stride) {
    if (boundaries.has(i)) boundaries.set(i,target);
    const a=index?.getX(i) ?? i, b=index?.getX(i+1) ?? i+1, c=lines?b:index?.getX(i+2) ?? i+2;
    if (!(codes[a] | codes[b] | codes[c])) continue;
    const replacement = fragments.get(i);
    if (replacement) {
      for (const point of replacement) {
        for (let k=0; k<outAttrs.length; k++) {
          const out=outAttrs[k];
          for (let j=0; j<out.itemSize; j++) out.setComponent(newVertex,j,point[offsets[k]+j]);
        }
        indices[target++]=newVertex++;
      }
    } else {
      indices[target++]=a; indices[target++]=b;
      if (!lines) indices[target++]=c;
    }
  }
  boundaries.set(count,target);
  for (const group of source.groups) {
    const start=boundaries.get(group.start)!;
    result.addGroup(start,boundaries.get(group.start+group.count)!-start,group.materialIndex);
  }
  const start=boundaries.get(source.drawRange.start) ?? 0;
  result.setDrawRange(start,Number.isFinite(source.drawRange.count)
    ? (boundaries.get(source.drawRange.start+source.drawRange.count) ?? target)-start : Infinity);
  result.setIndex(new BufferAttribute(indices,1));
  result.boundingBox=source.boundingBox; result.boundingSphere=source.boundingSphere;
  return result;
}

export function trimInvalidenSurfaceV371(object: Mesh | LineSegments): void {
  const old = object.geometry;
  const next = cutInvalidenGeometryV371(old, object instanceof LineSegments);
  if (old !== next) { object.geometry = next; old.dispose(); }
}
