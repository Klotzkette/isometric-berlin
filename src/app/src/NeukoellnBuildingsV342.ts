import type {SurroundingCityChunk} from "./SurroundingCityGeometry";
import {
  captureSourceQuarterPacketV303, prepareSourceQuarterPacketV303,
  type SourceQuarterSourceV303,
} from "./SourceQuarterPacketV303";

export const NEUKOELLN_BUILDINGS_KIND_V342 = "neukoelln-buildings-v342";

/** The finite measured replacements join the existing private source-quarter
 * transaction after all earlier recipes. Its original packet words remain
 * intact; exact old owners yield only during the common geometry/nav decode.
 * No eager source import, new timer, separate index owner or residency budget. */
export function* prepareNeukoellnBuildingsV342(
  chunk: SurroundingCityChunk, id: string, native = false,
  source?: SourceQuarterSourceV303,
): Generator<void, SurroundingCityChunk> {
  if (!source || !["ring182-8_8", "ring182-8_10", "ring182-9_8"].includes(id)) return chunk;
  const ticket = yield* captureSourceQuarterPacketV303(
    chunk, id, native, true, source, NEUKOELLN_BUILDINGS_KIND_V342,
  );
  return yield* prepareSourceQuarterPacketV303(chunk, ticket);
}
