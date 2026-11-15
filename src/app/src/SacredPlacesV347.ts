import type { SourceQuarterCatalogueEntryV309 } from "./SourceQuarterCatalogueV309";
import index from "./data/sacredPlacesV347Index.json";

let loaders: Record<string, () => Promise<unknown>> = {};
try { loaders = import.meta.glob("./data/sacredPlacesV347Packets*.json"); }
catch { /* Source checks read the same finite immutable recipes. */ }
export const sacredPlacesEntriesV347: SourceQuarterCatalogueEntryV309[] = index.sources.map(({ file, keys }) => ({
  kind: "sacred-places-v347", keys,
  load: () => {
    const path = "./data/" + file, loader = loaders[path];
    return (loader ? loader() : import(/* @vite-ignore */ path)) as Promise<{ default: unknown }>;
  },
}));
