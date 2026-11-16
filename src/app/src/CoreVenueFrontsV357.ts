import type { PrismBuilding } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";
import { GendarmenmarktFacadeBuilder, type PerimeterFacadeEdge } from "./GendarmenmarktFacadeBuilder";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import source from "./data/coreVenueFrontsV357.json";

type Pair = [number, number];
type Column = [x: number, z: number, bottom: number, top: number, material: number];
type Sign = { width: number; height: number; bottom: number; backing?: number; ink?: number };
type Band = { width: number; bottom: number; top: number; fill: number; frame?: number; bays?: number };
const palette = {
  club: [0x403842, 0xf2e8de],
  pub: [0x58392d, 0xf2e6cf],
  restaurant: [0x774035, 0xf7e6bc],
  company: [0x39424a, 0xf1f1eb],
  "health-insurance": [0xdce7d4, 0x285b3e],
} as const;
type Front = {
  id: string; name: string; kind: keyof typeof palette;
  owner: string; base: number; height: number; edge: [Pair, Pair]; side: number; offset: number;
  native: { cells: Column[]; normal: Pair; offset: number; bottom: number; top: number };
  sign: Sign | null; bands: Band[]; reference: string | null;
};
const fronts = source as unknown as Front[];
const sourceIds = new Set(fronts.map(front => front.owner));

function columnRuns(voxels: VoxelPayload, x: number, z: number): readonly Column[] {
  const offset = x - voxels.grid.min_x_idx;
  return voxels.building_rows?.[z - voxels.grid.min_z_idx]?.filter(
    ([start, count]) => offset >= start && offset < start + count,
  ) ?? [];
}

function nativeEdge(front: Front, voxels: VoxelPayload, base: PerimeterFacadeEdge): PerimeterFacadeEdge | null {
  if (voxels.cell_m !== 4) return null;
  const { cells, normal: [nx, nz], bottom, top } = front.native;
  if (!cells.length || Math.abs(nx) + Math.abs(nz) !== 1) return null;
  for (const [x, z, low, high, material] of cells) {
    if (!columnRuns(voxels, x, z).some(([, , a, b, c]) => a === low && b === high && c === material) ||
        columnRuns(voxels, x + nx, z + nz).some(([, , a, b]) => a < low + top * 10 && b > low + bottom * 10)) {
      return null;
    }
  }
  const [x, z, floor] = cells[0];
  const faceX = (x + .5 + nx / 2) * 4, faceZ = (z + .5 + nz / 2) * 4;
  const edgeLength = cells.length * 4;
  return {
    ...base,
    startXZ: [faceX - nz * 2, faceZ + nx * 2],
    endXZ: [faceX + nz * (edgeLength - 2), faceZ - nx * (edgeLength - 2)],
    wallBaseY: floor / 10,
    wallTopY: Math.min(...cells.map(column => column[3])) / 10,
    outwardSide: 1,
  };
}

/** The source wall remains responsible for every building volume and walk constraint. */
export function createCoreVenueFrontsV357(prisms: readonly PrismBuilding[], voxels?: VoxelPayload) {
  const sources = new Map(prisms.filter(prism => sourceIds.has(prism.id)).map(prism => [prism.id, prism]));
  const builder = new GendarmenmarktFacadeBuilder(Boolean(voxels), false, 0);
  const sites: string[] = [];
  for (const front of fronts) {
    const prism = sources.get(front.owner);
    if (!prism || prism.y0_dm !== front.base || prism.h_dm !== front.height) continue;
    const [[ax, az], [bx, bz]] = front.edge;
    if (!prism.ring.some(([x, z], i) => {
      const next = prism.ring[(i + 1) % prism.ring.length];
      return x === ax && z === az && next[0] === bx && next[1] === bz;
    })) continue;
    const drawn: PerimeterFacadeEdge = {
      startXZ: [ax / 10, az / 10], endXZ: [bx / 10, bz / 10],
      wallBaseY: front.base / 10, wallTopY: (front.base + front.height) / 10,
      outwardSide: front.side, street: "", prismId: front.owner,
    };
    const edge = voxels ? nativeEdge(front, voxels, drawn) : drawn;
    if (!edge) continue;
    const u = voxels ? front.native.offset : front.offset;
    const y = edge.wallBaseY;
    for (const { width, bottom, top, fill, frame, bays = 0 } of front.bands) {
      const height = top - bottom;
      builder.face(edge, u, y + bottom + height / 2, width, height, .045, fill, .23);
      if (frame !== undefined && bays > 0) {
        for (let j = 0; j <= bays; j++) {
          builder.face(edge, u + (j / bays - .5) * width, y + bottom + height / 2, .065, height, .06, frame, .27);
        }
        for (const level of [bottom, top]) {
          builder.face(edge, u, y + level, width, .07, .06, frame, .27);
        }
      }
    }
    if (front.sign) {
      const [backing, ink] = palette[front.kind];
      const sign = front.sign;
      builder.sign(edge, front.name, u, y + sign.bottom, sign.height, sign.width,
        sign.ink ?? ink, sign.backing ?? backing, .32);
    }
    sites.push(front.id);
  }
  const group = builder.finish("Berlin venue fronts");
  group.userData.sites = sites;
  return freezeStaticSceneTransforms(group);
}
