import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, SphereGeometry, Vector3,
} from "three";
import data from "./data/bendlerblockV202.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const BENDLERBLOCK_V202_GROUP = "Bendlerblock recognition details";

function materials(vertexColors = false) {
  return {
    day: new MeshBasicMaterial({ vertexColors, side: DoubleSide }),
    night: new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .84 }),
  };
}

/** Complete measured shells, court apertures and compact facade/memorial batches. */
export function createBendlerblockV202(native = false): Group {
  const root = new Group();
  root.name = BENDLERBLOCK_V202_GROUP + (native ? " native" : "");
  root.userData = { bendlerblockV202: true, schwellenraumGeschuetzt: true, textureFree: true, fullStaticDetailOnTouch: true,
    blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
    sourceReceipt: "bendlerblockV202Evidence.json", sourcePartCount: 10 };
  if (!native) {
    const positions = new Float32Array(data.surfaces.reduce((sum, s) => sum + s.triangles.length * 9, 0));
    const colors = new Float32Array(positions.length), tint = new Color();
    let offset = 0;
    for (const surface of data.surfaces) {
      tint.setHex(surface.color);
      for (const triangle of surface.triangles) for (const p of triangle) {
        positions.set(p, offset); tint.toArray(colors, offset); offset += 3;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const { day, night } = materials(true), mesh = new Mesh(geometry, day);
    mesh.name = "Bendlerblock measured walls and roofs with three open source passages";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
    root.add(mesh);
  }
  const rows = native ? data.blocks : data.boxes;
  const batches = native ? [rows] : [rows.filter(r => r[8] !== 9), rows.filter(r => r[8] === 9)];
  for (const [batch, subset] of batches.entries()) {
    const geometry = batch === 1 ? new SphereGeometry(.5, 10, 8) : new BoxGeometry(1, 1, 1);
    geometry.deleteAttribute("uv");
    const { day, night } = materials(), mesh = new InstancedMesh(geometry, day, 0);
    const matrices = new Float32Array(subset.length * 16), colors = new Float32Array(subset.length * 3);
    const matrix = new Matrix4(), size = new Vector3(), tint = new Color();
    subset.forEach((r, i) => {
      if (native) matrix.makeScale(r[4], r[6], r[7]);
      else matrix.makeRotationY(r[6]).scale(size.set(r[3], r[4], r[5]));
      matrix.setPosition(r[0], r[1], r[2]).toArray(matrices, i * 16);
      tint.setHex(r[native ? 3 : 7]).toArray(colors, i * 3);
    });
    mesh.count = subset.length;
    mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.name = batch === 1 ? "Richard Scheibe bound figure facing the court entry" : "Bendlerblock pale window frames, cornices and Ehrenhof";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, nativeMinecraft: native };
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
