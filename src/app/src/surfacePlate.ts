import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
} from "three";

import type { PretriangulatedSurfaceKind } from "./IsometricCityWorld";

const MAGIC = "ISOPLT01";
const HEADER_BYTES = 32;
const FORMAT_VERSION = 1;

export const ASPHALT_PLATE_INDEX_BATCH_SIZE = 90_000;

const KIND_CODE: Record<PretriangulatedSurfaceKind, number> = {
  asphalt: 1,
  paving: 2,
};

export const SURFACE_PLATE_MANIFEST_FILE =
  "surface-pretriangulation.json";

export type SurfacePlateManifestEntry = {
  compressed_bytes: number;
  file: string;
  index_count: number;
  kind: PretriangulatedSurfaceKind;
  raw_bytes: number;
  vertex_count: number;
};

export type SurfacePlateManifest = {
  format: "isometric-berlin-surface-plate";
  schema_version: 1;
  source_file: "surface-polygons.json";
  source_sha256: string;
  stage: "post-earcut-pre-terrain-drape";
  plates: SurfacePlateManifestEntry[];
};

export function encodeSurfacePlate(
  kind: PretriangulatedSurfaceKind,
  geometry: BufferGeometry,
): Uint8Array {
  const position = geometry.getAttribute("position");
  if (!(position instanceof BufferAttribute) || position.itemSize !== 3) {
    throw new Error(`${kind} surface plate has no vec3 position attribute`);
  }
  const positions = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    positions[index * 3] = position.getX(index);
    positions[index * 3 + 1] = position.getY(index);
    positions[index * 3 + 2] = position.getZ(index);
  }
  const sourceIndex = geometry.getIndex();
  const indices = new Uint32Array(sourceIndex?.count ?? position.count);
  if (sourceIndex) {
    for (let index = 0; index < sourceIndex.count; index += 1) {
      indices[index] = sourceIndex.getX(index);
    }
  } else {
    for (let index = 0; index < position.count; index += 1) {
      indices[index] = index;
    }
  }

  const output = new Uint8Array(
    HEADER_BYTES + positions.byteLength + indices.byteLength,
  );
  const view = new DataView(output.buffer);
  for (let index = 0; index < MAGIC.length; index += 1) {
    output[index] = MAGIC.charCodeAt(index);
  }
  view.setUint32(8, FORMAT_VERSION, true);
  view.setUint32(12, KIND_CODE[kind], true);
  view.setUint32(16, position.count, true);
  view.setUint32(20, indices.length, true);
  view.setUint32(24, positions.byteLength, true);
  view.setUint32(28, indices.byteLength, true);
  output.set(new Uint8Array(positions.buffer), HEADER_BYTES);
  output.set(
    new Uint8Array(indices.buffer),
    HEADER_BYTES + positions.byteLength,
  );
  return output;
}

