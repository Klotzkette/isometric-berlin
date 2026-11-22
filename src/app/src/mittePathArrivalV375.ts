import type { InstancedMesh, Mesh, Object3D } from "three";

const pending = new WeakMap<Object3D, Map<string, Mesh>>();

/** The ground owns a small exact slice until the complete source surface is attached. */
export function registerMittePathPreviewsV375(slabs: InstancedMesh, previews: Map<string, Mesh>): void {
  pending.set(slabs, previews);
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
