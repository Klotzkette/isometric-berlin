import type { SurfacePolygon } from "./IsometricCityWorld";
import { HBF_NORTH_APPROACH_SOURCE } from "./HbfNorthApproachProfile";

/** Offline exact complements: keep all lawn outside the mapped rail cuts. */
export function hbfNorthRailParkSurfaces(surface: SurfacePolygon): SurfacePolygon[] {
  const match = HBF_NORTH_APPROACH_SOURCE.park_surface_replacements.find(({ source_ring }) =>
    source_ring.length === surface.ring.length && source_ring.every((p, i) =>
      p[0] === surface.ring[i][0] && p[1] === surface.ring[i][1]),
  );
  return match ? match.polygons.map(polygon => ({ ...surface, ...polygon })) : [surface];
}
