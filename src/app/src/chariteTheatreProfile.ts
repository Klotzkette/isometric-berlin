import raw from "./chariteTheatreSource.json";

/** Metric source plans, with the documented display-height correction and
 * explicit procedural roof subdivisions shared by rendering and navigation. */
export const CHARITE_THEATRE_PROFILE = {
  sourceParent: raw.parent_id,
  sourceIds: ["sFAYdHwz", "uBD055gq"],
  center: [679.47, -677.641],
  groundY: 5.2,
  bodyTopY: 14.6,
  drumTopY: 18,
  topY: 22.4,
  radius: 8,
  domeRadius: 8.2,
  domeRise: 3.55,
  domeSegments: 96,
  domeRows: 14,
  rooflightHalfWidth: 0.825,
  rooflightTopY: 21.79,
  nativeDomeCell: 0.64,
  nativeDomeOverlap: 0.015,
  nativeDomeStep: 0.32,
  sourceUrls: [
    raw.source_url,
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055030",
  ],
  geometryStatus: raw.display_conflict,
} as const;

const P = CHARITE_THEATRE_PROFILE;

export function chariteTheatreSourceForPrism(
  id: string,
): (typeof raw.parts)[number] | undefined {
  return P.sourceIds.includes(id as (typeof P.sourceIds)[number])
    ? raw.parts.find((part) => part.id.endsWith(id))
    : undefined;
}

export function chariteTheatreDomeY(radius: number): number {
  return (
    P.drumTopY +
    P.domeRise * Math.sqrt(Math.max(0, 1 - (radius / P.domeRadius) ** 2))
  );
}

/** Height of the actual faceted roof, not a full-height cylindrical obstacle.
 * Source polygon/hole ownership is checked by the navigation index itself. */
export function chariteTheatreRoofAt(
  x: number,
  z: number,
  sourceId: string,
  native = false,
): number | null {
  if (sourceId === "uBD055gq") return P.bodyTopY;
  if (sourceId !== "sFAYdHwz") return null;
  const dx = x - P.center[0],
    dz = z - P.center[1];
  const radius = Math.hypot(dx, dz);
  if (radius > P.domeRadius) return null;
  let top: number = P.drumTopY;
  if (native) {
    const cell = P.nativeDomeCell;
    const ix = Math.round(dx / cell),
      iz = Math.round(dz / cell);
    // Neighbouring roof squares overlap by 15mm; retain the higher support
    // where the camera/player happens to stand on that narrow seam.
    for (let xx = ix - 1; xx <= ix + 1; xx++)
      for (let zz = iz - 1; zz <= iz + 1; zz++) {
        const r = Math.hypot(xx * cell, zz * cell);
        if (
          r > P.domeRadius ||
          Math.abs(dx - xx * cell) > (cell + P.nativeDomeOverlap) / 2 ||
          Math.abs(dz - zz * cell) > (cell + P.nativeDomeOverlap) / 2
        )
          continue;
        top = Math.max(
          top,
          Math.min(
            P.drumTopY + P.domeRise,
            Math.ceil(chariteTheatreDomeY(r) / P.nativeDomeStep) *
              P.nativeDomeStep,
          ),
        );
      }
  } else {
    const angle = (Math.atan2(dz, dx) + Math.PI * 2) % (Math.PI * 2);
    const pitch = (Math.PI * 2) / P.domeSegments;
    const midAngle = (Math.floor(angle / pitch) + 0.5) * pitch;
    const ringRadius = Math.min(
      P.domeRadius,
      (radius * Math.cos(angle - midAngle)) / Math.cos(pitch / 2),
    );
    const f = Math.acos(ringRadius / P.domeRadius) / (Math.PI / 2);
    const row = Math.min(P.domeRows - 1, Math.floor(f * P.domeRows));
    const a = ((row / P.domeRows) * Math.PI) / 2;
    const b = (((row + 1) / P.domeRows) * Math.PI) / 2;
    const r0 = P.domeRadius * Math.cos(a),
      r1 = P.domeRadius * Math.cos(b);
    const t = Math.max(0, Math.min(1, (r0 - ringRadius) / (r0 - r1)));
    top += P.domeRise * (Math.sin(a) + t * (Math.sin(b) - Math.sin(a)));
  }
  if (
    Math.abs(dx) <= P.rooflightHalfWidth &&
    Math.abs(dz) <= P.rooflightHalfWidth
  )
    top = Math.max(top, P.rooflightTopY);
  return top;
}
