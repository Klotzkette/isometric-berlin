/**
 * Distance-driven anti-aliasing for the far-zoomed view.
 *
 * "Flackert immer noch alles bei größerer Entfernung": once the camera
 * pulls back, three separate things alias at once —
 *
 *  1. Ink lines (EdgesGeometry `LineSegments`, 1 device pixel wide by
 *     definition) end up sub-pixel in world terms, so they flicker on and
 *     off between frames as the rasteriser rounds each segment to whichever
 *     pixel row/column it happens to land on this frame.
 *  2. Fine detail layers — lane markings, window-band seams, railings,
 *     small accessories — are geometry that is only legible up close; far
 *     out they contribute more aliasing than information.
 *  3. Baked textures need real mips/anisotropy so a minified sample blends
 *     instead of picking one texel per frame (already handled for the
 *     lettering canvas textures in `drawnLettering.ts`; nothing else in the
 *     viewer currently samples a `map` far enough out to matter).
 *
 * This module owns (1) and (2) as pure, unit-testable functions so the
 * thresholds and hysteresis bands can be pinned in tests without a WebGL
 * context. `ThreeViewer.tsx` wires them to the actual camera/viewport.
 *
 * Why fade opacity instead of resizing geometry: `LineBasicMaterial` line
 * width is clamped to 1px on most GPUs anyway, so there is no "shrink the
 * line" lever to pull. Once the *feature* an ink line traces projects to
 * well under a device pixel, the rasteriser's per-frame rounding of which
 * pixel row/column the 1px-wide line lands on is exactly the aliasing case
 * users see as flicker; fading it to fully transparent before that happens
 * removes the alternating signal instead of thinning it. This is mip-safe
 * by construction: it never touches a texture LOD or geometry resolution,
 * only a material's opacity uniform.
 */

import {
  MOABIT_PRISON_MEMORIAL_FINE_LAYER_NAME,
  MOABIT_PRISON_MEMORIAL_MICRO_LAYER_NAME,
} from "./MoabitPrisonMemorialPark";
import {
  WEIDENDAMMER_BRIDGE_INK_LAYER_NAME,
  WEIDENDAMMER_BRIDGE_LOVE_LOCK_LAYER_NAME,
} from "./WeidendammerBridgeDetails";
import { SPREE_RECOGNITION_FINE_LAYER_NAME } from "./spreeRecognitionProfile";
import { UNTER_DEN_LINDEN_FINE_LAYER_NAME } from "./unterDenLindenProfiles";

/**
 * The world-space feature size an ink line's fade is keyed to: not the
 * line's own (undefined) physical thickness, but the closest spacing
 * between adjacent authored ink strokes this drawing style commonly
 * relies on to read as separate lines -- window-band seams, kerb
 * segments, railing bars. Below this, adjacent strokes already visually
 * merge before any single stroke goes sub-pixel, so it is the right unit
 * to fade on.
 *
 * Calibrated against the viewer's own distance regime, not a literal
 * building measurement: at the standard 948 m default framing (App.tsx)
 * this keeps ink fully opaque (~0.74 px at a 1000 px-tall viewport, above
 * INK_LINE_FULL_PX), and it reaches the fully-hidden threshold by
 * CRISP_NONE_DISTANCE_M (crispnessProfile.ts, 2100 m) -- fine ink detail
 * finishes fading out right as the overall sharpen pass has already fully
 * relaxed, so a far view never shows a suddenly-soft picture full of
 * still-crisp aliasing lines.
 */
export const INK_LINE_REFERENCE_FEATURE_M = 0.5;

/** Projected pixel size of a world-space length at the given standoff. */
export function projectedPixelSize(
  worldSizeM: number,
  distanceM: number,
  viewportHeightPx: number,
  verticalFovDegrees: number,
): number {
  if (
    !Number.isFinite(distanceM) ||
    distanceM <= 0 ||
    !Number.isFinite(worldSizeM) ||
    worldSizeM <= 0
  ) {
    return 0;
  }
  const fovRad = (verticalFovDegrees * Math.PI) / 180;
  const pixelsPerMetreAtDistance =
    viewportHeightPx / (2 * distanceM * Math.tan(fovRad / 2));
  return worldSizeM * pixelsPerMetreAtDistance;
}

