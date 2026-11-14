/** Exact current production stage immediately before V329 overlays. */
import cluster from "../../src/data/clusterFacadesV320.json";
import senate from "../../src/data/berlinSenateV321.json";
import {
  prepareSurroundingQuarterPredecessorV303, groundOverlayKindsV329,
  type SurroundingCityChunk, type SurroundingOwnershipOptions,
} from "../../src/SurroundingCityGeometry";
import {loadSourceQuarterRecipesV309} from "../../src/SourceQuarterCatalogueV309";
import {
  captureNeighbourhoodPacketV300, prepareNeighbourhoodPacketV300,
  type NeighbourhoodSourceV300,
} from "../../src/NeighbourhoodPacketV300";
import {
  captureSourceQuarterPacketV303, prepareSourceQuarterPacketV303,
  type SourceQuarterTicketV303,
} from "../../src/SourceQuarterPacketV303";

export function doneV342<T>(g:Generator<void,T>):T {
  let n=g.next(); while(!n.done)n=g.next(); return n.value;
}
export async function optionsV342(id:string,native:boolean,admitV305=true):Promise<SurroundingOwnershipOptions> {
  return {
    schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,
    prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,
    golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,
    wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,
    sourceQuartersV303:true,neukoellnLandmarksV305:admitV305,northFidelityV309:true,
    treptowWaterfrontV317:true,governmentOfficesV321:true,universitiesV322:true,
    wilhelmHousingV324:true,wilhelmStreetFrontsV325:true,southWestSitesV326:true,
    sourceQuarterSourcesV303:await loadSourceQuarterRecipesV309(id,native),
    clusterFacadesV320:cluster as unknown as NeighbourhoodSourceV300,
    berlinSenateV321:senate as unknown as NeighbourhoodSourceV300,
  };
}
export async function predecessorV342(raw:SurroundingCityChunk,id:string,native:boolean,admitV305=true) {
  const options=await optionsV342(id,native,admitV305),quarters:SourceQuarterTicketV303[]=[];
  const clusterTicket=doneV342(captureNeighbourhoodPacketV300(raw,id,native,true,options.clusterFacadesV320!,"cluster-facades-v320"));
  const senateTicket=doneV342(captureNeighbourhoodPacketV300(raw,id,native,true,options.berlinSenateV321!,"berlin-senate-v321"));
  for(const entry of options.sourceQuarterSourcesV303??[]) {
    if(groundOverlayKindsV329.has(entry.kind) || entry.kind==="neukoelln-landmarks-v305"&&!admitV305) continue;
    const p=entry.source.packets[`${native?"minecraft":"drawn"}:${id}`];
    if(!p)continue;
    const t=p.preparedRecords
      ?doneV342(captureSourceQuarterPacketV303(raw,id,native,true,entry.source,entry.kind,entry.requiredReplacement))
      :doneV342(captureNeighbourhoodPacketV300(raw,id,native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind));
    if(t)quarters.push(t);
  }
  let prepared=doneV342(prepareSurroundingQuarterPredecessorV303(raw,id,native,options));
  for(const t of quarters)prepared=doneV342(prepareSourceQuarterPacketV303(prepared,t));
  prepared=doneV342(prepareNeighbourhoodPacketV300(prepared,clusterTicket));
  prepared=doneV342(prepareNeighbourhoodPacketV300(prepared,senateTicket));
  // None of the three literal host IDs belongs to elevated station or
  // Katzengraben transport catalogues, so production has no namedTransport pass.
  return prepared;
}
