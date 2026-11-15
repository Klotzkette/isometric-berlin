import type {SourceQuarterCatalogueEntryV309} from "./SourceQuarterCatalogueV309";
import index from "./data/airfieldSurfacesV346Index.json";
/** Last ordinary quarter recipe: exact complete predecessors, then flat paving. */
export const airfieldSurfacesV346:SourceQuarterCatalogueEntryV309={
  kind:"airfield-surfaces-v346",keys:index.keys,
  load:()=>import("./data/airfieldSurfacesV346.json"),
};
