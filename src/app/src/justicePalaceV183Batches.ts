import { BoxGeometry, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";

/** Compact final-count buffers; no maximum-capacity instance allocation. */
export function justicePalaceV183Boxes(rows: readonly number[][], native = false): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: .88 });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrix = new Matrix4(), color = new Color(), scale = new Vector3();
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(r[3], r[4], r[5]);
    else { matrix.makeRotationY(r[6]); matrix.scale(scale.set(r[3], r[4], r[5])); }
    matrix.setPosition(r[0], r[1], r[2]); matrix.toArray(matrices, i * 16);
    color.setHex(r[native ? 6 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, keepInMinecraft: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  return mesh;
}
