import { Color, type InstancedMesh } from "three";
import source from "./data/sintiRomaNativeWaterV256.json";

/** Only tint the existing dedicated pool's exact runs; preserve every transform. */
export function tintSintiRomaNativeWaterV256(slabs: InstancedMesh): number {
  const matrices = slabs.instanceMatrix.array;
  const paint = new Color(source.displayColor);
  let changed = 0;
  for (let i = 0; i < slabs.count; i++) {
    const at = i * 16;
    if (!source.runs.some(([x, z, width, depth]) =>
      Math.abs(matrices[at + 12] - x) < .001 &&
      Math.abs(matrices[at + 14] - z) < .001 &&
      Math.abs(matrices[at] - width) < .001 &&
      Math.abs(matrices[at + 10] - depth) < .001)) continue;
    slabs.setColorAt(i, paint);
    changed++;
  }
  if (changed && slabs.instanceColor) slabs.instanceColor.needsUpdate = true;
  slabs.userData.sintiRomaWaterTintV256 = { changed, sourcePoolAreaM2: source.sourcePool.area_m2 };
  return changed;
}
