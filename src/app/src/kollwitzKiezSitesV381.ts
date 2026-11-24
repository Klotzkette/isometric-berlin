import type {SurroundingChunkGeometry} from "./SurroundingCityGeometry";
import {kollwitzFrontHostsV381} from "./kollwitzFrontsIndexV381";
import {kollwitzplatzHostsV381, kollwitzplatzIdsV381} from "./kollwitzplatzIndexV381";
import {rykeStreetsHostsV381} from "./rykeStreetsIndexV381";
import {wasserturmParkHostsV381} from "./wasserturmParkIndexV381";

export const kollwitzKiezHostsV381 = [...kollwitzplatzHostsV381, ...rykeStreetsHostsV381, ...wasserturmParkHostsV381];
const streetIds = new Set(rykeStreetsHostsV381.map(h => h.id));
const waterTowerIds = new Set(wasserturmParkHostsV381.map(h => h.id));
const furnitureIds = new Set(["6_-4", "6_-5"]);
export const kollwitzKiezIdsV381 = new Set([...kollwitzKiezHostsV381.map(h => h.id), ...furnitureIds, ...kollwitzFrontHostsV381]);

export async function attachKollwitzKiezV381(entry: SurroundingChunkGeometry,id:string,native:boolean,signal:AbortSignal) {
  if (streetIds.has(id)) {
    const {attachRykeStreetsV381} = await import("./rykeStreetsV381");
    await attachRykeStreetsV381(entry,id,native,signal);
  }
  if (waterTowerIds.has(id)) {
    const {attachWasserturmParkV381} = await import("./wasserturmParkV381");
    await attachWasserturmParkV381(entry,id,native,signal);
  }
  if (kollwitzplatzIdsV381.has(id)) {
    const {attachKollwitzplatzV381} = await import("./kollwitzplatzV381");
    await attachKollwitzplatzV381(entry,id,native,signal);
  }
  if (kollwitzFrontHostsV381.has(id)) {
    const {attachKollwitzFrontsV381} = await import("./kollwitzFrontsV381");
    await attachKollwitzFrontsV381(entry,id,native,signal);
  }
  if (id === "6_-4") {
    const {attachRykeBasilicaV381} = await import("./rykeBasilicaV381");
    await attachRykeBasilicaV381(entry,id,native,signal);
  }
  if (furnitureIds.has(id)) {
    const {attachKollwitzStreetFurnitureV381} = await import("./kollwitzStreetFurnitureV381");
    await attachKollwitzStreetFurnitureV381(entry,id,native,signal);
  }
}
