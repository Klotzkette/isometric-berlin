import {BufferAttribute,BufferGeometry,DoubleSide,Mesh,MeshBasicMaterial,MeshStandardMaterial} from "three";
import {gunzipSync} from "three/examples/jsm/libs/fflate.module.js";
import {attachWorldSpaceDetail} from "./attachWorldSpaceDetail";
import {decodeBase64Bytes} from "./decodeBase64Bytes";
import {kollwitzFrontHostsV381} from "./kollwitzFrontsIndexV381";
import type {SurroundingChunkGeometry} from "./SurroundingCityGeometry";

type Packet = {n:number; i:number; origin:number[]; owners:string[]; data:string};

export async function attachKollwitzFrontsV381(entry: SurroundingChunkGeometry, id: string, native: boolean, signal: AbortSignal) {
  if (!kollwitzFrontHostsV381.has(id) || signal.aborted || entry.root.userData.kollwitzFrontsV381) return;
  const file=(native?"native_":"drawn_")+id;
  const packet: Packet=(await import(`./data/kollwitzFrontsV381/${file}.json`)).default;
  if (signal.aborted || entry.root.userData.kollwitzFrontsV381) return;
  if (packet.origin[0]+1!==entry.origin[0] || packet.origin[2]+1!==entry.origin[2]) return;
  const owners=new Set(entry.nav.buildings.map(b=>b.sourceId));
  if (!packet.owners.every(owner=>owners.has(owner))) return;
  const {n,i}=packet, stride=n<65536?2:3;
  if (n<1 || n>160000 || i<3 || i>600000 || i%3) throw Error("Ungültige Fassadendaten im Kollwitzkiez");
  const bytes=gunzipSync(decodeBase64Bytes(packet.data),{out:new Uint8Array(9*n+stride*i)});
  const xyz=new Uint16Array(3*n), indices=n<65536?new Uint16Array(i):new Uint32Array(i);
  for (let axis=0;axis<3;axis++) {
    let cm=0;
    for (let v=0;v<n;v++) {
      const k=axis*n+v;
      cm=(cm+bytes[k]+(bytes[3*n+k]<<8))&65535;
      xyz[3*v+axis]=cm;
    }
  }
  let previous=0;
  const mask=stride===2?65535:16777215;
  for (let k=0;k<i;k++) {
    const third=stride===3?bytes[9*n+2*i+k]<<16:0;
    previous=(previous+bytes[9*n+k]+(bytes[9*n+i+k]<<8)+third)&mask;
    if (previous>=n) throw Error("Ungültiger Fassadenindex im Kollwitzkiez");
    indices[k]=previous;
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new BufferAttribute(xyz,3));
  geometry.setAttribute("color",new BufferAttribute(bytes.slice(6*n,9*n),3,true));
  geometry.setIndex(new BufferAttribute(indices,1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,flatShading:true,roughness:.94});
  const day=native?night:new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const mesh=new Mesh(geometry,day);
  mesh.position.fromArray(packet.origin); mesh.scale.setScalar(.01);
  mesh.name="Historische Straßenfronten am Kollwitzplatz und Wasserturm";
  mesh.userData={dayMaterial:day,nightMaterial:night,kollwitzFrontsV381:true,keepInMinecraft:native,facadeOwners:packet.owners};
  attachWorldSpaceDetail(entry,mesh);
  entry.root.userData.kollwitzFrontsV381=true;
}
