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

// Warm sandstone tint (R > G > B) shared by every facade so the whole
// Regierungsviertel reads as one coherent illustrated palette instead of a
// per-tile photo patchwork.
const WARM_TINT: Rgb = [1.0, 0.95, 0.85];
// Bright band: the darkest a facade may become is LUMA_FLOOR, the lightest
// LUMA_FLOOR + LUMA_SPAN. Nothing ever falls to black (the round-4 failure) and
// nothing blows out. Four quantised bands keep tiles snapped onto shared tones.
const LUMA_FLOOR = 0.6;
const LUMA_SPAN = 0.26;
const LUMA_BANDS = 4;

/**
 * Collapse one tile's noisy photographic average onto the shared, warm,
 * illustrated facade palette. This is the fix for the round-5 "fragmented
 * polygon mosaic": every tile was posterised on its own average and rendered
 * unlit, so dark roof photos stayed near-black and sky-reflection photos turned
 * cyan — a patchwork. Here the colour is (1) desaturated hard so blue/green/cyan
 * casts die, (2) remapped onto one of a few bright luminance bands so no tile is
 * dark and neighbours snap together, and (3) tinted warm sandstone. The result
 * is a coherent hand-painted stone tone that the day lights then shade for
 * plasticity (roofs/side faces step naturally), never a photo sample.
 */
export function harmonizeFacadeColor(rgb: Rgb): Rgb {
  const [r, g, b] = rgb.map((channel) => channel / 255) as Rgb;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // 1. Kill the chroma of the source photo (sky reflections, vegetation bleed,
  // dark shadow casts) so only a faint hint of the building's own tone remains.
  const desaturation = 0.88;
  const gr = r + (luma - r) * desaturation;
  const gg = g + (luma - g) * desaturation;
  const gb = b + (luma - b) * desaturation;
  // 2. Remap the tile luminance onto a few bright, quantised bands. Dark
  // (roof/shadow) photos land on the floor tone, not black; the palette stays
  // coherent because every tile snaps to the same handful of levels.
  const band = quantizeChannel(luma, LUMA_BANDS);
  const targetLuma = LUMA_FLOOR + LUMA_SPAN * band;
  const greyLuma = 0.2126 * gr + 0.7152 * gg + 0.0722 * gb;
  const scale = targetLuma / Math.max(greyLuma, 1e-3);
  // 3. Warm sandstone tint, clamped to a valid colour.
  const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
  return [
    clamp01(gr * scale * WARM_TINT[0]) * 255,
    clamp01(gg * scale * WARM_TINT[1]) * 255,
    clamp01(gb * scale * WARM_TINT[2]) * 255,
  ];
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
 * Replace a photogrammetric building material with a drawn facade: strip the
 * baked aerial photo texture entirely and set a single flat, harmonised
 * gouache colour derived from that texture's average (or the material's own
 * colour as a fallback). Because the tone is snapped onto the shared warm
 * palette (see {@link harmonizeFacadeColor}) and the material is then lit
 * normally in every mode, the buildings read as one coherent isometric
 * illustration — no per-tile photo mosaic, no unlit dark blocks — while the day
 * lights supply plasticity and the crisp edge pass supplies contours. Geometry
 * is never touched, so the ≤1 px hero-centre contract is unaffected.
 */
export function applyDrawnFacade(material: MeshStandardMaterial): void {
  if (material.userData.drawnFacadeApplied === true) {
    // Idempotent guard so re-entrant load/upgrade paths never double-process.
    return;
  }
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
  const [r, g, b] = harmonizeFacadeColor(base);
  // Strip the photo maps: a drawn facade is a flat painted tone, never a
  // photographic sample. Removing the map is also what guarantees the
  // no-photo-textures contract holds.
  material.map = null;
  material.emissiveMap = null;
  material.color = new Color(r / 255, g / 255, b / 255);
  // Matte, non-metallic so the day hemisphere/sun shade the flat tone into
  // clean plastic faces rather than a glossy or washed-out surface.
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
