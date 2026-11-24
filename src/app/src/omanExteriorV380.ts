import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import type { SourceQuarterCatalogueEntryV309 } from "./SourceQuarterCatalogueV309";

const files = {
  drawn: new URL("./data/omanExteriorV380-drawn.json.gz", import.meta.url),
  minecraft: new URL("./data/omanExteriorV380-minecraft.json.gz", import.meta.url),
};

export const omanExteriorV380: SourceQuarterCatalogueEntryV309[] = (Object.keys(files) as (keyof typeof files)[]).map(mode => ({
  keys: [mode + ":outer187--13_12"],
  kind: "oman-exterior-v380",
  load: async () => {
    const response = await fetch(files[mode]);
    if (!response.ok) throw new Error("Botschaft Oman: Gebäudepaket " + response.status);
    const wire = new Uint8Array(await response.arrayBuffer());
    return { default: JSON.parse(new TextDecoder().decode(gunzipSync(wire))) };
  },
}));
