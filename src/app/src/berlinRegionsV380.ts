import {embassyHostsV380, embassyIdsV380} from "./embassySitesIndexV380";
import {kreuzbergPlaetzeHostsV380, kreuzbergPlaetzeIdsV380} from "./kreuzbergPlaetzeIndexV380";
import {prenzlauerStreetsIdsV380} from "./prenzlauerStreetsIndexV380";
import {torstrasseHostsV380} from "./torstrasseIndexV380";
import diplomaticHosts from "./data/diplomaticHostsV380.json";
import type {SurroundingChunkGeometry} from "./SurroundingCityGeometry";

type Host = {id: string; bounds: [number, number, number, number]};
export const berlinRegionsV380: Host[] = [
  ...embassyHostsV380, ...kreuzbergPlaetzeHostsV380, ...torstrasseHostsV380,
  ...diplomaticHosts.map(({id,bounds}) => ({id,bounds:bounds as Host["bounds"]})),
];
type Attach = (entry: SurroundingChunkGeometry,id:string,native:boolean,signal:AbortSignal) => Promise<void>;
const loaders=new Map<string,() => Promise<Attach>>();
function register(ids: Iterable<string>, load: () => Promise<Attach>) {
  for (const id of ids) loaders.set(id,load);
}
register(prenzlauerStreetsIdsV380, async () => (await import("./prenzlauerStreetsV380")).attachPrenzlauerStreetsV380);
register(torstrasseHostsV380.map(site => site.id), async () => (await import("./torstrasseV380")).attachTorstrasseV380);
register(kreuzbergPlaetzeIdsV380, async () => (await import("./kreuzbergPlaetzeV380")).attachKreuzbergPlaetzeV380);
register(["5_0","5_1","6_1"], async () => (await import("./jannowitzV380")).attachJannowitzV380);
register(embassyIdsV380, async () => (await import("./embassySitesV380")).attachEmbassySitesV380);
register(diplomaticHosts.map(site => site.id), async () => (await import("./diplomaticSitesV380")).attachDiplomaticSitesV380);

export function berlinRegionLoaderV380(id:string) {
  return loaders.get(id);
}
