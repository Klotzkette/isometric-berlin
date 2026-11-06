/** Shared data-free disposer; identical to the retained public implementation. */
import { type Group, InstancedMesh, Material, Mesh, Line, Points } from "three";

export function disposeSurroundingCityRoot(root: Group): void {
  const materials = new Set<Material>();
  root.traverse(object => {
    object.userData.disposeZooAnimalsV282?.();
    if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return;
    if (object instanceof InstancedMesh) object.dispose();
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    for (const value of Object.values(object.userData)) if (value instanceof Material) materials.add(value);
  });
  for (const material of materials) material.dispose();
  root.clear();
}
