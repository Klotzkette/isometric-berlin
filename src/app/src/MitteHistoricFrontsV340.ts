import type { PrismBuilding } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";
import {
  GendarmenmarktFacadeBuilder, perimeterEdgeLength, type PerimeterFacadeEdge,
} from "./GendarmenmarktFacadeBuilder";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import receipts from "./data/mitteHistoricFrontsV340.json";

type Front = typeof receipts[number];

function samePart(part: PrismBuilding | undefined, source: Front["source"]): boolean {
  return part?.y0_dm === source.y0_dm && part.h_dm === source.h_dm &&
    part.class === source.class && part.roof === source.roof &&
    JSON.stringify(part.ring) === JSON.stringify(source.ring) &&
    JSON.stringify(part.holes ?? []) === JSON.stringify(source.holes);
}

function streetEdge(front: Front): PerimeterFacadeEdge {
  const { id, ring, h_dm, y0_dm } = front.source;
  const start = ring[front.edge], end = ring[(front.edge + 1) % ring.length];
  const area = ring.reduce((sum, [x, z], i) => {
    const [px, pz] = ring[(i + ring.length - 1) % ring.length];
    return sum + px * z - pz * x;
  }, 0);
  return {
    startXZ: start.map(n => n / 10), endXZ: end.map(n => n / 10),
    wallBaseY: y0_dm / 10, wallTopY: (y0_dm + h_dm) / 10,
    outwardSide: area > 0 ? -1 : 1, street: front.address, prismId: id,
  };
}

function addFront(builder: GendarmenmarktFacadeBuilder, front: Front, edge: PerimeterFacadeEdge,
  bays: number, native: boolean, entrance: boolean, balcony: boolean): void {
  const length = perimeterEdgeLength(edge);
  const body = edge.wallTopY - edge.wallBaseY;
  const pitch = (body - .55) / front.floors;
  const bay = (length - (native ? .46 : .75)) / bays;
  const base = edge.wallBaseY;
  const trim = front.trim;
  const decorated = front.style === "renaissance";
  const width = Math.min(decorated ? 1.43 : 1.26, bay * .58);
  const height = Math.min(1.86, pitch * .60);
  // This thin wall finish clears both the original facade ink and the
  // independent ordinary panes at their maximum 0.176 m offset.
  builder.face(edge, length / 2, base + body / 2, length - .018, body - .025, .19, front.wall, .098);
  builder.face(edge, length / 2, base + .25, length - .035, .44, .23, 0xa29a89, .14);
  builder.face(edge, length / 2, edge.wallTopY - .22, length - .04, .25, .30, trim, .16);
  if (decorated || front.style === "corner") {
    builder.face(edge, length / 2, base + pitch, length - .05, .20, .29, trim, .15);
    builder.face(edge, length / 2, edge.wallTopY - .48, length - .04, .09, .20, 0xa69679, .16);
  }

  for (let column = 0; column < bays; column++) {
    const u = (length - bay * bays) / 2 + (column + .5) * bay;
    const central = column === Math.floor(bays / 2);
    for (let floor = 0; floor < front.floors; floor++) {
      const gateway = floor === 0 && central && entrance;
      const windowHeight = gateway ? Math.min(2.88, pitch - .35) : height;
      const windowWidth = gateway ? Math.min(bay * .85, 2.24) : width;
      const y = gateway ? base + .13 + windowHeight / 2 : base + (floor + .53) * pitch;
      const glass = gateway ? 0x54544b : (floor + column) % 4 === 0 ? 0x697e80 : 0x53686a;
      builder.window(edge, u, y, windowWidth, windowHeight, trim, 0xa7a697, glass,
        gateway || (decorated && floor === 0), .27, gateway);
      if (decorated && floor === 1 && !native) {
        const hood = y + height / 2 + .16;
        builder.beam(builder.point(edge, u - width * .62, hood, .35),
          builder.point(edge, u, hood + (column % 2 === 0 ? .24 : .14), .35), .105, trim);
        builder.beam(builder.point(edge, u, hood + (column % 2 === 0 ? .24 : .14), .35),
          builder.point(edge, u + width * .62, hood, .35), .105, trim);
      }
      if (decorated && balcony && (central || (!native && (column === 1 || column === bays - 2))) && floor === 1) {
        const slab = y - height / 2 - .10;
        builder.face(edge, u, slab, width + .55, .18, .71, trim, .47);
        builder.rail(edge, u, slab + .94, width + .50, .79, 0x464843);
      }
    }
  }
}

