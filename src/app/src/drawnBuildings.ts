import {
  type BufferGeometry,
  Color,
  Float32BufferAttribute,
  MeshStandardMaterial,
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

// Per-vertex classification: a vertex baked into a photogrammetry tile is
// either building/ground fabric (flatten it) or soft nature (leave it). Trees
// read green-dominant; water reads blue-dominant and dark. Everything else is
// stone/glass/asphalt that must become a flat drawn face.
function isVegetationVertex(r: number, g: number, b: number): boolean {
  // Only clearly saturated green (real foliage/grass) stays soft. A greyish or
  // faintly-green building/roof texel (g barely above r/b) must NOT match, or it
  // is left as an un-flattened raw-gradient vertex and renders as a smear — the
  // round-6 marble. Trees read strongly green (g ≈ 1.3–2× r), so a firm ratio
  // keeps nature soft while sending pale building texels to the flattener.
  return g > r * 1.18 && g > b * 1.18 && g > 0.18;
}
function isWaterVertex(r: number, g: number, b: number): boolean {
  // Real water is distinctly blue AND dark. A plain dark grey roof (r≈g≈b) must
  // NOT match, or it would be left as an un-flattened smear, so require blue to
  // clearly lead the other channels rather than merely tie them.
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return b > r * 1.2 && b > g * 1.2 && luma < 0.38;
}

// Bucket a surface by orientation so a wall, its neighbour wall and the roof
// above never share a flat cell: horizontal surfaces (roof/ground) split by a
// coarse height band, vertical walls split by their compass facing. Together
// with the XZ cell this yields per-face planar patches — each patch collapses
// to ONE flat colour, so any face is gradient-free (σ≈0) while adjacent faces
// stay distinct and the city keeps its real per-building colour variety.
function faceBucket(
  y: number,
  nx: number,
  ny: number,
  nz: number,
  cellSize: number,
): string {
  if (Math.abs(ny) > 0.55) {
    return `H${Math.round(y / (cellSize * 1.5))}`;
  }
  if (Math.abs(nx) >= Math.abs(nz)) {
    return nx >= 0 ? "E" : "W";
  }
  return nz >= 0 ? "N" : "S";
}

/**
 * Flatten a photogrammetry building geometry's baked per-vertex colours into
 * piecewise-constant flat faces. The raw vertex colours carry the photographic
 * lightness gradient (σ≈57 across a single tile) — rendering them unlit is not
 * enough, the colour SOURCE itself smears. Here we bin building/ground vertices
 * into per-face planar patches (XZ grid cell × orientation bucket), replace each
 * patch's colours with a single cleaned dominant tone, and leave vegetation and
 * water vertices untouched so nature stays soft. The result: every face is one
 * uniform colour (zero gradient within a face, hard edges between faces) while
 * each building keeps its own real colour.
 *
 * Both the original and the flat colour buffers are stashed on
 * `geometry.userData` so the mode switch can restore the exact original colours
 * (and thus the original per-vertex lit look) for night/minecraft losslessly.
 * Returns true when a flat buffer was built (i.e. the geometry had colours).
 */
// Palette quantisation for the flat tones. Two smoothly-varying neighbouring
// patches would otherwise carry slightly different medians and, tiled across a
// large facade, read as a soft gradient again (the round-5 "mosaic"). Snapping
// every cell tone onto a small shared palette collapses similar patches to the
// SAME colour, so a building reads as one (or a few) large uniform flat faces
// with hard steps only where the real colour genuinely changes — the clean
// isometric look ("klare einheitliche Flächen"), never a smear.
const FLAT_PALETTE_LEVELS = 5;

// How many grid cells to lay across the widest horizontal span of a tile. The
// photogrammetry tiles use quantised positions (local extent ≈ 2 units) blown
// up ~185× by the node matrix to ≈ 370 m of real city, so a fixed metre-based
// cell size would land entirely in one bucket and collapse the whole tile to a
// single colour. Deriving the cell size from the geometry's own bounding box
// makes the grid scale-invariant: ~48 cells across ≈ 370 m ⇒ ≈ 8 m facade
// patches, small enough that each real building gets its own flat tone but
// large enough that one wall stays a single uniform colour.
const FLAT_GRID_CELLS = 48;

export function flattenBuildingVertexColors(
  geometry: BufferGeometry,
  cellSize?: number,
): boolean {
  const colorAttr = geometry.getAttribute("color");
  const posAttr = geometry.getAttribute("position");
  if (!colorAttr || !posAttr) {
    return false;
  }
  if (geometry.userData.flatColorsBuilt === true) {
    return true;
  }
  const normalAttr = geometry.getAttribute("normal");
  const count = colorAttr.count;

  // Derive a scale-invariant cell size from the horizontal bounding box unless
  // the caller pins one explicitly (tests do). Without this the grid is either
  // far too coarse (one colour for the city) or wrong for a tile's real span.
  let resolvedCell = cellSize;
  if (resolvedCell === undefined) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < count; i += 1) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const span = Math.max(maxX - minX, maxZ - minZ);
    resolvedCell = span > 0 ? span / FLAT_GRID_CELLS : 1;
  }
  cellSize = resolvedCell;

  type Cell = { rs: number[]; gs: number[]; bs: number[]; members: number[] };
  const cells = new Map<string, Cell>();
  const skip = new Uint8Array(count); // 1 = soft nature vertex, keep original

  for (let i = 0; i < count; i += 1) {
    const r = colorAttr.getX(i);
    const g = colorAttr.getY(i);
    const b = colorAttr.getZ(i);
    if (isVegetationVertex(r, g, b) || isWaterVertex(r, g, b)) {
      skip[i] = 1;
      continue;
    }
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const nx = normalAttr ? normalAttr.getX(i) : 0;
    const ny = normalAttr ? normalAttr.getY(i) : 1;
    const nz = normalAttr ? normalAttr.getZ(i) : 0;
    const cx = Math.floor(x / cellSize);
    const cz = Math.floor(z / cellSize);
    const key = `${cx},${cz},${faceBucket(y, nx, ny, nz, cellSize)}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { rs: [], gs: [], bs: [], members: [] };
      cells.set(key, cell);
    }
    cell.rs.push(r);
    cell.gs.push(g);
    cell.bs.push(b);
    cell.members.push(i);
  }

  const median = (values: number[]): number => {
    values.sort((a, b) => a - b);
    const mid = values.length >> 1;
    return values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid];
  };

  const flat = new Float32Array(count * 3);
  // Seed with the originals so skipped nature vertices are preserved verbatim.
  for (let i = 0; i < count; i += 1) {
    flat[i * 3] = colorAttr.getX(i);
    flat[i * 3 + 1] = colorAttr.getY(i);
    flat[i * 3 + 2] = colorAttr.getZ(i);
  }
  for (const cell of cells.values()) {
    const dom: Rgb = [
      median(cell.rs) * 255,
      median(cell.gs) * 255,
      median(cell.bs) * 255,
    ];
    const [cr, cg, cb] = dominantFacadeColor(dom);
    const fr = quantizeChannel(cr / 255, FLAT_PALETTE_LEVELS);
    const fg = quantizeChannel(cg / 255, FLAT_PALETTE_LEVELS);
    const fb = quantizeChannel(cb / 255, FLAT_PALETTE_LEVELS);
    for (const i of cell.members) {
      flat[i * 3] = fr;
      flat[i * 3 + 1] = fg;
      flat[i * 3 + 2] = fb;
    }
  }

  const origColorAttr = colorAttr.clone();
  const flatColorAttr = new Float32BufferAttribute(flat, 3);
  geometry.userData.origColorAttr = origColorAttr;
  geometry.userData.flatColorAttr = flatColorAttr;
  geometry.userData.flatColorsBuilt = true;
  geometry.setAttribute("color", flatColorAttr);
  // Force the GPU upload of the freshly-swapped buffer. Without this the
  // renderer can keep serving the stale original colours it uploaded on the
  // mesh's first frame, so the flat faces silently fall back to the smeared
  // per-vertex photo colours until an unrelated mode switch marks them dirty.
  flatColorAttr.needsUpdate = true;
  return true;
}

/**
 * Swap a flattened geometry between its flat day colours and its original
 * per-vertex colours. Day uses the piecewise-constant flat buffer; night and
 * minecraft restore the original photogrammetry colours so their lit look is
 * exactly as before (lossless mode switch). No-op if never flattened.
 */
export function setBuildingColorMode(
  geometry: BufferGeometry,
  flat: boolean,
): void {
  if (geometry.userData.flatColorsBuilt !== true) {
    return;
  }
  const next = flat
    ? (geometry.userData.flatColorAttr as Float32BufferAttribute)
    : (geometry.userData.origColorAttr as Float32BufferAttribute);
  if (next) {
    geometry.setAttribute("color", next);
    next.needsUpdate = true;
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
    // per-vertex colours are flattened into piecewise-constant flat faces at
    // load time (see flattenBuildingVertexColors) and already cleaned to a flat
    // drawn tone, so the shader clean-up pass stays OFF to avoid double
    // desaturation. The flat-unlit shader supplies the gradient-free look.
    material.color = new Color(1, 1, 1);
    material.userData.drawnKind = "vertex";
    material.userData.flatClean = 0;
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
