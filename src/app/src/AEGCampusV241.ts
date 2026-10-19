import source from "./data/aegCampusV241.json";
import type { Group } from "three";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "./SurroundingCityGeometry";

/** Complete source shells, separate orthogonal native geometry, identical mobile detail. */
export function* addAEGCampusV241(root: Group, native = false): Generator<void> {
  for (const raw of source[native ? "minecraft" : "drawn"]) {
    const packet = raw as unknown as SurroundingCityChunk & { id: string };
    const result = yield* buildSurroundingCityChunk(packet, packet.id, native);
    result.root.name = packet.id;
    result.root.userData.fullMobileIdentical = true;
    result.root.userData.completeSourceShell = true;
    root.add(result.root);
    yield;
  }
}
