import { outlineNavigationEnvelopeBounds } from "./outlineNavigationEnvelope";

const MIN_WORLD_CAMERA_FAR_M = 16_000;
const FAR_PLANE_ROUNDING_M = 1_000;

/**
 * A conservative vertical span around the complete scene: it includes the
 * -120..280 m navigation target domain, the authored towers and underground
 * structures. This is a clipping allowance, not a building height or a change
 * to the permitted camera movement.
 */
const WORLD_VERTICAL_CLIPPING_SPAN_M = 1_000;

/**
 * Keep the opposite side of Berlin inside the far plane at every permitted
 * orbit angle. Both source geometry and navigation targets lie inside the
 * presentation envelope; its diagonal plus the maximum orbit distance bounds
 * camera-to-city distance by the triangle inequality.
 *
 * The v179 hairline extension needs 32,000 m at the full isometric orbit.
 * Keep the near plane unchanged: increasing the far plane from 16 to 32 km
 * changes relative depth precision by less than 0.0008% at 0.25 m near.
 */
export function worldCameraFarM(maxOrbitDistanceM: number): number {
  const envelope = outlineNavigationEnvelopeBounds();
  const cityDiagonal = Math.hypot(
    envelope.maxX - envelope.minX,
    envelope.maxZ - envelope.minZ,
    WORLD_VERTICAL_CLIPPING_SPAN_M,
  );
  const boundedOrbit = Number.isFinite(maxOrbitDistanceM)
    ? Math.max(0, maxOrbitDistanceM)
    : 0;
  return Math.max(
    MIN_WORLD_CAMERA_FAR_M,
    Math.ceil((cityDiagonal + boundedOrbit) / FAR_PLANE_ROUNDING_M) *
      FAR_PLANE_ROUNDING_M,
  );
}
