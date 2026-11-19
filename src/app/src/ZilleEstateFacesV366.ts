import type { PrismBuilding } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";
import { GendarmenmarktFacadeBuilder, perimeterEdgeLength, type PerimeterFacadeEdge } from "./GendarmenmarktFacadeBuilder";
import { zilleEstateOwnerV366 } from "./ZilleEstateRoofV366";
import faceData from "./data/zilleEstateFacesV366.json";
import capData from "./data/zilleEstateCapsV366.json";

type Course = [index: number, side: number, palette: number, balconies: number, fromDm: number, toDm: number];
type NativeWall = [x: number, z: number, dx: number, dz: number, bottom: number, top: number, material: number, face: number];
type Facade = { floors: number; eaveDm: number; style: string; faces: Course[]; native: NativeWall[] };
type Cap = [xDm: number, zDm: number, widthDm: number, depthDm: number, yawMilli: number,
  nativeXDm: number, nativeZDm: number, bottom: number, top: number, material: number];
const facades = new Map(Object.entries(faceData) as [string, Facade][]);
const caps = new Map(Object.entries(capData) as [string, Cap[]][]);
const paints = [0xc1bcaa, 0xb3a491, 0x995852];
const plinths = [0xaaa699, 0x82716c, 0x86504b];
const street = "Heinrich-Zille-Siedlung";

function runsAt(voxels: VoxelPayload, x: number, z: number) {
  const offset = x - voxels.grid.min_x_idx;
  return voxels.building_rows?.[z - voxels.grid.min_z_idx]?.filter(
    ([start, count]) => offset >= start && offset < start + count,
  ) ?? [];
}

function face(builder: GendarmenmarktFacadeBuilder, edge: PerimeterFacadeEdge, u: number, y: number,
  width: number, height: number, depth: number, color: number, out: number, kind: "stone" | "glass" = "stone") {
  if (builder.minecraft) {
    const alongZ = edge.startXZ[0] === edge.endXZ[0];
    builder.box(builder.point(edge, u, y, out), alongZ ? [depth, height, width] : [width, height, depth], color, 0, kind);
  } else {
    builder.face(edge, u, y, width, height, depth, color, out, kind);
  }
}

function balcony(builder: GendarmenmarktFacadeBuilder, edge: PerimeterFacadeEdge, u: number, level: number, width: number) {
  const reach = builder.minecraft ? .82 : .99;
  // Slab, side cheeks and the pale closed parapet leave the recess visibly open.
  face(builder, edge, u, level, width, .16, reach, 0xbebbb1, .44 + reach / 2);
  face(builder, edge, u, level + .52, width, .88, .12, 0xd8d7cd, .41 + reach);
  face(builder, edge, u, level + .99, width + .04, .09, .16, 0xe8e5d9, .42 + reach);
  for (const side of [-1, 1]) face(builder, edge, u + side * (width - .10) / 2,
    level + .52, .11, .88, reach - .10, 0xc5c4ba, .43 + reach / 2);
}

function facadeCourse(builder: GendarmenmarktFacadeBuilder, edge: PerimeterFacadeEdge, site: Facade, course: Course, withBalcony = Boolean(course[3])) {
  const palette = course[2];
  const length = perimeterEdgeLength(edge), height = edge.wallTopY - edge.wallBaseY;
  const levels = site.floors, floorHeight = height / levels;
  if (length < 1.82 || floorHeight < 1.9) return false;
  const accent = site.style === "accents";
  const bays = Math.max(1, Math.floor(length / (accent ? 2.65 : 3.2)));
  const bayWidth = length / bays;
  if (!accent) {
    face(builder, edge, length / 2, edge.wallBaseY + height / 2, length, height, .055, paints[palette], .315);
    face(builder, edge, length / 2, edge.wallBaseY + .24, length, .48, .070, plinths[palette], .345);
    face(builder, edge, length / 2, edge.wallTopY - .095, length, .11, .12, 0x938e81, .351);
  }
  for (let row = 0; row < levels; row++) {
    for (let bay = 0; bay < bays; bay++) {
      const u = (bay + .5) * bayWidth;
      const centerY = edge.wallBaseY + (row + .57) * floorHeight;
      const width = accent ? (row === 0 ? 1.18 : 1.57) : Math.min(1.72, bayWidth * .65);
      const opening = accent ? (row === 0 ? 1.03 : 1.42) : Math.min(1.39, floorHeight * .48);
      const loggia = withBalcony && row > 0 && (bay === 0 || (bays >= 4 && bay === bays - 1));
      if (!accent) {
        face(builder, edge, u, centerY, width, opening, .09, 0xe0ded5, .395);
        face(builder, edge, u, centerY, width - .14, opening - .14, .055, 0x515d5f, .45, "glass");
        face(builder, edge, u + width * .15, centerY, .060, opening - .12, .05, 0xd6d7d0, .49);
        face(builder, edge, u, centerY - opening / 2, width + .12, .09, .17, 0xc4c2b6, .435);
      }
      if (loggia) {
        balcony(builder, edge, u, edge.wallBaseY + row * floorHeight + .10, Math.min(2.76, bayWidth - .22));
      } else if ((row + course[0] + bay * 2) % 5 === 0) {
        // Partly drawn shutters in the street photograph; all dimensions are illustrative.
        const shade = opening * (row % 2 === 0 ? .49 : .31);
        const y = centerY + (opening - shade) / 2 - .07;
        const depth = accent ? .302 : .526;
        face(builder, edge, u, y, width - .15, shade, .052, 0xc9c7bc, depth);
        face(builder, edge, u, y - shade / 2 + .025, width - .14, .048, .06, 0x97978e, depth + .024);
      }
    }
  }
  return true;
}

