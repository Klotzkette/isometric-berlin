import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Vector3,
} from "three";
import drawn from "./data/zionskirchplatzV175Drawn.json";
import native from "./data/zionskirchplatzV175Native.json";
import evidence from "./data/zionskirchplatzV175Evidence.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

function materials(vertexColors = false) {
  return {
    day: new MeshBasicMaterial({ vertexColors, side: DoubleSide }),
    night: new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .88, flatShading: true }),
  };
}

function create(nativeMode: boolean): Group {
  const root = new Group();
  root.name = nativeMode ? "Zionskirchplatz four native frontages" : "Zionskirchplatz four restrained frontages and former Cafe 103";
  root.userData = { zionskirchplatzV175: true, textureFree: true, additiveOnly: true,
    fullStaticDetailOnTouch: true, sourceEnvelopeRetained: true,
    blockNative: nativeMode, nativeMinecraft: nativeMode, keepInMinecraft: nativeMode };
  if (!nativeMode) {
    const positions = new Float32Array(evidence.drawnTriangles * 9);
    const colors = new Float32Array(positions.length), color = new Color();
    let offset = 0;
    for (const surface of drawn.surfaces) {
      color.setHex(surface.color);
      for (const triangle of surface.triangles) for (const point of triangle) {
        positions.set(point, offset); color.toArray(colors, offset); offset += 3;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const { day, night } = materials(true);
    const mesh = new Mesh(geometry, day);
    mesh.name = "Four source-plane plaster colours and street-level bases";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
    root.add(mesh);
  }
  // Decode only this representation, allocate the exact final buffers once.
  const rows = nativeMode ? native.blocks : drawn.facadeBoxes;
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const { day, night } = materials();
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  rows.forEach((row, i) => {
    if (nativeMode) matrix.makeScale(row[4], row[6], row[7]);
    else matrix.makeRotationY(row[6]).scale(scale.set(row[3], row[4], row[5]));
    matrix.setPosition(row[0], row[1], row[2]).toArray(matrices, i * 16);
    color.setHex(row[nativeMode ? 3 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = "Street doors divided shop glazing cornices narrow balconies and historical 103 mark";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: nativeMode, nativeMinecraft: nativeMode };
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}

export function createZionskirchplatzV175(_options: { mobileLike?: boolean } = {}): Group { return create(false); }
export function createMinecraftZionskirchplatzV175(_options: { mobileLike?: boolean } = {}): Group { return create(true); }
