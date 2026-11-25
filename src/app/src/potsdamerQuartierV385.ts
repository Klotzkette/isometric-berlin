import { Group } from "three";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { createPotsdamerForecourtsV385 } from "./potsdamerForecourtsV385";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";

export async function attachPotsdamerQuartierV385(entry: SurroundingChunkGeometry, id: string, native: boolean, signal: AbortSignal) {
  if (entry.root.userData.potsdamerQuartierV385 || (id !== "0_1" && (id !== "0_2" || !native))) return;
  signal.throwIfAborted();
  const [ritz, offices, canada, wall] = await Promise.all([
    id === "0_1" ? import("./RitzPortalsV385") : undefined,
    native && id === "0_1" ? import("./EbertstrasseOfficesV385") : undefined,
    native && id === "0_1" ? import("./LeipzigerPublicFrontsV385") : undefined,
    native ? import("./potsdamerNativeWallV385") : undefined,
  ]);
  signal.throwIfAborted();
  if (entry.root.userData.potsdamerQuartierV385) return;
  const part = new Group();
  part.name = "Potsdamer und Leipziger Platz";
  part.userData = { nativeMinecraft: native, keepInMinecraft: native };
  if (ritz) part.add(ritz.createRitzPortalsV385(native));
  if (id === "0_1") part.add(createPotsdamerForecourtsV385(native));
  if (offices) part.add(offices.createNativeEbertstrasseOffices());
  if (canada) part.add(canada.createCanadianPublicFrontsV385(true));
  const wallExhibits = wall?.createNativePotsdamerWallExhibits(id);
  if (wallExhibits) part.add(wallExhibits);
  attachWorldSpaceDetail(entry, part);
  entry.root.userData.potsdamerQuartierV385 = true;
}
