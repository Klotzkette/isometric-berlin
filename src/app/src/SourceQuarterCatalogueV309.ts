/** Exact small catalogue only; large immutable recipes load for requested tiles.
 * A shared in-flight import has no scene lifetime and cannot publish geometry.
 * Failed imports are forgotten; the controller owns its bounded retry cadence. */
import type {SurroundingOwnershipOptions} from "./SurroundingCityGeometry";
import type {SourceQuarterSourceV303} from "./SourceQuarterPacketV303";
import networkIndexV326 from "./data/networkFidelityV326Index.json";
import southwestIndexV326 from "./data/southWestSitesV326PacketIndex.json";
import northeastIndexV326 from "./data/northEastPublicSitesV326PacketIndex.json";
import northernIndex from "./data/northernFidelityV309Index.json";
import federalIndexV321 from "./data/federalMinistriesV321PacketIndex.json";
import universitiesIndexV322 from "./data/universitiesV322PacketIndex.json";
import theatresIndexV322 from "./data/youthTheatreFrontsV322PacketIndex.json";

export type SourceQuarterRecipesV309=NonNullable<SurroundingOwnershipOptions["sourceQuarterSourcesV303"]>;
export type SourceQuarterCatalogueEntryV309={
  keys:readonly string[];
  kind:string;
  requiredReplacement?:boolean;
  admission?:"north-v309"|"treptow-v317"|"government-v321"|"universities-v322"|"wilhelm-v324"|"wilhelm-street-v325"|"southwest-sites-v326";
  load:()=>Promise<{default:unknown}>;
};
const families=(ids:readonly string[])=>ids.flatMap(id=>[`drawn:${id}`,`minecraft:${id}`]);
// Vite expands only these finite lazy JSON modules. Keeping the import path
// computed for non-Vite tools avoids type-inferencing 447 MB of recipe words.
let networkLoadersV326:Record<string,()=>Promise<unknown>>={};
try{networkLoadersV326=import.meta.glob("./data/networkFidelityV326Packets*.json");}catch{/* Bun fixture runner uses the same original JSON below. */}
const loadNetworkV326=(file:string):Promise<{default:unknown}>=>{
 const path="./data/"+file,load=networkLoadersV326[path];
 return (load?load():import(/* @vite-ignore */ path)) as Promise<{default:unknown}>;
};
export const SOURCE_QUARTER_CATALOGUE_V309:readonly SourceQuarterCatalogueEntryV309[]=[
  {keys:southwestIndexV326.keys,kind:"southwest-sites-v326",requiredReplacement:true,admission:"southwest-sites-v326",load:()=>import("./data/southWestSitesV326Packets.json")},
  {keys:northeastIndexV326.keys,kind:"north-east-public-sites-v326",load:()=>import("./data/northEastPublicSitesV326Packets.json")},
  {keys:["drawn:1_0","drawn:1_1"],kind:"wilhelm-street-v325",requiredReplacement:true,admission:"wilhelm-street-v325",load:()=>import("./data/wilhelmStreetFrontsV325Packets.json")},
  {keys:["drawn:1_0","drawn:1_1"],kind:"wilhelm-housing-v324",requiredReplacement:true,admission:"wilhelm-v324",load:()=>import("./data/wilhelmHousingV324Packets.json")},
  {keys:universitiesIndexV322.keys,kind:"universities-v322",requiredReplacement:true,admission:"universities-v322",load:()=>import("./data/universitiesV322Packets.json")},
  {keys:theatresIndexV322.keys,kind:"youth-theatres-v322",requiredReplacement:true,admission:"universities-v322",load:()=>import("./data/youthTheatreFrontsV322Packets.json")},
  {keys:federalIndexV321.keys,kind:"federal-ministries-v321",requiredReplacement:true,admission:"government-v321",load:()=>import("./data/federalMinistriesV321Packets.json")},
  {keys:families(["district188-11_1","district188-11_2","district188-ring182-11_0","district188-ring182-11_1","district188-ring182-12_0","district188-ring182-12_1","ring182-11_1","ring182-12_0","ring182-12_1","ring182-12_2"]),kind:"friedrichshain-v303",load:()=>import("./data/friedrichshainV303.json")},
  {keys:families(["ring182-9_9","ring182-9_10","ring182-10_9","ring182-10_10"]),kind:"rixdorf-v304",load:()=>import("./data/rixdorfV304.json")},
  {keys:families(["ring182-7_8","ring182-8_8"]),kind:"neukoelln-landmarks-v305",requiredReplacement:true,load:()=>import("./data/neukoellnLandmarksV305Packets.json")},
  {keys:northernIndex.keys,kind:"northern-fidelity-v309",requiredReplacement:true,admission:"north-v309",load:()=>import("./data/northernFidelityV309Packets.json")},
  {keys:families(["10_4","10_5","ring182-11_5"]),kind:"treptow-waterfront-v317",requiredReplacement:true,admission:"treptow-v317",load:()=>import("./data/treptowWaterfrontV317Packets.json")},
  ...networkIndexV326.sources.map(source=>({keys:source.keys,kind:"network-fidelity-v326",load:()=>loadNetworkV326(source.file)})),
  {
    keys: families(["ring182--7_11", "ring182--7_12"]),
    kind: "schlossstrasse-v327",
    load: () => import("./data/schlossstrasseV327Packets.json"),
  },
];

/** Separate factory permits deterministic transport/retry tests without mocks
 * of the browser module cache. Production uses the same exact loader below. */
export function createSourceQuarterRecipeLoaderV309(catalogue:readonly SourceQuarterCatalogueEntryV309[]) {
  const entries=catalogue.map(entry=>({entry,keys:new Set(entry.keys)}));
  const cache=new Map<SourceQuarterCatalogueEntryV309,Promise<SourceQuarterSourceV303>>();
  function load(entry:SourceQuarterCatalogueEntryV309):Promise<SourceQuarterSourceV303> {
    const prior=cache.get(entry);
    if(prior)return prior;
    const pending=Promise.resolve().then(entry.load).then(module=>{
      const source=module.default as SourceQuarterSourceV303;
      const keys=new Set(entry.keys);
      if(source?.schemaVersion!==1||!Array.isArray(source.keys)||source.keys.length!==keys.size||new Set(source.keys).size!==keys.size||source.keys.some(key=>!keys.has(key))||!source.packets||Object.keys(source.packets).length!==keys.size||Object.keys(source.packets).some(key=>!keys.has(key)))throw Error(`Incomplete exact source-quarter recipe ${entry.kind}`);
      return source;
    });
    cache.set(entry,pending);
    void pending.catch(()=>{if(cache.get(entry)===pending)cache.delete(entry);});
    return pending;
  }
  return async(id:string,native=false):Promise<SourceQuarterRecipesV309>=>{
    const key=`${native?"minecraft":"drawn"}:${id}`;
    const matches=entries.filter(e=>e.keys.has(key));
    if(!matches.length)return [];
    return Promise.all(matches.map(async({entry})=>({source:await load(entry),kind:entry.kind,...(entry.requiredReplacement?{requiredReplacement:true}:{}),...(entry.admission?{admission:entry.admission}:{})})));
  };
}
export const loadSourceQuarterRecipesV309=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309);
