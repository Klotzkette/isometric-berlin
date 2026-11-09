/** Resolve the complete published packet pipeline before the single Post owner. */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { gunzipSync } from "node:zlib";
import { captureNeighbourhoodPacketV300, prepareNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309 } from "../src/SourceQuarterCatalogueV309";
import { captureSourceQuarterPacketV303 } from "../src/SourceQuarterPacketV303";
import { prepareSurroundingQuarterPredecessorV303, type SurroundingCityChunk, type SurroundingOwnershipOptions } from "../src/SurroundingCityGeometry";
import clusterFacades from "../src/data/clusterFacadesV320.json";
import berlinSenate from "../src/data/berlinSenateV321.json";

const flags: SurroundingOwnershipOptions = {
  schlossplatzV239: true, staatsoperV240: true, architectureV241: true, mitteEnsembleV281: true,
  prenzlbergV264: true, chariteBridgesV265: true, operaTheatresV274: true, northernSitesV266: true,
  golgathaV270: true, tachelesFrontsV270: true, southFidelityV294: true, littenStadthausV297: true,
  wallGalleryV298: true, stralauSisyphosV299: true, neighbourhoodV300: true, westKiezV302: true,
  sourceQuartersV303: true, neukoellnLandmarksV305: true, northFidelityV309: true,
  treptowWaterfrontV317: true, governmentOfficesV321: true, universitiesV322: true,
  wilhelmHousingV324: true, wilhelmStreetFrontsV325: true, southWestSitesV326: true,
};
function drain<T>(work: Generator<void, T>): T {
  for (;;) {
    const next = work.next();
    if (next.done) return next.value;
  }
}
const fingerprint = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; ++i) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
  return hash;
};
const ink = (chunk: SurroundingCityChunk) => chunk.lines
  ? fingerprint(chunk.lines.positions + (chunk.lines.colors ?? ""))
  : null;
const loadPublished = createSourceQuarterRecipeLoaderV309(
  SOURCE_QUARTER_CATALOGUE_V309.filter(entry => !entry.kind.endsWith("-v328")),
);
const output: Record<string, unknown> = {};
for (const path of Bun.argv.slice(2)) {
  const name = basename(path);
  const [id, mode] = name.split(".");
  const native = mode === "minecraft";
  const key = `${mode}:${id}`;
  const raw = JSON.parse(gunzipSync(readFileSync(path)).toString()) as SurroundingCityChunk;
  const original = JSON.stringify(raw);
  const later = [
    [clusterFacades, "cluster-facades-v320"],
    [berlinSenate, "berlin-senate-v321"],
  ] as const;
  const older = await loadPublished(id, native);
  let prepared = drain(prepareSurroundingQuarterPredecessorV303(structuredClone(raw), id, native, flags));
  for (const entry of older) {
    const ticket = entry.source.packets[key]?.preparedRecords
      ? drain(captureSourceQuarterPacketV303(raw, id, native, true, entry.source, entry.kind, entry.requiredReplacement))
      : drain(captureNeighbourhoodPacketV300(raw, id, native, true, entry.source as unknown as NeighbourhoodSourceV300, entry.kind));
    if (!ticket) throw Error(`Published predecessor rejected ${entry.kind} ${key}`);
    const next = drain(ticket(prepared));
    if (next === prepared) throw Error(`Published predecessor did not admit ${entry.kind} ${key}`);
    prepared = next;
  }
  const beforeCluster = prepared;
  const kinds = older.map(entry => entry.kind);
  for (const [source, kind] of later) {
    if (!(source.keys as readonly string[]).includes(key)) continue;
    const ticket = drain(captureNeighbourhoodPacketV300(raw, id, native, true, source as unknown as NeighbourhoodSourceV300, kind));
    if (!ticket) throw Error(`Later predecessor rejected ${kind} ${key}`);
    const next = drain(prepareNeighbourhoodPacketV300(prepared, ticket));
    if (next === prepared) throw Error(`Later predecessor did not admit ${kind} ${key}`);
    prepared = next;
    kinds.push(kind);
  }
  if (JSON.stringify(raw) !== original) throw Error("Original packet changed");
  output[name] = {
    prepared: beforeCluster, kinds, navGuard: fingerprint(JSON.stringify(raw.nav)), lineGuard: ink(raw),
    preparedNavGuard: fingerprint(JSON.stringify(prepared.nav)), preparedLineGuard: ink(prepared),
  };
}
process.stdout.write(JSON.stringify(output));
