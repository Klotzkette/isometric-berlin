import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Material,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

export type BankMasonryV370 = "brick" | "stone" | "mixed-masonry" | "setts";

// Four bricks in each row, four courses per tile. Coordinates on the bank are in metres.
export const masonryTileMetresV370: Record<BankMasonryV370, readonly [number, number]> = {
  brick: [1.08, 0.34],
  stone: [2.48, 1.08],
  "mixed-masonry": [2.04, 0.88],
  setts: [0.68, 0.56],
};
const swatches: Record<BankMasonryV370, { face: number[][]; joint: number[] }> = {
  brick: {
    face: [
      [139, 86, 68],
      [154, 96, 73],
      [147, 89, 68],
      [134, 79, 64],
      [158, 104, 82],
    ],
    joint: [177, 156, 137],
  },
  stone: {
    face: [
      [138, 140, 131],
      [147, 145, 136],
      [134, 138, 133],
      [149, 147, 138],
    ],
    joint: [101, 102, 94],
  },
  "mixed-masonry": {
    face: [
      [138, 132, 115],
      [156, 144, 124],
      [128, 130, 118],
      [151, 137, 121],
      [131, 115, 103],
    ],
    joint: [103, 100, 88],
  },
  setts: {
    face: [
      [147, 147, 138],
      [157, 155, 145],
      [140, 141, 134],
      [150, 145, 137],
    ],
    joint: [109, 111, 105],
  },
};
const pixels = new Map<BankMasonryV370, Uint8Array>();

/** Shared immutable CPU pixels; independent GPU lifetimes for separately evicted tiles. */
export function waterwayMasonryMapV370(kind: BankMasonryV370): DataTexture {
  const w = 64,
    h = 32;
  let rgba = pixels.get(kind);
  if (!rgba) {
    rgba = new Uint8Array(w * h * 4);
    const palette = swatches[kind];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const row = y >> 3;
        const shifted = (x + (row % 2) * 8) % w;
        const unit = shifted >> 4;
        const joint = y % 8 === 0 || shifted % 16 === 0;
        const rgb = joint
          ? palette.joint
          : palette.face[(row * 7 + unit * 3 + (row ^ unit)) % palette.face.length];
        const grain = ((13 * x + 7 * y + x * y) % 7) - 3;
        const offset = (y * w + x) * 4;
        for (let k = 0; k < 3; k++) rgba[offset + k] = rgb[k] + grain;
        rgba[offset + 3] = 255;
      }
    pixels.set(kind, rgba);
  }
  const texture = new DataTexture(rgba, w, h);
  texture.name = `Waterway bank ${kind} courses v370`;
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** The viewer also disposes textures during permanent scene retirement. */
export function ownBankMasonryMapV370(texture: DataTexture, day: Material, night: Material): void {
  const materials = new Set([day, night]);
  let owners = materials.size,
    disposed = false;
  texture.addEventListener("dispose", () => {
    disposed = true;
  });
  for (const material of materials) {
    const retire = () => {
      material.removeEventListener("dispose", retire);
      if (--owners === 0 && !disposed) texture.dispose();
    };
    material.addEventListener("dispose", retire);
  }
}
