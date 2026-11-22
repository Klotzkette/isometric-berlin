import {
  BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial,
} from "three";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

// These exact path triangles are at least 74 m away from every surveyed entrance.
// Bind the origin and the complete append fingerprint before permitting a second
// single-material carrier. The ordinary raw and prepared host guards still apply.
const paths: Readonly<Record<string, readonly [number, number, number, number]>> = {
  "-12_1": [-6144, 512, 3721843984, 1455664769],
  "-11_1": [-5632, 512, 3858182148, 3214332623],
  "ring182-4_6": [2048, 3072, 495846356, 4005822131],
  "ring182-6_7": [3072, 3584, 3732532111, 1888291753],
  "ring182-6_8": [3072, 4096, 4191818568, 3689842284],
};

export function isParkPathAccessSourceV373(id: string, native: boolean, origin: readonly number[], fingerprint: number | undefined): boolean {
  const pin = paths[id];
  return !!pin && origin[0] === pin[0] && origin[1] === -10 && origin[2] === pin[1] && fingerprint === pin[native ? 3 : 2];
}

export function createParkPathAccessMeshV373(part: SurroundingPackedMesh, native: boolean) {
  const positions = new Uint16Array(decodeBase64Bytes(part.positions).buffer);
  const colours = decodeBase64Bytes(part.colors);
  const indices = new Uint32Array(decodeBase64Bytes(part.indices).buffer);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colours, 3, true));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const paint = { vertexColors: true, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 } as const;
  const night = new MeshStandardMaterial({ ...paint, flatShading: true, roughness: 1, metalness: 0 });
  const day = native ? night : new MeshBasicMaterial(paint);
  const mesh = new Mesh(geometry, day);
  mesh.name = part.kind;
  mesh.scale.setScalar(.01);
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = night;
  mesh.userData.surroundingCity = true;
  return { mesh, bytes: positions.byteLength + colours.byteLength + indices.byteLength };
}
