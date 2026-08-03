import type { VisualMode } from "./visualMode";

/**
 * Night mode's own sub-toggle: "Licht an" (default, today's night look with
 * warm windows + street lamps) vs. "Licht aus" (every artificial light off,
 * the city read only by cool moonlight). Day and Minecraft never show or use
 * this toggle — it only has an effect while `lightingMode === "night"`.
 *
 * Kept as its own boolean (not a fourth VisualMode) because it composes with
 * night rather than replacing it: leaving night for Day or Minecraft and
 * coming back restores whichever light state the owner last chose, exactly
 * like the day/night choice itself restores nothing but the mode does not
 * need to remember light state across a full mode round-trip either — the
 * persisted flag alone is the single source of truth, matching the existing
 * music-mute persistence contract.
 */
export const NIGHT_LIGHTS_STORAGE_KEY = "isometric-berlin.nightLightsOn";

/** True when a mode can show the "Licht an/aus" toggle at all. */
export function supportsNightLightsToggle(mode: VisualMode): boolean {
  return mode === "night";
}

/**
 * Whether artificial lights should render as on, given the current mode and
 * the persisted/selected preference. Day and Minecraft are unaffected by the
 * preference — they always render their own, unrelated lighting — so this
 * only evaluates the preference while in night mode.
 */
export function resolveNightLightsOn(
  mode: VisualMode,
  preference: boolean,
): boolean {
  if (!supportsNightLightsToggle(mode)) {
    return true;
  }
  return preference;
}

export function isNightLightsOnByUser(): boolean {
  try {
    const stored = window.localStorage.getItem(NIGHT_LIGHTS_STORAGE_KEY);
    // Default ("Licht an") when nothing was ever stored, matching the
    // spec's "Licht an (Default)" requirement.
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function rememberNightLightsOn(on: boolean): void {
  try {
    window.localStorage.setItem(NIGHT_LIGHTS_STORAGE_KEY, String(on));
  } catch {
    // The viewer stays usable when storage is blocked.
  }
}
