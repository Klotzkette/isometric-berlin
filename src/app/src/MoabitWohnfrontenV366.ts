import {
  GendarmenmarktFacadeBuilder, perimeterEdgeLength, type PerimeterFacadeEdge,
} from "./GendarmenmarktFacadeBuilder";
import type { VoxelPayload } from "./terrainPayload";
import source from "./data/moabitWohnfrontenV366.json";

type Site = typeof source[number];
const cream = 0xd1c9b7, grey = 0xaaa99c, brick = 0xad6550, darkBrick = 0x855044;
const plaster = 0xc4b9a5, iron = 0x4c5655, glass = 0x536363;
const fingerprints = new Map(source.map(s => [s.prism.id, JSON.stringify(s.prism)]));

function exposedVoxel(v: VoxelPayload, cell: number[]): boolean {
  const [x, z, dx, dz, lo, hi, kind] = cell;
  function column(cx: number, cz: number) {
    const offset = cx - v.grid.min_x_idx;
    return v.building_rows?.[cz - v.grid.min_z_idx]?.filter(
      ([start, count]) => start <= offset && offset < start + count,
    ) ?? [];
  }
  return column(x, z).some(([, , a, b, c]) => a === lo && b === hi && c === kind) &&
    !column(x + dx, z + dz).some(([, , a, b]) => a < hi && b > lo);
}

function facade(builder: GendarmenmarktFacadeBuilder, site: Site, edge: PerimeterFacadeEdge): void {
  const length = perimeterEdgeLength(edge), base = edge.wallBaseY;
  const h = edge.wallTopY - base - .22, pitch = h / 5;
  const rathenower = site.prism.id === "21453601";
  const plain = site.prism.id === "20512410";
  const balcony = site.prism.id === "20512422";
  const palazzo = site.prism.id === "20839232";
  const axes = palazzo ? 8 : 7;
  const band = (y: number, height: number, color: number, out = .26, depth = .12) =>
    builder.face(edge, length / 2, y, length, height, depth, color, out);
  const field = rathenower ? 0xd4c6b0 : balcony ? 0xbab9a9 : palazzo ? 0xc9c2b9 : 0xbcb7a7;

  band(base + h / 2, h, field, .18, .08);
  band(base + pitch, pitch * 2, rathenower ? darkBrick : plain ? field : grey, .245, .085);
  band(base + .18, .34, 0x827b70);
  band(base + h - .16, .21, plain ? field : cream, .35, .36);
  if (rathenower) band(base + h - .59, .52, brick);
  if (!plain) {
    band(base + pitch * 2, .16, cream, .36, .30);
    if (!rathenower) {
      band(base + pitch * 3, .10, cream);
      for (let j = 1; j < 11; j++)
        band(base + pitch * 2 * j / 11, .05, 0x938d81, .308, .045);
    }
  }

  // Project the axes across the whole photographed front, including its returns.
  // Each voxel strip intersects these same axes at its independently exposed face.
  const project = (p: number[]) => p[0] * site.right[0] + p[1] * site.right[1];
  const a = project(edge.startXZ), b = project(edge.endXZ);
  if (Math.abs(a - b) < .25) return;
  const full = site.extent[1] - site.extent[0], w = full / axes;
  const bayWidth = Math.min(1.55, w * .60);
  for (let i = 0; i < axes; i++) {
    const t = (i + .5) / axes;
    const u = (site.extent[0] + t * full - a) / (b - a) * length;
    if (u < bayWidth / 2 + .15 || u > length - bayWidth / 2 - .15) continue;
    const central = i === Math.floor(axes / 2);
    if (balcony && i > 0 && i < axes - 1) {
      builder.face(edge, u - bayWidth / 2 - .17, base + pitch * 3.85,
        .26, pitch * 2.0, .10, brick, .31);
    }
    if (rathenower && central) {
      builder.face(edge, u, base + h * .49, w * .96, h * .93, .12, brick, .34);
    }
    for (let floor = 0; floor < 5; floor++) {
      const portal = palazzo && i === 2 && floor === 0;
      const arch = portal || (palazzo && floor === 1) || (balcony && floor === 4) ||
        (rathenower && central && floor >= 2);
      const y = base + pitch * (floor + .52);
      const opening = pitch * (portal ? .92 : .56);
      const width = portal ? Math.min(w * .84, 2.1) : bayWidth;
      const trim = rathenower ? (floor < 2 || central ? brick : cream) : plain ? field : cream;
      builder.window(edge, u, y, width, opening, trim, iron, portal ? 0x41443b : glass,
        arch, .45, false);
      if (!plain && floor > 1 && !rathenower) {
        const head = y + opening / 2;
        builder.face(edge, u, head + .15, width + .28, .13, .20, trim, .48);
        if (palazzo && floor === 4) {
          for (const side of [-1, 1]) {
            builder.beam(builder.point(edge, u + side * width * .55, head + .18, .50),
              builder.point(edge, u, head + .18 + pitch * .095, .50), .11, trim);
          }
        }
      }
      if (balcony && central && floor === 2) {
        // Shallow semicircular stone balcony visible on the central window axis.
        const radius = Math.min(w * .48, 1.2), sill = y - opening / 2;
        const p = (i: number, level: number) => {
          const angle = Math.PI * i / 8;
          return builder.point(edge, u + radius * Math.cos(angle), level, .45 + .77 * Math.sin(angle));
        };
        for (let j = 0; j < 8; j++) {
          builder.beam(p(j, sill - .10), p(j + 1, sill - .10), .22, plaster);
          builder.beam(p(j, sill + .63), p(j + 1, sill + .63), .12, cream);
          builder.beam(p(j, sill), p(j, sill + .63), .12, grey);
        }
        builder.beam(p(8, sill), p(8, sill + .63), .12, grey);
      }
    }
  }
}

