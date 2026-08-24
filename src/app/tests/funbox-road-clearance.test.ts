import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";
import {
  BufferGeometry,
  InstancedMesh,
  Matrix4,
  Vector3,
} from "three";

import { createExpandedCityDetails } from "../src/ExpandedCityDetails";
import { NORTHERN_CITY_PROFILE } from "../src/expandedCityProfiles";
import {
  createMinecraftFunboxRecognition,
  createMinecraftVoxelWorld,
  decodeVoxelBuildingColumns,
  type VoxelPayload,
} from "../src/MinecraftVoxelWorld";

type Point2 = readonly [number, number];
type EncodedPoint2 = readonly [number, number];

type DeliveredRoadSurface = {
  holes: EncodedPoint2[][];
  kind: string;
  ring: EncodedPoint2[];
};

type SurfacePayload = {
  roads: DeliveredRoadSurface[];
};

type TunnelScenePayload = {
  tiergartentunnel: {
    portal_approaches: {
      minna_cauer: {
        carriageways: Array<{
          id: string;
          points: Array<readonly [number, number, number]>;
          widths_m: number[];
        }>;
      };
    };
  };
};

const meshRoot = new URL(
  "../public/mesh/regierungsviertel/",
  import.meta.url,
);
const surfacePayload = JSON.parse(
  readFileSync(new URL("surface-polygons.json", meshRoot), "utf8"),
) as SurfacePayload;
const tunnelScene = JSON.parse(
  readFileSync(new URL("scene.json", meshRoot), "utf8"),
) as TunnelScenePayload;
const voxelPayload = JSON.parse(
  readFileSync(new URL("minecraft-voxels.json", meshRoot), "utf8"),
) as VoxelPayload;

const profile = NORTHERN_CITY_PROFILE.funbox;
const envelope = profile.detailEnvelopeLocalM;
const cosine = Math.cos(profile.rotationY);
const sine = Math.sin(profile.rotationY);

function localToWorld([localX, localZ]: Point2): Point2 {
  return [
    profile.centerWorldM[0] + localX * cosine + localZ * sine,
    profile.centerWorldM[1] - localX * sine + localZ * cosine,
  ];
}

function worldToLocal([worldX, worldZ]: Point2): Point2 {
  const offsetX = worldX - profile.centerWorldM[0];
  const offsetZ = worldZ - profile.centerWorldM[1];
  return [
    offsetX * cosine - offsetZ * sine,
    offsetX * sine + offsetZ * cosine,
  ];
}

const envelopeRing = [
  [envelope.minX, envelope.minZ],
  [envelope.maxX, envelope.minZ],
  [envelope.maxX, envelope.maxZ],
  [envelope.minX, envelope.maxZ],
].map((point) => localToWorld(point as Point2));

function decoded([xDm, zDm]: EncodedPoint2): Point2 {
  return [xDm / 10, zDm / 10];
}

function ringBounds(ring: readonly Point2[]): readonly [number, number, number, number] {
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const [x, z] of ring) {
    minX = Math.min(minX, x);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxZ = Math.max(maxZ, z);
  }
  return [minX, minZ, maxX, maxZ];
}

function encodedRingBounds(
  ring: readonly EncodedPoint2[],
): readonly [number, number, number, number] {
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const [xDm, zDm] of ring) {
    minX = Math.min(minX, xDm / 10);
    minZ = Math.min(minZ, zDm / 10);
    maxX = Math.max(maxX, xDm / 10);
    maxZ = Math.max(maxZ, zDm / 10);
  }
  return [minX, minZ, maxX, maxZ];
}

function boundsOverlap(
  left: readonly [number, number, number, number],
  right: readonly [number, number, number, number],
  padding = 0,
): boolean {
  return !(
    left[2] + padding < right[0] ||
    right[2] + padding < left[0] ||
    left[3] + padding < right[1] ||
    right[3] + padding < left[1]
  );
}

