import source from "./data/quartier207V241.json";
import type { Group } from "three";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "./SurroundingCityGeometry";

/** Bounded required facade fittings; all measured bodies remain with their old owners. */
export function* addQuartier207V241(root: Group, native = false): Generator<void> {
  const packet = source[native ? "minecraft" : "drawn"] as unknown as SurroundingCityChunk & { id: string };
  const result = yield* buildSurroundingCityChunk(packet, packet.id, native);
  result.root.name = "Quartier 207: Jean Nouvel glass facade v241";
  result.root.userData.fullMobileIdentical = true;
  result.root.userData.facadeOnly = true;
  root.add(result.root);
  yield;
}
