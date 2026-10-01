import {
  Box3, BufferAttribute, BufferGeometry, DoubleSide, Group, InterleavedBuffer,
  InterleavedBufferAttribute, LineBasicMaterial, LineSegments, Mesh,
  Material, MeshBasicMaterial, MeshStandardMaterial, Sphere, Vector3,
} from "three";
import { markArchitecturalAccentInk, markArchitecturalInk } from "./architecturalInk";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export type SurroundingPolygon = { ring: number[][]; holes: number[][][] };
export type SurroundingBuilding = SurroundingPolygon & {
  height: number; minHeight: number; sourceId: string;
};
export type SurroundingNavigation = {
  ground: SurroundingPolygon[];
  buildings: SurroundingBuilding[];
  water: SurroundingPolygon[];
  roads?: SurroundingPolygon[];
  bridges?: SurroundingPolygon[];
  /** Absolute scene Y; explicitly an unsurveyed display height. */
  groundY: number;
};
export type SurroundingPackedMesh = {
  kind: string;
  positions: string;
  positionType: "u16cm";
  colors: string;
  indices: string;
};
export type SurroundingPackedLines = {
  positions: string;
  positionType?: "u16cm";
  colors?: string;
};
export type SurroundingCityChunk = {
  schemaVersion: 1;
  origin: [number, number, number];
  meshes: SurroundingPackedMesh[];
  lines?: SurroundingPackedLines;
  nav: SurroundingNavigation;
};
export type SurroundingChunkGeometry = {
  root: Group;
  geometryBytes: number;
  bufferCount: number;
  nav: SurroundingNavigation;
  origin: [number, number, number];
};

const MAX_VERTEX_COUNT = 400_000;
const MAX_INDEX_COUNT = 2_400_000;

export function validSurroundingPolygon(value: unknown): value is SurroundingPolygon {
  const polygon = value as SurroundingPolygon;
  const ring = (points: unknown): points is number[][] => Array.isArray(points) &&
    points.length >= 3 && points.length <= 100_000 && points.every(point =>
      Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
  return !!polygon && ring(polygon.ring) && Array.isArray(polygon.holes) &&
    polygon.holes.length <= 1_000 && polygon.holes.every(ring);
}

function validNavigation(value: SurroundingNavigation): boolean {
  return !!value && Number.isFinite(value.groundY) &&
    [value.ground, value.water, value.buildings, value.roads ?? [], value.bridges ?? []]
      .every(polygons => Array.isArray(polygons) && polygons.length <= 20_000 && polygons.every(validSurroundingPolygon)) &&
    value.buildings.every(building => Number.isFinite(building.height) && Number.isFinite(building.minHeight) &&
      building.height >= building.minHeight && typeof building.sourceId === "string");
}

function encodedBytes(encoded: string, multiple: number): number {
  if (typeof encoded !== "string" || encoded.length > 16 * 1024 * 1024 || encoded.length % 4 !== 0) {
    throw new Error("Invalid surrounding-city binary encoding");
  }
  const count = encoded.length / 4 * 3 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
  if (count % multiple !== 0) throw new Error("Invalid surrounding-city binary alignment");
  return count;
}

// One checkpoint handles at most 48 KiB of decoded bytes / 4,096 vertices.
// Both public builders consume this same iterator, so yielding never changes
// packet topology, colours, bounds, navigation or the final buffer ownership.
const DECODE_BASE64_CHARACTERS = 65_536;
const VERTEX_SLICE = 4_096;
const INDEX_SLICE = 16_384;

function* binary(encoded: string, multiple: number): Generator<void, ArrayBuffer> {
  const bytes = new Uint8Array(encodedBytes(encoded, multiple));
  let offset = 0;
  for (let start = 0; start < encoded.length; start += DECODE_BASE64_CHARACTERS) {
    const value = atob(encoded.slice(start, start + DECODE_BASE64_CHARACTERS));
    for (let i = 0; i < value.length; i++) bytes[offset++] = value.charCodeAt(i);
    yield;
  }
  if (offset !== bytes.length) throw new Error("Invalid surrounding-city binary alignment");
  return bytes.buffer;
}

function* geometryBounds(geometry: BufferGeometry): Generator<void> {
  geometry.userData.exactIndexPending = false;
  const position = geometry.getAttribute("position");
  const bounds = new Box3(), point = new Vector3();
  for (let start = 0; start < position.count; start += VERTEX_SLICE) {
    const end = Math.min(start + VERTEX_SLICE, position.count);
    for (let i = start; i < end; i++) bounds.expandByPoint(point.fromBufferAttribute(position, i));
    yield;
  }
  const sphere = new Sphere();
  bounds.getCenter(sphere.center);
  let radiusSquared = 0;
  for (let start = 0; start < position.count; start += VERTEX_SLICE) {
    const end = Math.min(start + VERTEX_SLICE, position.count);
    for (let i = start; i < end; i++) {
      point.fromBufferAttribute(position, i);
      radiusSquared = Math.max(radiusSquared, sphere.center.distanceToSquared(point));
    }
    yield;
  }
  sphere.radius = Math.sqrt(radiusSquared);
  geometry.boundingBox = bounds;
  geometry.boundingSphere = sphere;
}

function disposeUnpublishedChunk(root: Group): void {
  const materials = new Set<Material>();
  root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    for (const value of Object.values(object.userData)) if (value instanceof Material) materials.add(value);
  });
  for (const material of materials) material.dispose();
  root.clear();
}