function pointInRing(point: Point2, ring: readonly Point2[]): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const [x, z] = ring[index];
    const [previousX, previousZ] = ring[previous];
    if (
      (z > point[1]) !== (previousZ > point[1]) &&
      point[0] <
        ((previousX - x) * (point[1] - z)) / (previousZ - z) + x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInEncodedRing(
  point: Point2,
  ring: readonly EncodedPoint2[],
): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const [xDm, zDm] = ring[index];
    const [previousXDm, previousZDm] = ring[previous];
    const x = xDm / 10;
    const z = zDm / 10;
    const previousX = previousXDm / 10;
    const previousZ = previousZDm / 10;
    if (
      (z > point[1]) !== (previousZ > point[1]) &&
      point[0] <
        ((previousX - x) * (point[1] - z)) / (previousZ - z) + x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInSurface(point: Point2, surface: DeliveredRoadSurface): boolean {
  return (
    pointInEncodedRing(point, surface.ring) &&
    !surface.holes.some((hole) => pointInEncodedRing(point, hole))
  );
}

function cross(start: Point2, end: Point2, point: Point2): number {
  return (
    (end[0] - start[0]) * (point[1] - start[1]) -
    (end[1] - start[1]) * (point[0] - start[0])
  );
}

function onSegment(point: Point2, start: Point2, end: Point2): boolean {
  return (
    Math.abs(cross(start, end, point)) < 1e-8 &&
    point[0] >= Math.min(start[0], end[0]) - 1e-8 &&
    point[0] <= Math.max(start[0], end[0]) + 1e-8 &&
    point[1] >= Math.min(start[1], end[1]) - 1e-8 &&
    point[1] <= Math.max(start[1], end[1]) + 1e-8
  );
}

function segmentsIntersect(a0: Point2, a1: Point2, b0: Point2, b1: Point2): boolean {
  const aSide0 = cross(a0, a1, b0);
  const aSide1 = cross(a0, a1, b1);
  const bSide0 = cross(b0, b1, a0);
  const bSide1 = cross(b0, b1, a1);
  return (
    ((aSide0 > 0 && aSide1 < 0) || (aSide0 < 0 && aSide1 > 0)) &&
      ((bSide0 > 0 && bSide1 < 0) || (bSide0 < 0 && bSide1 > 0)) ||
    onSegment(a0, b0, b1) ||
    onSegment(a1, b0, b1) ||
    onSegment(b0, a0, a1) ||
    onSegment(b1, a0, a1)
  );
}

function pointToSegmentDistance(point: Point2, start: Point2, end: Point2): number {
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  const amount =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point[0] - start[0]) * deltaX +
              (point[1] - start[1]) * deltaZ) /
              lengthSquared,
          ),
        );
  return Math.hypot(
    point[0] - (start[0] + amount * deltaX),
    point[1] - (start[1] + amount * deltaZ),
  );
}

function segmentDistance(a0: Point2, a1: Point2, b0: Point2, b1: Point2): number {
  if (segmentsIntersect(a0, a1, b0, b1)) return 0;
  return Math.min(
    pointToSegmentDistance(a0, b0, b1),
    pointToSegmentDistance(a1, b0, b1),
    pointToSegmentDistance(b0, a0, a1),
    pointToSegmentDistance(b1, a0, a1),
  );
}

function ringSegments(ring: readonly Point2[]): Array<readonly [Point2, Point2]> {
  return ring.map((point, index) => [point, ring[(index + 1) % ring.length]]);
}

const envelopeSegments = ringSegments(envelopeRing);
const envelopeBounds = ringBounds(envelopeRing);

function surfaceIntersectsEnvelope(surface: DeliveredRoadSurface): boolean {
  if (!boundsOverlap(envelopeBounds, encodedRingBounds(surface.ring))) return false;
  if (envelopeRing.some((point) => pointInSurface(point, surface))) return true;
  for (const encodedRing of [surface.ring, ...surface.holes]) {
    let previous = decoded(encodedRing[encodedRing.length - 1]);
    for (const encodedPoint of encodedRing) {
      const point = decoded(encodedPoint);
      if (pointInRing(point, envelopeRing)) return true;
      if (
        envelopeSegments.some(([start, end]) =>
          segmentsIntersect(start, end, previous, point),
        )
      ) {
        return true;
      }
      previous = point;
    }
  }
  return false;
}

