/**
 * Shared station-local circulation for the existing 180 x 42 m Hauptbahnhof.
 * The five-level order and public entrance identities follow DB's station plan.
 * Slab tops are the actual earlier authored geometry; flight/landing widths,
 * routes and small fittings are bounded display estimates, not a stair survey.
 * No Three.js imports: both independent model families and navigation consume
 * these same metric endpoints without retaining either family's geometry.
 */
export type HbfPointV291 = readonly [number, number, number];
export type HbfLevelIdV291 = "upper-rail" | "upper-gallery" | "ground-concourse" | "lower-gallery" | "deep-rail";
export type HbfFlightV291 = {
  id: string;
  kind: "escalator" | "stairs";
  from: HbfPointV291;
  to: HbfPointV291;
  widthM: number;
  direction: -1 | 1;
  arm: -1 | 1;
  fromLevelId: HbfLevelIdV291;
  toLevelId: HbfLevelIdV291;
};
export type HbfLandingV291 = {
  id: string;
  levelId: HbfLevelIdV291;
  topLocalY: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};
export type HbfAirBoxV291 = { min: readonly [number, number, number]; max: readonly [number, number, number] };
export type HbfCombV291 = {
  id: string;
  flightId: string;
  kind: "escalator" | "stairs";
  end: "from" | "to";
  centre: HbfPointV291;
  unitX: number;
  unitZ: number;
  widthM: number;
  lengthM: number;
};

const levels = [
  { id: "upper-rail", topLocalY: 10.73 },
  { id: "upper-gallery", topLocalY: 4.85, openHalfM: 7.5, bridgeLocalZ: 28 },
  { id: "ground-concourse", topLocalY: 0.25, openHalfM: 9.5, bridgeLocalZ: 49.5 },
  { id: "lower-gallery", topLocalY: -5.15, openHalfM: 12, bridgeLocalZ: 71 },
  { id: "deep-rail", topLocalY: -14.055 },
] as const;

/** The retained rail/roof curve, in the unchanged station-local frame. */
export function hbfRailCurveAtV291(x: number): number {
  return 0.000787 * x * x + 0.2233 * x;
}

const flights: HbfFlightV291[] = [];
for (const arm of [-1, 1] as const) {
  for (const edge of [-1, 1] as const) {
    const endpoints: Array<readonly [HbfPointV291, HbfPointV291]> = [
      [[edge * 38, 10.73, arm * 15 + hbfRailCurveAtV291(edge * 38)], [edge * 14.5, 4.85, arm * 15 + hbfRailCurveAtV291(edge * 14.5)]],
      [[edge * 5.2, 4.85, arm * 34], [edge * 5.2, 0.25, arm * 42.74]],
      [[edge * 5.2, 0.25, arm * 55], [edge * 5.2, -5.15, arm * 65.26]],
      [[edge * 5.2, -5.15, arm * 67.5], [edge * 9.5, -14.055, arm * 81.8]],
    ];
    endpoints.forEach(([from, to], gap) => flights.push({
      id: `hbf-escalator-${arm}-${gap}-${edge}`,
      kind: "escalator", from, to, widthM: 2.4, direction: edge,
      arm, fromLevelId: levels[gap].id, toLevelId: levels[gap + 1].id,
    }));
  }
  const stairs: Array<readonly [HbfPointV291, HbfPointV291]> = [
    [[arm * 38, 10.73, hbfRailCurveAtV291(arm * 38)], [arm * 14.5, 4.85, hbfRailCurveAtV291(arm * 14.5)]],
    [[1.8, 4.85, arm * 54], [1.8, 0.25, arm * 62.74]],
    [[8.2, 0.25, arm * 55], [8.2, -5.15, arm * 65.26]],
    [[12.8, -5.15, arm * 67.5], [12.8, -14.055, arm * 81.8]],
  ];
  stairs.forEach(([from, to], gap) => flights.push({
    id: `hbf-stairs-${arm}-${gap}`, kind: "stairs", from, to,
    widthM: 2.6, direction: -1, arm,
    fromLevelId: levels[gap].id, toLevelId: levels[gap + 1].id,
  }));
}

