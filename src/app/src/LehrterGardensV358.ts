import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  ShapeUtils,
  Vector2,
} from "three";
import gardens from "./data/lehrterGardensV358.json";
import { groundTopSampler, smoothGroundTopSampler, type VoxelPayload } from "./terrainPayload";

type Point = readonly [number, number];

const ORIGIN_X = -397;
const ORIGIN_Z = -1028;
const BLOCK_METRES = 0.5;

const DRAWN_PALETTE = [0xa69477, 0x799059, 0x8e7454, 0x577149, 0x597344, 0x49643f];
const NATIVE_PALETTE = [0xa79375, 0x768c57, 0x80694c, 0x5b7748, 0x567040, 0x48623b];

// An older grass slab can span several elevation samples while retaining the
// height of its centre. Read the actual displayed tops in this small area.
function displayedGardenGround(slabs: InstancedMesh | undefined, cell: number): Map<string, number> {
  const tops = new Map<string, number>();
  if (!slabs) return tops;
  const matrices = slabs.instanceMatrix.array;
  for (let instance = 0; instance < slabs.count; instance += 1) {
    const i = instance * 16;
    const x = matrices[i + 12], z = matrices[i + 14];
    const halfX = matrices[i] / 2, halfZ = matrices[i + 10] / 2;
    if (x + halfX < ORIGIN_X - 90 || x - halfX > ORIGIN_X + 90 ||
        z + halfZ < ORIGIN_Z - 75 || z - halfZ > ORIGIN_Z + 75) continue;
    const top = matrices[i + 13] + matrices[i + 5] / 2;
    const firstX = Math.floor(Math.max(x - halfX, ORIGIN_X - 90) / cell);
    const lastX = Math.ceil(Math.min(x + halfX, ORIGIN_X + 90) / cell);
    const firstZ = Math.floor(Math.max(z - halfZ, ORIGIN_Z - 75) / cell);
    const lastZ = Math.ceil(Math.min(z + halfZ, ORIGIN_Z + 75) / cell);
    for (let ix = firstX; ix < lastX; ix += 1) {
      for (let iz = firstZ; iz < lastZ; iz += 1) {
        const key = `${ix}:${iz}`;
        tops.set(key, Math.max(top, tops.get(key) ?? -Infinity));
      }
    }
  }
  return tops;
}

function clipGardenPolygon(
  points: Point[], axis: 0 | 1, edge: number, side: 1 | -1,
): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = (a[axis] - edge) * side, db = (b[axis] - edge) * side;
    if (da >= 0) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const weight = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * weight, a[1] + (b[1] - a[1]) * weight]);
    }
  }
  return result;
}

export function createLehrterGardensV358(
  ground: VoxelPayload, native = false, slabs?: InstancedMesh,
): Group {
  const gardensGroup = new Group();
  gardensGroup.name = native ? "Kleingartenanlage Lehrter Straße Minecraft" : "Kleingartenanlage Lehrter Straße";
  gardensGroup.position.set(ORIGIN_X, 0, ORIGIN_Z);

  const { min_x_idx: minX, min_z_idx: minZ } = ground.grid;
  const sample = native ? groundTopSampler(ground) : smoothGroundTopSampler(ground);
  const elevation = (x: number, z: number) => sample(x / ground.cell_m - minX, z / ground.cell_m - minZ);
  const cell = ground.cell_m;
  const tops = displayedGardenGround(slabs, cell);
  const slabTop = (x: number, z: number) => tops.get(`${x}:${z}`) ?? -Infinity;
  const palette = (native ? NATIVE_PALETTE : DRAWN_PALETTE).map((hex) => new Color(hex));
  const sidePalette = palette.map((color) => color.clone().multiplyScalar(0.77));
  const positions: number[] = [];
  const colors: number[] = [];

  function vertex([x, z]: Point, y: number, color: Color): void {
    positions.push(x - ORIGIN_X, y, z - ORIGIN_Z);
    colors.push(color.r, color.g, color.b);
  }

  function sides(ring: Point[], bottoms: number[], tops: number[], color: Color): void {
    for (let i = 0; i < ring.length; i += 1) {
      const next = (i + 1) % ring.length;
      vertex(ring[i], bottoms[i], color);
      vertex(ring[next], bottoms[next], color);
      vertex(ring[next], tops[next], color);
      vertex(ring[i], bottoms[i], color);
      vertex(ring[next], tops[next], color);
      vertex(ring[i], tops[i], color);
    }
  }

  if (native) {
    for (const [kind, height, xIndex, zIndex, run] of gardens.native) {
      const x = xIndex * BLOCK_METRES;
      const z = zIndex * BLOCK_METRES;
      const xEnd = x + run * BLOCK_METRES;
      const zEnd = z + BLOCK_METRES;
      // Keep each run level with the Native terrain block underneath it.
      for (let start = x; start < xEnd;) {
        const end = Math.min(xEnd, (Math.floor(start / ground.cell_m) + 1) * ground.cell_m);
        const cx = (start + end) / 2, cz = (z + zEnd) / 2;
        const base = Math.max(elevation(cx, cz), slabTop(Math.floor(cx / cell), Math.floor(cz / cell))) + 0.07;
        const top = base + height;
        const corners: Point[] = [[start, z], [start, zEnd], [end, zEnd], [end, z]];
        for (const index of [0, 1, 2, 0, 2, 3]) vertex(corners[index], top, palette[kind]);
        if (height > 0) {
          sides(corners, [base, base, base, base], [top, top, top, top], sidePalette[kind]);
        }
        start = end;
      }
    }
  } else {
    for (const [rawKind, rawHeight, rawRings] of gardens.drawn) {
      const kind = rawKind as number;
      const height = rawHeight as number;
      const rings = rawRings as Point[][];
      const [outer, ...holes] = rings.map((ring) => ring.map(([x, z]) => new Vector2(x, z)));
      const flat = rings.flat();
      const clearance = 0.16 + kind * 0.008;
      for (const indices of ShapeUtils.triangulateShape(outer, holes)) {
        // ShapeUtils uses mathematical X/Y. Swap its winding for an upward-facing X/Z top.
        const triangle = indices.reverse().map((index) => flat[index]);
        const xs = triangle.map(([x]) => x), zs = triangle.map(([, z]) => z);
        for (let ix = Math.floor(Math.min(...xs) / cell); ix < Math.ceil(Math.max(...xs) / cell); ix += 1) {
          const strip = clipGardenPolygon(clipGardenPolygon(triangle, 0, ix * cell, 1), 0, (ix + 1) * cell, -1);
          if (strip.length < 3) continue;
          for (let iz = Math.floor(Math.min(...zs) / cell); iz < Math.ceil(Math.max(...zs) / cell); iz += 1) {
            const piece = clipGardenPolygon(clipGardenPolygon(strip, 1, iz * cell, 1), 1, (iz + 1) * cell, -1);
            if (piece.length < 3) continue;
            const under = slabTop(ix, iz);
            const bottom = piece.map(([x, z]) => Math.max(elevation(x, z) + clearance, under + 0.05 + kind * 0.008));
            const top = bottom.map((y) => y + height);
            for (let i = 1; i < piece.length - 1; i += 1) {
              for (const index of [0, i, i + 1]) vertex(piece[index], top[index], palette[kind]);
            }
            if (height > 0) sides(piece, bottom, top, sidePalette[kind]);
          }
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new MeshStandardMaterial({
    name: "Lehrter Straße garden paths and planting",
    vertexColors: true,
    roughness: 1,
    side: DoubleSide,
    flatShading: true,
  });
  gardensGroup.add(new Mesh(geometry, material));
  return gardensGroup;
}