function surfaceBoundaryDistance(surface: DeliveredRoadSurface): number {
  if (!boundsOverlap(envelopeBounds, encodedRingBounds(surface.ring), 20)) {
    return Number.POSITIVE_INFINITY;
  }
  let closest = Number.POSITIVE_INFINITY;
  for (const encodedRing of [surface.ring, ...surface.holes]) {
    let previous = decoded(encodedRing[encodedRing.length - 1]);
    for (const encodedPoint of encodedRing) {
      const point = decoded(encodedPoint);
      for (const [start, end] of envelopeSegments) {
        closest = Math.min(
          closest,
          segmentDistance(start, end, previous, point),
        );
      }
      previous = point;
    }
  }
  return closest;
}

function localBounds(points: readonly Point2[]) {
  return ringBounds(points.map(worldToLocal));
}

function smoothFunboxPoints(): Point2[] {
  const root = createExpandedCityDetails([
    {
      name: "Oggi's Gemüsekebab",
      world: [-150.861, profile.groundY, -1179.35],
    },
  ]);
  const targets = [
    root.getObjectByName("Expanded architecture and public-realm details"),
    root.getObjectByName("FUNBOX.COM entrance dome FUN lettering"),
    root.getObjectByName("FUNBOX.COM entrance dome BOX.COM lettering"),
    root.getObjectByName("FUNBOX ticket kiosk lettering"),
  ];
  expect(targets.every(Boolean)).toBe(true);
  root.updateMatrixWorld(true);
  const points: Point2[] = [];
  for (const target of targets) {
    target!.traverse((child) => {
      const geometry = (child as { geometry?: BufferGeometry }).geometry;
      if (!(geometry instanceof BufferGeometry)) return;
      const positions = geometry.getAttribute("position");
      const point = new Vector3();
      for (let index = 0; index < positions.count; index += 1) {
        point
          .set(positions.getX(index), positions.getY(index), positions.getZ(index))
          .applyMatrix4(child.matrixWorld);
        points.push([point.x, point.z]);
      }
    });
  }
  return points;
}

function minecraftFunboxPoints(mesh: InstancedMesh): Point2[] {
  const matrix = new Matrix4();
  const point = new Vector3();
  const points: Point2[] = [];
  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getMatrixAt(index, matrix);
    for (const x of [-0.5, 0.5]) {
      for (const y of [-0.5, 0.5]) {
        for (const z of [-0.5, 0.5]) {
          point.set(x, y, z).applyMatrix4(matrix);
          points.push([point.x, point.z]);
        }
      }
    }
  }
  return points;
}

function expectInsideDeclaredEnvelope(points: readonly Point2[]): void {
  for (const point of points) {
    const [localX, localZ] = worldToLocal(point);
    expect(localX).toBeGreaterThanOrEqual(envelope.minX - 0.001);
    expect(localX).toBeLessThanOrEqual(envelope.maxX + 0.001);
    expect(localZ).toBeGreaterThanOrEqual(envelope.minZ - 0.001);
    expect(localZ).toBeLessThanOrEqual(envelope.maxZ + 0.001);
  }
}

const tinyVoxelFixture: VoxelPayload = {
  schema_version: 2,
  cell_m: 4,
  classes: ["grass"],
  grid: { cols: 1, min_x_idx: 2_000, min_z_idx: 2_000, rows: 1 },
  ground_height: {
    cols: 1,
    rows: 1,
    stride_cells: 1,
    y_dm: [0],
  },
  ground_rows: [[[0, 1, 0]]],
  building_rows: [[]],
  tree_rows: [[]],
  water_top_y_m: -1.15,
};

function funboxInstanceData(root: ReturnType<typeof createMinecraftVoxelWorld>) {
  const mesh = root.getObjectByName("Voxel FUNBOX event park");
  expect(mesh).toBeInstanceOf(InstancedMesh);
  const funbox = mesh as InstancedMesh;
  return {
    colors: Array.from(funbox.instanceColor?.array ?? []),
    count: funbox.count,
    matrices: Array.from(funbox.instanceMatrix.array).slice(0, funbox.count * 16),
  };
}

