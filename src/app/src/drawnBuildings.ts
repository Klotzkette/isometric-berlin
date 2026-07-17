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

/**
 * Per-channel median of the opaque texels. The median is the dominant real
 * colour of the facade: unlike the mean it is not dragged toward black by a few
 * dark window/shadow texels or toward cyan by a stray sky-reflection texel, so
 * it reports the building's actual material colour ("so wie es ist"). Falls
 * back to a neutral stone tone for an empty buffer.
 */
export function medianColorFromPixels(pixels: ArrayLike<number>): Rgb {
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if (pixels[index + 3] < 8) {
      continue;
    }
    reds.push(pixels[index]);
    greens.push(pixels[index + 1]);
    blues.push(pixels[index + 2]);
  }
  if (reds.length === 0) {
    return [...FALLBACK_FACADE];
  }
  const median = (values: number[]): number => {
    values.sort((a, b) => a - b);
    const mid = values.length >> 1;
    return values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid];
  };
  return [median(reds), median(greens), median(blues)];
}

/** Snap a 0–1 value onto one of `steps` evenly-spaced flat levels. */
export function quantizeChannel(value: number, steps: number): number {
  const levels = Math.max(2, Math.floor(steps));
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * (levels - 1)) / (levels - 1);
}

// The day facade keeps the building's OWN colour (round-6: no global recolour).
// The dominant photo colour is only lightly cleaned so it reads as a flat
// illustrated tone rather than a photo, while staying unmistakably the real
// building: a moderate desaturation calms JPEG chroma noise and sky/vegetation
// bleed without changing the hue, and a gentle shadow lift keeps every facade
// readable (never black) without washing bright buildings out.
const DESATURATION = 0.3;
const LIFT_GAMMA = 0.78;
const MIN_LUMA = 0.48;
const MAX_LUMA = 0.82;

/**
 * Clean a facade's dominant real colour into a single flat illustrated tone,
 * preserving its hue. This replaces the round-5 global warm-sandstone palette:
 * every building now carries its own colour ("wie sie sind") — Reichstag
 * sandstone stays sandstone, a glass tower stays cool, white stone stays white.
 * The tone is (1) moderately desaturated toward its own luminance so photo
 * noise/chroma bleed dies but the hue survives, and (2) shadow-lifted by a
 * gentle gamma so dark facades become readable mid tones without blowing out
 * bright ones. It is rendered UNLIT (see applyDrawnFacade / applyMaterialLighting)
 * so each face is one absolutely uniform colour — no lighting gradient, no
 * blob-shadows from the lumpy photogrammetry.
 */
export function dominantFacadeColor(rgb: Rgb): Rgb {
  let [r, g, b] = rgb.map((channel) => channel / 255) as Rgb;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  r = r + (luma - r) * DESATURATION;
  g = g + (luma - g) * DESATURATION;
  b = b + (luma - b) * DESATURATION;
  const lifted = Math.min(
    MAX_LUMA,
    Math.max(MIN_LUMA, Math.pow(luma, LIFT_GAMMA)),
  );
  const scale = lifted / Math.max(luma, 1e-3);
  const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
  return [
    clamp01(r * scale) * 255,
    clamp01(g * scale) * 255,
    clamp01(b * scale) * 255,
  ];
}

/** Linear blend of two colours, 0 = keep `color`, 1 = fully `anchor`. */
export function blendTowardAnchor(color: Rgb, anchor: Rgb, amount: number): Rgb {
  const t = Math.min(1, Math.max(0, amount));
  return [
    color[0] + (anchor[0] - color[0]) * t,
    color[1] + (anchor[1] - color[1]) * t,
    color[2] + (anchor[2] - color[2]) * t,
  ];
}

