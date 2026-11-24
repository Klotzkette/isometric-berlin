import previous from "./data/mehringplatzV383/previous.json";

type Ring = ReadonlyArray<readonly number[]>;
type CorePrism = { id: string; y0_dm: number; h_dm: number; ring: Ring; holes?: ReadonlyArray<Ring> };
/** Height (dm) and FNV-1a checksum of every decimetre coordinate and inner ring. */
const original: Record<string, readonly [number, number]> = {
  "38799552": [120, 4206772913], "25483580": [150, 1867493011], "15548229": [180, 3557517655],
  "25483631": [150, 1717575473], "16110464": [60, 1643155357],
};

export function isMehringplatzPrismV383(building: CorePrism) {
  const spec = original[building.id];
  if (!spec || building.y0_dm !== 52 || building.h_dm !== spec[0]) return false;
  let hash = 2166136261;
  for (const ring of [building.ring, ...(building.holes ?? [])]) {
    hash = Math.imul(hash ^ ring.length, 16777619);
    for (const [x, z] of ring) {
      hash = Math.imul(hash ^ x, 16777619);
      hash = Math.imul(hash ^ z, 16777619);
    }
  }
  return (hash >>> 0) === spec[1];
}

const exact = new Map<number, number>();
for (const [z, start, end, top] of previous) {
  for (let x = start; x <= end; x++) exact.set(x + z * 1024, top);
}

/** The source voxel payload encodes absolute indices on a four-metre grid. */
export function isMehringplatzReplacementColumnV383(x: number, z: number, lo: number, hi: number, cls: number) {
  return x >= 293 && x <= 358 && z >= 525 && z <= 597 &&
    lo === 52 && cls === 3 && exact.get(x + z * 1024) === hi;
}
