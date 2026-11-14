import type { SourceQuarterCatalogueEntryV309 } from "./SourceQuarterCatalogueV309";

/** Finite street fronts load through the existing serial construction path. */
export const weddingGesundbrunnenFrontsV340: SourceQuarterCatalogueEntryV309 = {
  kind: "wedding-gesundbrunnen-fronts-v340",
  keys: [
    "drawn:1_-8",
    "drawn:district188--1_-8",
    "minecraft:1_-8",
    "minecraft:district188--1_-8",
  ],
  load: () => import("./data/weddingGesundbrunnenFrontsV340.json"),
};
