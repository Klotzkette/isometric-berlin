import { LineSegments, Mesh, type Object3D } from "three";
import { indexGeometryExactly } from "./exactGeometryIndex";

/** Only constructor-owned immutable buffers opt in; animations retain their layout. */
export function compactStaticGeometry(object: Object3D): number {
  if (!(object instanceof Mesh || object instanceof LineSegments) ||
      object.geometry.userData.exactIndexPending !== true) return 0;
  const geometry = object.geometry;
  const result = indexGeometryExactly(geometry);
  // This geometry can be shared, transferred, and revisited on every mode
  // switch. Never reallocate an attribute after its first GPU upload.
  geometry.userData.exactIndexPending = false;
  return result.savedBytes;
}
