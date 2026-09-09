import { extrapolatedEnvelopeBounds } from "./worldEnvelope";

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
 * The existing 16-degree / 6,551 m orbit needs 18,000 m. Keep the near plane
 * unchanged: increasing the far plane from 16 to 18 km changes relative depth
 * precision by less than 0.0002% at the existing 0.25 m near plane.
 */
export function worldCameraFarM(maxOrbitDistanceM: number): number {
  const envelope = extrapolatedEnvelopeBounds();
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
