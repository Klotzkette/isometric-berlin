import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import type { SourceQuarterCatalogueEntryV309 } from "./SourceQuarterCatalogueV309";

const files = {
  drawn: new URL("./data/rykeStreetHouseV381-drawn.json.gz", import.meta.url),
  minecraft: new URL("./data/rykeStreetHouseV381-minecraft.json.gz", import.meta.url),
};

export const rykeStreetHouseV381: SourceQuarterCatalogueEntryV309[] = (Object.keys(files) as (keyof typeof files)[]).map(mode => ({
  keys: [mode + ":6_-4"],
  kind: "ryke-street-house-v381",
  load: async () => {
    const response = await fetch(files[mode]);
    if (!response.ok) throw new Error("Vorderhaus Rykestraße, Gebäudepaket " + response.status);
    const wire = new Uint8Array(await response.arrayBuffer());
    return { default: JSON.parse(new TextDecoder().decode(gunzipSync(wire))) };
  },
}));
