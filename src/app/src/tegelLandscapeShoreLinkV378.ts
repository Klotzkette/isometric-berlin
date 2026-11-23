import type { Mesh } from "three";

interface LakeSource { positions: number[]; colors: number[]; indices: number[] }
export type ShoreUpdateV378 = (mesh: Mesh, source: LakeSource, native: boolean) => void;
let applyShore: ShoreUpdateV378 | undefined;
let pending: Promise<void> | undefined;
const waiting = new Set<() => void>();

/** West-lake roots can arrive before or after the shore tiles, in either style. */
export function registerTegelShoreV378(mesh: Mesh, source: LakeSource, native: boolean) {
  if (applyShore) { applyShore(mesh,source,native); return; }
  const release = () => { waiting.delete(update); mesh.geometry.removeEventListener("dispose",release); };
  const update = () => { release(); applyShore?.(mesh,source,native); };
  waiting.add(update);
  mesh.geometry.addEventListener("dispose",release);
}

/** The correction table is loaded only when a Tegeler See beach is on approach. */
export function loadTegelShoreV378(): Promise<void> {
  pending ??= import("./tegelLandscapeShoreApplyV378").then(module => {
    applyShore=module.applyTegelShoreV378;
    for (const update of [...waiting]) update();
  }).catch(error=>{pending=undefined;throw error;});
  return pending;
}
