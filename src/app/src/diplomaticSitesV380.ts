import {BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial} from "three";
import {gunzipSync} from "three/examples/jsm/libs/fflate.module.js";
import {attachWorldSpaceDetail} from "./attachWorldSpaceDetail";
import {decodeBase64Bytes} from "./decodeBase64Bytes";
import type {SurroundingChunkGeometry} from "./SurroundingCityGeometry";

import hosts from "./data/diplomaticHostsV380.json";

const shared = new Set(hosts.filter(h => h.shared).map(h => h.id));
type Packet = {o: number[]; n: number; i: number; data: string};
export async function attachDiplomaticSitesV380(entry: SurroundingChunkGeometry, id: string, native: boolean, signal: AbortSignal) {
  if (entry.root.userData.diplomaticSitesV380) return;
  const key = id.slice("diplomatic380-".length);
  const file = (shared.has(id) ? "shared_" : native ? "native_" : "drawn_") + key;
  const {default: packet} = await import(`./data/diplomaticSitesV380/${file}.json`) as {default: Packet};
  signal.throwIfAborted();
  const bytes = gunzipSync(decodeBase64Bytes(packet.data));
  const n = packet.n;
  if (bytes.length !== n * 9 + packet.i * 2) throw new Error("Ungültiges Geometriepaket für " + id);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Uint16Array(bytes.buffer, bytes.byteOffset, n * 3), 3));
  geometry.setAttribute("color", new BufferAttribute(bytes.subarray(n * 6, n * 9), 3, true));
  // RGB uses an odd number of bytes for odd vertex counts. Copy only unaligned indices.
  const indexStart = bytes.byteOffset + n * 9;
  const indices = indexStart % 2 ? new Uint16Array(bytes.slice(n * 9).buffer) : new Uint16Array(bytes.buffer, indexStart, packet.i);
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({vertexColors: true, side: DoubleSide});
  const night = new MeshStandardMaterial({vertexColors: true, side: DoubleSide, flatShading: true, roughness: .89});
  const mesh = new Mesh(geometry,day);
  mesh.name = "Diplomatische Standorte und Clayallee";
  mesh.position.set(packet.o[0],packet.o[1],packet.o[2]);
  mesh.scale.setScalar(.01);
  mesh.userData = {dayMaterial:day,nightMaterial:night,keepInMinecraft:native};
  attachWorldSpaceDetail(entry,mesh);
  entry.root.userData.diplomaticSitesV380 = true;
}
