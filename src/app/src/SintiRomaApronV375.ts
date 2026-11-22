import { BufferAttribute, BufferGeometry, Color, Mesh, MeshBasicMaterial } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import source from "./data/sintiRomaApronV375.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";

export const SINTI_ROMA_APRON_V375 =
  "Sinti and Roma memorial orthophoto-traced outer granite and entrance";

/** The field is outside the 237 fitted central stones. Local millimetres preserve the
 * measured ground datum and the registered granite/grass boundaries in one draw. */
export function createSintiRomaApronV375(): Mesh {
  const encoded = gunzipSync(decodeBase64Bytes(source.vertices));
  const records = new Int16Array(encoded.buffer, encoded.byteOffset, encoded.byteLength / 2);
  const indices = gunzipSync(decodeBase64Bytes(source.indices));
  const count = records.length / 4;
  const xyz = new Float32Array(count * 3);
  const rgb = new Uint8Array(count * 3);
  // Match the park ground. The three granite tones follow the orthophoto's
  // relative brightness while the surrounding mineral bedding stays subdued.
  const palette = [0xa9c592, 0x9c9b8f, 0xaaa99e, 0xb6b5a9, 0xc2c0b4].map(
    (value) => new Color(value),
  );
  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    const color = palette[records[offset + 3]];
    for (let n = 0; n < 3; n++) xyz[i * 3 + n] = records[offset + n] / 1000;
    rgb[i * 3] = Math.round(color.r * 255);
    rgb[i * 3 + 1] = Math.round(color.g * 255);
    rgb[i * 3 + 2] = Math.round(color.b * 255);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(xyz, 3));
  geometry.setAttribute("color", new BufferAttribute(rgb, 3, true));
  geometry.setIndex(
    new BufferAttribute(
      new Uint16Array(indices.buffer, indices.byteOffset, indices.byteLength / 2),
      1,
    ),
  );
  geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true });
  const night = new MeshBasicMaterial({ color: 0x4d5666, vertexColors: true });
  // Only the new surface gets precedence over the old coplanar 4 m finish.
  // Its own raised granite, the original stones and the basin still depth-test normally.
  for (const material of [day, night]) {
    material.polygonOffset = true;
    material.polygonOffsetFactor = 0;
    material.polygonOffsetUnits = -2;
  }
  const mesh = new Mesh(geometry, day);
  mesh.name = SINTI_ROMA_APRON_V375;
  mesh.position.fromArray(source.origin);
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = night;
  return mesh;
}
