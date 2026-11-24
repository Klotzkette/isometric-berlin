import { DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { createMeasuredPlaceGeometry, type SurveyMeshPacket } from "./measuredPlaceGeometryV381";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";

export async function attachLindenFrontV383(entry:SurroundingChunkGeometry, id:string, native:boolean, signal:AbortSignal) {
  const site=id.slice("lindenfront383-".length);
  if (signal.aborted || entry.root.userData.lindenFrontV383 || !["west","mitte","ost"].includes(site)) return;
  const key=(native ? "native-" : "drawn-")+site;
  const { default:packet }=await import(`./data/lindenFrontV383/${key}.json`) as {default:SurveyMeshPacket};
  if (signal.aborted || entry.root.userData.lindenFrontV383) return;
  const geometry=createMeasuredPlaceGeometry(packet);
  geometry.computeVertexNormals();
  const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,flatShading:true,roughness:.95});
  const day=native ? night : new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const mesh=new Mesh(geometry,day);
  mesh.name="Unter den Linden · fotografisch belegte Straßenfronten";
  mesh.position.fromArray(packet.origin);
  mesh.scale.setScalar(.01);
  mesh.userData={dayMaterial:day,nightMaterial:night,nativeMinecraft:native,keepInMinecraft:native};
  attachWorldSpaceDetail(entry,mesh);
  entry.root.userData.lindenFrontV383=true;
}
