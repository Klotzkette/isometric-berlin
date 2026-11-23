import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial } from "three";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { loadTierparkEastLowV379 } from "./tierparkEastIndexV379";
import regions from "./data/tierparkEastV379LandscapeIndex.json";
import type { SurroundingChunkGeometry, SurroundingNavigation } from "./SurroundingCityGeometry";

type Navigation = NonNullable<SurroundingNavigation["spreeBridgesV242"]>;
type Packet = {
  origin: [number,number,number];
  parts: {name:string; origin:[number,number,number]; positions:string; colors:string; indices:string}[];
  floors: Navigation["floors"];
  solids: Navigation["solids"];
};
const landscapeAt = new Set<string>(regions);

export async function attachTierparkEastV379(entry: SurroundingChunkGeometry, id: string, native: boolean, signal: AbortSignal): Promise<void> {
  if (signal.aborted || entry.root.userData.tierparkEastLandscapeV379) return;
  const file = (native ? "minecraft_" : "drawn_") + id;
  const [packet, low]: [Packet | undefined, Awaited<ReturnType<typeof loadTierparkEastLowV379>>] = await Promise.all([
    landscapeAt.has(id) ? import(`./data/tierparkEastV379Landscape/${file}.json`).then(m => m.default) : undefined,
    loadTierparkEastLowV379(id, native),
  ]);
  if (signal.aborted || entry.root.userData.tierparkEastLandscapeV379) return;
  const origin = packet?.origin ?? low?.cut.origin;
  if (!origin || origin.some((v,i)=>v!==entry.origin[i])) return;
  const ranges = entry.root.userData.surveyedShellIndexRangesV377 as {owner:string}[] | undefined;
  if (low && ranges?.some(range=>range.owner===low.shell.id)) {
    const heights = new Map(low.nav);
    entry.nav.buildings = entry.nav.buildings.flatMap(building=>{
      const height = heights.get(building.sourceId);
      if (height === undefined) return [building];
      if (!height) return [];
      return [{...building,height,roofTriangles:undefined}];
    });
  }
  entry.root.userData.tierparkEastLandscapeV379 = true;
  if (!packet) return;
  for (const part of packet.parts) {
    const geometry = new BufferGeometry();
    const position = new Uint16Array(decodeBase64Bytes(part.positions).buffer);
    geometry.setAttribute("position",new BufferAttribute(position,3));
    geometry.setAttribute("color",new BufferAttribute(decodeBase64Bytes(part.colors),3,true));
    geometry.setIndex(new BufferAttribute(new Uint16Array(decodeBase64Bytes(part.indices).buffer),1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry,new MeshBasicMaterial({vertexColors:true,side:DoubleSide}));
    mesh.position.fromArray(part.origin);
    mesh.scale.setScalar(.01);
    mesh.name=part.name;
    attachWorldSpaceDetail(entry,mesh);
  }
  if (packet.floors.length) {
    const existing = entry.nav.spreeBridgesV242 ?? {floors:[],solids:[]};
    entry.nav.spreeBridgesV242 = {floors:[...existing.floors,...packet.floors],solids:[...existing.solids,...packet.solids]};
  }
}