/**
 * Ink-line opacity for a given projected size (in device pixels) of the
 * reference feature above. Above `FULL_PX` the line is exactly as
 * authored (opacity 1) — it does not need to reach a full device pixel
 * first, only clear the point where sub-pixel rounding starts to matter.
 * Below `HIDE_PX` it is fully transparent. Between the two, opacity ramps
 * down with a smoothstep so the fade itself is not a second source of
 * popping.
 */
export const INK_LINE_FULL_PX = 0.7;
export const INK_LINE_HIDE_PX = 0.3;

export function inkLineFadeOpacity(projectedWidthPx: number): number {
  if (
    !Number.isFinite(projectedWidthPx) ||
    projectedWidthPx <= INK_LINE_HIDE_PX
  ) {
    return 0;
  }
  if (projectedWidthPx >= INK_LINE_FULL_PX) {
    return 1;
  }
  const t =
    (projectedWidthPx - INK_LINE_HIDE_PX) /
    (INK_LINE_FULL_PX - INK_LINE_HIDE_PX);
  return t * t * (3 - 2 * t);
}

export type InkLineFadeState = {
  appliedOpacity: number;
  authoredOpacity: number;
};

export type InkLineFadeStateInput = {
  authoredOpacity: number;
  currentOpacity: number;
  fadeOpacity: number;
  lastAppliedOpacity: number | null;
};

const OPACITY_CHANGE_EPSILON = 1e-6;

