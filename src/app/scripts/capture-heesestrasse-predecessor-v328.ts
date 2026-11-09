/** Receipt for the real published packet and its already admitted recipes. */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { gunzipSync } from "node:zlib";
import { captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309 } from "../src/SourceQuarterCatalogueV309";
import { captureSourceQuarterPacketV303 } from "../src/SourceQuarterPacketV303";
import { prepareSurroundingQuarterPredecessorV303, type SurroundingCityChunk, type SurroundingOwnershipOptions } from "../src/SurroundingCityGeometry";
import { clusterFacadesSourceV320 } from "../src/ClusterFacadesV320";
import { berlinSenateSourceV321 } from "../src/BerlinSenateV321";

const id = "ring182--7_13";
const loadPrevious = createSourceQuarterRecipeLoaderV309(
  SOURCE_QUARTER_CATALOGUE_V309.filter(entry => !entry.kind.endsWith("-v328")),
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
const result: Record<string, unknown> = {};
for (const path of Bun.argv.slice(2)) {
  const [packet, mode] = basename(path).split(".");
  if (packet !== id || mode !== "drawn" && mode !== "minecraft") throw Error("Foreign raw packet");
  const native = mode === "minecraft", key = `${mode}:${id}`;
  const raw = JSON.parse(gunzipSync(readFileSync(path)).toString()) as SurroundingCityChunk;
  let prepared = drain(prepareSurroundingQuarterPredecessorV303(structuredClone(raw), id, native, flags));
  const older = await loadPrevious(id, native);
  for (const entry of older) {
    const ticket = entry.source.packets[key]?.preparedRecords
      ? drain(captureSourceQuarterPacketV303(raw, id, native, true, entry.source, entry.kind, entry.requiredReplacement))
      : drain(captureNeighbourhoodPacketV300(raw, id, native, true, entry.source as unknown as NeighbourhoodSourceV300, entry.kind));
    if (!ticket) throw Error(`Older capture rejected ${entry.kind}`);
    const next = drain(ticket(prepared));
    if (next === prepared) throw Error(`Older recipe rejected ${entry.kind}`);
    prepared = next;
  }
  result[mode] = {
    navGuard: hash(JSON.stringify(raw.nav)), lineGuard: ink(raw),
    preparedNavGuard: hash(JSON.stringify(prepared.nav)), preparedLineGuard: ink(prepared),
    predecessorKinds: prepared.meshes.map(m => m.kind),
    previousFittingOwners: [clusterFacadesSourceV320, berlinSenateSourceV321].flatMap(s => s.packets[key]?.owners ?? []),
  };
}
process.stdout.write(JSON.stringify(result));
