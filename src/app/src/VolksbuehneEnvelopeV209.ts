import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial,
} from "three";
import data from "./data/volksbuehneEnvelopeV209.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const VOLKSBUEHNE_ENVELOPE_V209_GROUP = "Complete Volksbuehne source body and measured upper volumes v209";
export const VOLKSBUEHNE_ENVELOPE_V209_OWNER = data.owner;

/** Required city construction, independent of optional facade/sculpture loading.
 * The exact old owner yields only after this complete replacement is available. */
export function createVolksbuehneEnvelopeV209(native = false): Group {
  const root = new Group(); root.name = VOLKSBUEHNE_ENVELOPE_V209_GROUP + (native ? " native" : "");
  root.userData = {
    sourceParentIds: [data.owner], sourceOwnerIds: [data.owner], sourceGeometryRetained: true,
    requiredSourceEnvelope: true, originalSurfaceCount: 75, sourceSha256: data.sourceSha256,
    bdomSha256: data.bdomSha256, sourceReceipt: "volksbuehne-v209-source.json",
    measuredStageTopY: data.volumes[0].topY, measuredAuditoriumTopY: data.volumes[1].topY,
    nativeMinecraft: native, keepInMinecraft: native, blockNative: native,
    fullStaticDetailOnTouch: true, textureFree: true,
  };
  const packed = native ? data.native : data.drawn;
  const positions = new Float32Array(packed.vertices.length * 3);
  const colors = new Float32Array(positions.length), tint = new Color();
  packed.vertices.forEach((row, i) => {
    positions.set(row.slice(0, 3), i * 3);
    tint.setRGB(row[3] / 255, row[4] / 255, row[5] / 255, "srgb").toArray(colors, i * 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(packed.indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .91 });
  const mesh = new Mesh(geometry, day);
  mesh.name = native ? "Complete original orthogonal theatre blocks plus measured upper blocks" : "All original LoD2 ground wall roof sheets with bDOM auditorium and stage masses";
  mesh.userData = { dayMaterial: day, nightMaterial: night, nativeMinecraft: native,
    blockNative: native, keepInMinecraft: native, textureFree: true, sourceOwner: data.owner };
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
