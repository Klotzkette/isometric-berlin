import { Color, MeshStandardMaterial, type Texture } from "three";

export type Rgb = [number, number, number];

const FALLBACK_FACADE: Rgb = [176, 172, 160];

/**
 * Average an RGBA pixel buffer into a single 0–255 colour, skipping
 * near-transparent texels so cut-out edges don't drag the mean toward
 * black. Returns a neutral stone tone when the buffer is empty.
 */
export function averageColorFromPixels(pixels: ArrayLike<number>): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if (pixels[index + 3] < 8) {
      continue;
    }
    r += pixels[index];
    g += pixels[index + 1];
    b += pixels[index + 2];
    count += 1;
  }
  if (count === 0) {
    return [...FALLBACK_FACADE];
  }
  return [r / count, g / count, b / count];
}

/** Snap a 0–1 value onto one of `steps` evenly-spaced flat levels. */
export function quantizeChannel(value: number, steps: number): number {
  const levels = Math.max(2, Math.floor(steps));
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * (levels - 1)) / (levels - 1);
}

/**
 * Turn a photographic average colour into a drawn, illustrated facade
 * tone: pull it gently toward its own luminance (so photo noise reads as
 * flat paint) and posterise each channel onto a few steps. The result is
 * a hand-shaded gouache colour, never a photo sample.
 */
export function drawnFacadeColor(rgb: Rgb, steps = 6, desaturation = 0.32): Rgb {
  const [r, g, b] = rgb.map((channel) => channel / 255) as Rgb;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const mix = (channel: number): number =>
    quantizeChannel(channel + (luma - channel) * desaturation, steps);
  return [mix(r) * 255, mix(g) * 255, mix(b) * 255];
}

function sampleAverageTextureColor(texture: Texture): Rgb | null {
  const image = texture.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | undefined;
  if (!image || typeof document === "undefined") {
    return null;
  }
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  try {
    context.drawImage(image, 0, 0, size, size);
    return averageColorFromPixels(context.getImageData(0, 0, size, size).data);
  } catch {
    return null;
  }
}

/**
 * Replace a photogrammetric building material with a drawn facade: strip
 * the baked aerial photo texture, derive a flat gouache colour from that
 * texture's average (or the material's own colour as a fallback), and set
 * matte, non-metallic shading. Geometry is never touched, so the ≤1 px
 * hero-centre contract is unaffected. Called for every mesh material, in
 * every lighting mode, so no building ever shows a photo texture.
 */
export function applyDrawnFacade(material: MeshStandardMaterial): void {
  let base: Rgb | null = material.map
    ? sampleAverageTextureColor(material.map)
    : null;
  if (!base) {
    base = [
      material.color.r * 255,
      material.color.g * 255,
      material.color.b * 255,
    ];
  }
  const [r, g, b] = drawnFacadeColor(base);
  material.color = new Color(r / 255, g / 255, b / 255);
  if (material.map) {
    material.map = null;
  }
  material.emissiveMap = null;
  material.metalness = 0;
  material.roughness = Math.max(0.72, material.roughness ?? 0.8);
  material.needsUpdate = true;
}