// Bridge bands dock to the horizontal comb plates, rather than closing the
// whole daylight slot. Repeated equal bands are represented only once.
const landings: HbfLandingV291[] = [];
const landingKeys = new Set<string>();
for (const flight of flights) {
  for (const end of ["from", "to"] as const) {
    const point = flight[end];
    const levelId = end === "from" ? flight.fromLevelId : flight.toLevelId;
    // Existing curved upper platforms and deep islands already own these
    // complete comb plates; they must not get a duplicate crossing bridge.
    if (levelId === "upper-rail" || levelId === "deep-rail") continue;
    const dx = flight.to[0] - flight.from[0], dz = flight.to[2] - flight.from[2];
    const length = Math.hypot(dx, dz), sign = end === "from" ? -1 : 1;
    const centreX = point[0] + sign * dx / length, centreZ = point[2] + sign * dz / length;
    const xOriented = Math.abs(dx) > Math.abs(dz);
    const key = `${levelId}/${xOriented ? `${centreX}/` : ""}${centreZ}`;
    if (landingKeys.has(key)) continue;
    landingKeys.add(key);
    landings.push({
      id: `hbf-landing-${levelId}-${centreZ}`, levelId, topLocalY: point[1],
      minX: xOriented ? centreX - 1.1 : -20,
      maxX: xOriented ? centreX + 1.1 : 20,
      minZ: centreZ - (xOriented ? (flight.widthM + 0.5) / 2 : 1.1),
      maxZ: centreZ + (xOriented ? (flight.widthM + 0.5) / 2 : 1.1),
    });
  }
}
// Each panoramic shaft has an actual approach at its lower-gallery door.
for (const edge of [-1, 1] as const) for (const upperPlatformZ of [-15, 0, 15] as const) {
  const z = upperPlatformZ + hbfRailCurveAtV291(edge * 9.5);
  landings.push({
    id: `hbf-lift-lower-landing-${edge}-${upperPlatformZ}`, levelId: "lower-gallery",
    topLocalY: -5.15, minX: edge < 0 ? -13 : 7.5,
    maxX: edge < 0 ? -7.5 : 13, minZ: z - 2.6, maxZ: z + 2.6,
  });
}

// These are the existing drawn escalator comb dimensions. Fixed stairs and
// native flights need the same visible horizontal docking plates because a
// cardinal stair eye can extend slightly before the sloping run itself.
const combs: HbfCombV291[] = flights.flatMap((flight) => {
  const dx = flight.to[0] - flight.from[0], dz = flight.to[2] - flight.from[2];
  const length = Math.hypot(dx, dz), unitX = dx / length, unitZ = dz / length;
  return (["from", "to"] as const).map((end) => {
    const point = flight[end], sign = end === "from" ? -1 : 1;
    return { id: `${flight.id}-${end}-comb`, flightId: flight.id, kind: flight.kind, end,
      centre: [point[0] + sign * unitX, point[1], point[2] + sign * unitZ] as const,
      unitX, unitZ, widthM: flight.widthM + 0.5, lengthM: 2.2 };
  });
});

