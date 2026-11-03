/** Small exact visibility/recipe index; no render source enters the cold graph. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, Mesh, Line, Points, type Group } from "three";
import { createNorthSitesV306 } from "../src/NorthSitesV306";
import { createRailSseArchitectureV307 } from "../src/RailSseArchitectureV307";
import { createHospitalArchitectureV308 } from "../src/HospitalArchitectureV308";
import { createGesundbrunnenRoadBridgesV309 } from "../src/GesundbrunnenRoadBridgesV309";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

const data = resolve(import.meta.dir, "../src/data");
const componentNames = ["northSitesV306", "railSseArchitectureV307", "hospitalArchitectureV308Core", "northParkTerrainV306", "railSseTerrainV307", "northernFidelityV309Packets", "gesundbrunnenRoadBridgesV309", "gesundbrunnenRoadBridgesV309Profile", "railBridgeUnderdeckApproachV309", "railTerrainContactApproachV309", "railBridgeApproachV307Ground", "railBridgeApproachV307Pavement", "railBridgeApproachV307Bodies", "railBridgeApproachV307Profile", "railBridgeApproachV307Navigation", "gesundbrunnenBridgeInkV309"];
const sources = Object.fromEntries(componentNames.map(name => [name, createHash("sha256").update(readFileSync(resolve(data, `${name}.json`))).digest("hex")]));
const regionSet = new Set<string>(), box = new Box3();
const add = (bounds: readonly number[], renderable = false) => {
  if (bounds.length !== 4 || !bounds.every(Number.isFinite) || (renderable ? bounds[0] > bounds[2] || bounds[1] > bounds[3] : bounds[0] >= bounds[2] || bounds[1] >= bounds[3])) throw Error("Invalid northern visibility region");
  // A small conservative margin is only a fetch trigger, never source coverage.
  regionSet.add(JSON.stringify([Math.floor(bounds[0]) - 2, Math.floor(bounds[1]) - 2, Math.ceil(bounds[2]) + 2, Math.ceil(bounds[3]) + 2]));
};
for (const native of [false, true]) {
  const roots: Group[] = [];
  try {
    for (const factory of [createNorthSitesV306, createRailSseArchitectureV307, createHospitalArchitectureV308, createGesundbrunnenRoadBridgesV309]) roots.push(factory(native));
    for (const root of roots) root.traverse(child => {
      // An independently complete native ink group is intentionally empty.
      // Fetch bounds belong to actual renderables, never empty containers.
      if (!(child instanceof Mesh || child instanceof Line || child instanceof Points)) return;
      box.setFromObject(child, true); add([box.min.x, box.min.z, box.max.x, box.max.z], true);
    });
  } finally { for (const root of roots) disposeSurroundingCityRoot(root); }
}
for (const name of ["northParkTerrainV306", "railSseTerrainV307"]) for (const profile of JSON.parse(readFileSync(resolve(data, `${name}.json`), "utf8")).profiles) add(profile.bounds);
const packets = JSON.parse(readFileSync(resolve(data, "northernFidelityV309Packets.json"), "utf8"));
if (packets.schemaVersion !== 1 || new Set(packets.keys).size !== Object.keys(packets.packets).length || packets.keys.some((key: string) => !Object.hasOwn(packets.packets, key))) throw Error("Incomplete northern recipe catalogue");
const manifest = JSON.parse(readFileSync(resolve(import.meta.dir, "../public/mesh/surrounding-berlin-v159/manifest.json"), "utf8"));
for (const key of packets.keys as string[]) {
  const descriptor = manifest.chunks.find((chunk: {id:string}) => chunk.id === key.split(":")[1]);
  if (!descriptor) throw Error("Northern visibility tile has no complete descriptor");
  add(descriptor.bounds);
}
const regions = [...regionSet].map(text => JSON.parse(text)).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
const output = JSON.stringify({ schemaVersion: 1, keys: packets.keys, regions, sources });
writeFileSync(resolve(data, "northernFidelityV309Index.json"), output + "\n");
console.log(JSON.stringify({ regions: regions.length, keys: packets.keys.length, bytes: Buffer.byteLength(output + "\n"), sha256: createHash("sha256").update(output + "\n").digest("hex") }));
