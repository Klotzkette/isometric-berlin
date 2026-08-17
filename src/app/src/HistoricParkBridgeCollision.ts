import { ADLER_BRIDGE_PROFILE } from "./AdlerBridge";
import { LOEWEN_BRIDGE_PROFILE } from "./LoewenBridge";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";

export type HistoricParkBridgeCollisionIndex = {
  solidAt: (x: number, y: number, z: number, radiusM?: number) => boolean;
};

type LocalPoint = { u: number; v: number; y: number };

function toLocal(
  x: number,
  y: number,
  z: number,
  centre: readonly [number, number],
  axis: readonly [number, number],
  baseY: number,
): LocalPoint {
  const dx = x - centre[0];
  const dz = z - centre[1];
  return {
    u: dx * axis[0] + dz * axis[1],
    v: -dx * axis[1] + dz * axis[0],
    y: y - baseY,
  };
}

function inBox(
  point: LocalPoint,
  centre: readonly [number, number, number],
  half: readonly [number, number, number],
  radius: number,
): boolean {
  return (
    Math.abs(point.u - centre[0]) <= half[0] + radius &&
    Math.abs(point.y - centre[1]) <= half[1] + radius &&
    Math.abs(point.v - centre[2]) <= half[2] + radius
  );
}

function adlerSolidAt(point: LocalPoint, radius: number): boolean {
  const halfLength = ADLER_BRIDGE_PROFILE.inventory.lengthM / 2;
  const halfWidth = ADLER_BRIDGE_PROFILE.inventory.widthM / 2;
  for (const side of [-1, 1] as const) {
    // Wavy railing: its collision envelope follows only the narrow outer edge,
    // leaving the full 3.35 m official walking width open.
    if (
      inBox(
        point,
        [0, 0.72, side * (halfWidth + 0.02)],
        [halfLength, 0.62, 0.07],
        radius,
      )
    ) {
      return true;
    }
    // The two central eagle reliefs project out from the railings.
    if (
      inBox(
        point,
        [0, 0.83, side * (halfWidth + 0.145)],
        [1.38, 0.8, 0.18],
        radius,
      )
    ) {
      return true;
    }
    for (const end of [-1, 1] as const) {
      if (
        inBox(
          point,
          [
            end * (halfLength - 0.2),
            0.62,
            side * (halfWidth + 0.13),
          ],
          [0.39, 0.48, 0.42],
          radius,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function loewenSolidAt(point: LocalPoint, radius: number): boolean {
  const deckHalfLength = LOEWEN_BRIDGE_PROFILE.surveyedDeck.halfLengthM;
  const deckHalfWidth = LOEWEN_BRIDGE_PROFILE.surveyedDeck.halfWidthM;
  const overallHalfLength =
    LOEWEN_BRIDGE_PROFILE.engineering.overallLengthM / 2;
  const lionU = deckHalfLength + 0.55;
  const lionV = deckHalfWidth + 0.42;
  for (const side of [-1, 1] as const) {
    // Timber lattice, paired suspension cables/hangers and the 2025 outer
    // steel-rope handrail/mesh safety system share this narrow edge envelope.
    // The official 1.88 m deck centre stays open at every height.
    if (
      inBox(
        point,
        [0, 0.57, side * (deckHalfWidth + 0.07)],
        [deckHalfLength + 0.14, 0.9, 0.11],
        radius,
      )
    ) {
      return true;
    }
    for (const end of [-1, 1] as const) {
      // Original lion/plinth positions are outside the two-metre deck.
      if (
        inBox(
          point,
          [end * lionU, 0.91, side * lionV],
          [0.98, 0.95, 0.68],
          radius,
        )
      ) {
        return true;
      }
      // Pale approach walls run from the timber span to the buried anchors.
      const approachLength = overallHalfLength - deckHalfLength;
      if (
        inBox(
          point,
          [
            end * (deckHalfLength + approachLength / 2),
            0.2,
            side * lionV,
          ],
          [approachLength / 2, 0.35, 0.36],
          radius,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Compile the two authored bridge accessory envelopes against the same
 * committed ground sample used by their visible models. Deck floors are not
 * returned as obstacles: the OSM bridge ground layer already carries them and
 * pedestrians must remain able to cross both bridges.
 */
export function createHistoricParkBridgeCollision(
  ground: VoxelPayload,
): HistoricParkBridgeCollisionIndex {
  const sample = worldGroundSampler(ground);
  const adlerBaseY =
    (sample(...ADLER_BRIDGE_PROFILE.centreWorldM) ?? 5.2) + 0.35;
  const loewenBaseY =
    (sample(...LOEWEN_BRIDGE_PROFILE.world) ?? 5.2) + 0.12;
  return {
    solidAt: (x, y, z, radiusM = 0) => {
      if (![x, y, z, radiusM].every(Number.isFinite) || radiusM < 0) {
        return true;
      }
      const adlerDistance = Math.hypot(
        x - ADLER_BRIDGE_PROFILE.centreWorldM[0],
        z - ADLER_BRIDGE_PROFILE.centreWorldM[1],
      );
      if (adlerDistance <= 7.5 + radiusM) {
        const point = toLocal(
          x,
          y,
          z,
          ADLER_BRIDGE_PROFILE.centreWorldM,
          ADLER_BRIDGE_PROFILE.axis,
          adlerBaseY,
        );
        if (adlerSolidAt(point, radiusM)) return true;
      }
      const loewenDistance = Math.hypot(
        x - LOEWEN_BRIDGE_PROFILE.world[0],
        z - LOEWEN_BRIDGE_PROFILE.world[1],
      );
      if (loewenDistance <= 15.5 + radiusM) {
        const point = toLocal(
          x,
          y,
          z,
          LOEWEN_BRIDGE_PROFILE.world,
          LOEWEN_BRIDGE_PROFILE.axis,
          loewenBaseY,
        );
        if (loewenSolidAt(point, radiusM)) return true;
      }
      return false;
    },
  };
}