/** Keep courtyard faces open. Use the exact retained source building and exposed voxel rows. */
export function appendMoabitWohnfrontenV366(
  builder: GendarmenmarktFacadeBuilder, buildings: readonly unknown[], payload?: VoxelPayload,
): string[] {
  if (builder.minecraft && (!payload || payload.cell_m !== 4 || !payload.building_rows)) return [];
  const admitted = new Map<string, boolean>();
  for (const row of buildings) {
    if (!row || typeof row !== "object" || !("id" in row) || typeof row.id !== "string" ||
        !fingerprints.has(row.id)) continue;
    admitted.set(row.id, !admitted.has(row.id) && JSON.stringify(row) === fingerprints.get(row.id));
  }
  const ids: string[] = [];
  for (const site of source) {
    if (!admitted.get(site.prism.id)) continue;
    const edges: PerimeterFacadeEdge[] = [];
    const common = { street: site.address, prismId: site.prism.id };
    if (payload) {
      for (const cell of site.cells) {
        if (!exposedVoxel(payload, cell)) continue;
        const [x, z, dx, dz, low, high] = cell;
        const cx = x * 4 + 2 + dx * 2, cz = z * 4 + 2 + dz * 2;
        edges.push({ ...common, startXZ: [cx - dz * 2, cz + dx * 2], endXZ: [cx + dz * 2, cz - dx * 2],
          outwardSide: 1, wallBaseY: low / 10, wallTopY: high / 10 });
      }
    } else {
      for (const i of site.faces) {
        const {ring, y0_dm, h_dm} = site.prism;
        edges.push({ ...common, startXZ: ring[i].map(v => v / 10),
          endXZ: ring[(i + 1) % ring.length].map(v => v / 10),
          outwardSide: site.side, wallBaseY: y0_dm / 10, wallTopY: (y0_dm + h_dm) / 10 });
      }
    }
    for (const edge of edges) facade(builder, site, edge);
    if (edges.length) ids.push(site.prism.id);
  }
  return ids;
}
