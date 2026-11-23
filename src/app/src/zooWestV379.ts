import {Box3, Sphere, Vector3, BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial} from "three";
import type {SurroundingChunkGeometry} from "./SurroundingCityGeometry";
import {attachWorldSpaceDetail} from "./attachWorldSpaceDetail";
import {decodeBase64Bytes} from "./decodeBase64Bytes";
import {zooWestReliefHeightV379} from "./zooWestReliefV379";
import {zooWestIdsV379} from "./zooWestIndexV379";

interface Surface {positions: string; colors: string; indices: string; normals:string; sphere:number[]; bounds:number[]; indexBytes: number}
interface Building {id: string; rings: number[][][]; base: number; top: number; roof: number[][][]}
interface ZooPacket {origin: number[]; meshes: Record<string, Surface>; buildings: Building[]; water:number[][][][]}

function buildSurface(layer: string, source: Surface, native: boolean) {
  const positions = new Int16Array(decodeBase64Bytes(source.positions).buffer);
  const colors = decodeBase64Bytes(source.colors);
  const normals = new Int8Array(decodeBase64Bytes(source.normals).buffer);
  const rawIndex = decodeBase64Bytes(source.indices).buffer;
  const indices = source.indexBytes === 4 ? new Uint32Array(rawIndex) : new Uint16Array(rawIndex);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3, true));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3, true));
  geometry.boundingBox = new Box3(new Vector3().fromArray(source.bounds), new Vector3().fromArray(source.bounds,3));
  geometry.boundingSphere = new Sphere(new Vector3().fromArray(source.sphere), source.sphere[3]);
  const glass = layer === "glass";
  const common = {vertexColors:true, side:DoubleSide, transparent:glass, opacity:glass ? .85 : 1, depthWrite:!glass} as const;
  const night = new MeshStandardMaterial({...common, roughness:glass ? .3 : .9, flatShading:true});
  const day = native ? night : new MeshBasicMaterial(common);
  const mesh = new Mesh(geometry, day);
  mesh.scale.setScalar(.01);
  mesh.name = glass ? "Zoo Berlin · vermessene gläserne Doppelkuppel" : "Zoo Berlin · Häuser, Gebirgstierfelsen und Garten";
  mesh.userData = {dayMaterial:day, nightMaterial:night, keepInMinecraft:true};
  return mesh;
}

export async function attachZooWestV379(entry: SurroundingChunkGeometry, id: string, native: boolean, signal: AbortSignal) {
  if (signal.aborted || !zooWestIdsV379.has(id)) return;
  const tag = (native ? "native_" : "drawn_") + id.slice("zoo-west379-".length);
  const {default:packet}: {default:ZooPacket} = await import(`./data/zooWestV379Tiles/${tag}.json`);
  if (signal.aborted || entry.root.userData.zooWestV379) return;
  const group = new Group();
  group.name = "Zoo Berlin · " + id;
  group.position.set(packet.origin[0],0,packet.origin[1]);
  for (const [layer,source] of Object.entries(packet.meshes)) group.add(buildSurface(layer, source, native));
  attachWorldSpaceDetail(entry, group);
  const [ox,,oz] = entry.origin;
  for (const polygon of packet.water) {
    const [ring,...holes]=polygon.map(r=>r.map(([x,z])=>[x-ox,z-oz]));
    entry.nav.water.push({ring,holes});
  }
  for (const b of packet.buildings) {
    const rings = b.rings.map(r => r.map(([x,z]) => [x-ox,z-oz]));
    entry.nav.buildings.push({sourceId:b.id,ring:rings[0],holes:rings.slice(1),minHeight:0,
      groundOffset:b.base-entry.nav.groundY,height:b.top-b.base,roofTriangles:b.roof.map(tri => tri.map(([x,y,z])=>[x-ox,y-b.base,z-oz]))});
  }
  if (id === "zoo-west379--5_2") entry.root.userData.zooWestFloorV379 = (x:number,z:number) => zooWestReliefHeightV379(x,z,native,false);
  entry.root.userData.zooWestV379 = true;
}
