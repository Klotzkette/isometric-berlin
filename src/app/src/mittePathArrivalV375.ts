import type { InstancedMesh, Mesh, Object3D } from "three";

const pending = new WeakMap<Object3D, Map<string, Mesh>>();

/** The ground owns a small exact slice until the complete source surface is attached. */
export function registerMittePathPreviewsV375(slabs: InstancedMesh, previews: Map<string, Mesh>): void {
  pending.set(slabs, previews);
}

/** A camera-only district may retire before the city worker adopts it. Keep
 * its original exact path fragments available while that district is mobile. */
export function showArrivalPavingPreviewV376(world: Object3D, batch: string, visible: boolean): void {
  if (!batch.startsWith("restored-paving-")) return;
  const slabs = world.getObjectByName("Drawn ground slabs");
  const preview = slabs && pending.get(slabs)?.get(batch);
  if (preview) preview.visible = visible;
}

export function takeMittePathPreviewV375(world: Object3D, batch: string): Mesh | undefined {
  if (batch !== "surface-sand" && batch !== "surface-earth" && !batch.startsWith("restored-paving-"))
    return;
  const slabs = world.getObjectByName("Drawn ground slabs");
  const previews = slabs ? pending.get(slabs) : undefined;
  const preview = previews?.get(batch);
  if (!preview || !slabs || !previews) return;
  previews.delete(batch);
  if (!previews.size) pending.delete(slabs);
  preview.removeFromParent();
  return preview;
}
