import source from "./data/ihzV241.json";
import type { Group } from "three";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "./SurroundingCityGeometry";

/** Bounded required facade fittings; all measured bodies remain with their old owners. */
export function* addIHZV241(root: Group, native = false): Generator<void> {
  const packet = source[native ? "minecraft" : "drawn"] as unknown as SurroundingCityChunk & { id: string };
  const result = yield* buildSurroundingCityChunk(packet, packet.id, native);
  result.root.name = "Neue IHZ and Dorotheenstrasse 33 facade refinement v241";
  result.root.userData.fullMobileIdentical = true;
  result.root.userData.facadeOnly = true;
  root.add(result.root);
  yield;
}
