/** Offline exact JS navigation guards; never imported by production graphs. */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { prepareStreetCurvesV276 } from "../src/streetCurvesV276";
const sourcePath = new URL("../src/data/westKiezV302.json", import.meta.url);
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const dir = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));
const evidencePath = new URL("../../../geo_data/regierungsviertel/west-kiez-v302-packets-evidence.json.gz", import.meta.url);
const evidence = JSON.parse(gunzipSync(readFileSync(evidencePath)).toString());
const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0; return h; };
for (const [key, plan] of Object.entries(source.packets) as [string, any][]) {
  const [mode, id] = key.split(":"), descriptor = manifest.chunks.find((c: any) => c.id === id);
  const packet = JSON.parse(gunzipSync(readFileSync(new URL(descriptor[mode].url, dir))).toString());
  plan.navGuard = hash(JSON.stringify(packet.nav));
  const generator = prepareStreetCurvesV276(packet, id, mode === "minecraft");
  let next = generator.next(); while (!next.done) next = generator.next();
  const prepared = hash(JSON.stringify(next.value.nav));
  const expected = key === "drawn:-3_6" ? 2831834486 : key === "drawn:-2_6" ? 1269267644 : plan.navGuard;
  if (prepared !== expected) throw Error(`Unexpected original StreetCurvesV276 navigation at ${key}`);
  if (prepared !== plan.navGuard) plan.preparedNavGuard = prepared;
  else delete plan.preparedNavGuard;
  const receipt = evidence.packets.find((p: { key: string }) => p.key === key);
  if (!receipt) throw Error(`Missing original packet evidence ${key}`);
  receipt.rawNavGuard = plan.navGuard;
  if (prepared !== plan.navGuard) { receipt.preparedNavGuard = prepared; receipt.preparedNavPreparer = "prepareStreetCurvesV276"; }
  else { delete receipt.preparedNavGuard; delete receipt.preparedNavPreparer; }
}
writeFileSync(sourcePath, JSON.stringify(source) + "\n");
writeFileSync(evidencePath, gzipSync(JSON.stringify(evidence) + "\n", { level: 9 }));
console.log(JSON.stringify({ plans: source.keys.length }));