export const HBF_CIRCULATION_V291 = {
  frame: { anchorWorld: [-119.936, 4.575, -683.307] as const, rotationDegrees: 21.82 },
  levels, flights, landings, combs,
  shafts: ([-1, 1] as const).flatMap((edge) => ([-15, 0, 15] as const).map((upperPlatformZ) => ({
    id: `hbf-panoramic-shaft-${edge}-${upperPlatformZ}`, x: edge * 9.5, z: upperPlatformZ + hbfRailCurveAtV291(edge * 9.5),
    radiusM: 1.82, bottomLocalY: -15.15, topLocalY: 14.5,
  }))),
  upperPlatformCentresLocalZ: [-15, 0, 15] as const,
  upperTrackCentresLocalZ: [-18, -12, -4, 4, 12, 18] as const,
  // Exact retained Bügel glass plus already suppressed station/railway
  // source parts cross the real upper platforms. Full source records are
  // pinned below; only represented upper platform/flight body volumes yield.
  // rg8J0PRu shares official parent DEBE01YYK0003VCM with gqQdZFTa;
  // hlYYwDX2 is the retained western Bügel wall, and jacWOmHc is a station
  // part already owned by the existing geometric Hbf suppression predicate.
  upperRailEnvelopeSourceIds: ["o0aS4DvM", "clykH08k", "gqQdZFTa", "hlYYwDX2", "rg8J0PRu", "jacWOmHc", "SLLM5yNi"] as const,
  upperRailEnvelopeSourceSha256: {
    o0aS4DvM: "ab67aeaca6dd300e288eeb975a22df204a11e0e30901fe449bd718c6eb8683ae",
    clykH08k: "0e5016df9dbb71330dfc5eab0f6082680817603a8ffeb119741549dfef02f5e6",
    gqQdZFTa: "6adb566a3004bcda7306ef73877ea70fc511191bdb1422ef296f56919b80b0de",
    hlYYwDX2: "8cf6a02bb18e2b736ff8785ee99cc85966eb033d206fdca0ff1a0eec63aaba48",
    rg8J0PRu: "35443e049ff880f326265c0e055751c29da7b5dfbed10cf0f5f7461a487a14b0",
    jacWOmHc: "64dca1dedb2c72aae0d6bf89903a8e10b96dc6ecd0e4af246cab9f84a5b84d27",
    SLLM5yNi: "fbfeb1cfddacfb75798d1094589e4aed4c5264d2b80d00633f2678e1a750b331",
  } as const,
  upperRailEnvelopeSourceParents: {
    o0aS4DvM: { featureId: "DEBE3DxZo0aS4DvM", parentId: "DEBE01YYK0002OH0" },
    clykH08k: { featureId: "DEBE3DxoclykH08k", parentId: "DEBE01YYK0003Tvl" },
    gqQdZFTa: { featureId: "DEBE3DvIgqQdZFTa", parentId: "DEBE01YYK0003VCM" },
    hlYYwDX2: { featureId: "DEBE3DNfhlYYwDX2", parentId: "DEBE00YYYK0000D1" },
    rg8J0PRu: { featureId: "DEBE3Dbzrg8J0PRu", parentId: "DEBE01YYK0003VCM" },
    jacWOmHc: { featureId: "DEBE3DaxjacWOmHc", parentId: "DEBE01YYK0002O7Z" },
    SLLM5yNi: { featureId: "DEBE3DNoSLLM5yNi", parentId: "DEBE00YYYK0000D5" },
  } as const,
  hallHalfWidthM: 20,
  armNearLocalZ: 20,
  armFarLocalZ: 88,
  deepHalfWidthM: 38,
  deepHalfLengthM: 90,
  deepIslandCentresLocalX: [-28.5, -9.5, 9.5, 28.5] as const,
  deepIslandHalfWidthM: 4.8,
  deepIslandHalfLengthM: 84,
  deepBaseTopLocalY: -15,
  deepColumnCentresLocalX: [-28.5, -13.4, 13.4, 28.5] as const,
  deepColumnCentresLocalZ: [-66, -46, 46, 66] as const,
  deepColumnRadiusM: 0.43,
  deepColumnNativeRadiusM: 0.8,
  deepColumnTopLocalY: -6.25,
  mainCrossingHalfLengthM: 20,
  status: "DB five-level organisation; retained authored floor tops; connected flight, landing and stair dimensions are display estimates, not surveyed positions",
  sourceUrl: "https://www.bahnhof.de/downloads/station-plans/1071.pdf",
} as const;

const radians = HBF_CIRCULATION_V291.frame.rotationDegrees * Math.PI / 180;
const cosine = Math.cos(radians), sine = Math.sin(radians);

export function hbfLocalToWorldV291(point: HbfPointV291): [number, number, number] {
  const a = HBF_CIRCULATION_V291.frame.anchorWorld;
  return [a[0] + point[0] * cosine + point[2] * sine, a[1] + point[1], a[2] - point[0] * sine + point[2] * cosine];
}

export function hbfWorldToLocalV291(x: number, y: number, z: number, target: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const a = HBF_CIRCULATION_V291.frame.anchorWorld;
  const dx = x - a[0], dz = z - a[2];
  target[0] = dx * cosine - dz * sine;
  target[1] = y - a[1];
  target[2] = dx * sine + dz * cosine;
  return target;
}

/** Standing support follows a stable continuous incline beneath moving caps. */
export function hbfFlightGroundAtV291(flight: HbfFlightV291, x: number, z: number, padding = 0): number | null {
  const dx = flight.to[0] - flight.from[0], dz = flight.to[2] - flight.from[2];
  const lengthSquared = dx * dx + dz * dz;
  const rawT = ((x - flight.from[0]) * dx + (z - flight.from[2]) * dz) / lengthSquared;
  // A round trip through the unchanged world frame can move an exact comb
  // endpoint by a few ulps. Keep that real support without extending its run.
  if (rawT < -1e-9 || rawT > 1 + 1e-9) return null;
  const t = Math.max(0, Math.min(1, rawT));
  const across = Math.abs((x - flight.from[0]) * dz - (z - flight.from[2]) * dx) / Math.sqrt(lengthSquared);
  if (across > flight.widthM / 2 + padding + 1e-9) return null;
  return flight.from[1] + (flight.to[1] - flight.from[1]) * t;
}

