import {
  InstancedBufferAttribute, InstancedMesh, Material, Matrix4, NormalBlending, Object3D, Sphere,
} from "three";

export const STATIC_INSTANCE_CELL_M = 256;
export const STATIC_INSTANCE_PARTITION_MIN_COUNT = 2_048;

/** Copy object state without JSON-cloning userData's shared material references. */
function copyObjectState(target: Object3D, source: Object3D): void {
  target.name = source.name;
  target.up.copy(source.up);
  target.position.copy(source.position);
  target.quaternion.copy(source.quaternion);
  target.scale.copy(source.scale);
  target.matrix.copy(source.matrix);
  target.matrixWorld.copy(source.matrixWorld);
  target.matrixAutoUpdate = source.matrixAutoUpdate;
  target.matrixWorldAutoUpdate = source.matrixWorldAutoUpdate;
  target.matrixWorldNeedsUpdate = true;
  target.layers.mask = source.layers.mask;
  target.visible = source.visible;
  target.castShadow = source.castShadow;
  target.receiveShadow = source.receiveShadow;
  target.renderOrder = source.renderOrder;
  target.userData = { ...source.userData };
}

function canPartition(mesh: InstancedMesh, minimumCount: number): boolean {
  const materials = Array.isArray(mesh.material) ? [...mesh.material] : [mesh.material];
  for (const alternative of [mesh.userData.dayMaterial, mesh.userData.nightMaterial]) {
    if (alternative instanceof Material) materials.push(alternative);
  }
  return mesh.frustumCulled && mesh.count >= minimumCount && mesh.children.length === 0 && mesh.animations.length === 0 &&
    mesh.instanceMatrix.meshPerAttribute === 1 &&
    (!mesh.instanceColor || mesh.instanceColor.meshPerAttribute === 1) &&
    mesh.morphTexture === null && !mesh.customDepthMaterial && !mesh.customDistanceMaterial &&
    mesh.onBeforeRender === Object3D.prototype.onBeforeRender &&
    mesh.onAfterRender === Object3D.prototype.onAfterRender &&
    mesh.onBeforeShadow === Object3D.prototype.onBeforeShadow &&
    mesh.onAfterShadow === Object3D.prototype.onAfterShadow &&
    materials.every((material) => !material.transparent && material.opacity === 1 &&
      material.blending === NormalBlending) &&
    !Object.values(mesh.geometry.attributes).some((attribute) =>
      "isInstancedBufferAttribute" in attribute && attribute.isInstancedBufferAttribute);
}

/**
 * Partition fully authored, immutable opaque instances before scene publication.
 * Geometry/materials stay shared; every instance matrix and color is copied
 * exactly once. Only frustum rejection changes, never distance/detail policy.
 * Transparent batches retain their original draw order. Custom render hooks,
 * morphs and geometry-level instance attributes require their own partitioner.
 */
export function partitionStaticSpatialInstances<T extends Object3D>(
  root: T,
  { cellM = STATIC_INSTANCE_CELL_M, minimumCount = STATIC_INSTANCE_PARTITION_MIN_COUNT }: {
    cellM?: number;
    minimumCount?: number;
  } = {},
): T {
  if (!Number.isFinite(cellM) || cellM <= 0 || !Number.isFinite(minimumCount) || minimumCount < 1) {
    throw new Error("Static instance partition requires positive cell size and count");
  }
  const candidates: InstancedMesh[] = [];
  root.traverse((object) => {
    if (object instanceof InstancedMesh && object.parent && canPartition(object, minimumCount)) {
      candidates.push(object);
    }
  });
  const matrix = new Matrix4();
  for (const source of candidates) {
    const cells = new Map<string, number[]>();
    for (let index = 0; index < source.count; index += 1) {
      const offset = index * 16;
      const x = source.instanceMatrix.array[offset + 12];
      const z = source.instanceMatrix.array[offset + 14];
      const key = `${Math.floor(x / cellM)},${Math.floor(z / cellM)}`;
      const entries = cells.get(key);
      if (entries) entries.push(index);
      else cells.set(key, [index]);
    }
    if (cells.size < 2) continue;
    // A Group would replace the inherited renderer groupOrder. An Object3D
    // wrapper retains the exact original opaque ordering contract instead.
    const container = new Object3D();
    copyObjectState(container, source);
    for (const [cell, indices] of cells) {
      const batch = new InstancedMesh(source.geometry, source.material, indices.length);
      batch.name = `${source.name} [cell ${cell}]`;
      batch.layers.mask = source.layers.mask;
      batch.castShadow = source.castShadow;
      batch.receiveShadow = source.receiveShadow;
      batch.renderOrder = source.renderOrder;
      batch.visible = source.visible;
      batch.userData = { ...source.userData };
      batch.userData.staticSpatialCell = cell;
      batch.userData.staticSpatialSourceName = source.name;
      for (let index = 0; index < indices.length; index += 1) {
        source.getMatrixAt(indices[index], matrix);
        batch.setMatrixAt(index, matrix);
      }
      if (source.instanceColor) {
        const values = source.instanceColor.array.slice(0, indices.length * source.instanceColor.itemSize);
        for (let index = 0; index < indices.length; index += 1) {
          const offset = indices[index] * source.instanceColor.itemSize;
          values.set(source.instanceColor.array.subarray(offset, offset + source.instanceColor.itemSize),
            index * source.instanceColor.itemSize);
        }
        batch.instanceColor = new InstancedBufferAttribute(values, source.instanceColor.itemSize,
          source.instanceColor.normalized, source.instanceColor.meshPerAttribute);
        batch.instanceColor.setUsage(source.instanceColor.usage);
        batch.instanceColor.gpuType = source.instanceColor.gpuType;
        batch.instanceColor.needsUpdate = true;
      }
      batch.instanceMatrix.setUsage(source.instanceMatrix.usage);
      batch.instanceMatrix.needsUpdate = true;
      // Box-derived spheres conservatively include rotated, nonuniformly scaled
      // and sheared instances, rather than assuming a sphere's max-axis scale.
      batch.computeBoundingBox();
      batch.boundingSphere = batch.boundingBox!.getBoundingSphere(new Sphere());
      container.add(batch);
    }
    const parent = source.parent!;
    const index = parent.children.indexOf(source);
    parent.remove(source);
    parent.add(container);
    parent.children.splice(parent.children.indexOf(container), 1);
    parent.children.splice(index, 0, container);
  }
  return root;
}
