import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  InterleavedBufferAttribute,
  LineSegments,
  Material,
  MaterialLoader,
  Mesh,
  Object3D,
} from "three";

type TypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array;

type TransferAttribute = {
  array: TypedArray;
  gpuType: BufferAttribute["gpuType"];
  itemSize: number;
  normalized: boolean;
  usage: BufferAttribute["usage"];
};

type TransferGeometry = {
  attributes: Record<string, TransferAttribute>;
  drawRange: { count: number; start: number };
  groups: Array<{ count: number; materialIndex: number; start: number }>;
  index: TransferAttribute | null;
  name: string;
  userData: Record<string, unknown>;
};

type MaterialJson = ReturnType<Material["toJSON"]>;

export type TransferObject3D = {
  alternateMaterials: Partial<
    Record<"dayMaterial" | "moonlitMaterial" | "nightMaterial", MaterialJson>
  >;
  castShadow: boolean;
  children: TransferObject3D[];
  count?: number;
  frustumCulled: boolean;
  geometry?: TransferGeometry;
  instanceColor?: TransferAttribute | null;
  instanceMatrix?: TransferAttribute;
  layersMask: number;
  material?: MaterialJson | MaterialJson[];
  matrix: number[];
  matrixAutoUpdate: boolean;
  name: string;
  receiveShadow: boolean;
  renderOrder: number;
  type: "Group" | "InstancedMesh" | "LineSegments" | "Mesh" | "Object3D";
  userData: Record<string, unknown>;
  visible: boolean;
};

export const TRANSFERRED_ALTERNATE_MATERIAL_KEYS = [
  "dayMaterial",
  "nightMaterial",
  "moonlitMaterial",
] as const;

/** Assigned + transferred alternates, de-duplicated for exact-once disposal. */
export function objectMaterialsIncludingTransferredAlternates(
  object: Object3D,
): Material[] {
  const materials = new Set<Material>();
  if (object instanceof Mesh || object instanceof LineSegments) {
    const assigned = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of assigned) materials.add(material);
  }
  for (const key of TRANSFERRED_ALTERNATE_MATERIAL_KEYS) {
    const alternate = object.userData[key];
    if (alternate instanceof Material) materials.add(alternate);
  }
  return [...materials];
}

function cloneUserData(object: Object3D): Record<string, unknown> {
  const userData = { ...object.userData } as Record<string, unknown>;
  for (const key of TRANSFERRED_ALTERNATE_MATERIAL_KEYS) {
    delete userData[key];
  }
  return structuredClone(userData);
}

function serializeAttribute(attribute: BufferAttribute): TransferAttribute {
  if (!(attribute.array.buffer instanceof ArrayBuffer)) {
    throw new Error("Shared geometry buffers are not transferable");
  }
  return {
    array: attribute.array as TypedArray,
    gpuType: attribute.gpuType,
    itemSize: attribute.itemSize,
    normalized: attribute.normalized,
    usage: attribute.usage,
  };
}

function serializeGeometry(geometry: BufferGeometry): TransferGeometry {
  const attributes: Record<string, TransferAttribute> = {};
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    if (attribute instanceof InterleavedBufferAttribute) {
      throw new Error(`Interleaved attribute ${name} cannot be transferred`);
    }
    attributes[name] = serializeAttribute(attribute);
  }
  return {
    attributes,
    drawRange: { ...geometry.drawRange },
    groups: geometry.groups.map((group) => ({
      ...group,
      materialIndex: group.materialIndex ?? 0,
    })),
    index: geometry.index ? serializeAttribute(geometry.index) : null,
    name: geometry.name,
    userData: structuredClone(geometry.userData),
  };
}

function serializeMaterial(material: Material): MaterialJson {
  for (const value of Object.values(
    material as unknown as Record<string, unknown>,
  )) {
    if (value && typeof value === "object" && "isTexture" in value) {
      throw new Error(
        `Textured material ${material.name || material.type} cannot be transferred`,
      );
    }
  }
  return material.toJSON();
}

function transferableType(object: Object3D): TransferObject3D["type"] {
  if (object instanceof InstancedMesh) return "InstancedMesh";
  if (object instanceof LineSegments) return "LineSegments";
  if (object instanceof Mesh) return "Mesh";
  if (object instanceof Group) return "Group";
  return "Object3D";
}

function serializeObject(object: Object3D): TransferObject3D {
  if (object.matrixAutoUpdate) {
    object.updateMatrix();
  }
  const alternateMaterials: TransferObject3D["alternateMaterials"] = {};
  for (const key of TRANSFERRED_ALTERNATE_MATERIAL_KEYS) {
    const material = object.userData[key];
    if (material instanceof Material) {
      alternateMaterials[key] = serializeMaterial(material);
    }
  }
  const descriptor: TransferObject3D = {
    alternateMaterials,
    castShadow: object.castShadow,
    children: object.children.map(serializeObject),
    frustumCulled: object.frustumCulled,
    layersMask: object.layers.mask,
    matrix: object.matrix.toArray(),
    matrixAutoUpdate: object.matrixAutoUpdate,
    name: object.name,
    receiveShadow: object.receiveShadow,
    renderOrder: object.renderOrder,
    type: transferableType(object),
    userData: cloneUserData(object),
    visible: object.visible,
  };
  if (object instanceof Mesh || object instanceof LineSegments) {
    descriptor.geometry = serializeGeometry(object.geometry);
    descriptor.material = Array.isArray(object.material)
      ? object.material.map(serializeMaterial)
      : serializeMaterial(object.material);
  }
  if (object instanceof InstancedMesh) {
    descriptor.count = object.count;
    descriptor.instanceMatrix = serializeAttribute(object.instanceMatrix);
    descriptor.instanceColor = object.instanceColor
      ? serializeAttribute(object.instanceColor)
      : null;
  }
  return descriptor;
}

