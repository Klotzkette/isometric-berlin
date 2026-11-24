import { DoubleSide, Group, Mesh, MeshBasicMaterial } from "three";
import { appendVerifiedKollwitzDenkmalV381 } from "./kollwitzDenkmalV381";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { createMeasuredPlaceGeometry } from "./measuredPlaceGeometryV381";
import { surroundingPolygonContains, type SurroundingChunkGeometry } from "./SurroundingCityGeometry";
import { kollwitzplatzIdsV381 } from "./kollwitzplatzIndexV381";

export async function attachKollwitzplatzV381(entry:SurroundingChunkGeometry,id:string,native:boolean,signal:AbortSignal):Promise<void> {
  if (!kollwitzplatzIdsV381.has(id)||signal.aborted||entry.root.userData.kollwitzplatzFloorV381) return;
  const [surfaces,crowns]=await Promise.all([
    import("./data/kollwitzplatzV381/surfaces.json").then(m=>m.default),
    (native?import("./data/kollwitzplatzV381/native.json"):import("./data/kollwitzplatzV381/drawn.json")).then(m=>m.default),
  ]);
  if (signal.aborted||entry.root.userData.kollwitzplatzFloorV381) return;
  const group=new Group();group.name="Kollwitzplatz";
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night=day.clone();night.color.setHex(0x92939f);
  for (const [label,packet] of [["Platzwege, Spiel- und Sitzbereiche",surfaces.mesh],["Vermessene Baum- und Strauchkronen",crowns]] as const) {
    const part=new Mesh(createMeasuredPlaceGeometry(packet),day);
    part.name=label;part.scale.setScalar(.01);part.position.fromArray(packet.origin);
    part.userData={dayMaterial:day,nightMaterial:night,nativeMinecraft:native,keepInMinecraft:native};
    group.add(part);
  }
  appendVerifiedKollwitzDenkmalV381(group,native);
  attachWorldSpaceDetail(entry,group);
  entry.root.userData.kollwitzplatzFloorV381=(x:number,z:number)=>
    surfaces.floors.some(p=>surroundingPolygonContains(p,x,z))?3.2:null;
}
