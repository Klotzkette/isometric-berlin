import { BufferAttribute, BufferGeometry } from "three";
import { hbfPolygonComplementV291, type HbfOpeningV291, type HbfPlaneV291 } from "./HbfGeometryOpeningsV291";
import { STELENFELD_RING as ring } from "./stelenfeldSiteV385";

// Split at the single concave corner of the measured cadastral site.
const cuts: HbfOpeningV291[] = [
  [ring[0], ring[1], ring[2], ring[3], ring[4], ring[6], ring[7]],
  [ring[4], ring[5], ring[6]],
].map((ring, i) => {
  const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
  const sign = Math.sign(ring.reduce((area, [x,z], j) => {
    const b = ring[(j + 1) % ring.length];
    return area + x * b[1] - z * b[0];
  }, 0));
  return {
    id: "Stelenfeld " + i,
    bounds: { min: [Math.min(...xs), -Infinity, Math.min(...zs)], max: [Math.max(...xs), Infinity, Math.max(...zs)] },
    planes: ring.map(([x,z], j): HbfPlaneV291 => {
      const b = ring[(j + 1) % ring.length];
      const dx = (b[0] - x) * sign, dz = (b[1] - z) * sign;
      return [-dz, 0, dx, dz * x - dx * z];
    }),
  };
});
const west = Math.min(...ring.map(([x]) => x)), east = Math.max(...ring.map(([x]) => x));
const north = Math.min(...ring.map(([,z]) => z)), south = Math.max(...ring.map(([,z]) => z));

/** Only untextured original paving and the snow blanket call this. Other
 * surfaces can still refer to the same original vertex and face numbers. */
export function cutStelenfeldPavingV385(source: BufferGeometry): BufferGeometry {
  if (source.userData.stelenfeldPavingV385) return source;
  if (!source.boundingBox) source.computeBoundingBox();
  const bounds = source.boundingBox!;
  if (bounds.max.x < west || bounds.min.x > east || bounds.max.z < north || bounds.min.z > south) return source;
  const position = source.getAttribute("position"), index = source.index;
  const count = index?.count ?? position.count;
  const changed: number[] = [], fragments: number[] = [];
  for (let i = 0; i < count; i += 3) {
    const a = index?.getX(i) ?? i, b = index?.getX(i + 1) ?? i + 1, c = index?.getX(i + 2) ?? i + 2;
    const ax = position.getX(a), bx = position.getX(b), cx = position.getX(c);
    if (Math.max(ax,bx,cx) < west || Math.min(ax,bx,cx) > east) continue;
    const az = position.getZ(a), bz = position.getZ(b), cz = position.getZ(c);
    if (Math.max(az,bz,cz) < north || Math.min(az,bz,cz) > south) continue;
    const remaining = hbfPolygonComplementV291([
      [ax, position.getY(a), az], [bx, position.getY(b), bz], [cx, position.getY(c), cz],
    ], cuts);
    if (!remaining) continue;
    changed.push(i);
    for (const poly of remaining) {
      for (let j = 1; j + 1 < poly.length; j++) fragments.push(...poly[0], ...poly[j], ...poly[j+1]);
    }
  }
  if (!changed.length) return source;
  const positions = new Float32Array(position.count * 3 + fragments.length);
  positions.set(position.array);
  positions.set(fragments, position.count * 3);
  const Index = index?.array instanceof Uint32Array || positions.length / 3 > 65535 ? Uint32Array : Uint16Array;
  const indices = new Index(count + fragments.length / 3);
  if (index) indices.set(index.array);
  else for (let i = 0; i < count; i++) indices[i] = i;
  for (const i of changed) indices[i + 1] = indices[i + 2] = indices[i];
  for (let j = 0; j < fragments.length / 3; j++) indices[count + j] = position.count + j;
  const result = new BufferGeometry();
  result.setAttribute("position", new BufferAttribute(positions, 3));
  result.setIndex(new BufferAttribute(indices, 1));
  result.name = source.name;
  result.userData = {...source.userData, stelenfeldPavingV385: changed.length};
  result.boundingBox = source.boundingBox?.clone() ?? null;
  result.boundingSphere = source.boundingSphere?.clone() ?? null;
  return result;
}
