import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as current from "../src/terrainPayload";

const source = new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url);
const payload = JSON.parse(readFileSync(source, "utf8")) as current.VoxelPayload;
const setups = [{name:"current", terrain:current, samples:[] as number[]}];
if (process.argv[2]) {
  const moduleUrl = pathToFileURL(resolve(process.argv[2])).href;
  const terrain = await import(moduleUrl) as typeof current;
  setups.unshift({name:"previous", terrain, samples:[]});
}

let fingerprint: string | undefined;
for (let round = 0; round < 24; round++) {
  // Alternate which implementation gets the first timed allocation.
  for (const setup of round%2 ? [...setups].reverse() : setups) {
    const start = performance.now();
    const mesh = setup.terrain.createGroundSlabs(payload,"Drawn ground slabs",setup.terrain.CLASS_SHADES,{bridgeDecks:true});
    const elapsed = performance.now() - start;
    if (round === 0) {
      const hash = createHash("sha256").update(mesh.instanceMatrix.array).update(mesh.instanceColor!.array).digest("hex");
      if (fingerprint && fingerprint !== hash) throw new Error("Different instance matrices or colours");
      fingerprint = hash;
      console.log(setup.name, mesh.count, "runs", hash);
    }
    if (round >= 4) setup.samples.push(elapsed);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
}
for (const {name,samples} of setups) {
  const sorted = samples.sort((a,b) => a-b);
  console.log(name, {medianMs:(sorted[9]+sorted[10])/2, q1Ms:sorted[5], q3Ms:sorted[15], count:sorted.length});
}
