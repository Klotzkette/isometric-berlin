import { BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments } from "three";
import source from "./data/a10TransportV347.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { releaseScratchBuffer } from "./releaseScratchBuffer";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { decodeLosslessGzipJson } from "./losslessGzipBase85";

function positions(encoded: string): Float32Array {
  const packed = decodeBase64Bytes(encoded);
  try {
    const input = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
    const output = new Float32Array(packed.byteLength / 4);
    for (let i = 0; i < output.length; i++) output[i] = input.getInt32(i * 4, true) / 100;
    return output;
  } finally {
    releaseScratchBuffer(packed.buffer);
  }
}

/** Additive mapped courses. Like the retained V200 transport layer, these are
 * cartographic strokes, not engineering road decks or guessed bridge heights.
 * The already lazy regional owner controls their lifetime in both families. */
export function createA10TransportV347(native = false): Group {
  const root = new Group();
  root.name = "A10 v347: mapped junctions and lane-based carriageway edges";
  root.userData = {
    a10TransportV347: true, textureFree: true, fullStaticDetailOnTouch: true,
    cartographicTransport: true, blockNative: native, nativeMinecraft: native,
    keepInMinecraft: native,
  };
  for (const batch of source.groups) {
    // Only one bounded regional group is expanded at a time; parsed source
    // arrays are not retained by the scene or any loader cache.
    const decoded = decodeLosslessGzipJson(batch.gzipBase85, 2 * 1024 * 1024) as {
      positionsCm: string; colorsU8: string;
    };
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions(decoded.positionsCm), 3));
    geometry.setAttribute("color", new BufferAttribute(decodeBase64Bytes(decoded.colorsU8), 3, true));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const day = new LineBasicMaterial({ vertexColors: true, fog: false });
    const night = new LineBasicMaterial({ vertexColors: true, color: 0xb8c9d4, fog: false });
    const lines = new LineSegments(geometry, day);
    lines.name = batch.key;
    lines.userData = {
      a10TransportV347: true, dayMaterial: day, nightMaterial: night,
      textureFree: true, cartographicTransport: true, blockNative: native,
    };
    root.add(lines);
  }
  return freezeStaticSceneTransforms(root);
}