function columnRuns(voxels: VoxelPayload, x: number, z: number) {
  const offset = x - voxels.grid.min_x_idx;
  return voxels.building_rows?.[z - voxels.grid.min_z_idx]?.filter(([start, count]) => offset >= start && offset < start + count) ??
    voxels.buildings?.filter(([xx, zz]) => xx === x && zz === z) ?? [];
}

function matchesColumn(voxels: VoxelPayload, x: number, z: number, low: number, high: number, cls: number): boolean {
  return columnRuns(voxels, x, z).some(([, , bottom, top, kind]) => bottom === low && top === high && kind === cls);
}

export function createMitteHistoricFrontsV340(prisms: readonly PrismBuilding[], voxels?: VoxelPayload) {
  const matched = new Map<string, PrismBuilding>();
  for (const part of prisms) {
    if (sourceIds.has(part.id)) matched.set(part.id, part);
  }
  // Keep the builder's small native shape path, but do not use its coarse-wall
  // clearance: these edges are located directly on verified voxel faces.
  const builder = new GendarmenmarktFacadeBuilder(Boolean(voxels), true, 0);
  const addresses: string[] = [];
  let nativeFaces = 0;
  for (const front of receipts) {
    if (!samePart(matched.get(front.source.id), front.source)) continue;
    const edge = streetEdge(front);
    const entrance = front.style === "arch" || front.style === "renaissance";
    if (!voxels) {
      addFront(builder, front, edge, front.bays, false, entrance, true);
      addresses.push(front.address);
      continue;
    }
    if (voxels.cell_m !== 4) continue;
    const faces = front.native.filter(([x, z, low, high, cls, dx, dz]) =>
      matchesColumn(voxels, x, z, low, high, cls) &&
      !columnRuns(voxels, x + dx, z + dz).some(([, , , top]) => top > low + (high - low) * .45));
    if (faces.length !== front.native.length) continue;
    const midX = (edge.startXZ[0] + edge.endXZ[0]) / 2;
    const midZ = (edge.startXZ[1] + edge.endXZ[1]) / 2;
    let entranceFace = -1, distance = Infinity;
    faces.forEach(([x, z, , , , dx, dz], i) => {
      const d = Math.hypot((x + .5 + dx / 2) * voxels.cell_m - midX, (z + .5 + dz / 2) * voxels.cell_m - midZ);
      if (d < distance) { entranceFace = i; distance = d; }
    });
    for (const [i, [x, z, low, high, , dx, dz]] of faces.entries()) {
      const half = voxels.cell_m / 2;
      const faceX = (x + .5 + dx / 2) * voxels.cell_m;
      const faceZ = (z + .5 + dz / 2) * voxels.cell_m;
      addFront(builder, front, {
        ...edge,
        startXZ: [faceX - dz * half, faceZ + dx * half],
        endXZ: [faceX + dz * half, faceZ - dx * half],
        outwardSide: 1, wallBaseY: low / 10, wallTopY: high / 10,
      }, 1, true, entrance && i === entranceFace, i === entranceFace);
    }
    if (faces.length) addresses.push(front.address);
    nativeFaces += faces.length;
  }
  const model = builder.finish("Historic street fronts in the Spandauer Vorstadt");
  Object.assign(model.userData, { addresses, nativeFaces, blockNative: Boolean(voxels), keepInMinecraft: Boolean(voxels) });
  return freezeStaticSceneTransforms(model);
}

const sourceIds = new Set(receipts.map(front => front.source.id));
