import source from "./data/staatsbibliothekV241.json";
import type { Group } from "three";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "./SurroundingCityGeometry";

/** Required restored Linden front, paired with retained library architecture.
 * The surrounding construction transaction owns cancellation and publication.
 * Navigation and every archived measured source remain with their old owners.
 */
export function* addStaatsbibliothekV241(root: Group, native = false): Generator<void> {
  const packet = source[native ? "minecraft" : "drawn"] as unknown as SurroundingCityChunk & { id: string };
  const result = yield* buildSurroundingCityChunk(packet, packet.id, native);
  result.root.name = "Staatsbibliothek Unter den Linden: restored street front v241";
  result.root.userData.fullMobileIdentical = true;
  result.root.userData.sourceEnvelopeResident = true;
  root.add(result.root);
  yield;
}
