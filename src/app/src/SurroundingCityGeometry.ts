import { parkStaticGeometrySteps } from "./losslessStaticStorage";
import { replacePanoramaFacadeV202 } from "./panoramaFacadeV202";
import { siteNavigationV209, transferSiteLinesV209, transferSiteTrianglesV209 } from "./siteOwnershipV209";
import {
  Box3, BufferAttribute, BufferGeometry, DoubleSide, Group, InterleavedBuffer,
  InterleavedBufferAttribute, LineBasicMaterial, LineSegments, Mesh,
  Material, MeshBasicMaterial, MeshStandardMaterial, Sphere, Vector3,
} from "three";
import { markArchitecturalAccentInk, markArchitecturalInk } from "./architecturalInk";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { surroundingColourOwners, surroundingGenericColour, type SurroundingColourOwners } from "./surroundingCityColourV184";
import { shadeAltMitteFacadeV186 } from "./altMitteFacadeReliefV186";

export type SurroundingPolygon = { ring: number[][]; holes: number[][][] };
export type SurroundingBuilding = SurroundingPolygon & {
  height: number; minHeight: number; sourceId: string;
  /** Rigid DGM placement of this complete source building; heights stay relative. */
  groundOffset?: number;
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
      building.height >= building.minHeight && typeof building.sourceId === "string" &&
      (building.groundOffset === undefined || Number.isFinite(building.groundOffset)));
}

function encodedBytes(encoded: string, multiple: number): number {
  if (typeof encoded !== "string" || encoded.length > 16 * 1024 * 1024 || encoded.length % 4 !== 0) {
    throw new Error("Invalid surrounding-city binary encoding");
  }
  const count = encoded.length / 4 * 3 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
  if (count % multiple !== 0) throw new Error("Invalid surrounding-city binary alignment");
  return count;
}

// A decode checkpoint handles at most 48 KiB; bounds scans use 4,096 vertices.
// Both public builders consume this same iterator, so yielding never changes
// packet topology, colours, bounds, navigation or the final buffer ownership.
const DECODE_BASE64_CHARACTERS = 65_536;
const VERTEX_SLICE = 4_096;

/** Decode one bounded stream slice directly into its final destination. No full
 * positions, colours or source-index copy overlaps the resident GPU/CPU arrays.
 * Native base64 decoding is optional; older Safari/Android use the same bytes. */
function* binarySlices(encoded: string, multiple: number): Generator<Uint8Array> {
  const count = encodedBytes(encoded, multiple);
  let offset = 0;
  const fromBase64 = (Uint8Array as typeof Uint8Array & {
    fromBase64?: (value: string) => Uint8Array;
  }).fromBase64;
  for (let start = 0; start < encoded.length; start += DECODE_BASE64_CHARACTERS) {
    const text = encoded.slice(start, start + DECODE_BASE64_CHARACTERS);
    let bytes: Uint8Array;
    if (fromBase64) bytes = fromBase64(text);
    else {
      const value = atob(text);
      bytes = new Uint8Array(value.length);
      for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i);
    }
    offset += bytes.length;
    if (bytes.length % multiple !== 0 || offset > count)
      throw new Error("Invalid surrounding-city binary alignment");
    yield bytes;
  }
  if (offset !== count) throw new Error("Invalid surrounding-city binary alignment");
}

function* interleavedPositions(encoded: string, values: Uint16Array,
  vertexOffset: number, stride: number): Generator<void> {
  let to = vertexOffset * stride;
  for (const bytes of binarySlices(encoded, 6)) {
    const source = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    for (let i = 0; i < source.length; i += 3, to += stride) {
      values[to] = source[i]; values[to + 1] = source[i + 1]; values[to + 2] = source[i + 2];
    }
    yield;
  }
}

