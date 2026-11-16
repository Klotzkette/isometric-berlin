import type { SourceQuarterCatalogueEntryV309 } from "./SourceQuarterCatalogueV309";
import { VENUE_FRONTS_KIND_V355, VENUE_FRONTS_KIND_V356, VENUE_FRONTS_KIND_V357, venueFrontSourceV355, type VenueFrontRecipes } from "./VenueFrontMeshV355";
import index from "./data/venueFrontsV355Index.json";
import indexV356 from "./data/venueFrontsV356Index.json";
import indexV357 from "./data/venueFrontsV357Index.json";

let loaders: Record<string, () => Promise<unknown>> = {};
try {
  loaders = import.meta.glob("./data/venueFrontsV35[567]Packets*.json");
} catch {
  // Offline builds and the source verification runner use the local module URL.
}
function entries(index: { sources: { file: string; keys: string[] }[] }, kind: string): SourceQuarterCatalogueEntryV309[] {
  return index.sources.map(({ file, keys }) => ({
    keys,
    kind,
    load: async () => {
      const path = "./data/" + file;
      const loader = loaders[path];
      const { default: compact } = await (loader ? loader() : import(/* @vite-ignore */ path)) as {
        default: VenueFrontRecipes;
      };
      if (compact.keys.length !== keys.length || keys.some((key, i) => compact.keys[i] !== key)) {
        throw new Error("Venue front index and packet differ");
      }
      return { default: venueFrontSourceV355(compact, kind) };
    },
  }));
}

export const venueFrontEntriesV355 = entries(index, VENUE_FRONTS_KIND_V355);
export const venueFrontEntriesV356 = entries(indexV356, VENUE_FRONTS_KIND_V356);
export const venueFrontEntriesV357 = entries(indexV357, VENUE_FRONTS_KIND_V357);
