import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";
import source from "./data/steglitzPublicSpaceV327.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const STEGLITZ_PUBLIC_SPACE_V327 = "Steglitz V327: Kreisel podium, transit approaches and Hermann-Ehlers-Platz";
const SOURCE_CONTROL = 2192474099;
const MAX_BYTES = 110 * 1024;

function sourceControl(): number {
  const value = JSON.stringify(source);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
  return hash;
}

function materials(vertexColors: boolean, native: boolean) {
  const day = new MeshBasicMaterial({ vertexColors, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: 0.86, flatShading: true });
  return {
    day,
    metadata: {
      dayMaterial: day, nightMaterial: night, textureFree: true,
      fullStaticDetailOnTouch: true, blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
    },
  };
}

function instances(native: boolean): InstancedMesh {
  const rows = native ? source.native : source.drawn;
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const { day, metadata } = materials(false, native);
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16);
  const colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), size = new Vector3(), color = new Color();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const [x, y, z, width, height, depth] = row;
    if (native) matrix.identity();
    else matrix.makeRotationY(row[6]);
    matrix.scale(size.set(width, height, depth));
    matrix.setPosition(x, y, z).toArray(matrices, i * 16);
    color.setHex(row[native ? 6 : 7]).toArray(colors, i * 3);
  }
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.name = native ? "Cardinal source shells, scaffold, platforms and market" : "Construction and street fittings, transit and market";
  mesh.userData = metadata;
  return mesh;
}

function drawnSurfaces(): Mesh {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(source.vertices.length * 3);
  const colors = new Uint8Array(positions.length);
  const color = new Color();
  for (let i = 0; i < source.vertices.length; i++) {
    const [x, y, z, rgb] = source.vertices[i];
    const at = i * 3;
    positions.set([x, y, z], at);
    color.setHex(rgb);
    colors.set([Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255)], at);
  }
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3, true));
  geometry.setIndex(new BufferAttribute(Uint16Array.from(source.indices), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const { day, metadata } = materials(true, false);
  const mesh = new Mesh(geometry, day);
  mesh.name = "Measured upper Kreisel podium and striped market awnings";
  mesh.userData = metadata;
  return mesh;
}

/** Additive only. The existing V182 owner and the V247 walking floor stay authoritative. */
export function createSteglitzPublicSpaceV327(native: boolean): Group | null {
  if (typeof native !== "boolean" || source.schemaVersion !== 1 || sourceControl() !== SOURCE_CONTROL) return null;
  const count = native ? source.native.length : source.drawn.length;
  const surfaceBytes = native ? 0 : source.vertices.length * 27 + source.indices.length * 2;
  if (count * 76 + surfaceBytes + 648 > MAX_BYTES) return null;
  const root = new Group();
  root.name = STEGLITZ_PUBLIC_SPACE_V327;
  root.userData = {
    steglitzPublicSpaceV327: true, textureFree: true, fullStaticDetailOnTouch: true,
    blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
  };
  if (!native) root.add(drawnSurfaces());
  root.add(instances(native));
  return freezeStaticSceneTransforms(root);
}
