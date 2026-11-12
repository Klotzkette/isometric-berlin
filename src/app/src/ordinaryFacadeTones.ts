// Display estimates for unrecorded mineral plaster, warm stone and muted
// masonry. The palette spans light limewash through deeper clay and sand.
// It is used only by existing, source-bound fallback paint paths.
export const ORDINARY_FACADE_TONES = [
  0xe1d5bf, 0xccb69a, 0xece6d8, 0xc5bfaa, 0xc4a592, 0xbcbfb6,
  0xd3bd9d, 0xd3cec0, 0xe1cbb0, 0xbba990, 0xdad7cb, 0xbba08e,
] as const;

// Keep the same family assignments as the exact historical receipts. The
// native tones stay within the fixed Minecraft architectural block palette.
const nativeWalls = [
  0xe8d1ae, 0xb69b83, 0xf3efd0, 0xd4d4b7, 0xb36f57, 0x8e9a9e,
  0xd2b17a, 0xb69b83, 0xf5e3c5, 0xc09a68, 0xd4d4b7, 0xb36f57,
] as const;
const originalWalls = [
  0xe8ddc7, 0xdcc5a6, 0xeee8d8, 0xcdd4c3, 0xddbdb3, 0xc4d1d0,
  0xe5cf9e, 0xd4d1c7, 0xe7d4bd, 0xcfc2b3, 0xdcdccf, 0xd8c4c8,
] as const;
const wallIndex = new Map<number, number>(originalWalls.map((tone, index) => [tone, index]));

/** Native tones stay within the fixed Minecraft architectural block palette. */
export function coreResidentialNativeTone(drawnTone: number, nativeTone: number): number {
  const index = wallIndex.get(drawnTone);
  return index === undefined ? nativeTone : nativeWalls[index];
}

export function coreResidentialDrawnTone(drawnTone: number): number {
  const index = wallIndex.get(drawnTone);
  return index === undefined ? drawnTone : ORDINARY_FACADE_TONES[index];
}