describe("FUNBOX road and portal clearance", () => {
  test("fits the complete declared event envelope outside delivered asphalt", () => {
    expect(profile.drivableRoadOsmWayIds).toEqual([
      "25359021",
      "431664605",
      "37995742",
      "4389561",
      "37995740",
      "431664589",
      "431664590",
      "1412995432",
    ]);
    const asphalt = surfacePayload.roads.filter(({ kind }) => kind === "asphalt");
    expect(asphalt.filter(surfaceIntersectsEnvelope)).toHaveLength(0);
    const clearance = Math.min(...asphalt.map(surfaceBoundaryDistance));
    expect(clearance).toBeCloseTo(profile.deliveredRoadSurfaceClearanceM, 2);
    expect(clearance).toBeGreaterThan(2.5);
  });

  test("pins every smooth body, lamp, outline and sign inside that envelope", () => {
    const points = smoothFunboxPoints();
    expect(points.length).toBeGreaterThan(5_700);
    expectInsideDeclaredEnvelope(points);
    const bounds = localBounds(points);
    expect(bounds[0]).toBeCloseTo(-22.811, 2);
    expect(bounds[1]).toBeCloseTo(-48.811, 2);
    expect(bounds[2]).toBeCloseTo(22.811, 2);
    expect(bounds[3]).toBeGreaterThan(56);
    expect(bounds[3]).toBeLessThanOrEqual(envelope.maxZ);
  });

  test("keeps the full and mobile Minecraft park byte-identical and road-safe", () => {
    const direct = createMinecraftFunboxRecognition();
    const points = minecraftFunboxPoints(direct);
    expectInsideDeclaredEnvelope(points);
    const bounds = localBounds(points);
    expect(bounds[0]).toBeCloseTo(-22, 2);
    expect(bounds[1]).toBeCloseTo(-48, 2);
    expect(bounds[2]).toBeCloseTo(22, 2);
    expect(bounds[3]).toBeGreaterThan(56);
    expect(bounds[3]).toBeLessThanOrEqual(envelope.maxZ);

    const full = createMinecraftVoxelWorld(tinyVoxelFixture, null, null, {
      detailProfile: "full",
    });
    const mobile = createMinecraftVoxelWorld(tinyVoxelFixture, null, null, {
      detailProfile: "mobile",
    });
    expect(funboxInstanceData(mobile)).toEqual(funboxInstanceData(full));
  });

  test("leaves the north tunnel portal and neighbouring voxel buildings free", () => {
    const portal = tunnelScene.tiergartentunnel.portal_approaches.minna_cauer;
    const portalClearance = Math.min(
      ...portal.carriageways.map((carriageway) => {
        const points = carriageway.points.map(
          ([x, , z]) => [x, z] as const,
        );
        let closest = Number.POSITIVE_INFINITY;
        for (const [start, end] of envelopeSegments) {
          for (let index = 0; index < points.length - 1; index += 1) {
            closest = Math.min(
              closest,
              segmentDistance(start, end, points[index], points[index + 1]),
            );
          }
        }
        return closest - Math.max(...carriageway.widths_m) / 2;
      }),
    );
    expect(portalClearance).toBeCloseTo(167.95, 1);
    expect(portalClearance).toBeGreaterThan(160);

    const cellM = voxelPayload.cell_m;
    let overlappingBuildingCells = 0;
    for (const [xIndex, zIndex] of decodeVoxelBuildingColumns(voxelPayload)) {
      const centerX = (xIndex + 0.5) * cellM;
      const centerZ = (zIndex + 0.5) * cellM;
      const half = cellM / 2;
      const cell = [
        [centerX - half, centerZ - half],
        [centerX + half, centerZ - half],
        [centerX + half, centerZ + half],
        [centerX - half, centerZ + half],
      ] as Point2[];
      if (!boundsOverlap(envelopeBounds, ringBounds(cell))) continue;
      if (
        cell.some((point) => pointInRing(point, envelopeRing)) ||
        envelopeRing.some((point) => pointInRing(point, cell)) ||
        ringSegments(cell).some(([cellStart, cellEnd]) =>
          envelopeSegments.some(([start, end]) =>
            segmentsIntersect(start, end, cellStart, cellEnd),
          ),
        )
      ) {
        overlappingBuildingCells += 1;
      }
    }
    expect(overlappingBuildingCells).toBe(0);
  });
});
