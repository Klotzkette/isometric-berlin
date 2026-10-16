import { describe, expect, test } from "bun:test";
import { GALLERY_STARTUP_V220 as START, galleryStartupSelectionV220 } from "../src/galleryStartupV220";
import { pointInWorldRing } from "../src/chancelleryExtensionProfile";
import { smoothGroundTopSampler, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import { compilePedestrianObstacles, createPedestrianState, PEDESTRIAN_EYE_HEIGHT_M, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import { neueNationalgalerieWorldV217 } from "../src/neueNationalgalerieWalkV217";
import { directStartupMode } from "../src/modeLinks";
import { resolveInitialVisualMode } from "../src/visualMode";
import { sightSlug } from "../src/viewNavigation";
import surfaces from "../public/mesh/regierungsviertel/surface-polygons.json";
import ground from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import landmarks from "../src/data/regierungsviertel-landmarks.json";

type Ring = number[][];
const [x, eyeY, z] = START.position;
const inside = (ring: Ring) => pointInWorldRing(x * 10, z * 10, ring as [number, number][]);
const distance = (ring: Ring) => {
  let nearest = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j].map(v => v / 10), [bx, bz] = ring[i].map(v => v / 10);
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    nearest = Math.min(nearest, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return nearest;
};

describe("Neue Nationalgalerie pedestrian arrival v220", () => {
  test("the mapped corner footway is inside paving and clear of every delivered carriageway", () => {
    const [a, b] = START.footwaySegment;
    expect(x).toBeCloseTo(a[0] + START.segmentFraction * (b[0] - a[0]), 8);
    expect(z).toBeCloseTo(a[1] + START.segmentFraction * (b[1] - a[1]), 8);
    const pavement = surfaces.roads.find(p => p.kind === "paving" && inside(p.ring) && !p.holes.some(inside));
    expect(pavement).toBeDefined();
    expect(Math.min(...[pavement!.ring, ...pavement!.holes].map(distance))).toBeGreaterThan(1.1);
    for (const road of surfaces.roads.filter(p => p.kind === "asphalt")) {
      expect(inside(road.ring) && !road.holes.some(inside)).toBeFalse();
      expect(Math.min(...[road.ring, ...road.holes].map(distance))).toBeGreaterThan(5.29);
    }
  });

  test("the full pedestrian capsule remains at the exact terrain position without relocation", () => {
    const groundAt = smoothGroundTopSampler(ground as unknown as VoxelPayload);
    expect(groundAt(x, z)).toBeCloseTo(START.groundY, 6);
    expect(eyeY).toBeCloseTo(START.groundY + PEDESTRIAN_EYE_HEIGHT_M, 8);
    for (const mode of ["day", "night", "snowstorm", "minecraft", "schwellenraum", "flood"] as const) {
      const environment = {
        bounds: { minX: -1000, maxX: 1000, minZ: 1000, maxZ: 1600 },
        water: [], obstacles: compilePedestrianObstacles(prisms, () => mode), groundAt,
      };
      const state = createPedestrianState(environment, { x, z, yaw: 0, groundYHint: START.groundY, preserveHorizontalPosition: true });
      expect(state.x).toBeCloseTo(x, 8);
      expect(state.z).toBeCloseTo(z, 8);
      expect(state.groundY).toBeCloseTo(START.groundY, 8);
      expect(pedestrianPointIsBlocked(x, z, START.groundY, environment.obstacles, environment)).toBeFalse();
    }
  });

  test("the opening faces the existing south entrance at standing height", () => {
    const entrance = neueNationalgalerieWorldV217(0, 9.82 + PEDESTRIAN_EYE_HEIGHT_M, 25.2);
    for (let i = 0; i < 3; i++) expect(START.target[i]).toBeCloseTo(entrance[i], 8);
    expect(START.target[0]).toBeLessThan(x);
    expect(START.target[2]).toBeLessThan(z);
    expect(Math.hypot(START.target[0] - x, START.target[2] - z)).toBeLessThan(65);
  });

  test("normal entry is fixed, while explicit place and theme links remain deliberate choices", () => {
    expect(landmarks.landmarks).toHaveLength(93);
    const ordinary = galleryStartupSelectionV220(landmarks.landmarks);
    expect(ordinary).toEqual({ name: START.landmarkName, automatic: true });
    expect(resolveInitialVisualMode(null)).toBe("day");
    expect(directStartupMode("")).toBeNull();
    expect(galleryStartupSelectionV220(landmarks.landmarks, "#landmark=not-a-place")).toEqual(ordinary);
    for (const landmark of landmarks.landmarks) {
      expect(galleryStartupSelectionV220(landmarks.landmarks, `#landmark=${sightSlug(landmark.name)}`))
        .toEqual({ name: landmark.name, automatic: false });
    }
    for (const mode of ["day", "night", "snowstorm", "minecraft", "schwellenraum", "flood"] as const) {
      expect(directStartupMode(`?theme=${mode}`)).toBe(mode);
      expect(resolveInitialVisualMode(mode)).toBe(mode);
    }
  });
});
