// 28 colours: deliberately coarse so quantisation reads as discrete
// Minecraft blocks. Grouped by family — stone-grey, sandstone-cream,
// concrete-white, glass-teal, roof-copper (kept varied so Reichstag dome
// and Chancellery stay distinct at zoom-out), water-blue, foliage-green,
// path-asphalt, plaza-brick, dome-glass highlight, metallic-copper
// highlight, grass-green, dirt-brown, tent-canvas.
export const MINECRAFT_PALETTE = [
  // asphalt + outline darks
  0x111815, 0x202923,
  // roof-copper family (oxidised dark -> light -> metallic highlight)
  0x34443a, 0x74806d, 0xa4aa91, 0xe79a61,
  // concrete
  0xd4d4b7, 0xf3efd0,
  // path + sandstone + tent canvas
  0x715b4a, 0xb69b83, 0xe8d1ae, 0xf5e3c5,
  // stone-grey + glass + dome-glass highlight
  0x40515c, 0x8e9a9e, 0xd6dfe0, 0xf7fbf7,
  // water-blue + glass-teal
  0x24546a, 0x2f7892, 0x72c5d2, 0xa4dfe2,
  // foliage + grass
  0x315d31, 0x438343, 0x64a852, 0x8bc665,
  // dirt-brown + metallic copper + plaza-brick + marquee gold
  0x704a2d, 0xc18a4b, 0x994a35, 0xe6bd4c,
] as const;

export const MATERIAL_PALETTES = {
  concrete: [0xa4aa91, 0xd4d4b7, 0xf3efd0, 0xd6dfe0],
  domeGlass: [0x8e9a9e, 0xd6dfe0, 0xf7fbf7, 0xa4dfe2],
  foliage: [0x315d31, 0x438343, 0x64a852, 0x8bc665],
  glass: [0x40515c, 0x8e9a9e, 0x72c5d2, 0xd6dfe0],
  metal: [0x74806d, 0x8e9a9e, 0xd6dfe0, 0xf7fbf7],
  path: [0x202923, 0x715b4a, 0xb69b83],
  plazaBrick: [0x994a35, 0xc18a4b, 0xe79a61],
  roofCopper: [0x34443a, 0x74806d, 0xa4aa91, 0xe79a61],
  sandstone: [0xb69b83, 0xe8d1ae, 0xf5e3c5],
  water: [0x24546a, 0x2f7892, 0x72c5d2, 0xa4dfe2],
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
