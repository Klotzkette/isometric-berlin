import { BufferAttribute, BufferGeometry, type Group, Mesh } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "./decodeBase64Bytes";


export interface LawnPacket {
  vertices: number;
  indices: number;
  guard: number;
  faces: string;
  positions: string;
  remainder: string;
  wide: boolean;
}

let pending: Promise<readonly LawnPacket[]> | undefined;

/** Fetch only from the progressive surface worker when the first lawn arrives. */
export function loadMittePathLawnsV375(): Promise<readonly LawnPacket[]> {
  pending ??= fetch(new URL("./data/mittePathLawnV375.json", import.meta.url)).then(response => {
    if (!response.ok) throw new Error(`Mitte path lawns: HTTP ${response.status}`);
    return response.json() as Promise<readonly LawnPacket[]>;
  }).catch(() => {
    // A missing optional asset must leave the original park available.
    // A subsequent park batch can retry a transient network failure.
    pending = undefined;
    return [];
  });
  return pending;
}

/** Restore the exact interleaved GPU bytes from their delta-coded byte planes. */
function unpack(text: string, stride: number): Uint8Array<ArrayBuffer> {
  const planes = gunzipSync(decodeBase64Bytes(text));
  const result = new Uint8Array(planes.length), count = result.length / stride;
  for (let lane = 0; lane < stride; lane++) {
    let value = 0;
    for (let i = 0, at = lane; i < count; i++, at += stride) {
      value ^= planes[lane * count + i];
      result[at] = value;
    }
  }
  return result;
}

/** Only touch the indexed grass faces whose original vertices and coordinates
 * attest to a measured crossing. Preserve all other draw indices in place. */
export function applyMittePathLawnV375(root: Group, batches: readonly LawnPacket[]): void {
  const lawn = root.getObjectByName("smooth parkland lawns");
  if (!(lawn instanceof Mesh) || lawn.geometry.userData.mittePathLawnV375) return;
  const geometry = lawn.geometry, position = geometry.getAttribute("position"), index = geometry.index;
  if (!index || !position || position.itemSize !== 3 || !(position.array instanceof Float32Array) ||
      Object.keys(geometry.attributes).length !== 1 || geometry.groups.length ||
      geometry.drawRange.start !== 0 || geometry.drawRange.count < index.count) return;
  const packet = batches.find(item => item.vertices === position.count && item.indices === index.count);
  if (!packet) return;

  const raw = unpack(packet.faces, 4);
  const faces = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const words = new Uint32Array(position.array.buffer, position.array.byteOffset, position.array.length);
  let hash = 2166136261, previous = -1;
  for (const face of faces) {
    if (face <= previous || face * 3 + 2 >= index.count) return;
    previous = face;
    for (let k = 0; k < 3; k++) {
      const vertex = index.getX(3 * face + k);
      hash = Math.imul(hash ^ vertex, 16777619);
      for (let d = 0; d < 3; d++) hash = Math.imul(hash ^ words[3 * vertex + d], 16777619);
    }
  }
  if ((hash >>> 0) !== packet.guard) return;

  const rawPosition = unpack(packet.positions, 12), rawIndex = unpack(packet.remainder, packet.wide ? 4 : 2);
  const remainder = new BufferGeometry();
  remainder.setAttribute("position", new BufferAttribute(new Float32Array(
    rawPosition.buffer, rawPosition.byteOffset, rawPosition.byteLength / 4,
  ), 3));
  const IndexArray = packet.wide ? Uint32Array : Uint16Array;
  remainder.setIndex(new BufferAttribute(new IndexArray(
    rawIndex.buffer, rawIndex.byteOffset, rawIndex.byteLength / IndexArray.BYTES_PER_ELEMENT,
  ), 1));
  remainder.computeBoundingSphere();

  for (const face of faces) {
    const offset = 3 * face, first = index.getX(offset);
    index.setX(offset + 1, first);
    index.setX(offset + 2, first);
  }
  index.needsUpdate = true;
  geometry.userData.mittePathLawnV375 = faces.length;
  const retained = new Mesh(remainder, lawn.material);
  retained.name = "Retained park lawn beside mapped paths in Mitte v375";
  retained.userData = { ...lawn.userData };
  lawn.add(retained);
}
