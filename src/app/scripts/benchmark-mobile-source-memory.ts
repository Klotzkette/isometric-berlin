import { heapStats } from "bun:jsc";
import { splitProgressiveBuildings, MOBILE_INITIAL_BUILDING_COUNT } from "../src/progressiveWorld.ts";
import { MOBILE_DETAIL_BATCH_SIZE } from "../src/buildingDetailStreaming.ts";
import { PackedBuildingDistrictStore } from "../src/packedBuildingDistrictStore.ts";

const snapshot = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  Bun.gc(true);
  const { heapSize, objectCount } = heapStats();
  return { heapSize, objectCount };
};
const baseline = await snapshot();
let payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json();
let partition = splitProgressiveBuildings(payload.buildings, MOBILE_INITIAL_BUILDING_COUNT, MOBILE_DETAIL_BATCH_SIZE, Number.POSITIVE_INFINITY);
payload.buildings = [];
partition.initial.length = 0;
const decoded = await snapshot();
const store = new PackedBuildingDistrictStore(partition.remaining);
const packed = await snapshot();
const buildings = store.read("buildings-1");
const active = await snapshot();
console.log(JSON.stringify({ baseline, decoded, packed, active, encodedCodeUnits: store.encodedCodeUnits,
  activeDistrictBuildings: buildings.length,
  decodedSourceHeapBytes: decoded.heapSize - baseline.heapSize,
  packedSourceHeapBytes: packed.heapSize - baseline.heapSize,
  heapBytesSaved: decoded.heapSize - packed.heapSize,
  objectCountSaved: decoded.objectCount - packed.objectCount }));
// Keep both representations observable until every measurement completed.
console.log(payload.classes.length, partition.remaining.length, store.size, buildings[0].id);
