import {Group} from "three";
import {createSurveySurfaceV380,addSurveyTreesV380,type PrenzlauerStreetPacketV380} from "./prenzlauerStreetsV380";
import {wasserturmParkGroundV381,wasserturmParkRoofV381,wasserturmParkSolidV381} from "./wasserturmParkNavigationV381";
import {attachWorldSpaceDetail} from "./attachWorldSpaceDetail";
import type {SurroundingChunkGeometry} from "./SurroundingCityGeometry";

export function createWasserturmParkV381(
  ground:PrenzlauerStreetPacketV380, detail:PrenzlauerStreetPacketV380, tower:PrenzlauerStreetPacketV380, native:boolean,
) {
  const park=new Group();
  park.name="Wasserturmpark – Hochbehälter, Standrohrturm und Parkterrassen";
  park.userData={wasserturmParkV381:true,nativeMinecraft:native,keepInMinecraft:native,inventoryTrees:ground.trees.length};
  park.add(createSurveySurfaceV380(ground,"Wasserturmpark – vermessener Hang und Katasterwege"));
  park.add(createSurveySurfaceV380(detail,"Wasserturmpark – Türme, Treppenläufe, Mauern und Ausstattung"));
  park.add(createSurveySurfaceV380(tower,"Wasserturm – Wohnschaft, Kegeldach und Schornstein"));
  addSurveyTreesV380(park,ground.trees,native);
  return park;
}

export async function attachWasserturmParkV381(entry:SurroundingChunkGeometry,id:string,native:boolean,signal?:AbortSignal) {
  if(id!=="wasserturm381-park") return;
  signal?.throwIfAborted();
  if(entry.root.userData.wasserturmParkFloorV381) return;
  const style=native?"native":"drawn";
  const [land,objects,tower]=await Promise.all([
    import(`./data/wasserturmParkTerrainV381-${style}.json`),import(`./data/wasserturmParkObjectsV381-${style}.json`),
    import(`./data/wasserturmMainV381-${style}.json`),
  ]);
  signal?.throwIfAborted();
  if(entry.root.userData.wasserturmParkFloorV381) return;
  attachWorldSpaceDetail(entry,createWasserturmParkV381(land.default,objects.default,tower.default,native));
  entry.root.userData.wasserturmParkSolidV381=(x:number,y:number,z:number,radius:number)=>wasserturmParkSolidV381(x,y,z,radius,native);
  entry.root.userData.wasserturmParkRoofV381=(x:number,z:number,feet:number)=>wasserturmParkRoofV381(x,z,feet,native);
  entry.root.userData.wasserturmParkFloorV381=(x:number,z:number)=>wasserturmParkGroundV381(x,z,native);
}
