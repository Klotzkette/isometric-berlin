import { Box3, Matrix4, Vector3, type Camera, type Frustum } from "three";
import type { SurroundingChunkDescriptor } from "./SurroundingCity";

type Tile = SurroundingChunkDescriptor;
type Point = { x: number; z: number };
type Item = { tile: Tile; box: Box3; order: number; local: boolean; base: boolean; distance: number };
type Bucket = { box: Box3; items: Item[] };

function distanceToBox(box: Box3, x: number, z: number): number {
  const dx = Math.max(box.min.x - x, 0, x - box.max.x);
  const dz = Math.max(box.min.z - z, 0, z - box.max.z);
  return dx * dx + dz * dz;
}

/** The broad phase uses the union of the actual member boxes, including roofs.
 * Only the existing exact frustum/distance predicates decide tile admission. */
export function createSurroundingViewPlanV379(
  tiles: readonly Tile[], ceiling: (tile: Tile) => number, local: (tile: Tile) => boolean,
  base: (tile: Tile) => boolean,
) {
  const buckets = new Map<string, Bucket>();
  for (let order = 0; order < tiles.length; order++) {
    const tile = tiles[order], [x0, z0, x1, z1] = tile.bounds;
    const key = Math.floor(x0 / 2048) + ":" + Math.floor(z0 / 2048);
    let bucket = buckets.get(key);
    if (!bucket) { bucket = { box: new Box3(), items: [] }; buckets.set(key, bucket); }
    const box = new Box3(new Vector3(x0, -12, z0), new Vector3(x1, ceiling(tile), z1));
    bucket.box.union(box);
    bucket.items.push({ tile, box, order, local: local(tile), base: base(tile), distance: 0 });
  }
  const projection = new Matrix4(), view = new Matrix4();
  const near = new Vector3(), far = new Vector3();
  const visible: Item[] = [], ordered: Tile[] = [];
  const sampleOffsets = [[-.62, .28], [.62, .28], [-.62, -.28], [.62, -.28]];
  let focusX = NaN, focusZ = NaN;

  return (camera: Camera, frustum: Frustum, position: Vector3, focus: Point): readonly Tile[] => {
    if (focusX === focus.x && focusZ === focus.z && projection.equals(camera.projectionMatrix) &&
        view.equals(camera.matrixWorldInverse)) return ordered;
    focusX = focus.x; focusZ = focus.z;
    projection.copy(camera.projectionMatrix); view.copy(camera.matrixWorldInverse);
    const range = Math.hypot(position.x - focus.x, position.y, position.z - focus.z);
    const siteReachSquared = Math.max(1100, 1.5 * range) ** 2;
    visible.length = 0;
    for (const bucket of buckets.values()) {
      if (distanceToBox(bucket.box, position.x, position.z) >= 180 ** 2 && !frustum.intersectsBox(bucket.box)) continue;
      for (const item of bucket.items) {
        const d = distanceToBox(item.box, focus.x, focus.z);
        const eye = distanceToBox(item.box, position.x, position.z);
        if (item.local && d > siteReachSquared && eye > siteReachSquared) continue;
        if (eye >= 180 ** 2 && !frustum.intersectsBox(item.box)) continue;
        item.distance = d; visible.push(item);
      }
    }
    visible.sort((a,b) => a.distance - b.distance || a.order - b.order);
    ordered.length = 0;
    // A wide approach once completed the entire central cluster before starting
    // any near the screen edges. Interleave four real base packets under actual
    // on-screen ground rays, keeping the nearest four packets first. The
    // ordinary nearest-first order resumes immediately, with all details kept.
    if (range >= 900 && visible.length >= 24) {
      const promoted = new Set<Item>();
      for (const [x,y] of sampleOffsets) {
        near.set(x,y,-1).unproject(camera); far.set(x,y,1).unproject(camera);
        const t = -near.y / (far.y - near.y);
        if (!(t >= 0 && t <= 1)) continue;
        near.lerp(far,t);
        const item = visible.find(v => v.base && near.x >= v.box.min.x && near.x < v.box.max.x &&
          near.z >= v.box.min.z && near.z < v.box.max.z);
        if (item) promoted.add(item);
      }
      for (let i = 0; i < 4; i++) { promoted.delete(visible[i]); ordered.push(visible[i].tile); }
      for (const item of promoted) ordered.push(item.tile);
      for (let i = 4; i < visible.length; i++) if (!promoted.has(visible[i])) ordered.push(visible[i].tile);
    } else {
      for (const item of visible) ordered.push(item.tile);
    }
    return ordered;
  };
}
