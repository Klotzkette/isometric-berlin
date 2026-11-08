/** Main-thread metadata for new, independently streamed named-site packets.
 * The ordinary loader verifies each complete gzip SHA before the unchanged
 * bounded decoder. No existing body, navigation row or authored facade retires.
 */
import index from "./data/publicInstitutionsV326Index.json";
import type {SurroundingCityManifest} from "./SurroundingCity";

export const PUBLIC_INSTITUTIONS_KIND_V326 = "public-institutions-v326";
export const publicInstitutionsManifestV326 = {
  schemaVersion: 1,
  chunks: index.chunks,
  footprint: index.footprint,
  groundY: 3,
} as unknown as SurroundingCityManifest;

/** Counts describe physical official source families, not institution tenants. */
export const publicInstitutionsCountsV326 = index.counts;
