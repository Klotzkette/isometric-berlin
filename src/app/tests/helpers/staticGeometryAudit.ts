import { type Object3D } from "three";

/** Hash submitted vertex/index/instance data and world transforms, never UUIDs. */
export function staticGeometryAudit(root: Object3D) {
  root.updateMatrixWorld(true);
  const hash = new Bun.CryptoHasher("sha256");
  const geometries = new Set();
  const buffers = new Set();
  let bytes = 0, draws = 0, instances = 0, vertices = 0;
  const text = (value: unknown) => hash.update(JSON.stringify(value));
  const data = (array: ArrayBufferView) => hash.update(
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
  );
  root.traverse((object: any) => {
    if (!object.geometry) return;
    draws++;
    const geometry = object.geometry;
    text({ matrix: object.matrixWorld.elements, visible: object.visible, groups: geometry.groups, drawRange: geometry.drawRange });
    for (const key of Object.keys(geometry.attributes).sort()) {
      const attribute = geometry.attributes[key];
      text([key, attribute.itemSize, attribute.normalized]);
      data(attribute.array);
    }
    if (geometry.index) data(geometry.index.array);
    const materialSignature = (material: any) => material && ({
      color: material.color?.getHex(), emissive: material.emissive?.getHex(),
      emissiveIntensity: material.emissiveIntensity, opacity: material.opacity,
      roughness: material.roughness, metalness: material.metalness,
      transparent: material.transparent, side: material.side, wireframe: material.wireframe,
      vertexColors: material.vertexColors, alphaTest: material.alphaTest,
      depthTest: material.depthTest, depthWrite: material.depthWrite,
      toneMapped: material.toneMapped, blending: material.blending,
      polygonOffset: material.polygonOffset, polygonOffsetFactor: material.polygonOffsetFactor,
      polygonOffsetUnits: material.polygonOffsetUnits, linewidth: material.linewidth,
    });
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    text(materials.map(materialSignature));
    for (const key of ["dayMaterial", "nightMaterial", "moonlitMaterial"]) {
      const value = object.userData[key];
      text([key, Array.isArray(value) ? value.map(materialSignature) : materialSignature(value)]);
    }
    for (const material of materials) {
      const texture = material.map;
      if (!texture) continue;
      text([texture.wrapS, texture.wrapT, texture.minFilter, texture.magFilter, texture.repeat.toArray()]);
      const image = texture.image;
      if (image?.data && ArrayBuffer.isView(image.data)) {
        text([image.width, image.height]); data(image.data);
      }
    }
    if (!geometries.has(geometry)) {
      geometries.add(geometry);
      vertices += geometry.attributes.position?.count ?? 0;
      for (const attribute of [...Object.values(geometry.attributes), geometry.index] as any[]) {
        if (attribute && !buffers.has(attribute.array.buffer)) {
          buffers.add(attribute.array.buffer);
          bytes += attribute.array.byteLength;
        }
      }
    }
    if (object.isInstancedMesh) {
      instances += object.count;
      text(object.count);
      data(object.instanceMatrix.array);
      bytes += object.instanceMatrix.array.byteLength;
      if (object.instanceColor) {
        data(object.instanceColor.array);
        bytes += object.instanceColor.array.byteLength;
      }
    }
  });
  return { hash: hash.digest("hex"), budget: { bytes, draws, instances, vertices } };
}

export function disposeStaticAudit(root: Object3D): void {
  const resources = new Set<any>();
  root.traverse((object: any) => {
    if (object.geometry) resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) resources.add(material);
    }
  });
  for (const resource of resources) resource.dispose();
  root.clear();
}
