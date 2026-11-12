import {
  coreHousePaintV273,
  exactCoreHouseRow,
  type CoreHousePartV273,
} from "./CoreHouseColoursV273";
import unpainted from "./data/coreFacadeFallback.json";
import { coreResidentialDrawnTone, ORDINARY_FACADE_TONES } from "./ordinaryFacadeTones";

/** Drawn-only lookup for the source parts without an overview colour. It does
 * not join the native column-ownership or roof-allocation lookup. */
export function coreResidentialFacadeTone(part: CoreHousePartV273): number | undefined {
  if (part.tone) {
    const paint = coreHousePaintV273(part);
    return paint ? coreResidentialDrawnTone(paint[2]) : undefined;
  }
  if (!part.id) return;
  const rows = (unpainted as unknown as Readonly<Record<string, readonly number[][]>>)[part.id];
  const row = exactCoreHouseRow(part, rows?.[0], rows);
  return row ? ORDINARY_FACADE_TONES[row[2]] : undefined;
}