// Curated real-colour anchors for the hand-checked hero landmarks, keyed by the
// hero-detail id in scene.json. The extracted per-material colour is nudged
// toward these so recognisability is guaranteed even if a material segment's
// photo sample is contaminated: Reichstag = warm sandstone, Bundeskanzleramt =
// near-white with cool grey, Hauptbahnhof = cool steel/glass. Per-material
// variation survives the blend (roof vs wall segments stay distinct); only the
// overall colour family is pinned. The Schweizerische Botschaft lives only in a
// shared base-tile atlas (no separate mesh id), so it relies on the natural
// dominant-colour extraction — light natural stone falls out of that directly.
export const HERO_FACADE_ANCHORS: Record<string, Rgb> = {
  reichstag: [214, 200, 170],
  bundeskanzleramt: [227, 226, 222],
  hauptbahnhof: [198, 209, 218],
};
const HERO_ANCHOR_BLEND = 0.55;

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

function sampleDominantTextureColor(texture: Texture): Rgb | null {
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
    return medianColorFromPixels(context.getImageData(0, 0, size, size).data);
  } catch {
    return null;
  }
}

// Minimal shape of the shader object three hands to onBeforeCompile that we
// need to touch: the uniform bag and the fragment source string.
type PatchableShader = {
  uniforms: Record<string, { value: number }>;
  fragmentShader: string;
};

/**
 * Patch a MeshStandardMaterial so it can render UNLIT on demand while keeping
 * its real albedo (per-vertex colour or a flat tone). The building meshes in
 * this scene are photogrammetric with baked per-vertex colours and NO texture
 * map, so the old "strip the map, drive a flat tone through emissive, force
 * colour black" trick destroyed their real colour (a black diffuse zeroes the
 * vertex-colour multiply) and collapsed every building to one uniform tone.
 *
 * Instead we leave the diffuse albedo intact and, when `uFlatUnlit` is on,
 * short-circuit the physical lighting: the fragment outputs the albedo directly
 * (plus emissive) so every face is one absolutely flat tone — no directional
 * shading, no hemisphere gradient, no blob-shadow from the lumpy geometry —
 * while each building keeps its own real colour ("so wie sie sind"). When
 * `uFlatClean` is on the albedo is first moderately desaturated toward its own
 * luminance and shadow-lifted, so baked photo noise/shadow calms into a clean
 * illustrated tone without changing hue. The toggle is a uniform, not a define,
 * so day/night/minecraft switches never recompile and stay lossless. Night and
 * minecraft simply set `uFlatUnlit = 0` and the material lights normally.
 */
export function installFlatUnlitShader(material: MeshStandardMaterial): void {
  if (material.userData.flatUnlitInstalled === true) {
    return;
  }
  material.userData.flatUnlitInstalled = true;
  if (material.userData.flatUnlit === undefined) {
    material.userData.flatUnlit = 0;
  }
  if (material.userData.flatClean === undefined) {
    material.userData.flatClean = 0;
  }
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    const patchable = shader as unknown as PatchableShader;
    patchable.uniforms.uFlatUnlit = {
      value: (material.userData.flatUnlit as number) ?? 0,
    };
    patchable.uniforms.uFlatClean = {
      value: (material.userData.flatClean as number) ?? 0,
    };
    // Keep a handle to the live shader so the mode switch can flip the uniform
    // without a recompile.
    material.userData.flatShader = patchable;
    patchable.fragmentShader =
      "uniform float uFlatUnlit;\nuniform float uFlatClean;\n" +
      patchable.fragmentShader.replace(
        "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
        `vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
        if ( uFlatUnlit > 0.5 ) {
          vec3 flatAlbedo = diffuseColor.rgb;
          if ( uFlatClean > 0.5 ) {
            float flatLuma = dot( flatAlbedo, vec3( 0.2126, 0.7152, 0.0722 ) );
            flatAlbedo = mix( vec3( flatLuma ), flatAlbedo, 0.72 );
            flatAlbedo = pow( clamp( flatAlbedo, 0.0, 1.0 ), vec3( 0.82 ) );
            // Lift the darkest facades (e.g. near-black roofs) off pure black
            // into a readable dark grey so no face reads as an empty hole,
            // without dimming bright stone/glass.
            flatAlbedo = vec3( 0.18 ) + flatAlbedo * 0.82;
          }
          outgoingLight = flatAlbedo + totalEmissiveRadiance;
        }`,
      );
  };
  material.needsUpdate = true;
}

