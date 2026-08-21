import {
  brandenburgGateWalkableAt,
  minecraftHeroCollisionEnabled,
  minecraftHeroWalkableAt,
} from "./MinecraftHeroNavigation";
import { schwellenraumNavigationOverrideAt } from "./SchwellenraumInteriors";
import {
  invalidenfriedhofSolidAt,
  invalidenfriedhofWalkableInteriorAt,
} from "./InvalidenfriedhofDetails";
import { wagnerMemorialWalkableInteriorAt } from "./WagnerMemorial";
import type { VisualMode } from "./visualMode";

/** Capsule-aware solids without double-closing the authored bell opening. */
export function invalidenfriedhofPedestrianSolidAt(
  x: number,
  y: number,
  z: number,
  radius = 0,
): boolean {
  return invalidenfriedhofSolidAt(x, y, z, radius);
}

/**
 * Compose the deliberately narrow public openings used by pedestrian mode.
 * The Brandenburg Gate's five passages exist in every visual mode; station
 * and parliamentary shell exceptions remain presentation-specific.
 */
export function visualModeWalkableInteriorAt(
  mode: VisualMode,
  x: number,
  y: number,
  z: number,
  sourceBuildingId?: string,
): boolean {
  if (wagnerMemorialWalkableInteriorAt(x, y, z, sourceBuildingId)) {
    return true;
  }
  if (invalidenfriedhofWalkableInteriorAt(x, y, z, sourceBuildingId)) {
    return true;
  }
  if (brandenburgGateWalkableAt(x, y, z, sourceBuildingId)) return true;
  if (mode === "schwellenraum") {
    return schwellenraumNavigationOverrideAt(x, y, z, sourceBuildingId);
  }
  return (
    minecraftHeroCollisionEnabled(mode) &&
    minecraftHeroWalkableAt(x, y, z, sourceBuildingId)
  );
}
