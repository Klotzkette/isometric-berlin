import source from "./data/requiredMitteV239.json";
import type { Group } from "three";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "./SurroundingCityGeometry";

/** Complete measured owners are attached before city readiness. Packed source
 * data is constructor-only and can be collected after synchronous GPU upload. */
export function* addRequiredMitteV239(root: Group, native = false): Generator<void> {
  const packets = source[native ? "minecraft" : "drawn"] as unknown as (SurroundingCityChunk & { id: string })[];
  for (const packet of packets) {
    const result = yield* buildSurroundingCityChunk(packet, packet.id, native);
    result.root.name = `Required Mitte v239: ${packet.id}`;
    root.add(result.root);
    yield;
  }
}
