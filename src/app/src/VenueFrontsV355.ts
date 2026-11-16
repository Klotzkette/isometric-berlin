import type { SourceQuarterCatalogueEntryV309 } from "./SourceQuarterCatalogueV309";
import { VENUE_FRONTS_KIND_V355, venueFrontSourceV355, type VenueFrontRecipes } from "./VenueFrontMeshV355";
import index from "./data/venueFrontsV355Index.json";

let loaders: Record<string, () => Promise<unknown>> = {};
try {
  loaders = import.meta.glob("./data/venueFrontsV355Packets*.json");
} catch {
  // Offline builds and the source verification runner use the local module URL.
}
export const venueFrontEntriesV355: SourceQuarterCatalogueEntryV309[] = index.sources.map(({ file, keys }) => ({
  keys,
  kind: VENUE_FRONTS_KIND_V355,
  load: async () => {
    const path = "./data/" + file;
    const loader = loaders[path];
    const { default: compact } = await (loader ? loader() : import(/* @vite-ignore */ path)) as {
      default: VenueFrontRecipes;
    };
    if (compact.keys.length !== keys.length || keys.some((key, i) => compact.keys[i] !== key)) {
      throw new Error("Venue front index and packet differ");
    }
    return { default: venueFrontSourceV355(compact) };
  },
}));
