import {
  BufferGeometry, Color, Float32BufferAttribute, Group, type InstancedMesh,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { indexGeometryExactly } from "./exactGeometryIndex";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { ALLOTMENT_TOP_COLORS_V360, decodeAllotmentRingV360 } from "./AllotmentDetailsV360";
import { releaseScratchBuffer } from "./releaseScratchBuffer";
import { groundTopSampler, smoothGroundTopSampler, type VoxelPayload } from "./terrainPayload";
import packetUrl from "./data/allotmentDetailsV360Core.json.gz?url";

type Tile = {
  x: number;
  z: number;
  sheets: [number, number, number, number[][]][];
  runs: number[];
};
type Span = [left: number, right: number, top: number];

async function readCoreAllotments(signal: AbortSignal): Promise<Tile[]> {
  const response = await fetch(packetUrl, { signal });
  if (!response.ok) throw Error(`Allotment detail HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 18 || bytes.length > 256 * 1024) throw Error("Invalid allotment detail size");
  const size = new DataView(bytes.buffer).getUint32(bytes.length - 4, true);
  if (!size || size > 2 * 1024 * 1024) throw Error("Allotment detail exceeds its decoded allowance");
  const scratch = new Uint8Array(size + 1);
  try {
    const decoded = gunzipSync(bytes, { out: scratch });
    if (decoded.length !== size) throw Error("Unexpected allotment detail length");
    const tiles = (JSON.parse(new TextDecoder().decode(decoded)) as { tiles: Tile[] }).tiles;
    if (!Array.isArray(tiles) || tiles.length > 192) throw Error("Invalid allotment detail tiles");
    return tiles;
  } finally {
    releaseScratchBuffer(scratch.buffer);
  }
}

/** Existing raster runs can keep the height of their centre over several
 * terrain samples. Follow the surface actually drawn at each detail cell. */
function renderedGround(
  slabs: InstancedMesh | undefined, ground: VoxelPayload, native: boolean, tiles: Tile[],
): (x: number, z: number) => number {
  const cell = ground.cell_m;
  const { min_x_idx: minX, min_z_idx: minZ } = ground.grid;
  const sample = native ? groundTopSampler(ground) : smoothGroundTopSampler(ground);
  const rows = new Map<number, Span[]>();
  if (slabs) {
    for (const tile of tiles) {
      for (let z = Math.floor(tile.z / cell); z < Math.ceil((tile.z + 512) / cell); z++) {
        if (!rows.has(z)) rows.set(z, []);
      }
    }
    const matrices = slabs.instanceMatrix.array;
    for (let i = 0; i < slabs.count * 16; i += 16) {
      const x = matrices[i + 12], z = matrices[i + 14], row = rows.get(Math.floor(z / cell));
      if (!row || matrices[i] <= 0 || matrices[i + 5] <= 0) continue;
      row.push([x - matrices[i] / 2, x + matrices[i] / 2, matrices[i + 13] + matrices[i + 5] / 2]);
    }
  }
  return (x, z) => {
    let top = sample(x / cell - minX, z / cell - minZ);
    for (const [left, right, y] of rows.get(Math.floor(z / cell)) ?? []) {
      if (x >= left && x < right) top = Math.max(top, y);
    }
    return top + .09;
  };
}

function clip(points: Vector2[], axis: "x" | "y", cut: number, side: 1 | -1): Vector2[] {
  const result: Vector2[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = (a[axis] - cut) * side, db = (b[axis] - cut) * side;
    if (da >= 0) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) result.push(a.clone().lerp(b, da / (da - db)));
  }
  return result;
}

// One former 250,000-vertex non-indexed mesh carried nine Float32 words per vertex.
const CORE_GEOMETRY_BYTES = 9_000_000;

function makeCoreGeometry(positions: number[], paint: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(paint, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export async function loadCoreAllotmentsV360(signal: AbortSignal) {
  const tiles = await readCoreAllotments(signal);
  return function* build(
    ground: VoxelPayload, slabs: InstancedMesh | undefined, native: boolean,
  ): Generator<void, Group> {
    const group = new Group();
    group.name = native ? "Kartierte Kleingartenwege und Hecken (Minecraft)" : "Kartierte Kleingartenwege und Hecken";
    const sample = renderedGround(slabs, ground, native, tiles);
    const colors = ALLOTMENT_TOP_COLORS_V360.map(hex => new Color(hex));
    const shaded = colors.map(color => color.clone().multiplyScalar(.69));
    const positions: number[] = [], paint: number[] = [];
    const pieces: BufferGeometry[] = [];
    let indexedBytes = 0;
    const cell = ground.cell_m;
    function vertex(point: Vector2, y: number, color: Color) {
      if (positions.length >= 750_000) throw Error("Core allotment detail exceeds its geometry allowance");
      positions.push(point.x, y, point.y);
      paint.push(color.r, color.g, color.b);
    }
    function piece(ring: Vector2[], base: number, height: number, style: number) {
      const top = base + height;
      for (let i = 1; i < ring.length - 1; i++) {
        vertex(ring[0], top, colors[style]);
        vertex(ring[i], top, colors[style]);
        vertex(ring[i + 1], top, colors[style]);
      }
      if (!height) return;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length], shade = shaded[style];
        vertex(a, base, shade); vertex(b, base, shade); vertex(b, top, shade);
        vertex(a, base, shade); vertex(b, top, shade); vertex(a, top, shade);
      }
    }
    for (const tile of tiles) {
      if (native) {
        if (tile.runs.length % 7) throw Error("Invalid native allotment detail");
        for (let i = 0; i < tile.runs.length; i += 7) {
          const [x, z, w, d, , h, style] = tile.runs.slice(i, i + 7);
          const left = tile.x + x / 100, right = tile.x + (x + w) / 100;
          const near = tile.z + z / 100, far = tile.z + (z + d) / 100;
          for (let xx = left; xx < right;) {
            const nextX = Math.min(right, (Math.floor(xx / cell) + 1) * cell);
            for (let zz = near; zz < far;) {
              const nextZ = Math.min(far, (Math.floor(zz / cell) + 1) * cell);
              piece([new Vector2(xx, zz), new Vector2(xx, nextZ),
                new Vector2(nextX, nextZ), new Vector2(nextX, zz)],
              sample((xx + nextX) / 2, (zz + nextZ) / 2), h / 100, style);
              zz = nextZ;
            }
            xx = nextX;
          }
          if (i % 112 === 0) yield;
        }
      } else {
        for (const [, height, style, deltas] of tile.sheets) {
          const rings = deltas.map(d => decodeAllotmentRingV360(d).map(p =>
            new Vector2(tile.x + p.x / 100, tile.z + p.y / 100)));
          const [outer, ...holes] = rings;
          const vertices = rings.flat();
          for (const [a, b, c] of ShapeUtils.triangulateShape(outer, holes)) {
            const tri = [vertices[a], vertices[c], vertices[b]];
            const xs = tri.map(p => p.x), zs = tri.map(p => p.y);
            for (let x = Math.floor(Math.min(...xs) / cell); x < Math.ceil(Math.max(...xs) / cell); x++) {
              const stripe = clip(clip(tri, "x", x * cell, 1), "x", (x + 1) * cell, -1);
              if (stripe.length < 3) continue;
              for (let z = Math.floor(Math.min(...zs) / cell); z < Math.ceil(Math.max(...zs) / cell); z++) {
                const fragment = clip(clip(stripe, "y", z * cell, 1), "y", (z + 1) * cell, -1);
                if (fragment.length >= 3) piece(fragment, sample((x + .5) * cell, (z + .5) * cell), height / 100, style);
              }
            }
          }
          yield;
        }
      }
      if (!native && positions.length) {
        // Compute the original flat normals before sharing any corners. Finish
        // each tile separately so the temporary triangle soup stays bounded.
        const tileGeometry = makeCoreGeometry(positions, paint);
        const indexed = indexGeometryExactly(tileGeometry);
        if (!tileGeometry.index) {
          tileGeometry.setIndex(Array.from({ length: indexed.vertexCount }, (_, i) => i));
        }
        // The merged index may need 32-bit entries even if this tile uses 16.
        indexedBytes += indexed.vertexCount * 36 + tileGeometry.index!.count * 4;
        if (indexedBytes > CORE_GEOMETRY_BYTES) throw Error("Core allotment detail exceeds its geometry allowance");
        pieces.push(tileGeometry);
        positions.length = 0;
        paint.length = 0;
        yield;
      }
    }
    if (!positions.length && !pieces.length) return group;
    const geometry = native ? makeCoreGeometry(positions, paint) : mergeGeometries(pieces);
    if (!geometry) throw Error("Could not join indexed allotment detail");
    geometry.computeBoundingSphere();
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true });
    const mesh = new Mesh(geometry, dayMaterial);
    mesh.userData = { dayMaterial, nightMaterial, nativeMinecraft: native };
    group.add(mesh);
    return group;
  };
}
