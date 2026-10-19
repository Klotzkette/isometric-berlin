import { transferIHZTrianglesV241 } from "./ihzV241Ownership";
import { transferQuartier207TrianglesV241 } from "./quartier207V241Ownership";
import { transferStaatsbibliothekLinesV241, transferStaatsbibliothekTrianglesV241 } from "./staatsbibliothekV241Ownership";
import { transferSpreeFacadeV231 } from "./spreeFacadeOwnershipV231";
import { transferStaatsoperTrianglesV240 } from "./staatsoperV240Ownership";
import { transferSchlossplatzLinesV239, transferSchlossplatzTrianglesV239 } from "./schlossplatzV239Ownership";
import centralNamed from "./data/centralNamedV230Ownership.json";
import { transferCentralNamedNavigationV230 } from "./centralNamedPacketNavigationV230";
import westIndustrial from "./data/westIndustrialV230Ownership.json";
import { transferWestIndustrialNavigationV230 } from "./westIndustrialPacketNavigationV230";
import hospital from "./data/bundeswehrHospitalV215Ownership.json";
import springer from "./data/springerV215Ownership.json";
import theatre from "./data/volksbuehneOwnershipV209.json";
import helmholtz from "./data/kiezSitesOwnershipV209.json";
import prisons from "./data/prisonsMemorialsOwnershipV209.json";
import neukoelln from "./data/neukoellnPlacesV210Ownership.json";
import arenaStation from "./data/arenaStationV225Ownership.json";
import townhalls from "./data/townhallV227Ownership.json";
import districtCourts from "./data/districtCourtsV229Ownership.json";
import { transferDistrictCourtNavigationV229 } from "./districtCourtPacketNavigationV229";
import { transferExactPacketLines, transferExactPacketTriangles } from "./exactPacketTransfer";
import { transferPrisonsNavigationV209 } from "./prisonsNavigationTransferV209";
import { transferNeukoellnNavigationV210 } from "./neukoellnPlacesV210Navigation";
import { transferKalkscheuneFacadeV218 } from "./kalkscheuneOwnershipV218";
import { transferArenaStationNavigationV225 } from "./arenaStationV225Navigation";
import { transferTownhallNavigationV227 } from "./townhallPacketNavigationV227";
import type { SurroundingNavigation, SurroundingPackedLines, SurroundingPackedMesh } from "./SurroundingCityGeometry";

const triangles = [...theatre.records, ...helmholtz.records, ...prisons.records, ...neukoelln.records, ...hospital.records, ...springer.records, ...arenaStation.records, ...townhalls.records, ...districtCourts.records, ...westIndustrial.records, ...centralNamed.records];
const lines = [...helmholtz.lineRecords, ...prisons.lineRecords, ...neukoelln.lineRecords, ...hospital.lineRecords, ...springer.lineRecords, ...arenaStation.lineRecords, ...townhalls.lineRecords, ...districtCourts.lineRecords, ...westIndustrial.lineRecords, ...centralNamed.lineRecords];

/** Each replacement body is required in the city construction transaction. */
export function* transferSiteTrianglesV209(tile: string, native: boolean,
  part: SurroundingPackedMesh, indices: Uint16Array | Uint32Array, offset: number,
  schlossplatzV239 = false, staatsoperV240 = false, architectureV241 = false): Generator<void, number> {
  const sites = yield* transferExactPacketTriangles(triangles, tile, native, part, indices, offset);
  return sites + (yield* transferKalkscheuneFacadeV218(tile, native, part, indices, offset))
    + (yield* transferSpreeFacadeV231(tile, native, part, indices, offset))
    + (yield* transferSchlossplatzTrianglesV239(schlossplatzV239, tile, native, part, indices, offset))
    + (yield* transferStaatsoperTrianglesV240(staatsoperV240, tile, native, part, indices, offset))
    + (yield* transferStaatsbibliothekTrianglesV241(architectureV241, tile, native, part, indices, offset))
    + (yield* transferQuartier207TrianglesV241(architectureV241, tile, native, part, indices, offset))
    + (yield* transferIHZTrianglesV241(architectureV241, tile, native, part, indices, offset));
}
export function* transferSiteLinesV209(tile: string, part: SurroundingPackedLines,
  values: Uint16Array, stride: number, schlossplatzV239 = false, architectureV241 = false): Generator<void, number> {
  return (yield* transferExactPacketLines(lines, tile, part, values, stride))
    + (yield* transferSchlossplatzLinesV239(schlossplatzV239, tile, part, values, stride))
    + (yield* transferStaatsbibliothekLinesV241(architectureV241, tile, part, values, stride));
}

const equalRing = (a: number[][], b: number[][]) => a.length === b.length &&
  a.every((p, i) => p.length === b[i].length && p.every((v, j) => v === b[i][j]));

/** Correct the obsolete Platzhaus collision roof only with the complete exact
 * source nav record as guard. The input packet and all other owners stay intact. */
export function siteNavigationV209(tile: string, original: SurroundingNavigation): SurroundingNavigation {
  const transferred = transferDistrictCourtNavigationV229(tile, transferTownhallNavigationV227(tile, transferArenaStationNavigationV225(tile, transferNeukoellnNavigationV210(tile, transferPrisonsNavigationV209(tile, original)))));
  const nav = transferCentralNamedNavigationV230(tile, transferWestIndustrialNavigationV230(tile, transferred));
  const records = helmholtz.navigationRecords.filter(record => record.tile === tile);
  if (!records.length) return nav;
  let changed = false;
  const buildings = nav.buildings.map(building => {
    const record = records.find(r => building.sourceId === r.owner &&
      building.height === r.original.height && building.minHeight === r.original.minHeight &&
      equalRing(building.ring, r.original.ring) && building.holes.length === r.original.holes.length &&
      building.holes.every((ring, i) => equalRing(ring, r.original.holes[i])));
    if (!record) return building;
    changed = true;
    return { ...building, height: record.newHeight };
  });
  return changed ? { ...nav, buildings } : nav;
}
