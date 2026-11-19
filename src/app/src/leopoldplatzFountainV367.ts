import type { SurfacePolygon } from "./IsometricCityWorld";

/** Source ring of the flush Fontänenfeld in front of the Alte Nazarethkirche. */
export function isLeopoldplatzFountainPad(surface: SurfacePolygon): boolean {
  return surface.kind === "basin" && surface.name === "Fontänenfeld" &&
    surface.area_m2 === 185 && surface.ring[0]?.[0] === -7461 &&
    surface.ring[0]?.[1] === -31561;
}
