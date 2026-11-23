import { Mesh, type Object3D } from "three";
import {
  crossingProfileV378,
  type WaterwayCrossingV378,
} from "./waterwayBridgeGeometryV378";

type Floor = {
  sample: (x: number, z: number) => number | null;
  owner: Object3D;
};
const bins = [new Map<number, Set<Floor>>(), new Map<number, Set<Floor>>()];
const binKey = (x: number, z: number) => x + z * 2048;

function floorSurface(r: WaterwayCrossingV378, native: boolean) {
  const { x, z, dx, dz, sec, top, p } = crossingProfileV378(r, native);
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [s, left, right] of sec)
    for (const v of [left, right]) {
      const [px, , pz] = p(s, v, 0);
      bounds[0] = Math.min(bounds[0], px);
      bounds[1] = Math.min(bounds[1], pz);
      bounds[2] = Math.max(bounds[2], px);
      bounds[3] = Math.max(bounds[3], pz);
    }
  const sample = (px: number, pz: number) => {
    const u = (px - x) * dx + (pz - z) * dz,
      w = -(px - x) * dz + (pz - z) * dx;
    if (u < sec[0][0] || u > sec[sec.length - 1][0]) return null;
    const i = sec.findIndex((a) => a[0] >= u),
      a = sec[Math.max(0, i - 1)],
      b = sec[i];
    const t = b[0] === a[0] ? 0 : (u - a[0]) / (b[0] - a[0]);
    const low = a[1] + (b[1] - a[1]) * t,
      high = a[2] + (b[2] - a[2]) * t;
    if (w < low + 0.05 || w > high - 0.05) return null;
    return top(u);
  };
  return { bounds, sample };
}

/** Register just the public surfaces in occupied 128 m bins. Stream eviction,
 * a whole scene teardown and a family switch can occur independently. */
export function registerLandwehrFloorsV378(
  owner: Object3D,
  spans: WaterwayCrossingV378[],
  native: boolean,
) {
  const group = bins[native ? 1 : 0],
    entries: [number, Floor][] = [];
  for (const r of spans) {
    if (r.walking === false || (r.role !== "foot" && r.role !== "street"))
      continue;
    const { bounds, sample } = floorSurface(r, native),
      floor = { owner, sample };
    for (
      let z = Math.floor(bounds[1] / 128);
      z <= Math.floor(bounds[3] / 128);
      z++
    )
      for (
        let x = Math.floor(bounds[0] / 128);
        x <= Math.floor(bounds[2] / 128);
        x++
      )
        entries.push([binKey(x, z), floor]);
  }
  if (!entries.length) return;
  const attach = () => {
    for (const [key, floor] of entries) {
      let set = group.get(key);
      if (!set) group.set(key, (set = new Set()));
      set.add(floor);
    }
  };
  const remove = () => {
    for (const [key, floor] of entries) {
      const set = group.get(key);
      set?.delete(floor);
      if (set?.size === 0) group.delete(key);
    }
  };
  owner.addEventListener("added", attach);
  owner.addEventListener("removed", remove);
  owner.traverse((part) => {
    if (part instanceof Mesh)
      part.geometry.addEventListener("dispose", () => {
        remove();
        owner.removeEventListener("added", attach);
        owner.removeEventListener("removed", remove);
      });
  });
  if (owner.parent) attach();
}

export function landwehrDeckFloorV378(
  x: number,
  z: number,
  native = false,
): number | null {
  // The complete canal including the two bypasses lies within this envelope.
  if (x < -3900 || x > 5700 || z < -450 || z > 3450) return null;
  const floors = bins[native ? 1 : 0].get(
    binKey(Math.floor(x / 128), Math.floor(z / 128)),
  );
  if (!floors) return null;
  for (const { owner, sample } of floors) {
    let root: Object3D | null = owner;
    while (root?.visible && root.parent) root = root.parent;
    if (!root?.visible || !("isScene" in root)) continue;
    const value = sample(x, z);
    if (value !== null) return value;
  }
  return null;
}