export function hbfLandingContainsV291(landing: HbfLandingV291, x: number, z: number, padding = 0): boolean {
  return x >= landing.minX - padding && x <= landing.maxX + padding && z >= landing.minZ - padding && z <= landing.maxZ + padding;
}

/** Support belongs to the visible horizontal comb, not the cut parent slab. */
export function hbfCombGroundAtV291(comb: HbfCombV291, x: number, z: number): number | null {
  const dx = x - comb.centre[0], dz = z - comb.centre[2];
  if (Math.abs(dx * comb.unitX + dz * comb.unitZ) > comb.lengthM / 2 + 1e-9 ||
    Math.abs(-dx * comb.unitZ + dz * comb.unitX) > comb.widthM / 2 + 1e-9) return null;
  return comb.centre[1];
}

const nativeAirBoxCache = new Map<HbfFlightV291, readonly HbfAirBoxV291[]>();
/** Independent native stair-eye reading shared by actual slab cuts and support. */
export function hbfNativeAirBoxesV291(flight: HbfFlightV291, headroomM = 2.9): readonly HbfAirBoxV291[] {
  const cached = headroomM === 2.9 ? nativeAirBoxCache.get(flight) : undefined;
  if (cached) return cached;
  const [ax, ay, az] = flight.from, [bx, by, bz] = flight.to;
  const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
  const px = -dz / length, pz = dx / length, half = flight.widthM / 2 + 0.16;
  const boxes: HbfAirBoxV291[] = [], steps = Math.ceil(length / 2);
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const x0 = ax + dx * t0, x1 = ax + dx * t1, z0 = az + dz * t0, z1 = az + dz * t1;
    const y0 = ay + (by - ay) * t0, y1 = ay + (by - ay) * t1;
    boxes.push({
      min: [Math.min(x0, x1) - Math.abs(px) * half, Math.min(y0, y1) - 0.3, Math.min(z0, z1) - Math.abs(pz) * half],
      max: [Math.max(x0, x1) + Math.abs(px) * half, Math.max(y0, y1) + headroomM, Math.max(z0, z1) + Math.abs(pz) * half],
    });
  }
  if (headroomM === 2.9) nativeAirBoxCache.set(flight, boxes);
  return boxes;
}

/** Matches the retained short straight platform boxes, including their yaw. */
export function hbfUpperPlatformAtV291(x: number, z: number, padding = 0): boolean {
  if (Math.abs(x) > 113 + padding) return false;
  const steps = 20, stepLength = 224 / steps;
  for (let i = 0; i < steps; i++) {
    const x0 = -112 + i * stepLength, x1 = x0 + stepLength;
    const z0 = hbfRailCurveAtV291(x0), z1 = hbfRailCurveAtV291(x1);
    const midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2;
    const yaw = Math.atan2(z1 - z0, x1 - x0);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const centre of HBF_CIRCULATION_V291.upperPlatformCentresLocalZ) {
      const dx = x - midX, dz = z - midZ - centre;
      if (Math.abs(dx * c + dz * s) <= Math.hypot(x1 - x0, z1 - z0) * 1.02 / 2 + padding && Math.abs(-dx * s + dz * c) <= 2.15 + padding) return true;
    }
  }
  return false;
}

const shaftCutNormals = Array.from({ length: 32 }, (_, i) => {
  const angle = i * Math.PI * 2 / 32;
  return [Math.cos(angle), Math.sin(angle)] as const;
});

/**
 * XZ projection of the actual slab apertures. A flight's clear volume extends
 * from support −0.3m to support +2.9m, and has the same 0.16m edge clearance
 * as the geometry complement. Using the slab bottom matters at the thick
 * upper railway deck: visitors must not land on an absent top face.
 */
