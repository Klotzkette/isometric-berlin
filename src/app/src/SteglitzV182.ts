import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, EdgesGeometry,
  Group, InstancedBufferAttribute, InstancedMesh, LineBasicMaterial, LineSegments,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import source from "./data/steglitzV182Source.json";
import native from "./data/steglitzV182Native.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const STEGLITZ_V182_GROUP = "Steglitz: Kreisel scaffold, town hall, Schloss, Gymnasium and Spiegelwand";
export const STEGLITZ_V182_NATIVE_GROUP = "Steglitz: independent block-native landmark skins";

function materials(vertexColors = false) {
  return {
    day: new MeshBasicMaterial({ vertexColors, side: DoubleSide }),
    night: new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .87, flatShading: true }),
  };
}

function shells(): Mesh {
  const length = source.surfaces.reduce((sum, surface) => sum + surface.triangles.length * 9, 0);
  const positions = new Float32Array(length), colors = new Float32Array(length), color = new Color();
  let offset = 0;
  for (const surface of source.surfaces) {
    color.setHex(surface.color);
    for (const triangle of surface.triangles) for (const point of triangle) {
      positions.set(point, offset); color.toArray(colors, offset); offset += 3;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const { day, night } = materials(true), mesh = new Mesh(geometry, day);
  mesh.name = "Complete official Steglitz walls and roof silhouettes, mapped Kreisel stepped footprint";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, sourceGeometryRetained: true };
  return mesh;
}

function details(nativeMode: boolean): InstancedMesh {
  const rows = nativeMode ? native.boxes : source.boxes;
  const count = rows.length + (nativeMode ? 0 : source.rods.length);
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const { day, night } = materials();
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
  const matrix = new Matrix4(), color = new Color(), size = new Vector3();
  rows.forEach((row, i) => {
    if (nativeMode) matrix.identity(); else matrix.makeRotationY(row[6]);
    matrix.scale(size.set(row[3], row[4], row[5]));
    matrix.setPosition(row[0], row[1], row[2]).toArray(matrices, i * 16);
    color.setHex(row[nativeMode ? 6 : 7]).toArray(colors, i * 3);
  });
  if (!nativeMode) {
    const a = new Vector3(), b = new Vector3(), direction = new Vector3(), rotation = new Quaternion();
    const up = new Vector3(0, 1, 0);
    source.rods.forEach((row, i) => {
      a.fromArray(row); b.fromArray(row, 3); direction.subVectors(b, a);
      const length = direction.length(); rotation.setFromUnitVectors(up, direction.normalize());
      matrix.compose(a.add(b).multiplyScalar(.5), rotation, size.set(row[6], length, row[6]));
      const index = i + rows.length;
      matrix.toArray(matrices, index * 16); color.setHex(row[7]).toArray(colors, index * 3);
    });
  }
  mesh.count = count;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = nativeMode ? "One metre source skin, scaffold, crane and memorial blocks" : "Restrained windows, fine scaffold lattice, crane and nine mirror panels";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: nativeMode, nativeMinecraft: nativeMode, noHiddenSolidInfill: nativeMode };
  return mesh;
}

function create(nativeMode: boolean): Group {
  const root = new Group();
  root.name = nativeMode ? STEGLITZ_V182_NATIVE_GROUP : STEGLITZ_V182_GROUP;
  root.userData = { steglitzV182: true, fullStaticDetailOnTouch: true, textureFree: true,
    blockNative: nativeMode, nativeMinecraft: nativeMode, keepInMinecraft: nativeMode,
    completeSourceOwners: true, proceduralRecognitionDetails: true, photographedPixelsBundled: false };
  if (!nativeMode) {
    const body = shells(); root.add(body);
    const edges = new LineSegments(new EdgesGeometry(body.geometry, 20),
      new LineBasicMaterial({ color: 0x495652, transparent: true, opacity: .48, depthWrite: false }));
    edges.name = "Measured roof ridges, eaves, corners and courtyard edges";
    root.add(edges);
  }
  root.add(details(nativeMode));
  return freezeStaticSceneTransforms(root);
}

export function createSteglitzV182(_options: { mobileLike?: boolean } = {}): Group { return create(false); }
export function createMinecraftSteglitzV182(_options: { mobileLike?: boolean } = {}): Group { return create(true); }
