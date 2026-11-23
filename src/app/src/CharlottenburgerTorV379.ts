import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshStandardMaterial } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Packet = { n: number; faces: number; p: string; c: string; i: string; palette: number[]; origin: number[] };

function inflate(field: string, size: number) {
  const result = gunzipSync(decodeBase64Bytes(field), {out:new Uint8Array(size)});
  if (result.length !== size) throw Error("Unvollständige Geometriedaten am Charlottenburger Tor");
  return result;
}

/** The packed source stores centimetres and triangle references as unsigned
 * 16-bit differences. Signed coordinates are recovered after each addition. */
export function createCharlottenburgerTorV379(native: boolean, packet: Packet): Group {
  const {n, faces, palette} = packet, indexCount = faces*3;
  if (!Number.isInteger(n) || n < 1 || n > 65535 || !Number.isInteger(faces) || faces < 1 || faces > 80000) {
    throw Error("Ungültiger Geometrieumfang am Charlottenburger Tor");
  }
  const words=inflate(packet.p,n*6), ids=inflate(packet.i,indexCount*2);
  const tones=inflate(packet.c,n), xyz=new Float32Array(n*3), indices=new Uint16Array(indexCount);
  for (let axis=0;axis<3;axis++) {
    let value=0;
    for (let v=0;v<n;v++) {
      const i=axis*n+v;
      value=(value+words[i]+(words[3*n+i]<<8))&65535;
      xyz[v*3+axis]=(value<32768?value:value-65536)*.01;
    }
  }
  let previous=0;
  for (let i=0;i<indexCount;i++) {
    previous=(previous+ids[i]+(ids[indexCount+i]<<8))&65535;
    if (previous>=n) throw Error("Ungültiger Dreiecksindex am Charlottenburger Tor");
    indices[i]=previous;
  }
  const rgb=new Uint8Array(n*3), color=new Color();
  const linear=palette.map(value=>{color.setHex(value);return [color.r,color.g,color.b].map(v=>Math.round(v*255));});
  for (let v=0;v<n;v++) rgb.set(linear[tones[v]],v*3);
  const g=new BufferGeometry();
  g.setAttribute("position",new BufferAttribute(xyz,3));
  g.setAttribute("color",new BufferAttribute(rgb,3,true));
  g.setIndex(new BufferAttribute(indices,1));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  const day=new MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.94,side:DoubleSide});
  const night=day.clone();
  // A small ambient contribution keeps the real stone and bronzes legible at dusk.
  night.emissive.setHex(0x100e0b);
  const mesh=new Mesh(g,day);
  mesh.name="Charlottenburger Tor – Kolonnaden, Kandelaber und Charlottenburger Brücke";
  mesh.userData={dayMaterial:day,nightMaterial:night,charlottenburgerTorV379:true,nativeMinecraft:native,keepInMinecraft:native};
  mesh.position.set(packet.origin[0],packet.origin[1],packet.origin[2]);
  const root=new Group();
  root.name="Charlottenburger Tor und Brückenumfeld";
  root.userData={charlottenburgerTorV379:true,nativeMinecraft:native,keepInMinecraft:native};
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}

export async function loadCharlottenburgerTorV379(native: boolean, signal?: AbortSignal): Promise<Group> {
  const packet=native ? await import("./data/charlottenburgerTorV379Native.json") : await import("./data/charlottenburgerTorV379Drawn.json");
  signal?.throwIfAborted();
  return createCharlottenburgerTorV379(native,packet.default);
}
