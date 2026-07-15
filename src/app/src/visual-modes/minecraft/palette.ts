export const MINECRAFT_PALETTE = [
  0x111815, 0x202923, 0x34443a, 0x536354,
  0x74806d, 0xa4aa91, 0xd4d4b7, 0xf3efd0,
  0x4e4036, 0x715b4a, 0x927665, 0xb69b83,
  0xd2b89a, 0xe8d1ae, 0xf5e3c5, 0xfff2d8,
  0x28343d, 0x40515c, 0x63727a, 0x8e9a9e,
  0xb3bec0, 0xd6dfe0, 0xe9f2ef, 0xf7fbf7,
  0x193746, 0x24546a, 0x2f7892, 0x46a4bb,
  0x72c5d2, 0xa4dfe2, 0x243b25, 0x315d31,
  0x438343, 0x64a852, 0x8bc665, 0xb6db78,
  0x4a3326, 0x704a2d, 0x9b6738, 0xc18a4b,
  0xdbaa63, 0xf1cc81, 0x6a3428, 0x994a35,
  0xc56a45, 0xe79a61, 0xe6bd4c, 0xffdf72,
] as const;

export const MATERIAL_PALETTES = {
  concrete: [0xa4aa91, 0xd4d4b7, 0xf3efd0, 0xb3bec0],
  domeGlass: [0x63727a, 0x8e9a9e, 0xb3bec0, 0xe9f2ef],
  foliage: [0x243b25, 0x315d31, 0x438343, 0x64a852, 0x8bc665],
  glass: [0x40515c, 0x63727a, 0x8e9a9e, 0xd6dfe0],
  metal: [0x536354, 0x8e9a9e, 0xd6dfe0, 0xf7fbf7],
  path: [0x4e4036, 0x715b4a, 0x927665, 0xb69b83],
  plazaBrick: [0x6a3428, 0x994a35, 0xc56a45, 0xe79a61],
  roofCopper: [0x34443a, 0x536354, 0x74806d, 0xa4aa91],
  sandstone: [0x927665, 0xb69b83, 0xd2b89a, 0xe8d1ae, 0xf5e3c5],
  water: [0x193746, 0x24546a, 0x2f7892, 0x46a4bb, 0x72c5d2],
} as const;

function channels(color: number): [number, number, number] {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
}
export function createPaletteLutData(levels = 16): Uint8Array {
  const width = levels * levels;
  const data = new Uint8Array(width * levels * 4);
  const palette = MINECRAFT_PALETTE.map(channels);
  let offset = 0;
  for (let green = 0; green < levels; green += 1) {
    for (let blue = 0; blue < levels; blue += 1) {
      for (let red = 0; red < levels; red += 1) {
        const source = [red, green, blue].map(
          (value) => (value / (levels - 1)) * 255,
        );
        let nearest = palette[0];
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const candidate of palette) {
          const distance =
            (source[0] - candidate[0]) ** 2 +
            (source[1] - candidate[1]) ** 2 +
            (source[2] - candidate[2]) ** 2;
          if (distance < nearestDistance) {
            nearest = candidate;
            nearestDistance = distance;
          }
        }
        data[offset] = nearest[0];
        data[offset + 1] = nearest[1];
        data[offset + 2] = nearest[2];
        data[offset + 3] = 255;
        offset += 4;
      }
    }
  }
  return data;
}
