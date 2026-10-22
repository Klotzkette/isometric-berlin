import { Color } from "three";
import { genericFacadeIndex } from "./cityColourV184";

type Rgb = readonly [number, number, number];
type Palette = { wall: Rgb; roof: Rgb };
const linear = (hex: number): Rgb => new Color(hex).toArray().map(value => Math.round(value * 255)) as [number, number, number];

// Unknown-material display estimates, not per-house paint observations. Keep
// warm ochre, muted clay and cool stone alongside ivory instead of giving every
// eighth ordinary owner conspicuously pink, cyan or green fallback plaster.
export const OUTER_HOUSE_FACADE_SWATCHES_V262 = [
  0xd0c6b2, 0xbfae98, 0xe1dbc9, 0xb9beb1,
  0xc7b6aa, 0xb6bdba, 0xcbb88e, 0xc1bfb3,
] as const;
// A separate, darker fallback cap. A warm tone does not assert brick tiles or
// a pitched roof; measured roof forms and mapped material receipts still win.
export const OUTER_HOUSE_ROOF_SWATCHES_V262 = [
  0x77746c, 0x81756a, 0x6e7473, 0x8b7567,
  0x777d77, 0x8c8172, 0x786c63, 0x858584,
] as const;
const walls = OUTER_HOUSE_FACADE_SWATCHES_V262.map(linear);
const roofs = OUTER_HOUSE_ROOF_SWATCHES_V262.map(linear);
const palettes: Palette[][] = walls.map(wall => roofs.map(roof => ({ wall, roof })));

/** Shared immutable values only; no new vertex storage or retained owner map. */
export function outerHousePaletteV262(sourceId: string): Palette {
  let hash = 2166136261;
  for (let i = 0; i < sourceId.length; i++) hash = Math.imul(hash ^ sourceId.charCodeAt(i), 16777619);
  // Upper bits avoid coupling every wall family to one repeated roof colour.
  return palettes[genericFacadeIndex(sourceId)][(hash >>> 16) & 7];
}

/** Only retained primary ordinary-building packet identities. Source-colour,
 * unique-corner and mesh-kind guards remain in the surrounding decoder. */
export function refineOuterHousePaletteV262(id: string): boolean {
  return /^(?:(?:ring182|city183|outer187|north190|east200|marzahn230)-)?-?\d+_-?\d+$/.test(id);
}
