import {
  CanvasTexture,
  Color,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  NearestFilter,
  type Texture,
} from "three";

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

/**
 * Whether a material should get the drawn flat-facade treatment. Only opaque
 * building/ground facades qualify. Vegetation and other cut-out cards carve
 * their shape out of an alpha channel (alphaTest, alphaMap, or blended
 * transparency); stripping their texture turns a leaf card into a solid quad
 * filled with a sky-averaged light-blue tone — the "trees vanish / flat
 * light-blue fill" regression from v0.5.6. Those keep their textures.
 */
export function isDrawnFacadeCandidate(material: MeshStandardMaterial): boolean {
  if (material.transparent) {
    return false;
  }
  if ((material.alphaTest ?? 0) > 0) {
    return false;
  }
  if (material.alphaMap) {
    return false;
  }
  return true;
}

function luminance255(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Turn a photographic facade texture into a rendered architectural drawing:
 * posterise every texel onto a few flat gouache tones (so the photo noise and
 * soft gradients that read as "pastös" collapse into clean paint), then ink in
 * thin dark lines wherever the photo has a strong luminance edge — window
 * frames, cornices, storey divisions. The window grid and facade articulation
 * survive as a drawn suggestion, but no photographic detail does. Pure and
 * DOM-free so it can be unit-tested on a raw RGBA buffer.
 */
export function stylizeFacadePixels(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  options?: {
    steps?: number;
    edgeStrength?: number;
    desaturation?: number;
    edgeLow?: number;
    edgeHigh?: number;
  },
): Uint8ClampedArray {
  // Drawing defaults: a few flat gouache tones plus ink lines *only* on real
  // structural edges. Round-3 inked with far too low a threshold (0.05) at high
  // strength (0.92): a photographic facade has micro-gradients almost
  // everywhere, so nearly every texel got darkened to near-black, leaving only
  // smooth window panes light. The high threshold band here keeps brick/stone
  // noise untouched and only draws window frames, cornices and storey lines,
  // so ink coverage stays low and the facade keeps its own brightness.
  const steps = options?.steps ?? 4;
  const edgeStrength = options?.edgeStrength ?? 0.7;
  const desaturation = options?.desaturation ?? 0.35;
  const edgeLow = options?.edgeLow ?? 0.14;
  const edgeHigh = options?.edgeHigh ?? 0.4;
  const out = new Uint8ClampedArray(width * height * 4);
  const lum = new Float32Array(width * height);
  for (let i = 0, p = 0; p < width * height; i += 4, p += 1) {
    lum[p] = luminance255(pixels[i], pixels[i + 1], pixels[i + 2]);
  }
  const at = (x: number, y: number): number => {
    const cx = Math.min(width - 1, Math.max(0, x));
    const cy = Math.min(height - 1, Math.max(0, y));
    return lum[cy * width + cx];
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const poster = drawnFacadeColor(
        [pixels[index], pixels[index + 1], pixels[index + 2]],
        steps,
        desaturation,
      );
      // Sobel luminance gradient → ink lines along facade edges.
      const gx =
        at(x - 1, y - 1) +
        2 * at(x - 1, y) +
        at(x - 1, y + 1) -
        at(x + 1, y - 1) -
        2 * at(x + 1, y) -
        at(x + 1, y + 1);
      const gy =
        at(x - 1, y - 1) +
        2 * at(x, y - 1) +
        at(x + 1, y - 1) -
        at(x - 1, y + 1) -
        2 * at(x, y + 1) -
        at(x + 1, y + 1);
      const magnitude = Math.min(1, Math.sqrt(gx * gx + gy * gy) / (4 * 255));
      // Threshold + ramp so even moderate window/cornice edges become bold,
      // clearly visible dark lines instead of a faint tint.
      const t = Math.min(
        1,
        Math.max(0, (magnitude - edgeLow) / Math.max(1e-6, edgeHigh - edgeLow)),
      );
      const ink = 1 - t * edgeStrength;
      out[index] = poster[0] * ink;
      out[index + 1] = poster[1] * ink;
      out[index + 2] = poster[2] * ink;
      out[index + 3] = pixels[index + 3];
    }
  }
  return out;
}

function drawnFacadeTexture(source: Texture): Texture | null {
  const image = source.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | undefined;
  if (!image || typeof document === "undefined") {
    return null;
  }
  const maxDim = 192;
  const sourceWidth = (image as { width?: number }).width ?? maxDim;
  const sourceHeight = (image as { height?: number }).height ?? maxDim;
  const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  try {
    context.drawImage(image, 0, 0, width, height);
    const source2d = context.getImageData(0, 0, width, height);
    source2d.data.set(stylizeFacadePixels(source2d.data, width, height));
    context.putImageData(source2d, 0, 0);
  } catch {
    return null;
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = source.colorSpace;
  texture.wrapS = source.wrapS;
  texture.wrapT = source.wrapT;
  texture.flipY = source.flipY;
  texture.anisotropy = source.anisotropy;
  // Nearest magnification keeps the few flat tones and ink lines crisp up close
  // (a drawing, not a smoothly-interpolated photo); mipmapped minification keeps
  // distant facades calm without reblending the tones into a photo gradient.
  texture.magFilter = NearestFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
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
  if (material.userData.drawnFacadeApplied === true) {
    // Idempotent: never re-stylise an already-drawn map (that would double the
    // ink and posterise the posterised tones), so re-entrant load/upgrade paths
    // are safe.
    return;
  }
  const drawnMap = material.map ? drawnFacadeTexture(material.map) : null;
  if (drawnMap) {
    // Keep a stylised architectural drawing of the facade — posterised tones
    // plus inked window/cornice lines — so buildings read as a rendered
    // isometric drawing rather than a single flat "pastös" blob. The map is a
    // drawing, never the photo, so the no-photo-textures contract holds. Colour
    // is neutral white so the drawn map shows through untinted.
    material.map = drawnMap;
    material.color = new Color(1, 1, 1);
  } else {
    // No 2D canvas (tests/SSR) or no source texture: fall back to a single flat
    // gouache tone derived from the texture average (or the material colour).
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
    material.map = null;
  }
  // Matte, non-metallic. The photo look is removed by rendering the facade
  // unlit in day mode (see applyMaterialLighting) rather than by stripping the
  // PBR surface maps here — that keeps the praised night presentation, which
  // still lights the drawn map, exactly as before. The contract flag marks the
  // material as drawn for the unlit day switch and the release invariant.
  material.emissiveMap = null;
  material.metalness = 0;
  material.roughness = Math.max(0.72, material.roughness ?? 0.8);
  material.userData.drawnFacadeApplied = true;
  material.needsUpdate = true;
}

/**
 * Contract check for the "no building shows a photo" invariant. A material
 * satisfies the drawn-facade contract when it is either a non-candidate
 * (vegetation/cut-out card, exempt) or a candidate that has been stylised
 * (flag set by {@link applyDrawnFacade}). Used by tests and can be called after
 * any load/upgrade path to assert no unstylised photo facade slipped through.
 */
export function isDrawnFacadeSatisfied(material: MeshStandardMaterial): boolean {
  if (!isDrawnFacadeCandidate(material)) {
    return true;
  }
  return material.userData.drawnFacadeApplied === true;
}
