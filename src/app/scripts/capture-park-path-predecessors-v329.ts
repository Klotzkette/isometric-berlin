/** Capture the exact already-published ground and competing per-tile additions. */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309 } from "../src/SourceQuarterCatalogueV309";
import { captureSourceQuarterPacketV303 } from "../src/SourceQuarterPacketV303";
import { prepareSurroundingQuarterPredecessorV303, type SurroundingCityChunk, type SurroundingOwnershipOptions } from "../src/SurroundingCityGeometry";
import { clusterFacadesSourceV320 } from "../src/ClusterFacadesV320";
import { berlinSenateSourceV321 } from "../src/BerlinSenateV321";

const previous = createSourceQuarterRecipeLoaderV309(
  SOURCE_QUARTER_CATALOGUE_V309.filter(entry => !entry.kind.endsWith("-v329")),
);
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
function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; ++i) h = Math.imul(h ^ value.charCodeAt(i), 16777619) >>> 0;
  return h;
}
const ink = (p: SurroundingCityChunk) => p.lines ? hash(p.lines.positions + (p.lines.colors ?? "")) : null;
const inputs: { id: string; mode: "drawn" | "minecraft"; path: string }[] = JSON.parse(await Bun.stdin.text());
for (const { id, mode, path } of inputs) {
  const native = mode === "minecraft", key = `${mode}:${id}`;
  const bytes = readFileSync(path);
  const raw = JSON.parse((path.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString()) as SurroundingCityChunk;
  let prepared = drain(prepareSurroundingQuarterPredecessorV303(structuredClone(raw), id, native, flags));
  for (const entry of await previous(id, native)) {
    const ticket = entry.source.packets[key]?.preparedRecords
      ? drain(captureSourceQuarterPacketV303(raw, id, native, true, entry.source, entry.kind, entry.requiredReplacement))
      : drain(captureNeighbourhoodPacketV300(raw, id, native, true, entry.source as unknown as NeighbourhoodSourceV300, entry.kind));
    if (!ticket) throw Error(`Old packet capture rejected ${entry.kind} ${key}`);
    const next = drain(ticket(prepared));
    if (next === prepared) throw Error(`Old packet recipe rejected ${entry.kind} ${key}`);
    prepared = next;
  }
  const later = [clusterFacadesSourceV320, berlinSenateSourceV321].flatMap(s => s.packets[key]?.append ?? []);
  process.stdout.write(JSON.stringify({
    key, navGuard: hash(JSON.stringify(raw.nav)), lineGuard: ink(raw),
    preparedNavGuard: hash(JSON.stringify(prepared.nav)), preparedLineGuard: ink(prepared),
    priorAdditions: [...prepared.meshes.slice(raw.meshes.length), ...later],
  }) + "\n");
}
