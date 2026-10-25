import { Color } from "three";

type Rgb = readonly [number, number, number];
type Palette = { wall: Rgb; roof: Rgb };
const linear = (hex: number): Rgb => new Color(hex).toArray().map(v => Math.round(v * 255)) as [number, number, number];

// Contextual estimates for unknown default plaster only, never observations of
// individual houses. Separate cap colours retain each measured roof's geometry.
export const PRIMARY_WALL_SWATCHES_V273 = [
  0xe8ddc7, 0xdcc5a6, 0xeee8d8, 0xcdd4c3, 0xddbdb3, 0xc4d1d0,
  0xe5cf9e, 0xd4d1c7, 0xe7d4bd, 0xcfc2b3, 0xdcdccf, 0xd8c4c8,
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
