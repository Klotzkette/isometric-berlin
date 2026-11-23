import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";
import { retailHostsV378, retailHostV378 } from "./retailV378Index";
import { tegelHostsV378 } from "./tegelLandscapeIndexV378";
import { hasTransportV378, transportExteriorTilesV378 } from "./transportV378Index";
import waterwayIndex from "./data/waterwaysV378Hosts.json";
import streetIds from "./data/neukoellnStreetHostsV378.json";

type Host = { id: string; bounds: [number, number, number, number] };
const streets = new Set(streetIds);
const landscape = new Set(tegelHostsV378.map(site => site.id));
const waterwayHosts = Object.entries(waterwayIndex).map(([id,bounds]) => ({id, bounds: bounds as Host["bounds"]}));
export const exteriorSitesV378: Host[] = [...tegelHostsV378, ...retailHostsV378, ...transportExteriorTilesV378, ...waterwayHosts];

export async function attachBerlinDetailsV378(entry: SurroundingChunkGeometry, id: string, native: boolean, signal: AbortSignal) {
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
}
