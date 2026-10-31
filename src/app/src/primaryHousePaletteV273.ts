import { Color } from "three";

type Rgb = readonly [number, number, number];
type Palette = { wall: Rgb; roof: Rgb };
const linear = (hex: number): Rgb => new Color(hex).toArray().map(v => Math.round(v * 255)) as [number, number, number];

// Contextual estimates for unknown default plaster only, never observations of
// individual houses. v288 keeps twelve stable choices but mutes the former pink,
// cyan and green fallback families into ordinary plaster/limestone/stone tones.
// Exact mapped material receipts still run after this fallback; no source or
// individually authored colour is classified by resemblance to these swatches.
// Separate cap colours retain each measured roof's geometry.
export const PRIMARY_WALL_SWATCHES_V273 = [
  0xe0d8c9, 0xd1c3ae, 0xe8e3d8, 0xc9c9bf, 0xcec0b4, 0xc2c6c3,
  0xd7c69e, 0xcdcbc2, 0xd9cdbb, 0xc5bbac, 0xd5d5ca, 0xc7bfba,
] as const;
export const PRIMARY_ROOF_SWATCHES_V273 = [
  0x7b6961, 0x8e7165, 0x6b7376, 0x8f6953,
  0x68716b, 0x9b7e6d, 0x665f58, 0x838282,
] as const;
const roofs = PRIMARY_ROOF_SWATCHES_V273.map(linear);
const palettes: Palette[][] = PRIMARY_WALL_SWATCHES_V273.map(hex => {
  const wall = linear(hex);
  return roofs.map(roof => ({ wall, roof }));
});

/** Stable across packet boundaries; shared values, no retained source-ID map. */
export function primaryHousePaletteV273(sourceId: string): Palette {
  let hash = 2166136261;
  for (let i = 0; i < sourceId.length; i++) hash = Math.imul(hash ^ sourceId.charCodeAt(i), 16777619);
  return palettes[(hash >>> 0) % palettes.length][(hash >>> 16) & 7];
}