/** Flip the unlit toggle live (day = unlit flat, night/minecraft = lit). */
export function setFlatUnlit(
  material: MeshStandardMaterial,
  unlit: boolean,
): void {
  const value = unlit ? 1 : 0;
  material.userData.flatUnlit = value;
  const shader = material.userData.flatShader as PatchableShader | undefined;
  if (shader?.uniforms.uFlatUnlit) {
    shader.uniforms.uFlatUnlit.value = value;
  }
}

/**
 * Turn a photogrammetric building material into a drawn facade. Two real
 * material kinds exist in this scene:
 *
 *  - **Vertex-coloured** (the base/detail tiles): no texture map, real colour
 *    baked per vertex. We KEEP the vertex colours (albedo = white × vertexColor)
 *    and only enable the clean-up pass; the flat-unlit shader renders them as
 *    flat real-colour faces. Forcing a flat single tone here would throw away
 *    the building's actual colour, so we never do that.
 *  - **Textured** (rare hero segments that carry a baked photo `map`): we strip
 *    the photo and collapse it to a single flat tone equal to its dominant real
 *    colour (see {@link dominantFacadeColor}), optionally nudged toward a
 *    curated hero anchor. A flat tone is correct here because the alternative is
 *    a photographic sample, which the no-photo contract forbids.
 *
 * Either way the material is rendered UNLIT in day mode (see the flat-unlit
 * shader / applyMaterialLighting): every face is one uniform tone with no
 * lighting gradient or blob-shadow; the crisp edge pass supplies the clean
 * isometric outline. Geometry is never touched (≤1 px hero-centre).
 */
export function applyDrawnFacade(
  material: MeshStandardMaterial,
  options?: { anchor?: Rgb },
): void {
  if (material.userData.drawnFacadeApplied === true) {
    // Idempotent guard so re-entrant load/upgrade paths never double-process.
    return;
  }
  installFlatUnlitShader(material);
  material.metalness = 0;
  material.roughness = Math.max(0.72, material.roughness ?? 0.8);

  if (!material.map && material.vertexColors) {
    // Vertex-coloured building: keep the real per-vertex colour, just make the
    // diffuse multiplier neutral so the baked colour survives untinted. The
    // flat-unlit shader supplies the flat look and the clean-up pass.
    material.color = new Color(1, 1, 1);
    material.userData.drawnKind = "vertex";
    material.userData.flatClean = 1;
    material.userData.drawnFacadeApplied = true;
    material.needsUpdate = true;
    return;
  }

  // Textured / plain material: collapse to a single flat real tone.
  let base: Rgb | null = material.map
    ? sampleDominantTextureColor(material.map)
    : null;
  if (!base) {
    base = [
      material.color.r * 255,
      material.color.g * 255,
      material.color.b * 255,
    ];
  }
  let flat = dominantFacadeColor(base);
  if (options?.anchor) {
    flat = blendTowardAnchor(flat, options.anchor, HERO_ANCHOR_BLEND);
  }
  const [r, g, b] = flat;
  // Strip the photo maps: a drawn facade is a flat painted tone, never a
  // photographic sample. Removing the map is also what guarantees the
  // no-photo-textures contract holds.
  material.map = null;
  material.emissiveMap = null;
  material.color = new Color(r / 255, g / 255, b / 255);
  // Remember the flat tone so the night branch can restore it as a lit base
  // colour; the flat-unlit shader reads the diffuse albedo directly for day.
  material.userData.dayFlatColor = material.color.getHex();
  material.userData.drawnKind = "flat";
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
