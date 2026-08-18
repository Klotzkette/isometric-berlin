import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
} from "three";

import type { LaneMarking, SurfacePayload } from "../../IsometricCityWorld";

type TerrainAt = (x: number, z: number) => number;

type CorridorSegment = {
  points: readonly (readonly [number, number])[];
  widthM: number;
};

type MedianSample = {
  highInnerZ: number;
  lowInnerZ: number;
  x: number;
};

export const UNTER_DEN_LINDEN_MEDIAN_SOURCE_NAME = "Unter den Linden";
const SAMPLE_STEP_M = 4;
const CHUNK_SAMPLE_COUNT = 24;

function sourceSegments(
  laneMarkings: readonly LaneMarking[] | undefined,
): CorridorSegment[] {
  return (laneMarkings ?? [])
    .filter(
      (marking) =>
        marking.name === UNTER_DEN_LINDEN_MEDIAN_SOURCE_NAME &&
        marking.points.length >= 2,
    )
    .map((marking) => ({
      points: marking.points.map(
        ([x, z]): readonly [number, number] => [x / 10, z / 10],
      ),
      widthM: marking.width_m,
    }));
}

function corridorAxis(segments: readonly CorridorSegment[]): {
  intercept: number;
  slope: number;
} {
  const points = segments.flatMap((segment) => segment.points);
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const meanZ = points.reduce((sum, [, z]) => sum + z, 0) / points.length;
  let covariance = 0;
  let variance = 0;
  for (const [x, z] of points) {
    covariance += (x - meanX) * (z - meanZ);
    variance += (x - meanX) ** 2;
  }
  const slope = variance > 1e-6 ? covariance / variance : 0;
  return { intercept: meanZ - slope * meanX, slope };
}

function segmentSide(
  segment: CorridorSegment,
  axis: { intercept: number; slope: number },
): number {
  return (
    segment.points.reduce(
      (sum, [x, z]) => sum + z - (axis.intercept + axis.slope * x),
      0,
    ) / segment.points.length
  );
}

