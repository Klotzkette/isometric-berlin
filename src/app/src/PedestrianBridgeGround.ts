import {
  BRIDGE_MIN_CLEARANCE_M,
  BRIDGE_PROFILES,
  bridgeClusters,
  bridgeProfileAt,
  fitRectangle,
  HUGO_PREUSS_STRUCTURE_PROFILE,
} from "./IsometricCityWorld";
import { SANDKRUG_STRUCTURE_PROFILE } from "./HumboldthafenRefinements";
import { groundTopSampler, worldGroundSampler, type VoxelPayload } from "./MinecraftVoxelWorld";
import type { VisualMode } from "./visualMode";

/**
 * Navigation counterparts of the bounded public bridge recognition decks.
 * OSM water correctly continues underneath them; it must not close their
 * represented upper surface. The same committed profiles and terrain clusters
 * drive the renderer. No arbitrary shoreline buffer is made walkable.
 */
export function createPedestrianBridgeGround(
  ground: VoxelPayload,
  visualMode: () => VisualMode,
  bodyRadiusM: number,
): (x: number, z: number) => number | null {
  // The two-level parliament connection keeps its existing authored floor
  // contract. Unnamed clusters may be railway bridges and are not opened.
  const profiles = BRIDGE_PROFILES.filter((profile) => profile.surveyedDeck && profile.kind !== "parliament");
  const names = new Set(profiles.map((profile) => profile.name));
  const sampledDecks = new Map<string, number>();
  const sample = groundTopSampler(ground);
  const worldSample = worldGroundSampler(ground);
  const cell = ground.cell_m;
  for (const cluster of bridgeClusters(ground)) {
    const points = cluster.flatMap(([x, z]) => {
      const x0 = (ground.grid.min_x_idx + x) * cell;
      const z0 = (ground.grid.min_z_idx + z) * cell;
      return [[x0, z0], [x0 + cell, z0], [x0 + cell, z0 + cell], [x0, z0 + cell]] as Array<[number, number]>;
    });
    const rect = fitRectangle(points);
    const profile = rect && bridgeProfileAt(...rect.center);
    if (!profile || !names.has(profile.name)) continue;
    let highest = sampledDecks.get(profile.name) ?? Number.NEGATIVE_INFINITY;
    for (const [x, z] of cluster) highest = Math.max(highest, sample(x, z) + 0.55);
    sampledDecks.set(profile.name, highest);
  }
  const decks = profiles.flatMap((profile) => {
    if (!profile.surveyedDeck || !profile.axis) return [];
    // The two park crossings are always installed as dedicated models. Other
    // profiles require the actual delivered OSM bridge cluster to be present.
    const historic = profile.kind === "adler" || profile.kind === "suspension";
    const sampled = sampledDecks.get(profile.name);
    if (!historic && sampled === undefined) return [];
    const axisLength = Math.hypot(...profile.axis);
    const baseY = historic
      ? worldSample(...profile.world) ?? 5.2
      : Math.max(sampled!, (ground.water_top_y_m ?? 1.31) + BRIDGE_MIN_CLEARANCE_M + (profile.kind === "golda" ? 0.9 : 0));
    return [{
      profile,
      axisX: profile.axis[0] / axisLength,
      axisZ: profile.axis[1] / axisLength,
      baseY,
      halfLength: profile.surveyedDeck.halfLengthM,
      halfWidth: Math.max(0, profile.surveyedDeck.halfWidthM - bodyRadiusM),
    }];
  });
  return (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    for (const deck of decks) {
      const dx = x - deck.profile.world[0];
      const dz = z - deck.profile.world[1];
      const reach = deck.halfLength + deck.halfWidth + Math.abs(deck.profile.curveSagittaM ?? 0);
      if (dx * dx + dz * dz > reach * reach) continue;
      const projectedU = dx * deck.axisX + dz * deck.axisZ;
      const projectedV = -dx * deck.axisZ + dz * deck.axisX;
      const curve = deck.profile.curveSagittaM ?? 0;
      let u = projectedU;
      // Closest centreline parameter of Hugo-Preuß's existing parabolic plan
      // curve, in the same tangent-normal frame used for its short plates.
      for (let iteration = 0; curve !== 0 && iteration < 4; iteration += 1) {
        const offset = curve * (1 - (u / deck.halfLength) ** 2);
        const slope = -2 * curve * u / deck.halfLength ** 2;
        const second = -2 * curve / deck.halfLength ** 2;
        u -= ((u - projectedU) + (offset - projectedV) * slope) /
          (1 + slope * slope + (offset - projectedV) * second);
      }
      const offset = curve * Math.max(0, 1 - (u / deck.halfLength) ** 2);
      const slope = -2 * curve * u / deck.halfLength ** 2;
      const v = ((projectedV - offset) - slope * (projectedU - u)) / Math.hypot(1, slope);
      if (Math.abs(u) > deck.halfLength || Math.abs(v) > deck.halfWidth) continue;
      if (deck.profile.kind === "suspension") {
        return deck.baseY + (visualMode() === "minecraft" ? 0.24 : 0.17);
      }
      if (deck.profile.kind === "adler") {
        return deck.baseY + (visualMode() === "minecraft" ? 0.33 : 0.46);
      }
      // The renderer uses short flat plates at segment centres, not a smooth
      // invented ramp. Match their top exactly, including road/footway bands.
      const kind = deck.profile.kind;
      const segments = kind === "vierendeel" ? 40 : kind === "ironArch" ? 30 : kind === "openFrame" ? 16
        : kind === "curvedBox" ? HUGO_PREUSS_STRUCTURE_PROFILE.fasciaBayCount : kind === "golda" ? 28 : 14;
      const segmentLength = deck.halfLength * 2 / segments;
      const index = Math.max(0, Math.min(segments - 1, Math.floor((u + deck.halfLength) / segmentLength)));
      const segmentU = -deck.halfLength + segmentLength * (index + 0.5);
      const camber = kind === "vierendeel" ? 0.16 : kind === "ironArch" ? 0.34 : kind === "openFrame" ? 0.12
        : kind === "stoneArch" ? 0.42 : kind === "steelArch" ? 1.2 : kind === "curvedBox" ? 1.05 : 0.82;
      const rise = camber * Math.cos(segmentU / deck.halfLength * Math.PI / 2) ** 2;
      const lateral = Math.abs(v);
      const surface = kind === "vierendeel" || kind === "golda" ? 0 : kind === "ironArch"
        ? lateral >= 6.8 && lateral <= 10.8 ? 0.13 : lateral <= 6.5 ? 0.07 : 0
        : kind === "openFrame" ? lateral >= SANDKRUG_STRUCTURE_PROFILE.roadwayWidthM / 2 ? 0.13 : 0.07
        : kind === "stoneArch" ? Math.abs(lateral - (deck.profile.surveyedDeck!.halfWidthM - 2.25)) <= 2 ? 0.09 : lateral <= 6.6 ? 0.07 : 0
        : kind === "steelArch" ? Math.abs(lateral - 9.9) <= 1.55 ? 0.25 : Math.abs(lateral - 7.25) <= 1 ? 0.155 : lateral <= 6.25 ? 0.07 : 0
        : Math.abs(lateral - 9.05) <= 2.275 ? 0.1 : Math.abs(lateral - 5.4) <= 1.1 ? 0.09 : lateral <= 4.25 ? 0.07 : 0;
      return deck.baseY + rise + surface;
    }
    return null;
  };
}