/**
 * Centimetre coordinates stay Uint16 through publication, rather than expanding
 * to Float32. A common Uint16 stream carries both position and normalized colour
 * (byte * 257 is exact). Every tile uses one vertex/index pair and at most one
 * interleaved ink buffer. Nothing is triangulated or voxelised on the phone.
 */
function* buildSurroundingCityChunk(
  chunk: SurroundingCityChunk,
  id: string,
  minecraft = false,
): Generator<void, SurroundingChunkGeometry> {
  if (chunk?.schemaVersion !== 1 || !Array.isArray(chunk.origin) ||
      chunk.origin.length !== 3 || !chunk.origin.every(Number.isFinite) ||
      !Array.isArray(chunk.meshes) || chunk.meshes.length > 16 ||
      !validNavigation(chunk.nav)) {
    throw new Error("Invalid surrounding-city chunk");
  }
  const root = new Group();
  root.name = `Surrounding Berlin outline ${id}${minecraft ? " native Minecraft" : ""}`;
  root.position.fromArray(chunk.origin);
  root.userData.surroundingCity = true;
  root.userData.sourceGeometry = "Geoportal Berlin LoD2 and OpenStreetMap; rudimentary mapped outline extension";
  root.userData.unsurveyedGround = true;
  root.userData.nativeMinecraft = minecraft;

  let completed = false;
  try {
    // Validate counts before allocating the aggregate destination. Decoding is
    // deliberately serial: the largest temporary is one bounded source stream.
    let vertexCount = 0, indexCount = 0;
    for (const part of chunk.meshes) {
      if (part.positionType !== "u16cm" || typeof part.positions !== "string" ||
          typeof part.colors !== "string" || typeof part.indices !== "string") {
        throw new Error("Invalid surrounding-city mesh encoding");
      }
      const positionBytes = encodedBytes(part.positions, 6);
      const colorBytes = encodedBytes(part.colors, 3);
      const indexBytes = encodedBytes(part.indices, 12);
      const count = positionBytes / 6;
      if (colorBytes !== count * 3) throw new Error("Surrounding-city colour count differs from positions");
      vertexCount += count;
      indexCount += indexBytes / 4;
      if (vertexCount > MAX_VERTEX_COUNT || indexCount > MAX_INDEX_COUNT) {
        throw new Error("Surrounding-city geometry exceeds the bounded tile budget");
      }
    }
    const vertices = new Uint16Array(vertexCount * 6);
    // Most outline tiles fit the native 16-bit index range. Preserve every
    // source index while avoiding four-byte indices where two are sufficient.
    // WebGL2 reserves 0xffff for primitive restart, so 65,536 vertices require U32.
    const indices = vertexCount <= 65_535 ? new Uint16Array(indexCount) : new Uint32Array(indexCount);
    let vertexOffset = 0, indexOffset = 0;
    for (const part of chunk.meshes) {
      const positions = new Uint16Array(yield* binary(part.positions, 6));
      const colors = new Uint8Array(yield* binary(part.colors, 3));
      const sourceIndices = new Uint32Array(yield* binary(part.indices, 12));
      const count = positions.length / 3;
      for (let i = 0; i < count; i++) {
        const at = (vertexOffset + i) * 6, from = i * 3;
        vertices[at] = positions[from];
        vertices[at + 1] = positions[from + 1];
        vertices[at + 2] = positions[from + 2];
        vertices[at + 3] = colors[from] * 257;
        vertices[at + 4] = colors[from + 1] * 257;
        vertices[at + 5] = colors[from + 2] * 257;
        if ((i + 1) % VERTEX_SLICE === 0) yield;
      }
      for (let i = 0; i < sourceIndices.length; i++) {
        if (sourceIndices[i] >= count) throw new Error("Surrounding-city index exceeds the source mesh");
        indices[indexOffset + i] = vertexOffset + sourceIndices[i];
        if ((i + 1) % INDEX_SLICE === 0) yield;
      }
      vertexOffset += count;
      indexOffset += sourceIndices.length;
    }
    let geometryBytes = vertices.byteLength + indices.byteLength;
    let bufferCount = 0;
    const linePositions = chunk.lines?.positions && !minecraft
      ? new Uint16Array(yield* binary(chunk.lines.positions, 12)) : null;
    if (linePositions && linePositions.length / 3 > MAX_VERTEX_COUNT) {
      throw new Error("Surrounding-city ink exceeds the tile budget");
    }
    const lineColors = linePositions && chunk.lines?.colors
      ? new Uint8Array(yield* binary(chunk.lines.colors, 3)) : null;
    if (lineColors && lineColors.length !== linePositions!.length) {
      throw new Error("Surrounding-city ink colour count differs from positions");
    }
    if (vertexCount && indexCount) {
      const geometry = new BufferGeometry();
      const data = new InterleavedBuffer(vertices, 6);
      geometry.setAttribute("position", new InterleavedBufferAttribute(data, 3, 0, false));
      geometry.setAttribute("color", new InterleavedBufferAttribute(data, 3, 3, true));
      geometry.setIndex(new BufferAttribute(indices, 1));
      const nightMaterial = new MeshStandardMaterial({
        vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: DoubleSide,
      });
      const dayMaterial = minecraft ? nightMaterial : new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
      const body = new Mesh(geometry, dayMaterial);
      body.name = `${root.name} mapped surfaces and massing`;
      body.scale.setScalar(0.01);
      body.userData.dayMaterial = dayMaterial;
      body.userData.nightMaterial = nightMaterial;
      body.userData.surroundingCity = true;
      root.add(body);
      yield* geometryBounds(geometry);
      bufferCount += 2;
    }
    if (linePositions) {
      const positions = linePositions;
      if (positions.length) {
        const geometry = new BufferGeometry();
        if (lineColors) {
          const values = new Uint16Array(positions.length * 2);
          for (let i = 0; i < positions.length / 3; i++) {
            for (let component = 0; component < 3; component++) {
              values[i * 6 + component] = positions[i * 3 + component];
              values[i * 6 + component + 3] = lineColors[i * 3 + component] * 257;
            }
            if ((i + 1) % VERTEX_SLICE === 0) yield;
          }
          const data = new InterleavedBuffer(values, 6);
          geometry.setAttribute("position", new InterleavedBufferAttribute(data, 3, 0));
          geometry.setAttribute("color", new InterleavedBufferAttribute(data, 3, 3, true));
          geometryBytes += values.byteLength;
        } else {
          geometry.setAttribute("position", new BufferAttribute(positions, 3));
          geometryBytes += positions.byteLength;
        }
        const material = lineColors
          ? markArchitecturalAccentInk(new LineBasicMaterial({ vertexColors: true }), 0xffffff, "silhouette")
          : markArchitecturalInk(new LineBasicMaterial(), "silhouette");
        const ink = new LineSegments(geometry, material);
        ink.name = `${root.name} ink lines`;
        ink.scale.setScalar(0.01);
        ink.renderOrder = 2;
        root.add(ink);
        yield* geometryBounds(geometry);
        bufferCount++;
      }
    }
    const result = { root: freezeStaticSceneTransforms(root), geometryBytes, bufferCount,
      nav: chunk.nav, origin: chunk.origin };
    completed = true;
    return result;
  } finally {
    // A cancelled camera load or an invalid later stream must not retain an
    // unfinished mesh/material family. Nothing is added to the scene until done.
    if (!completed) disposeUnpublishedChunk(root);
  }
}

