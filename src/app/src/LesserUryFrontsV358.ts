import type { PrismBuilding } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";
import {
  GendarmenmarktFacadeBuilder, perimeterEdgeLength, type PerimeterFacadeEdge,
} from "./GendarmenmarktFacadeBuilder";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { addZilleEstateV366 } from "./ZilleEstateFacesV366";
import data from "./data/lesserUryV358.json";

type Point = [x: number, z: number];
type Face = [edgeIndex: number, side: number, start: Point, end: Point];
type Cell = [x: number, z: number, dx: number, dz: number, bottom: number, top: number, material: number];
type Housing = {
  owner: string;
  address: string;
  base: number;
  height: number;
  floors: number;
  tone: keyof typeof finishes;
  faces: Face[];
  cells: Cell[];
};

const finishes = {
  taupe: { plaster: 0xa69a82, plinth: 0x6f5861 },
  sand: { plaster: 0xb1a48a, plinth: 0x796b61 },
  clay: { plaster: 0xa79483, plinth: 0x775d60 },
} as const;
const source = data as unknown as Housing[];
const ids = new Set(source.map(site => site.owner));
const street = "Lesser-Ury-Weg";

function columnRuns(voxels: VoxelPayload, x: number, z: number) {
  const offset = x - voxels.grid.min_x_idx;
  return voxels.building_rows?.[z - voxels.grid.min_z_idx]?.filter(
    ([start, count]) => offset >= start && offset < start + count,
  ) ?? [];
}

function verifiedBlockFace(
  site: Housing, [x, z, dx, dz, bottom, top, material]: Cell, voxels: VoxelPayload,
): PerimeterFacadeEdge | null {
  if (voxels.cell_m !== 4 || Math.abs(dx) + Math.abs(dz) !== 1 ||
      !columnRuns(voxels, x, z).some(([, , a, b, c]) => a === bottom && b === top && c === material) ||
      columnRuns(voxels, x + dx, z + dz).some(([, , a, b]) => a < top && b > bottom)) return null;
  const faceX = (x + .5 + dx / 2) * 4, faceZ = (z + .5 + dz / 2) * 4;
  return {
    startXZ: [faceX - dz * 2, faceZ + dx * 2],
    endXZ: [faceX + dz * 2, faceZ - dx * 2],
    wallBaseY: bottom / 10, wallTopY: top / 10, outwardSide: 1, street, prismId: site.owner,
  };
}

function addHousingFacade(
  builder: GendarmenmarktFacadeBuilder, site: Housing, edge: PerimeterFacadeEdge,
): void {
  const length = perimeterEdgeLength(edge);
  const base = edge.wallBaseY, height = edge.wallTopY - base;
  const { plaster, plinth } = finishes[site.tone];
  const pitch = height / site.floors;
  const baseHeight = pitch + .03;
  const bays = Math.max(1, Math.floor(length / 2.65));
  const half = length / 2;
  // Near-coplanar coatings cover the generic glazing at its old offsets.
  builder.face(edge, half, base + height / 2, length, height, .075, plaster, .152);
  builder.face(edge, half, base + baseHeight / 2, length, baseHeight, .08, plinth, .16);
  builder.face(edge, half, base + baseHeight, length, .12, .07, 0x867769, .20);
  builder.face(edge, half, edge.wallTopY - .16, length, .21, .10, 0xb2a995, .19);

  for (let row = 0; row < site.floors; row++) {
    for (let bay = 0; bay < bays; bay++) {
      const u = length * (bay + .5) / bays;
      const y = base + (row + .57) * pitch;
      const width = row === 0 ? 1.18 : 1.57;
      const opening = row === 0 ? 1.03 : 1.42;
      builder.face(edge, u, y, width, opening, .075, 0xd9d6cb, .22);
      builder.face(edge, u - width * .235, y, width * .405, opening - .14, .05, 0x626f71, .256, "glass");
      builder.face(edge, u + width * .235, y, width * .415, opening - .14, .05, 0x536366, .256, "glass");
      builder.face(edge, u, y - opening / 2 - .055, width + .19, .095, .16, 0xb5b1a4, .239);
    }
  }
}

/** The existing LoD2 walls and 4 m raster cells keep their geometry and collision. */
export function createLesserUryFrontsV358(prisms: readonly PrismBuilding[], voxels?: VoxelPayload) {
  const owners = new Map(prisms.filter(prism => ids.has(prism.id)).map(prism => [prism.id, prism]));
  const builder = new GendarmenmarktFacadeBuilder(Boolean(voxels), false, 0);
  const addresses = new Set<string>();
  const cells = new Set<string>();

  for (const site of source) {
    const wall = owners.get(site.owner);
    if (!wall || wall.y0_dm !== site.base || wall.h_dm !== site.height ||
        !site.faces.every(([i, , [ax, az], [bx, bz]]) => {
          const from = wall.ring[i], to = wall.ring[(i + 1) % wall.ring.length];
          return from?.[0] === ax && from[1] === az && to?.[0] === bx && to[1] === bz;
        })) continue;

    if (voxels) {
      for (const cell of site.cells) {
        const key = cell.slice(0, 4).join("/");
        if (cells.has(key)) continue;
        const edge = verifiedBlockFace(site, cell, voxels);
        if (!edge) continue;
        addHousingFacade(builder, site, edge);
        cells.add(key);
        addresses.add(site.address);
      }
    } else {
      for (const [, outwardSide, [ax, az], [bx, bz]] of site.faces) {
        addHousingFacade(builder, site, {
          startXZ: [ax / 10, az / 10], endXZ: [bx / 10, bz / 10], outwardSide,
          wallBaseY: site.base / 10, wallTopY: (site.base + site.height) / 10,
          street, prismId: site.owner,
        });
      }
      addresses.add(site.address);
    }
  }
  const estate = addZilleEstateV366(builder, prisms, voxels);
  const group = builder.finish("Lesser-Ury-Weg Heinrich-Zille-Siedlung");
  group.userData.estate = estate;
  group.userData.addresses = [...addresses];
  group.userData.textureFree = true;
  return freezeStaticSceneTransforms(group);
}
