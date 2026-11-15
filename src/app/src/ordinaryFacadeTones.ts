// Display estimates for unrecorded mineral plaster, warm stone and muted
// masonry. Restrained mineral tones avoid peach/green fallback bands; the
// stable family assignments still span limewash, stone and muted clay.
// It is used only by existing, source-bound fallback paint paths.
export const ORDINARY_FACADE_TONES = [
  0xded8cb, 0xc7bbab, 0xe9e5dc, 0xc1beb4, 0xbdaea3, 0xb9bcb7,
  0xccc0ad, 0xd0cdc4, 0xdbceba, 0xb8ae9f, 0xd6d4cc, 0xb5a79b,
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
