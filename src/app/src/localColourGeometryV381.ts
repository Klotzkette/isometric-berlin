import {BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial} from "three";
import {gunzipSync} from "three/examples/jsm/libs/fflate.module.js";
import {decodeBase64Bytes} from "./decodeBase64Bytes";

export interface LocalColourPacket { origin: number[]; n: number; faces: number; mesh: string; palette: number[] }

export function createLocalColourGeometry(id: string, native: boolean, packet: LocalColourPacket, maxFaces: number) {
  const {n, faces} = packet;
  if (!Number.isInteger(n) || n < 1 || n > 65535 || !Number.isInteger(faces) || faces < 1 || faces > maxFaces) {
    throw new RangeError("Ungültiger Geometrieumfang");
  }
  const stream = gunzipSync(decodeBase64Bytes(packet.mesh), {out: new Uint8Array(7*n+6*faces)});
  if (stream.length !== 7*n+6*faces) throw new RangeError("Unvollständiges Modell");
  const positions = new Int16Array(n*3), indices = new Uint16Array(faces*3);
  let value = 0;
  for (let axis = 0; axis < 3; axis++) {
    for (let v = 0; v < n; v++) {
      const i = axis*n+v;
      value = (value+stream[i]+(stream[3*n+i]<<8)) & 65535;
      positions[v*3+axis] = value;
    }
  }
  value = 0;
  for (let i = 0; i < indices.length; i++) {
    value = (value+stream[7*n+i]+(stream[7*n+indices.length+i]<<8)) & 65535;
    if (value >= n) throw new RangeError("Ungültiger Geometrieindex");
    indices[i] = value;
  }
  const g = new BufferGeometry();
  const tones = stream.subarray(6*n,7*n), rgb = new Uint8Array(n*3);
  const color = new Color();
  const palette = packet.palette.map(tint => color.setHex(tint).toArray().map(value => Math.round(255 * value)));
  for (let i = 0; i < tones.length; i++) rgb.set(palette[tones[i]], i * 3);
  g.setAttribute("position", new BufferAttribute(positions, 3));
  g.setAttribute("color", new BufferAttribute(rgb, 3, true));
  g.setIndex(new BufferAttribute(indices, 1));
  g.computeBoundingSphere();
  const day = new MeshBasicMaterial({vertexColors: true, side: DoubleSide});
  const night = new MeshStandardMaterial({vertexColors: true, flatShading: true, side: DoubleSide, roughness: .78});
  const mesh = new Mesh(g, day);
  mesh.scale.setScalar(.01);
  mesh.position.set(packet.origin[0], packet.origin[1], packet.origin[2]);
  mesh.name = id;
  mesh.userData = {dayMaterial: day, nightMaterial: night, nativeMinecraft: native, keepInMinecraft: native};
  return mesh;
}

