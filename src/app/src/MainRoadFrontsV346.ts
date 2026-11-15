import type { SourceQuarterCatalogueEntryV309 } from "./SourceQuarterCatalogueV309";
import index from "./data/mainRoadFrontsV346Index.json";
let loaders: Record<string, () => Promise<unknown>> = {};
try { loaders = import.meta.glob("./data/mainRoadFrontsV346Packets*.json"); }
catch { /* Source checks use the same immutable packet file. */ }
export const mainRoadFrontsEntriesV346: SourceQuarterCatalogueEntryV309[] = (index.sources as {file:string;keys:string[]}[]).map(({file, keys}) => ({
  kind: "main-road-fronts-v346", keys,
  load: () => {
    const path = "./data/" + file, loader = loaders[path];
    return (loader ? loader() : import(/* @vite-ignore */ path)) as Promise<{default:unknown}>;
  },
}));
