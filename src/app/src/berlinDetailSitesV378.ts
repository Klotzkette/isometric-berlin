import {attachKollwitzKiezV381, kollwitzKiezHostsV381, kollwitzKiezIdsV381} from "./kollwitzKiezSitesV381";
import {berlinRegionLoaderV380, berlinRegionsV380} from "./berlinRegionsV380";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";
import { zooWestIdsV379, zooWestHostsV379 } from "./zooWestIndexV379";
import { tierparkEastIdsV379 } from "./tierparkEastIndexV379";
import { retailHostsV378, retailHostV378 } from "./retailV378Index";
import { tegelHostsV378 } from "./tegelLandscapeIndexV378";
import { hasTransportV378, transportExteriorTilesV378 } from "./transportV378Index";
import waterwayIndex from "./data/waterwaysV378Hosts.json";
import streetIds from "./data/neukoellnStreetHostsV378.json";

type Host = { id: string; bounds: [number, number, number, number] };
const streets = new Set(streetIds);
const landscape = new Set(tegelHostsV378.map(site => site.id));
const waterwayHosts = Object.entries(waterwayIndex).map(([id,bounds]) => ({id, bounds: bounds as Host["bounds"]}));
export const exteriorSitesV378: Host[] = [...kollwitzKiezHostsV381, ...berlinRegionsV380, { id: "charlottenburger-tor-v379", bounds: [-2872,505,-2600,630] }, ...zooWestHostsV379, ...tegelHostsV378, ...retailHostsV378, ...transportExteriorTilesV378, ...waterwayHosts];

export async function attachBerlinDetailsV378(entry: SurroundingChunkGeometry, id: string, native: boolean, signal: AbortSignal) {
  if (id === "charlottenburger-tor-v379") {
    const [{ loadCharlottenburgerTorV379 }, { attachWorldSpaceDetail }] = await Promise.all([
      import("./CharlottenburgerTorV379"), import("./attachWorldSpaceDetail"),
    ]);
    signal.throwIfAborted();
    const gate = await loadCharlottenburgerTorV379(native, signal);
    attachWorldSpaceDetail(entry, gate);
    signal.throwIfAborted();
  }
  if (zooWestIdsV379.has(id)) {
    const { attachZooWestV379 } = await import("./zooWestV379");
    await attachZooWestV379(entry, id, native, signal);
  }
  if (tierparkEastIdsV379.has(id)) {
    const { attachTierparkEastV379 } = await import("./tierparkEastV379");
    await attachTierparkEastV379(entry, id, native, signal);
  }
  if (streets.has(id)) {
    const {attachNeukoellnStreetV378} = await import("./neukoellnStreetV378");
    await attachNeukoellnStreetV378(entry,id,native,signal);
  }
  if (Object.hasOwn(waterwayIndex,id)) {
    const {attachWaterwaysV378} = await import("./waterwaysV378");
    await attachWaterwaysV378(entry,id,native,signal);
  }
  if (landscape.has(id)) {
    const {attachTegelLandscapeV378} = await import("./tegelLandscapeV378");
    await attachTegelLandscapeV378(entry,id,native,signal);
  }
  if (retailHostV378(id)) {
    const { attachRetailV378 } = await import("./retailV378");
    await attachRetailV378(entry, id, native, signal);
  }
  if (hasTransportV378(id)) {
    const {attachTransportV378} = await import("./transportV378");
    await attachTransportV378(entry,id,native,signal);
  }
  const regional = berlinRegionLoaderV380(id);
  if (regional) {
    const attach = await regional();
    signal.throwIfAborted();
    await attach(entry,id,native,signal);
  }
  if (kollwitzKiezIdsV381.has(id)) await attachKollwitzKiezV381(entry,id,native,signal);
}
