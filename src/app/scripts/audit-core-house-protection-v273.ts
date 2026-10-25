/** Freeze the resolved authored registries, including IDs supplied by imports. */
import { readFileSync, writeFileSync } from "node:fs";
import {
  HERO_PRISM_TONES,
  HERO_PRISM_ROOF_TONES,
  PRISM_SUPPRESSED_IDS,
  PRISM_GLASSED_IDS,
} from "../src/IsometricCityWorld";

const registries = {
  HERO_PRISM_TONES: Object.keys(HERO_PRISM_TONES).sort(),
  HERO_PRISM_ROOF_TONES: Object.keys(HERO_PRISM_ROOF_TONES).sort(),
  PRISM_SUPPRESSED_IDS: [...PRISM_SUPPRESSED_IDS].sort(),
  PRISM_GLASSED_IDS: [...PRISM_GLASSED_IDS].sort(),
};
const source = new URL("../src/IsometricCityWorld.ts", import.meta.url);
const output = new URL("../../../geo_data/regierungsviertel/core-house-colours-v273-protected.json", import.meta.url);
const result = {
  schemaVersion: 1,
  policy: "Resolved existing authored facade, roof, replacement and glass owners; protect complete source families before selecting ordinary unobserved residential paint.",
  source: "src/app/src/IsometricCityWorld.ts",
  sourceSha256: new Bun.CryptoHasher("sha256").update(readFileSync(source)).digest("hex"),
  registries,
  ids: [...new Set(Object.values(registries).flat())].sort(),
};
writeFileSync(output, `${JSON.stringify(result)}\n`);
console.log(`Resolved ${result.ids.length} authored core identities; no scene constructed.`);
