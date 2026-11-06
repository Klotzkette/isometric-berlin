import type { Object3D } from "three";

/** Exact transferred source owners required by the retained Core recipe.
 * This is a loading precondition only: the existing complete-source geometry,
 * material, lifetime and word guards still decide whether anything may retire. */
export const NORTHERN_CORE_BATCH_IDS_V319 = Object.freeze([
  "restored-asphalt-1--6", "restored-asphalt-1--7", "restored-asphalt-2--6", "restored-asphalt-2--7",
  "restored-kerbs-1--6", "restored-kerbs-1--7", "restored-kerbs-2--6", "restored-kerbs-2--7",
  "restored-paving-1--6", "restored-paving-1--7", "restored-paving-2--7",
  "surface-earth", "surface-parks-1", "surface-parks-3", "surface-parks-4", "surface-parks-6", "surface-sand",
] as const);
const required: ReadonlySet<string> = new Set(NORTHERN_CORE_BATCH_IDS_V319);

/** A failed or paused worker may retain a usable partial city after its input
 * has been released. Neither that absence nor a generic lifecycle flag proves
 * that the actual source batches exist under this particular world. */
export function hasNorthernCoreSourceBatchesV319(world: Object3D | null | undefined): boolean {
  if (!world) return false;
  const seen = new Set<string>();
  for (const owner of world.children) {
    const id = owner.userData.progressiveWorldBatchId;
    if (typeof id !== "string" || !required.has(id)) continue;
    if (owner.parent !== world || owner.userData.progressiveWorldBatch !== true || seen.has(id)) return false;
    seen.add(id);
  }
  return seen.size === required.size;
}