function safeOpacity(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

/**
 * Apply the distance fade without erasing an authored mode opacity.
 *
 * Some ink layers deliberately change their base opacity between Day and
 * Night. The old camera update replaced that value with the global fade on
 * the next frame, producing a visible brightness jump. A value that differs
 * from our last applied result is an external mode update and becomes the new
 * authored base; otherwise repeated frames are exactly idempotent.
 */
export function nextInkLineFadeState({
  authoredOpacity,
  currentOpacity,
  fadeOpacity,
  lastAppliedOpacity,
}: InkLineFadeStateInput): InkLineFadeState {
  const safeAuthored = safeOpacity(authoredOpacity, 1);
  const safeCurrent = safeOpacity(currentOpacity, safeAuthored);
  const safeFade = safeOpacity(fadeOpacity, 0);
  const externalOpacityChange =
    lastAppliedOpacity !== null &&
    Number.isFinite(lastAppliedOpacity) &&
    Math.abs(safeCurrent - lastAppliedOpacity) > OPACITY_CHANGE_EPSILON;
  const nextAuthored = externalOpacityChange ? safeCurrent : safeAuthored;
  return {
    appliedOpacity: nextAuthored * safeFade,
    authoredOpacity: nextAuthored,
  };
}

/**
 * Distance thresholds (world metres) for small ornament and fine drawing.
 * The viewer measures to each object's cached world bounds. Whole facades,
 * railings and other readable forms remain visible at every distance.
 *
 * The gap between SHOW and HIDE is deliberate hysteresis, same shape as
 * `renderQuality.ts`'s pixel-ratio/settled-detail governors: a camera
 * sitting exactly on the boundary (e.g. gently orbiting at a fixed radius)
 * must not have the layer blink on and off every frame. Entering the band
 * from close in only hides past HIDE_DISTANCE_M; returning from far out
 * only shows again once inside SHOW_DISTANCE_M, comfortably nearer.
 */
export const FINE_DETAIL_SHOW_DISTANCE_M = 900;
export const FINE_DETAIL_HIDE_DISTANCE_M = 1200;

export type FineDetailVisibilityInput = {
  distanceM: number;
  visible: boolean;
};

export type DetailFadeRangeM = readonly [showM: number, hideM: number];

/** Validate authored per-object hysteresis metadata once during collection. */
export function readDetailFadeRangeM(value: unknown): DetailFadeRangeM | null {
  let showM: unknown;
  let hideM: unknown;
  if (Array.isArray(value)) {
    [showM, hideM] = value;
  } else if (value !== null && typeof value === "object") {
    ({ show: showM, hide: hideM } = value as {
      hide?: unknown;
      show?: unknown;
    });
  }
  if (
    typeof showM !== "number" ||
    !Number.isFinite(showM) ||
    showM < 0 ||
    typeof hideM !== "number" ||
    !Number.isFinite(hideM) ||
    hideM <= showM
  ) {
    return null;
  }
  return [showM, hideM];
}

export function nextDetailFadeVisible(
  { distanceM, visible }: FineDetailVisibilityInput,
  rangeM: DetailFadeRangeM,
): boolean {
  if (!Number.isFinite(distanceM)) return visible;
  return visible ? distanceM < rangeM[1] : distanceM <= rangeM[0];
}

/**
 * Hysteretic visibility decision for a fine-detail layer, given only the
 * current camera-to-object distance and the layer's own last-applied state. Unlike
 * `renderQuality.ts`'s time-based hysteresis (which debounces *bursts of
 * input*), this debounces *distance*: the camera can sit anywhere without
 * a clock, so the band is defined in metres, not milliseconds, and the
 * function is a pure step of distance and previous state rather than of
 * elapsed time.
 */
export function nextFineDetailVisible({
  distanceM,
  visible,
}: FineDetailVisibilityInput): boolean {
  return nextDetailFadeVisible({ distanceM, visible }, [
    FINE_DETAIL_SHOW_DISTANCE_M,
    FINE_DETAIL_HIDE_DISTANCE_M,
  ]);
}

/** Sub-decimetre/brick-bond drawing only resolves in a real close-up. */
export const MICRO_DETAIL_SHOW_DISTANCE_M = 230;
export const MICRO_DETAIL_HIDE_DISTANCE_M = 310;

export function nextMicroDetailVisible({
  distanceM,
  visible,
}: FineDetailVisibilityInput): boolean {
  if (!Number.isFinite(distanceM)) {
    return visible;
  }
  if (visible) {
    return distanceM < MICRO_DETAIL_HIDE_DISTANCE_M;
  }
  return distanceM <= MICRO_DETAIL_SHOW_DISTANCE_M;
}

/**
 * Only close ornament and sub-pixel drawing belong in distance visibility.
 * Facades, railings, lamps, canopies, furniture and other readable forms remain
 * present at every distance. Their ordinary ink still uses its opacity fade.
 */
export const FINE_DETAIL_LAYER_NAMES: readonly string[] = [
  SPREE_RECOGNITION_FINE_LAYER_NAME,
  UNTER_DEN_LINDEN_FINE_LAYER_NAME,
  "carriageway lane markings",
  "drawn kerb lines",
  "bridge railing ink lines",
  "Moltkebrücke ornamental stone ink lines",
  "Adlerbruecke ink lines",
  "Löwenbrücke ink lines",
  "Löwenbrücke modern safety posts ink lines",
  WEIDENDAMMER_BRIDGE_INK_LAYER_NAME,
  WEIDENDAMMER_BRIDGE_LOVE_LOCK_LAYER_NAME,
  "Amtssitz presidential standard eagle red details front",
  "Amtssitz presidential standard eagle red details back",
  "Brandenburg Gate photo-bounded fine detail",
  "Reichstag west pediment crowned-finial fine detail",
  "Reichstag west portico Wappenbaum fine detail",
  "Reichstagspräsidentenpalais micro facade details bodies",
  "Reichstagspräsidentenpalais micro facade details lamps",
  "Reichstagspräsidentenpalais micro facade details ink lines",
  "Georg Elser pavement inscription quote",
  "Georg Elser pavement inscription attribution",
  "Queer Rainbow Memorial fine detail",
  "CSD attack memorial fine detail",
  "Goethe memorial fine allegory and fence cues",
  "Lessing memorial relief allegory and fence cues",
  "Richard Wagner six-metre marble ensemble ink lines",
  "Richard Wagner open steel canopy ink lines",
  "Bertolt Brecht seated figure and installation fine detail",
  "Helene Weigel halftone glass portrait",
  "Invalidenfriedhof Scharnhorst lion tomb fine detail",
  "Invalidenfriedhof Witzleben canopy fine detail",
  "Invalidenfriedhof Winterfeld portrait and helmet fine detail",
  "Invalidenfriedhof von Kessel fenced slab fine detail",
  "Invalidenfriedhof Familie von Rauch arch fine detail",
  "Invalidenfriedhof Auguste-Viktoria bell tower fine detail",
  "Günter Litfin watchtower fine detail",
  "Invalidenfriedhof historic wall fine detail",
  MOABIT_PRISON_MEMORIAL_FINE_LAYER_NAME,
];

/** Mortar and brick-bond strokes, never entire pieces of street furniture. */
export const MICRO_DETAIL_LAYER_NAMES: readonly string[] = [
  "Kollhoff clinker mortar joints",
  MOABIT_PRISON_MEMORIAL_MICRO_LAYER_NAME,
];