function interpolatedAt(
  segment: CorridorSegment,
  x: number,
): { widthM: number; z: number } | null {
  for (let index = 1; index < segment.points.length; index += 1) {
    const from = segment.points[index - 1];
    const to = segment.points[index];
    const minX = Math.min(from[0], to[0]);
    const maxX = Math.max(from[0], to[0]);
    if (x < minX - 1e-6 || x > maxX + 1e-6) continue;
    const dx = to[0] - from[0];
    const progress = Math.abs(dx) < 1e-8 ? 0 : (x - from[0]) / dx;
    return {
      widthM: segment.widthM,
      z: from[1] + (to[1] - from[1]) * progress,
    };
  }
  return null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function corridorValueAt(
  segments: readonly CorridorSegment[],
  x: number,
): { widthM: number; z: number } | null {
  const values = segments
    .map((segment) => interpolatedAt(segment, x))
    .filter((value): value is { widthM: number; z: number } => value !== null);
  if (values.length === 0) return null;
  return {
    widthM: median(values.map((value) => value.widthM)),
    z: median(values.map((value) => value.z)),
  };
}

/**
 * Derive the centre reservation solely from the paired committed OSM road
 * centrelines and widths. No hand-drawn boulevard polygon enters this path.
 */
export function deriveUnterDenLindenMedianSamples(
  surfaces: Pick<SurfacePayload, "lane_markings">,
): MedianSample[] {
  const segments = sourceSegments(surfaces.lane_markings);
  if (segments.length < 2) return [];
  const axis = corridorAxis(segments);
  const high = segments.filter((segment) => segmentSide(segment, axis) > 0);
  const low = segments.filter((segment) => segmentSide(segment, axis) <= 0);
  if (high.length === 0 || low.length === 0) return [];
  const minX = Math.ceil(
    Math.max(
      Math.min(...high.flatMap((segment) => segment.points.map(([x]) => x))),
      Math.min(...low.flatMap((segment) => segment.points.map(([x]) => x))),
    ) / SAMPLE_STEP_M,
  ) * SAMPLE_STEP_M;
  const maxX = Math.floor(
    Math.min(
      Math.max(...high.flatMap((segment) => segment.points.map(([x]) => x))),
      Math.max(...low.flatMap((segment) => segment.points.map(([x]) => x))),
    ) / SAMPLE_STEP_M,
  ) * SAMPLE_STEP_M;
  const samples: MedianSample[] = [];
  for (let x = minX; x <= maxX; x += SAMPLE_STEP_M) {
    const highValue = corridorValueAt(high, x);
    const lowValue = corridorValueAt(low, x);
    if (!highValue || !lowValue) continue;
    const highInnerZ = highValue.z - highValue.widthM / 2 - 0.45;
    const lowInnerZ = lowValue.z + lowValue.widthM / 2 + 0.45;
    const width = highInnerZ - lowInnerZ;
    // Narrow channelised junctions are carriageway, not a planted median.
    if (width < 2.4 || width > 34) continue;
    samples.push({ highInnerZ, lowInnerZ, x });
  }
  return samples;
}

function contiguousRuns(samples: readonly MedianSample[]): MedianSample[][] {
  const runs: MedianSample[][] = [];
  for (const sample of samples) {
    const current = runs.at(-1);
    const previous = current?.at(-1);
    if (!current || !previous || sample.x - previous.x > SAMPLE_STEP_M * 1.2) {
      runs.push([sample]);
    } else {
      current.push(sample);
    }
  }
  return runs.filter((run) => run.length >= 2);
}

function createMedianChunk(
  samples: readonly MedianSample[],
  terrainAt: TerrainAt,
  chunkIndex: number,
): Group {
  const anchorX = (samples[0].x + samples.at(-1)!.x) / 2;
  const anchorZ =
    samples.reduce(
      (sum, sample) => sum + (sample.highInnerZ + sample.lowInnerZ) / 2,
      0,
    ) / samples.length;
  const group = new Group();
  group.name = `Schwellenraum Unter den Linden source median ${chunkIndex + 1}`;
  group.position.set(anchorX, 0, anchorZ);
  group.userData.schwellenraumPraesentation = true;
  group.userData.schwellenraumStatic = true;
  group.userData.sourceName = UNTER_DEN_LINDEN_MEDIAN_SOURCE_NAME;
  group.userData.geometryContract = [
    "Derived from paired committed OSM carriageway centrelines and mapped",
    "widths; intersections remain open",
  ].join(" ");

  const plateVertices: number[] = [];
  const edgeVertices: number[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    const from = samples[index - 1];
    const to = samples[index];
    const corners = [
      [from.x, from.lowInnerZ],
      [from.x, from.highInnerZ],
      [to.x, to.highInnerZ],
      [to.x, to.lowInnerZ],
    ] as const;
    const local = corners.map(([x, z]) => [
      x - anchorX,
      terrainAt(x, z) + 0.105,
      z - anchorZ,
    ] as const);
    for (const vertexIndex of [0, 1, 2, 0, 2, 3]) {
      plateVertices.push(...local[vertexIndex]);
    }
    for (const [a, b] of [
      [0, 3],
      [1, 2],
    ] as const) {
      edgeVertices.push(
        local[a][0],
        local[a][1] + 0.035,
        local[a][2],
        local[b][0],
        local[b][1] + 0.035,
        local[b][2],
      );
    }
  }
  const plateGeometry = new BufferGeometry();
  plateGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(plateVertices, 3),
  );
  plateGeometry.computeVertexNormals();
  const plate = new Mesh(
    plateGeometry,
    new MeshBasicMaterial({
      color: 0xd8ca91,
      depthWrite: false,
      opacity: 0.26,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      transparent: true,
    }),
  );
  plate.name = "warm static source-median veil";
  plate.renderOrder = 2.1;
  plate.userData.schwellenraumStatic = true;
  group.add(plate);

  const edgeGeometry = new BufferGeometry();
  edgeGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(edgeVertices, 3),
  );
  const edges = new LineSegments(
    edgeGeometry,
    new LineBasicMaterial({
      color: 0xb49a55,
      depthWrite: false,
      opacity: 0.72,
      transparent: true,
    }),
  );
  edges.name = "paired OSM inner carriageway edges";
  edges.renderOrder = 2.2;
  edges.userData.schwellenraumStatic = true;
  group.add(edges);

  const glintGeometry = new OctahedronGeometry(0.11, 0);
  for (let index = 6; index < samples.length; index += 12) {
    const sample = samples[index];
    const z = (sample.highInnerZ + sample.lowInnerZ) / 2;
    const glint = new Mesh(
      glintGeometry,
      new MeshBasicMaterial({ color: index % 24 === 0 ? 0xffe6a2 : 0xeadcff }),
    );
    glint.name = `ruhender Mittelstreifen-Lichtpunkt ${index}`;
    glint.position.set(
      sample.x - anchorX,
      terrainAt(sample.x, z) + 0.3,
      z - anchorZ,
    );
    glint.rotation.set(0.2, 0.35, 0.12);
    glint.userData.schwellenraumStatic = true;
    group.add(glint);
  }

  const radiusM = Math.max(
    ...samples.flatMap((sample) => [
      Math.hypot(sample.x - anchorX, sample.highInnerZ - anchorZ),
      Math.hypot(sample.x - anchorX, sample.lowInnerZ - anchorZ),
    ]),
  );
  group.userData.schutzradiusM = radiusM;
  return group;
}

export function installUnterDenLindenMedianRefinement(
  root: Group,
  surfaces: Pick<SurfacePayload, "lane_markings">,
  terrainAt: TerrainAt,
): number {
  if (root.userData.unterDenLindenMedianInstalled === true) return 0;
  const samples = deriveUnterDenLindenMedianSamples(surfaces);
  let chunkIndex = 0;
  for (const run of contiguousRuns(samples)) {
    for (
      let offset = 0;
      offset < run.length - 1;
      offset += CHUNK_SAMPLE_COUNT - 1
    ) {
      const chunk = run.slice(offset, offset + CHUNK_SAMPLE_COUNT);
      if (chunk.length < 2) continue;
      root.add(createMedianChunk(chunk, terrainAt, chunkIndex));
      chunkIndex += 1;
    }
  }
  root.userData.unterDenLindenMedianInstalled = true;
  root.userData.unterDenLindenMedianChunkCount = chunkIndex;
  return chunkIndex;
}
