import {
  brandenburgGateWalkableAt,
  minecraftHeroCollisionEnabled,
  minecraftHeroWalkableAt,
} from "./MinecraftHeroNavigation";
import { schwellenraumNavigationOverrideAt } from "./SchwellenraumInteriors";
import type { VisualMode } from "./visualMode";

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
  if (brandenburgGateWalkableAt(x, y, z, sourceBuildingId)) return true;
  if (mode === "schwellenraum") {
    return schwellenraumNavigationOverrideAt(x, y, z, sourceBuildingId);
  }
  return (
    minecraftHeroCollisionEnabled(mode) &&
    minecraftHeroWalkableAt(x, y, z, sourceBuildingId)
  );
}
