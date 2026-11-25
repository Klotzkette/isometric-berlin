import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
import source from "./data/stelenfeldAltMitteV385.json";

export const STELENFELD_LOD2_PARENT = "DEBE00YYGu00005X";
const footprints = source.footprints as unknown as readonly WorldRing[];
const nativeRows: Readonly<Record<number, readonly number[][]>> = source.nativeRows;

export function isOldStelenfeldFloorPart(part: { id: string; sourceId?: string }): boolean {
  return part.sourceId === STELENFELD_LOD2_PARENT &&
    (part.id === "DEBE3DeExMIcRZKx" || part.id === "DEBE3DZhgOS1LQeK");
}

/** The original model's only two floors, including their stair-stepped native extent. */
export function hasOldStelenfeldFloor(x: number, z: number, native: boolean): boolean {
  if (x < 390 || x >= 568 || z < 484 || z >= 650) return false;
  if (native) {
    const cellX = Math.floor(x);
    return nativeRows[Math.floor(z)]?.some(([start, length]) => cellX >= start && cellX < start + length) ?? false;
  }
  return footprints.some(ring => pointInWorldRing(x, z, ring) || ring.some(([x1, z1], i) => {
    const [x2, z2] = ring[(i + 1) % ring.length];
    return Math.abs((x - x1) * (z2 - z1) - (z - z1) * (x2 - x1)) < 1e-7 &&
      x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && z >= Math.min(z1, z2) && z <= Math.max(z1, z2);
  }));
}
