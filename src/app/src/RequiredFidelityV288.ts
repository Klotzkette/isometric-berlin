import { waterfrontOriginalPrismV296 } from "./waterfrontV296Profile";
import { createDprkEmbassyV288 } from "./MitteEmbassiesV288";
import { createSouthFidelityV294, hasCompleteSouthFidelityV294 } from "./SouthFidelityV294";
import { diningOriginalPrismV296, PARLIAMENTARY_DINING_V296 } from "./parliamentaryDiningV296Profile";
import type { DiningPrismV296 } from "./parliamentaryDiningV296Profile";
import { createParliamentaryDiningV296 } from "./ParliamentaryDiningV296";
import { createCourtsParkV293 } from "./CourtsParkV293";
import { createWaterfrontFidelityV296 } from "./WaterfrontFidelityV296";
import { BufferGeometry, Group, InstancedMesh, Material, Mesh } from "three";
import { createBerlinHistoricDomV288, hasCompleteBerlinHistoricDomV288 } from "./BerlinHistoricCoreV288";
import { matchesBerlinHistoricDomOwnersV288, matchesBerlinHistoricDomNativeV288 } from "./BerlinHistoricCoreV288Ownership";
import { createPotsdamerCorridorCoreV288, hasCompletePotsdamerCorridorCoreV288 } from "./PotsdamerCorridorCoreV288";
import { admitsPotsdamerCorridorCoreV288, admitsPotsdamerCorridorNativeV288 } from "./PotsdamerCorridorV288Ownership";
import { createMitteDdrV288 } from "./MitteDdrV288";
import { createChancelleryCanopySourceV289, hasCompleteChancelleryCanopySourceV289 } from "./ChancelleryCanopySourceV289";
import { admitsChancelleryCanopySourceV289, admitsChancelleryCanopyNativeV289 } from "./ChancelleryCanopySourceV289Ownership";

type FactoryV288 = () => { group: Group; complete?: (group: Group) => boolean } | null;
/** Own each completed result immediately, including before its admission
 * proof. A failed later constructor can never strand earlier allocations. */
export function constructUnpublishedFidelityV288(factories: readonly FactoryV288[]): Group {
  const root=new Group();root.name="Required complete source fidelity corrections v288";
  try {
    for(const factory of factories){const next=factory();if(!next)continue;root.add(next.group);if(next.complete&&!next.complete(next.group))throw new Error("Incomplete source fidelity ownership transaction");}
    return root;
  } catch(error) {
    const geometries=new Set<BufferGeometry>(),materials=new Set<Material>();
    root.traverse(object=>{const mesh=object as Mesh;if(mesh.geometry)geometries.add(mesh.geometry);
      for(const value of [mesh.material,object.userData.dayMaterial,object.userData.nightMaterial])for(const m of Array.isArray(value)?value:[value])if(m instanceof Material)materials.add(m);
      if(mesh instanceof InstancedMesh)mesh.dispose();
    });
    root.clear();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();throw error;
  }
}

/** Construct complete owners before any old prism/column can yield. This
 * module belongs only to the main-thread city transaction, never the worker. */
export function prepareRequiredFidelityV288(prisms: { buildings: unknown }, payload: unknown, native=false, canopyLegacyAdmitted=false, mobileLike=false) {
  const historicDom=matchesBerlinHistoricDomOwnersV288(prisms.buildings)&&(!native||matchesBerlinHistoricDomNativeV288(payload));
  const potsdamerCorridor=admitsPotsdamerCorridorCoreV288(prisms)&&(!native||admitsPotsdamerCorridorNativeV288(payload));
  const chancelleryCanopy=admitsChancelleryCanopySourceV289(prisms)&&(native?admitsChancelleryCanopyNativeV289(payload):canopyLegacyAdmitted);
  const diningIds=[...PARLIAMENTARY_DINING_V296.lampenladen.sourceIds,...PARLIAMENTARY_DINING_V296.marie.sourceIds];
  const parliamentaryDining=Array.isArray(prisms.buildings)&&diningIds.every(id=>(prisms.buildings as DiningPrismV296[]).some(p=>p.id===id&&diningOriginalPrismV296(p)));
  const waterfront=Array.isArray(prisms.buildings)&&prisms.buildings.some(waterfrontOriginalPrismV296);
  const root=constructUnpublishedFidelityV288([
    ()=>({group:createCourtsParkV293(native)}),
    ()=>({group:createSouthFidelityV294(native,{mobileLike}),complete:hasCompleteSouthFidelityV294}),
    ()=>({group:createParliamentaryDiningV296(native)}),
    ()=>({group:createWaterfrontFidelityV296(native)}),
    ()=>historicDom?{group:createBerlinHistoricDomV288(native),complete:hasCompleteBerlinHistoricDomV288}:null,
    ()=>potsdamerCorridor?{group:createPotsdamerCorridorCoreV288(native),complete:hasCompletePotsdamerCorridorCoreV288}:null,
    ()=>{const group=createMitteDdrV288({native,payload});return group?{group}:null;},
    ()=>{const group=createDprkEmbassyV288({native,payload});return group?{group}:null;},
    ()=>chancelleryCanopy?{group:createChancelleryCanopySourceV289(native),complete:hasCompleteChancelleryCanopySourceV289}:null,
  ]);
  root.userData={historicDomV288:historicDom,potsdamerCorridorV288:potsdamerCorridor,chancelleryCanopySourceV289:chancelleryCanopy,courtsParkV293:true,southFidelityV294:true,parliamentaryDiningV296:parliamentaryDining,waterfrontV296:waterfront,sourceGeometryRetained:true,fullStaticDetailOnTouch:true};
  return {root,historicDom,potsdamerCorridor,chancelleryCanopy,courtsPark:true,southFidelity:true,parliamentaryDining,waterfront};
}
