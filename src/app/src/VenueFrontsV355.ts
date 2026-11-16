import type { SourceQuarterCatalogueEntryV309 } from "./SourceQuarterCatalogueV309";
import { VENUE_FRONTS_KIND_V355, VENUE_FRONTS_KIND_V356, venueFrontSourceV355, type VenueFrontRecipes } from "./VenueFrontMeshV355";
import index from "./data/venueFrontsV355Index.json";
import nextIndex from "./data/venueFrontsV356Index.json";

let loaders: Record<string, () => Promise<unknown>> = {};
try {
  loaders = import.meta.glob("./data/venueFrontsV35[56]Packets*.json");
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
export const venueFrontEntriesV356 = entries(nextIndex, VENUE_FRONTS_KIND_V356);
