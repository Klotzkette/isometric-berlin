import {
  BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4,
  MeshBasicMaterial, MeshStandardMaterial, Vector3,
} from "three";
import drawn from "./data/alexanderplatzV189.json";
import native from "./data/alexanderplatzV189Native.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const ALEXANDERPLATZ_V189_GROUP = "Haus des Reisens aluminium grid and curved podium eaves v189";

/** Small immutable additions over the complete retained six-part LoD2 body. */
export function createAlexanderplatzV189(minecraft = false, _mobileLike = false): Group {
  const root = new Group();
  root.name = ALEXANDERPLATZ_V189_GROUP;
  const rows = minecraft ? native.boxes : drawn.boxes;
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .86, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), pitch = new Matrix4(), scale = new Vector3(), color = new Color();
  rows.forEach((row, i) => {
    if (minecraft) matrix.makeScale(row[3], row[4], row[5]);
    else matrix.makeRotationY(row[6]).multiply(pitch.makeRotationX(row[7])).scale(scale.set(row[3], row[4], row[5]));
    matrix.setPosition(row[0], row[1], row[2]);
    matrix.toArray(matrices, i * 16);
    color.setHex(row[minecraft ? 6 : 8]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.name = minecraft ? "Independent orthogonal Reisens facade members" : "Reisens thin aluminium grid and concave shell members";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: minecraft, keepInMinecraft: minecraft, surfaceOnly: true };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  root.userData = { additiveOnly: true, textureFree: true, photographsBundled: false,
    fullStaticDetailOnTouch: true, sourceGeometryRetained: true,
    nativeMinecraft: minecraft, keepInMinecraft: minecraft, blockNative: minecraft,
    parentId: drawn.parentId, osmId: drawn.osmId, sourceSha256: drawn.sourceSha256,
    instanceCount: rows.length, hiddenSolidInfill: false, groundAndNavigationUnchanged: true };
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
