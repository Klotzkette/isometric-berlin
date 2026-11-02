/** Step 10 offline-only authoring bridge; this module is outside runtime graphs. */
import { readFileSync, writeFileSync } from "node:fs";
import { stralauGeometryV299 } from "../src/StralauSisyphosV299";

if (process.argv.includes("--hash-recipes")) {
  const path = new URL("../src/data/stralauSisyphosV299Packets.json", import.meta.url);
  const source = JSON.parse(readFileSync(path, "utf8"));
  const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; };
  for (const plan of Object.values(source.packets) as any[]) {
    plan.guard = hash(JSON.stringify(plan._originalNav));
    delete plan._originalNav;
  }
  writeFileSync(path, JSON.stringify(source) + "\n");
  console.log(JSON.stringify({ plans: Object.keys(source.packets).length }));
} else for (const native of [false, true]) {
  const path = new URL(`../../../geo_data/regierungsviertel/raw/stralau-v299/${native ? "native" : "drawn"}-rows.json`, import.meta.url);
  const model = stralauGeometryV299(native);
  writeFileSync(path, JSON.stringify(model.rows));
  console.log(JSON.stringify({ native, rowCount: model.rows.length }));
}
