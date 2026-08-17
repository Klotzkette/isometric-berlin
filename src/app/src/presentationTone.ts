import { ACESFilmicToneMapping, NoToneMapping, type ToneMapping } from "three";

import type { VisualMode } from "./visualMode";

/**
 * Per-mode tone response of the renderer — the last step between an
 * authored paint tone and the pixel the owner actually sees.
 *
 * The drawn modes are a FLAT UNLIT drawing: every facade, plate and lawn
 * carries one hand-authored hex value and the flat-unlit shader outputs
 * that albedo directly (see `installFlatUnlitShader`). A film curve in
 * front of that is not a stylistic choice, it is a defect — it rewrites
 * the palette nobody asked it to rewrite. Measured on the shipped
 * v0.37.0 build, ACES at exposure 1.33 turned
 *
 *   - the ivory register `#f8f3e6` into a neutral grey `#e9e7e4`
 *     (warm r−b 18 → 5: the "alle Gebäude … grau" complaint), and
 *   - the calm sage lawn `#a9c592` into a fluorescent `#d0fea1`,
 *
 * because the filmic shoulder desaturates near-white while the toe/mid
 * section expands the greens. Both directions are wrong at once, and no
 * repaint of the palette can fix it — the curve has to go.
 *
 * So day and night render with NO tone mapping at exposure 1: authored
 * paint reaches the screen bit-exact, which is the whole premise of the
 * axonometric drawing convention (`isoFaceShade` supplies plasticity
 * through per-face constants, not through a luminance curve).
 *
 * Minecraft is genuinely LIT — cubes want a hard key light, deep shadow
 * sides and a highlight roll-off that keeps a sunlit white block from
 * clipping — so it keeps ACES. Its exposure is calibrated (down from the
 * v0.37.0 1.62) so a cream facade stays cream instead of driving into
 * the lemon-yellow that the amber key light produced.
 */
export type PresentationTone = {
  exposure: number;
  toneMapping: ToneMapping;
};

export const PRESENTATION_TONE: Record<VisualMode, PresentationTone> = {
  day: { exposure: 1, toneMapping: NoToneMapping },
  night: { exposure: 1, toneMapping: NoToneMapping },
  minecraft: { exposure: 1.2, toneMapping: ACESFilmicToneMapping },
  snowstorm: { exposure: 1, toneMapping: NoToneMapping },
  // The ordinary Day palette remains untouched. Atmosphere is additive and
  // local, so no film curve may silently recolour the source city.
  schwellenraum: { exposure: 1, toneMapping: NoToneMapping },
};

/** True when a mode reproduces authored paint without a film curve. */
export function isPaintFaithful(mode: VisualMode): boolean {
  const tone = PRESENTATION_TONE[mode];
  return tone.toneMapping === NoToneMapping && tone.exposure === 1;
}
