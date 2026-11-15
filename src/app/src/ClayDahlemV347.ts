/** Complete measured Clayallee exteriors and mapped museum/farm detail.
 * Admission, disposal, restoration and mobile fidelity follow the source host. */
import type { SourceQuarterCatalogueEntryV309 } from "./SourceQuarterCatalogueV309";
import index from "./data/clayDahlemV347Index.json";

export const clayDahlemV347: SourceQuarterCatalogueEntryV309 = {
  kind: "clay-dahlem-v347",
  keys: index.keys,
  load: () => import("./data/clayDahlemV347.json"),
};
