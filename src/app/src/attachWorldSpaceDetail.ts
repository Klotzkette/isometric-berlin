import { Group, InstancedMesh, Mesh, type BufferGeometry, type Object3D } from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";

/** All parts are owned by this exact stream entry. Account for shared meshes
 * once, including instance transforms and colours. */
export function attachWorldSpaceDetail(entry: SurroundingChunkGeometry, part: Object3D) {
  const anchor = new Group();
  anchor.position.set(-entry.origin[0], -entry.origin[1], -entry.origin[2]);
  anchor.add(part);
  const arrays = new Set<ArrayBufferView>();
  part.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geometry: BufferGeometry = object.geometry;
    for (const attr of Object.values(geometry.attributes)) {
      if ("array" in attr) arrays.add(attr.array);
    }
    if (object.geometry.index) arrays.add(object.geometry.index.array);
    if (object instanceof InstancedMesh) {
      arrays.add(object.instanceMatrix.array);
      if (object.instanceColor) arrays.add(object.instanceColor.array);
    }
  });
  entry.geometryBytes += [...arrays].reduce((bytes, array) => bytes + array.byteLength, 0);
  entry.bufferCount += arrays.size;
  entry.root.add(freezeStaticSceneTransforms(anchor));
}