function* interleavedColors(encoded: string, values: Uint16Array,
  vertexOffset: number, owners?: SurroundingColourOwners, grounded = false): Generator<void> {
  let to = vertexOffset * 6 + 3;
  const scratch: [number, number, number] = [0, 0, 0];
  for (const bytes of binarySlices(encoded, 3)) {
    for (let i = 0; i < bytes.length; i += 3, to += 6) {
      const tone = owners && surroundingGenericColour(owners, values[to - 3], values[to - 1], bytes[i], bytes[i + 1], bytes[i + 2],
        grounded ? values[to - 2] : undefined, scratch);
      values[to] = (tone?.[0] ?? bytes[i]) * 257;
      values[to + 1] = (tone?.[1] ?? bytes[i + 1]) * 257;
      values[to + 2] = (tone?.[2] ?? bytes[i + 2]) * 257;
    }
    yield;
  }
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
export function* buildSurroundingCityChunk(
  chunk: SurroundingCityChunk,
  id: string,
  minecraft = false,
  parkBacking = false,
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
  root.userData.sourceKinds = [...new Set(chunk.meshes.map(part => part.kind))];

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
    const colourOwners = chunk.meshes.some(part => part.kind === "city")
      ? yield* surroundingColourOwners(chunk.nav.buildings, chunk.nav.groundY, chunk.origin[1]) : undefined;
    let vertexOffset = 0, indexOffset = 0;
    for (const part of chunk.meshes) {
      const count = encodedBytes(part.positions, 6) / 6;
      yield* interleavedPositions(part.positions, vertices, vertexOffset, 6);
      yield* interleavedColors(part.colors, vertices, vertexOffset, part.kind === "city" ? colourOwners : undefined, !minecraft);
      let written = 0;
      for (const bytes of binarySlices(part.indices, 12)) {
        const source = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
        for (let i = 0; i < source.length; i++) {
          if (source[i] >= count) throw new Error("Surrounding-city index exceeds the source mesh");
          indices[indexOffset + written + i] = vertexOffset + source[i];
        }
        written += source.length;
        yield;
      }
      const panoramaTransferred = yield* replacePanoramaFacadeV202(id, minecraft, part, indices, indexOffset);
      if (panoramaTransferred) root.userData.panoramaTransferredTriangles = (root.userData.panoramaTransferredTriangles ?? 0) + panoramaTransferred;
      const siteTransferred = yield* transferSiteTrianglesV209(id, minecraft, part, indices, indexOffset);
      if (siteTransferred) root.userData.siteTransferredTrianglesV209 = (root.userData.siteTransferredTrianglesV209 ?? 0) + siteTransferred;
      // The v169 core resident packets contain source shells only. Refine the
      // existing streamed drawn window recipes; never add a second facade.
      if (!minecraft && !id.startsWith("alt-mitte-v169-") && part.kind === "alt-mitte-v169") {
        const shaded = yield* shadeAltMitteFacadeV186(vertices, indices, indexOffset, written);
        root.userData.altMitteWindowRelief = (root.userData.altMitteWindowRelief ?? 0) + shaded;
      }
      vertexOffset += count;
      indexOffset += written;
    }
    let geometryBytes = vertices.byteLength + indices.byteLength;
    let bufferCount = 0;
    const lines = chunk.lines?.positions && !minecraft ? chunk.lines : null;
    const lineCount = lines ? encodedBytes(lines.positions, 12) / 6 : 0;
    if (lineCount > MAX_VERTEX_COUNT) {
      throw new Error("Surrounding-city ink exceeds the tile budget");
    }
    const hasLineColors = !!lines?.colors;
    if (hasLineColors && encodedBytes(lines!.colors!, 3) !== lineCount * 3) {
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
    if (lines && lineCount) {
      const geometry = new BufferGeometry();
      const values = new Uint16Array(lineCount * (hasLineColors ? 6 : 3));
      // Attach ownership before the first decode checkpoint so cancellation
      // disposes this unpublished geometry/material as well as the mesh.
      if (hasLineColors) {
        const data = new InterleavedBuffer(values, 6);
        geometry.setAttribute("position", new InterleavedBufferAttribute(data, 3, 0));
        geometry.setAttribute("color", new InterleavedBufferAttribute(data, 3, 3, true));
      } else geometry.setAttribute("position", new BufferAttribute(values, 3));
      const material = hasLineColors
        ? markArchitecturalAccentInk(new LineBasicMaterial({ vertexColors: true }), 0xffffff, "silhouette")
        : markArchitecturalInk(new LineBasicMaterial(), "silhouette");
      const ink = new LineSegments(geometry, material);
      ink.name = `${root.name} ink lines`;
      ink.scale.setScalar(0.01);
      ink.renderOrder = 2;
      root.add(ink);
      yield* interleavedPositions(lines.positions, values, 0, hasLineColors ? 6 : 3);
      if (hasLineColors) yield* interleavedColors(lines.colors!, values, 0);
      root.userData.siteTransferredLineSegmentsV209 = yield* transferSiteLinesV209(id, lines, values, hasLineColors ? 6 : 3);
      geometryBytes += values.byteLength;
      yield* geometryBounds(geometry);
      bufferCount++;
    }
    // These fresh per-tile arrays are owned only by this unpublished root.
    if (parkBacking) yield* parkStaticGeometrySteps(root, true);
    const result = { root: freezeStaticSceneTransforms(root), geometryBytes, bufferCount,
      nav: siteNavigationV209(id, chunk.nav), origin: chunk.origin };
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
  const iterator = buildSurroundingCityChunk(chunk, id, minecraft, true);
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
    const ground = nav.groundY + (building.groundOffset ?? 0);
    if (y < ground + building.minHeight || y > ground + building.height) return false;
    const [west, north, east, south] = boundsOf(building);
    if (x + radius < west || x - radius > east || z + radius < north || z - radius > south) return false;
    if (surroundingPolygonContains(building, x, z)) return true;
    return radius > 0 && (ringDistanceSquared(building.ring, x, z) < radius * radius ||
      building.holes.some(ring => ringDistanceSquared(ring, x, z) < radius * radius));
  });
}
