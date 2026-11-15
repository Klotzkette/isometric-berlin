import type {SourceQuarterCatalogueEntryV309} from "./SourceQuarterCatalogueV309";
/** Whole measured villas and roofs replace only exact old fallback owners. */
export const schwanenwerderV346:SourceQuarterCatalogueEntryV309={
 kind:"schwanenwerder-v346",
 keys:["outer187--28_14","outer187--28_15","outer187--27_14","outer187--27_15"].flatMap(id=>[`drawn:${id}`,`minecraft:${id}`]),
 load:()=>import("./data/schwanenwerderV346Packets.json"),
};
