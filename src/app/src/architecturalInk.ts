import { Color, LineBasicMaterial } from "three";

import type { VisualMode } from "./visualMode";

/**
 * One shared ink register for the complete drawn city.
 *
 * Silhouettes carry the strongest contour, detail lines describe joints and
 * openings, and micro lines sit back so close-up articulation never turns a
 * facade or monument into a dark cage. Every value is static and world-space;
 * changing mode only recolours the existing material.
 */
export type ArchitecturalInkRole = "detail" | "micro" | "silhouette";

export const ARCHITECTURAL_EDGE_THRESHOLD_DEGREES = 18;

export const ARCHITECTURAL_INK_PALETTE: Record<
  VisualMode,
  Record<ArchitecturalInkRole, number>
> = {
  day: {
    silhouette: 0x68645e,
    detail: 0x7b766e,
    micro: 0x918a80,
  },
  night: {
    silhouette: 0x9eb3cc,
    detail: 0x8197b1,
    micro: 0x697e98,
  },
  minecraft: {
    silhouette: 0x26312d,
    detail: 0x3b4740,
    micro: 0x536056,
  },
  snowstorm: {
    silhouette: 0x62686b,
    detail: 0x7b8183,
    micro: 0x969a9b,
  },
  // Exact Day ink: the atmospheric mode never repaints architecture.
  schwellenraum: {
    silhouette: 0x68645e,
    detail: 0x7b766e,
    micro: 0x918a80,
  },
};

function storedRole(material: LineBasicMaterial): ArchitecturalInkRole {
  const role = material.userData.architecturalInkRole;
  return role === "detail" || role === "micro" || role === "silhouette"
    ? role
    : "silhouette";
}

const ACCENT_BLEND: Record<VisualMode, number> = {
  day: 0,
  night: 0.72,
  minecraft: 0.8,
  snowstorm: 0.58,
  schwellenraum: 0,
};

/** Mark a line once and initialise it in the daylight drawing register. */
export function markArchitecturalInk<T extends LineBasicMaterial>(
  material: T,
  role: ArchitecturalInkRole,
): T {
  material.userData.modeInk = true;
  material.userData.architecturalInkRole = role;
  material.color.setHex(ARCHITECTURAL_INK_PALETTE.day[role]);
  return material;
}

/**
 * Register a purposeful coloured line (glass, bronze, masonry) without
 * flattening its identity into grey. Dark and winter modes blend that hue
 * toward the matching ink register; returning to Day restores it exactly.
 */
export function markArchitecturalAccentInk<T extends LineBasicMaterial>(
  material: T,
  dayColor: number,
  role: ArchitecturalInkRole,
): T {
  material.userData.modeInk = true;
  material.userData.architecturalInkRole = role;
  material.userData.architecturalInkDayColor = dayColor;
  material.color.setHex(dayColor);
  return material;
}

/** Recolour an existing line without rebuilding or moving its geometry. */
export function applyArchitecturalInkMode(
  material: LineBasicMaterial,
  mode: VisualMode,
  role: ArchitecturalInkRole = storedRole(material),
): void {
  material.userData.modeInk = true;
  material.userData.architecturalInkRole = role;
  const dayColor = material.userData.architecturalInkDayColor;
  if (typeof dayColor === "number" && Number.isFinite(dayColor)) {
    material.color
      .setHex(dayColor)
      .lerp(
        new Color(ARCHITECTURAL_INK_PALETTE[mode][role]),
        ACCENT_BLEND[mode],
      );
    return;
  }
  material.color.setHex(ARCHITECTURAL_INK_PALETTE[mode][role]);
}