function collectTransfers(
  descriptor: TransferObject3D,
  buffers: Set<ArrayBuffer>,
): void {
  const add = (attribute?: TransferAttribute | null): void => {
    const buffer = attribute?.array.buffer;
    if (buffer instanceof ArrayBuffer) buffers.add(buffer);
  };
  if (descriptor.geometry) {
    add(descriptor.geometry.index);
    for (const attribute of Object.values(descriptor.geometry.attributes)) {
      add(attribute);
    }
  }
  add(descriptor.instanceMatrix);
  add(descriptor.instanceColor);
  descriptor.children.forEach((child) => collectTransfers(child, buffers));
}

/** Serialize only compact metadata; every large typed array is zero-copy. */
export function serializeObject3DForTransfer(root: Object3D): {
  object: TransferObject3D;
  transfers: Transferable[];
} {
  const object = serializeObject(root);
  const buffers = new Set<ArrayBuffer>();
  collectTransfers(object, buffers);
  return { object, transfers: [...buffers] };
}

function deserializeAttribute(
  descriptor: TransferAttribute,
  instanced = false,
): BufferAttribute {
  const attribute = instanced
    ? new InstancedBufferAttribute(
        descriptor.array,
        descriptor.itemSize,
        descriptor.normalized,
      )
    : new BufferAttribute(
        descriptor.array,
        descriptor.itemSize,
        descriptor.normalized,
      );
  attribute.setUsage(descriptor.usage);
  attribute.gpuType = descriptor.gpuType;
  return attribute;
}

function deserializeGeometry(descriptor: TransferGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.name = descriptor.name;
  geometry.userData = descriptor.userData;
  for (const [name, attribute] of Object.entries(descriptor.attributes)) {
    geometry.setAttribute(name, deserializeAttribute(attribute));
  }
  if (descriptor.index) {
    geometry.setIndex(deserializeAttribute(descriptor.index));
  }
  geometry.clearGroups();
  for (const group of descriptor.groups) {
    geometry.addGroup(group.start, group.count, group.materialIndex);
  }
  geometry.setDrawRange(descriptor.drawRange.start, descriptor.drawRange.count);
  return geometry;
}

function deserializeMaterial(descriptor: MaterialJson): Material {
  return new MaterialLoader().parse(descriptor);
}

function deserializeObject(descriptor: TransferObject3D): Object3D {
  const geometry = descriptor.geometry
    ? deserializeGeometry(descriptor.geometry)
    : undefined;
  const material = Array.isArray(descriptor.material)
    ? descriptor.material.map(deserializeMaterial)
    : descriptor.material
      ? deserializeMaterial(descriptor.material)
      : undefined;
  let object: Object3D;
  switch (descriptor.type) {
    case "InstancedMesh": {
      const mesh = new InstancedMesh(
        geometry,
        material,
        descriptor.count ?? 0,
      );
      if (descriptor.instanceMatrix) {
        mesh.instanceMatrix = deserializeAttribute(
          descriptor.instanceMatrix,
          true,
        ) as InstancedBufferAttribute;
      }
      mesh.instanceColor = descriptor.instanceColor
        ? (deserializeAttribute(
            descriptor.instanceColor,
            true,
          ) as InstancedBufferAttribute)
        : null;
      object = mesh;
      break;
    }
    case "LineSegments":
      object = new LineSegments(geometry, material);
      break;
    case "Mesh":
      object = new Mesh(geometry, material);
      break;
    case "Group":
      object = new Group();
      break;
    default:
      object = new Object3D();
  }
  object.name = descriptor.name;
  object.userData = descriptor.userData;
  for (const key of TRANSFERRED_ALTERNATE_MATERIAL_KEYS) {
    const alternate = descriptor.alternateMaterials[key];
    if (alternate) {
      object.userData[key] = deserializeMaterial(alternate);
    }
  }
  object.matrix.fromArray(descriptor.matrix);
  object.matrix.decompose(object.position, object.quaternion, object.scale);
  object.matrixAutoUpdate = descriptor.matrixAutoUpdate;
  object.castShadow = descriptor.castShadow;
  object.receiveShadow = descriptor.receiveShadow;
  object.frustumCulled = descriptor.frustumCulled;
  object.layers.mask = descriptor.layersMask;
  object.renderOrder = descriptor.renderOrder;
  object.visible = descriptor.visible;
  for (const child of descriptor.children) {
    object.add(deserializeObject(child));
  }
  return object;
}

export function deserializeTransferredObject3D(
  descriptor: TransferObject3D,
): Object3D {
  return deserializeObject(descriptor);
}