export function createSurroundingCityChunk(
  chunk: SurroundingCityChunk, id: string, minecraft = false,
): SurroundingChunkGeometry {
  const iterator = buildSurroundingCityChunk(chunk, id, minecraft);
  let next = iterator.next();
  while (!next.done) next = iterator.next();
  return next.value;
}

export type SurroundingChunkSchedule = {
  signal?: AbortSignal;
  budgetMs?: number;
  now?: () => number;
  yield?: () => Promise<void>;
};

function yieldSurroundingTask(): Promise<void> {
  const scheduler = (globalThis as typeof globalThis & { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise(resolve => setTimeout(resolve, 0));
}

/** Cooperative loading retains the complete synchronous geometry contract. */
export async function createSurroundingCityChunkCooperatively(
  chunk: SurroundingCityChunk, id: string, minecraft = false,
  schedule: SurroundingChunkSchedule = {},
): Promise<SurroundingChunkGeometry> {
  const now = schedule.now ?? (() => performance.now());
  const yieldTask = schedule.yield ?? yieldSurroundingTask;
  const budget = Math.max(0, schedule.budgetMs ?? 3);
  const iterator = buildSurroundingCityChunk(chunk, id, minecraft);
  let started = now();
  try {
    while (true) {
      if (schedule.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const next = iterator.next();
      if (next.done) return next.value;
      if (now() - started >= budget) {
        await yieldTask();
        started = now();
      }
    }
  } finally {
    iterator.return(undefined as never);
  }
}

export function surroundingRingContains(ring: readonly number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

// Weak ownership is important: source rings disappear with an evicted tile.
const polygonBounds = new WeakMap<SurroundingPolygon, readonly [number, number, number, number]>();
function boundsOf(polygon: SurroundingPolygon): readonly [number, number, number, number] {
  let bounds = polygonBounds.get(polygon);
  if (!bounds) {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const point of polygon.ring) {
      minX = Math.min(minX, point[0]); minZ = Math.min(minZ, point[1]);
      maxX = Math.max(maxX, point[0]); maxZ = Math.max(maxZ, point[1]);
    }
    bounds = [minX, minZ, maxX, maxZ]; polygonBounds.set(polygon, bounds);
  }
  return bounds;
}

export function surroundingPolygonContains(polygon: SurroundingPolygon, x: number, z: number): boolean {
  const [west, north, east, south] = boundsOf(polygon);
  return x >= west && x <= east && z >= north && z <= south && surroundingRingContains(polygon.ring, x, z) &&
    !polygon.holes.some(hole => surroundingRingContains(hole, x, z));
}

function ringDistanceSquared(ring: number[][], x: number, z: number): number {
  let nearest = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const length = dx * dx + dz * dz;
    const t = length > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length)) : 0;
    nearest = Math.min(nearest, (x - a[0] - t * dx) ** 2 + (z - a[1] - t * dz) ** 2);
  }
  return nearest;
}

/** Expand represented walls only; an open courtyard remains an open courtyard. */
export function surroundingBuildingSolidAt(
  nav: SurroundingNavigation, x: number, y: number, z: number, radius = 0,
): boolean {
  return nav.buildings.some(building => {
    if (y < nav.groundY + building.minHeight || y > nav.groundY + building.height) return false;
    const [west, north, east, south] = boundsOf(building);
    if (x + radius < west || x - radius > east || z + radius < north || z - radius > south) return false;
    if (surroundingPolygonContains(building, x, z)) return true;
    return radius > 0 && (ringDistanceSquared(building.ring, x, z) < radius * radius ||
      building.holes.some(ring => ringDistanceSquared(ring, x, z) < radius * radius));
  });
}