function drawnEdge(building: PrismBuilding, site: Facade, course: Course): PerimeterFacadeEdge {
  const [index, side, , , from, to] = course;
  const a = building.ring[index], b = building.ring[(index + 1) % building.ring.length];
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  // Keep the bays on existing v358 finishes at their previous pitch and origin.
  const at = (u: number) => [(a[0] + dx * u / length) / 10, (a[1] + dz * u / length) / 10];
  return { startXZ: at(site.style === "accents" ? 0 : from), endXZ: at(site.style === "accents" ? length : to),
    wallBaseY: building.y0_dm / 10, wallTopY: site.eaveDm / 10, outwardSide: side, street, prismId: building.id };
}

/** Fittings share the estate's existing two instanced material batches in each mode. */
export function addZilleEstateV366(builder: GendarmenmarktFacadeBuilder, buildings: readonly PrismBuilding[], voxels?: VoxelPayload) {
  let walls = 0, fittings = 0;
  const used = new Set<string>();
  const seen = new Set<string>(), duplicates = new Set<string>();
  for (const building of buildings) {
    if (!facades.has(building.id) && !caps.has(building.id)) continue;
    if (seen.has(building.id)) duplicates.add(building.id);
    seen.add(building.id);
  }
  for (const building of buildings) {
    if (duplicates.has(building.id)) continue;
    const spec = facades.get(building.id), roofCaps = caps.get(building.id);
    if ((!spec && !roofCaps) || !zilleEstateOwnerV366(building)) continue;
    if (spec && !voxels) {
      for (const course of spec.faces) {
        if (facadeCourse(builder, drawnEdge(building, spec, course), spec, course)) walls++;
      }
    } else if (spec && voxels && voxels.cell_m === 4) {
      for (const [x,z,dx,dz,base,top,material,index] of spec.native) {
        const key = [x,z,dx,dz].join("/");
        if (used.has(key) || !runsAt(voxels,x,z).some(([, , a,b,m]) => a===base && b===top && m===material)
            || runsAt(voxels,x+dx,z+dz).some(([, , a,b]) => a < top && b > base)) continue;
        const course = spec.faces.find(s => s[0] === index);
        if (!course) continue;
        const cx = (x+.5+dx/2)*4, cz = (z+.5+dz/2)*4;
        let withBalcony = false;
        if (course[3]) {
          const edge = drawnEdge(building, spec, course);
          const length = perimeterEdgeLength(edge);
          const bays = Math.max(1, Math.floor(length / 3.2));
          const along = ((cx - edge.startXZ[0]) * (edge.endXZ[0] - edge.startXZ[0]) +
            (cz - edge.startXZ[1]) * (edge.endXZ[1] - edge.startXZ[1])) / length;
          const firstBay = length / (2 * bays);
          withBalcony = Math.abs(along - firstBay) <= 2 || (bays >= 4 && Math.abs(length - firstBay - along) <= 2);
        }
        const painted = facadeCourse(builder, { startXZ: [cx-dz*2,cz+dx*2], endXZ: [cx+dz*2,cz-dx*2],
          wallBaseY: base/10, wallTopY: top/10, outwardSide: 1, street, prismId: building.id }, spec, course, withBalcony);
        if (painted) { used.add(key); walls++; }
      }
    }
    for (const [x,z,w,d,angle,nx,nz,base,top,material] of roofCaps ?? []) {
      if (voxels) {
        if (voxels.cell_m !== 4) continue;
        const runs = runsAt(voxels, Math.floor(nx/40), Math.floor(nz/40));
        if (!runs.some(([, , a,b,m]) => a===base && b===top && m===material) || runs.some(([, , ,b]) => b>top)) continue;
        builder.box([nx/10,top/10+.13,nz/10], [.75,.26,.75], 0xc2c5ba);
      } else {
        const y = (building.y0_dm + building.h_dm)/10;
        builder.box([x/10,y+.10,z/10], [w/10,.20,d/10], 0x858b85, angle/1000);
        builder.box([x/10,y+.235,z/10], [w/10-.08,.09,d/10-.08], 0xd3d4c9, angle/1000);
      }
      fittings++;
    }
  }
  return { walls, fittings };
}
