import { DoubleSide, Group, Mesh, MeshBasicMaterial } from "three";
import { createMeasuredPlaceGeometry as geometry, type SurveyMeshPacket as Packed } from "./measuredPlaceGeometryV381";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { surroundingPolygonBounds, surroundingPolygonContains, type SurroundingChunkGeometry, type SurroundingPolygon } from "./SurroundingCityGeometry";
import { kreuzbergPlaetzeIdsV380 } from "./kreuzbergPlaetzeIndexV380";

type Survey = {mesh:Packed; floors:(SurroundingPolygon & {y:number})[]};

export async function attachKreuzbergPlaetzeV380(entry:SurroundingChunkGeometry,id:string,native:boolean,signal:AbortSignal):Promise<void> {
  if (!kreuzbergPlaetzeIdsV380.has(id)||signal.aborted||entry.root.userData.kreuzbergPlaetzeFloorV380) return;
  const site=id.slice("kreuzberg380-".length);
  const file=native?"native":"drawn";
  const [survey,detail]:[Survey,Packed]=await Promise.all([
    import(`./data/kreuzbergPlaetzeV380/${site}_ground.json`).then(m=>m.default),
    import(`./data/kreuzbergPlaetzeV380/${site}_${file}.json`).then(m=>m.default),
  ]);
  if (signal.aborted||entry.root.userData.kreuzbergPlaetzeFloorV380) return;
  const group=new Group();
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night=day.clone();night.color.setHex(0x898f9b);
  for (const [name,packet] of [["Straßenbefahrung",survey.mesh],["Platzfassaden und Stadtbäume",detail]] as const) {
    const mesh=new Mesh(geometry(packet),day);
    mesh.name=name;
    mesh.scale.setScalar(.01);
    mesh.position.fromArray(packet.origin);
    mesh.userData={dayMaterial:day,nightMaterial:night,nativeMinecraft:native,keepInMinecraft:native};
    group.add(mesh);
  }
  group.name=site==="moritz"?"Moritzplatz":"Rio-Reiser-Platz";
  attachWorldSpaceDetail(entry,group);
  const surfaces=survey.floors.map(poly=>({poly,bounds:surroundingPolygonBounds(poly)})).sort((a,b)=>b.poly.y-a.poly.y);
  entry.root.userData.kreuzbergPlaetzeFloorV380=(x:number,z:number)=>{
    for (const {bounds:[x0,z0,x1,z1],poly} of surfaces) {
      if (x>=x0&&x<=x1&&z>=z0&&z<=z1&&surroundingPolygonContains(poly,x,z)) return poly.y;
    }
    return null;
  };
}