export function hbfSlabCutAtV291(x: number, z: number, bottomLocalY: number, topLocalY: number, native = false, padding = 0): boolean {
  for (const flight of flights) {
    if (native) {
      for (const box of hbfNativeAirBoxesV291(flight)) {
        if (box.min[1] >= topLocalY || box.max[1] <= bottomLocalY) continue;
        if (x >= box.min[0] - padding && x <= box.max[0] + padding &&
          z >= box.min[2] - padding && z <= box.max[2] + padding) return true;
      }
      continue;
    }
    const height = hbfFlightGroundAtV291(flight, x, z, 0.16 + padding);
    if (height !== null && height + 2.9 >= bottomLocalY - 1e-9 && height - 0.3 <= topLocalY + 1e-9) return true;
  }
  for (const shaft of HBF_CIRCULATION_V291.shafts) {
    if (shaft.topLocalY < bottomLocalY || shaft.bottomLocalY > topLocalY) continue;
    const dx = x - shaft.x, dz = z - shaft.z;
    if (native) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) <= 2.3 + padding) return true;
    } else {
      const radius = shaft.radiusM + 0.02 + padding;
      if (shaftCutNormals.every(([nx, nz]) => nx * dx + nz * dz <= radius + 1e-9)) return true;
    }
  }
  return false;
}

/** Shared side-gallery/bridge/foyer support with the represented slab holes. */
export function hbfLevelFloorContainsV291(levelId: HbfLevelIdV291, x: number, z: number, native = false): boolean {
  const p = HBF_CIRCULATION_V291, ax = Math.abs(x), az = Math.abs(z);
  const level = p.levels.find((candidate) => candidate.id === levelId)!;
  const bottom = levelId === "upper-rail" ? 9.25 : level.topLocalY - (levelId === "deep-rail" ? 0.95 : 0.5);
  if (hbfSlabCutAtV291(x, z, bottom, level.topLocalY, native)) return false;
  if (levelId === "upper-rail") return hbfUpperPlatformAtV291(x, z);
  if (levelId === "deep-rail") return az <= p.deepIslandHalfLengthM && p.deepIslandCentresLocalX.some((centre) => Math.abs(x - centre) <= p.deepIslandHalfWidthM);
  if (ax > p.hallHalfWidthM) return false;
  const far = levelId === "ground-concourse" ? 82 : p.armFarLocalZ;
  if (az <= far && ax >= ("openHalfM" in level ? level.openHalfM : 20)) return true;
  if ("bridgeLocalZ" in level && Math.abs(az - level.bridgeLocalZ) <= 2.6) return true;
  if (levelId === "ground-concourse") {
    if (az <= p.mainCrossingHalfLengthM || az >= 82 && az <= 92.2) return true;
    if (Math.abs(z - 37) <= 7.1 && ax <= 4.8) return true;
  }
  return p.landings.some((landing) => landing.levelId === levelId && hbfLandingContainsV291(landing, x, z));
}

/** A narrow opening where a represented flight joins/crosses a rail. */
export function hbfFlightOpeningAtV291(x: number, z: number, floorTopLocalY: number, padding = 0): boolean {
  return flights.some((flight) => {
    const height = hbfFlightGroundAtV291(flight, x, z, 0.16 + padding);
    return height !== null && height + 2.9 >= floorTopLocalY - 0.5 - 1e-9 && height - 0.3 <= floorTopLocalY + 1e-9;
  });
}

/** Highest real support below the visitor; nearby ramps take precedence. */
export function hbfCirculationGroundLocalAtV291(x: number, z: number, hint = 0.25, native = false): number | null {
  const p = HBF_CIRCULATION_V291;
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(hint)) return null;
  const ax = Math.abs(x), az = Math.abs(z);
  if (ax > 113 || az > Math.max(92.2, Math.abs(hbfRailCurveAtV291(x)) + 18)) return null;
  let top: number | null = null;
  const accept = (candidate: number, present: boolean): void => {
    if (present && candidate <= hint + 0.5 && (top === null || candidate > top)) top = candidate;
  };
  let nearFlight: number | null = null;
  for (const flight of flights) {
    const height = hbfFlightGroundAtV291(flight, x, z);
    if (height === null) continue;
    accept(height, true);
    if (height <= hint + 0.5 && height >= hint - 0.75 && (nearFlight === null || Math.abs(height - hint) < Math.abs(nearFlight - hint))) nearFlight = height;
  }
  for (const comb of combs) {
    const height = hbfCombGroundAtV291(comb, x, z);
    if (height !== null) accept(height, true);
  }
  for (const level of p.levels) accept(level.topLocalY, hbfLevelFloorContainsV291(level.id, x, z, native));
  accept(p.deepBaseTopLocalY, ax <= p.deepHalfWidthM && az <= p.deepHalfLengthM);
  return nearFlight ?? top;
}