/** Decode the lossless Earcut result and restore its constant planar normal. */
export function decodeSurfacePlate(
  bytes: ArrayBuffer,
  expectedKind: PretriangulatedSurfaceKind,
): BufferGeometry {
  if (bytes.byteLength < HEADER_BYTES) {
    throw new Error("Surface plate is shorter than its header");
  }
  const raw = new Uint8Array(bytes);
  const magic = String.fromCharCode(...raw.subarray(0, MAGIC.length));
  const view = new DataView(bytes);
  const version = view.getUint32(8, true);
  const kindCode = view.getUint32(12, true);
  const vertexCount = view.getUint32(16, true);
  const indexCount = view.getUint32(20, true);
  const positionBytes = view.getUint32(24, true);
  const indexBytes = view.getUint32(28, true);
  if (magic !== MAGIC || version !== FORMAT_VERSION) {
    throw new Error("Unsupported surface plate format");
  }
  if (kindCode !== KIND_CODE[expectedKind]) {
    throw new Error(`Surface plate kind does not match ${expectedKind}`);
  }
  if (
    positionBytes !== vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT ||
    indexBytes !== indexCount * Uint32Array.BYTES_PER_ELEMENT ||
    HEADER_BYTES + positionBytes + indexBytes !== bytes.byteLength
  ) {
    throw new Error("Surface plate byte counts are inconsistent");
  }

  // Copy out of the decompression response once. The resulting arrays are
  // then owned by Three and can be transferred/detached by the Worker without
  // retaining the full compressed response buffer.
  const positions = new Float32Array(vertexCount * 3);
  positions.set(
    new Float32Array(bytes, HEADER_BYTES, vertexCount * 3),
  );
  const indices = new Uint32Array(indexCount);
  indices.set(
    new Uint32Array(bytes, HEADER_BYTES + positionBytes, indexCount),
  );
  const normals = new Float32Array(vertexCount * 3);
  for (let index = 2; index < normals.length; index += 3) {
    normals[index] = 1;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  return geometry;
}

/**
 * Split an indexed plate on triangle boundaries before terrain tessellation.
 * Triangle coordinates and order stay exact; local index remapping merely
 * prevents the tessellator from owning the complete 2,566-hole asphalt union
 * at once. The finished chunks can be merged back without a visual or topology
 * change.
 */
export function splitIndexedSurfacePlate(
  source: BufferGeometry,
  maxIndexCount = ASPHALT_PLATE_INDEX_BATCH_SIZE,
): BufferGeometry[] {
  const sourcePosition = source.getAttribute("position");
  const sourceNormal = source.getAttribute("normal");
  const sourceIndex = source.getIndex();
  if (
    !(sourcePosition instanceof BufferAttribute) ||
    sourcePosition.itemSize !== 3 ||
    !(sourceNormal instanceof BufferAttribute) ||
    sourceNormal.itemSize !== 3 ||
    !sourceIndex
  ) {
    throw new Error("Surface plate cannot be partitioned without indexed vec3 data");
  }
  const boundedIndexCount = Math.max(
    3,
    Math.floor(maxIndexCount / 3) * 3,
  );
  const chunks: BufferGeometry[] = [];
  for (
    let offset = 0;
    offset < sourceIndex.count;
    offset += boundedIndexCount
  ) {
    const end = Math.min(sourceIndex.count, offset + boundedIndexCount);
    const remap = new Map<number, number>();
    const positions: number[] = [];
    const normals: number[] = [];
    const indices = new Uint32Array(end - offset);
    for (let index = offset; index < end; index += 1) {
      const sourceVertex = sourceIndex.getX(index);
      let localVertex = remap.get(sourceVertex);
      if (localVertex === undefined) {
        localVertex = remap.size;
        remap.set(sourceVertex, localVertex);
        positions.push(
          sourcePosition.getX(sourceVertex),
          sourcePosition.getY(sourceVertex),
          sourcePosition.getZ(sourceVertex),
        );
        normals.push(
          sourceNormal.getX(sourceVertex),
          sourceNormal.getY(sourceVertex),
          sourceNormal.getZ(sourceVertex),
        );
      }
      indices[index - offset] = localVertex;
    }
    const chunk = new BufferGeometry();
    chunk.setAttribute("position", new Float32BufferAttribute(positions, 3));
    chunk.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    chunk.setIndex(new BufferAttribute(indices, 1));
    chunks.push(chunk);
  }
  return chunks;
}

export async function fetchSurfacePlate(
  rootUrl: URL,
  entry: SurfacePlateManifestEntry,
  signal?: AbortSignal,
): Promise<BufferGeometry> {
  const response = await fetch(new URL(entry.file, rootUrl), { signal });
  if (!response.ok) {
    throw new Error(
      `Surface plate ${entry.kind} failed with HTTP ${response.status}`,
    );
  }
  let bytes = await response.arrayBuffer();
  // Some static servers (including Vite preview) attach Content-Encoding to
  // a `.gz` file, so fetch transparently returns the already inflated plate;
  // GitHub/static file hosts may return the gzip bytes verbatim. Accept both
  // without guessing from headers that browsers retain after decoding.
  const magic = String.fromCharCode(
    ...new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength)),
  );
  if (magic !== MAGIC) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("This browser cannot decompress the surface plate");
    }
    const compressed = new Response(bytes).body;
    if (!compressed) throw new Error("Surface plate response has no body");
    bytes = await new Response(
      compressed.pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer();
  }
  const geometry = decodeSurfacePlate(bytes, entry.kind);
  if (
    geometry.getAttribute("position").count !== entry.vertex_count ||
    geometry.getIndex()?.count !== entry.index_count
  ) {
    geometry.dispose();
    throw new Error(`Surface plate ${entry.kind} does not match its manifest`);
  }
  return geometry;
}
