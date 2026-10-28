import source from "./data/mitteEnsembleV281.json";
import type { Group } from "three";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "./SurroundingCityGeometry";
import { mitteEnsembleV281Enabled } from "./mitteEnsembleV281Plan";

/** Required architectural fittings; original roofs, owners and native cells remain. */
export function* addMitteEnsembleV281(root: Group, native = false): Generator<void> {
  if (!mitteEnsembleV281Enabled()) return;
  const packet = source[native ? "minecraft" : "drawn"] as unknown as SurroundingCityChunk & { id: string };
  const result = yield* buildSurroundingCityChunk(packet, packet.id, native);
  result.root.name = "Ensemble courtyard, Ganymed and Dorotheenstrasse 35/37 v281";
  result.root.userData.fullMobileIdentical = true;
  result.root.userData.facadeOnly = true;
  root.add(result.root);
  yield;
}
