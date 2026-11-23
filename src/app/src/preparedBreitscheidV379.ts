// Stable layout shared with scripts/bake-breitscheid-v379.ts. Offsets are relative
// to the first four-byte-aligned byte following the UTF-8 manifest.
import { BufferAttribute, BufferGeometry, Group, LineSegments, MaterialLoader, Mesh, type Object3D } from "three";

export type PackedChurchAttribute = {
  offset: number; length: number; type: "Float32Array" | "Uint8Array" | "Uint16Array" | "Uint32Array";
  size: number; stride: number; normalized: boolean;
};
export type PackedChurchNode = {
  name: string; type: string; parent: number; renderOrder: number; userData: Record<string, unknown>;
  attributes?: Record<string, PackedChurchAttribute>; index?: PackedChurchAttribute;
  geometryFlags?: Record<string, unknown>; material?: object; night?: object;
};

export function decodePreparedBreitscheidV379(bytes: ArrayBuffer): Group {
  const view = new DataView(bytes);
  if (view.getUint32(0) !== 0x42435731) throw new Error("Invalid Breitscheidplatz geometry");
  const size = view.getUint32(4, true);
  const nodes: PackedChurchNode[] = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 8, size)));
  const start = (8 + size + 3) & ~3;
  const types = { Float32Array, Uint8Array, Uint16Array, Uint32Array };
  const attribute = (a: PackedChurchAttribute) => {
    const Type = types[a.type];
    if (!a.stride) return new BufferAttribute(new Type(bytes, start + a.offset, a.length), a.size, a.normalized);
    const values = new Type(a.length);
    const output = new Uint8Array(values.buffer);
    const packed = new Uint8Array(bytes, start + a.offset, output.length);
    let at = 0;
    for (let lane = 0; lane < a.stride; lane++) {
      let previous = 0;
      for (let i = lane; i < output.length; i += a.stride) {
        previous = (previous + packed[at++]) & 255;
        output[i] = previous;
      }
    }
    return new BufferAttribute(values, a.size, a.normalized);
  };
  const materials = new MaterialLoader();
  const objects: Object3D[] = [];
  for (const row of nodes) {
    let object: Object3D;
    if (row.attributes) {
      const geometry = new BufferGeometry();
      for (const [name, a] of Object.entries(row.attributes)) geometry.setAttribute(name, attribute(a));
      if (row.index) geometry.setIndex(attribute(row.index));
      geometry.userData = row.geometryFlags ?? {};
      const material = materials.parse(row.material);
      object = row.type === "LineSegments" ? new LineSegments(geometry, material) : new Mesh(geometry, material);
      Object.assign(object.userData, row.userData);
      if (row.night) {
        object.userData.dayMaterial = material;
        object.userData.nightMaterial = materials.parse(row.night);
      }
    } else {
      object = new Group();
      object.userData = row.userData;
    }
    object.name = row.name;
    object.renderOrder = row.renderOrder;
    if (row.parent >= 0) objects[row.parent].add(object);
    objects.push(object);
  }
  return objects[0] as Group;
}

export async function loadPreparedBreitscheidV379(signal: AbortSignal): Promise<Group> {
  const response = await fetch(new URL("./data/breitscheidEnsembleV379.bin.gz", import.meta.url), {signal});
  if (!response.ok) throw new Error("Breitscheidplatz packet HTTP " + response.status);
  let buffer = await response.arrayBuffer();
  const prefix = new Uint8Array(buffer, 0, 2);
  if (prefix[0] === 0x1f && prefix[1] === 0x8b) {
    if (typeof DecompressionStream !== "undefined") {
      buffer = await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    } else {
      const { gunzipSync } = await import("three/examples/jsm/libs/fflate.module.js");
      buffer = new Uint8Array(gunzipSync(new Uint8Array(buffer))).buffer;
    }
  }
  signal.throwIfAborted();
  return decodePreparedBreitscheidV379(buffer);
}
