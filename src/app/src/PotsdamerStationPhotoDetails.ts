import { POTSDAMER_SOUTH_STATION_PHOTO_RECEIPT, isPotsdamerSouthStationPhotoSource } from "./potsdamerStationPhotoOwnership";
import { POTSDAMER_STATION_PHOTO_STRIP_RECEIPT, canReplacePotsdamerSouthStationPhoto,
  isPotsdamerStationPhotoStripSource } from "./potsdamerStationPhotoOwnership";
import { potsdamerStationStripPhotoNativeBlocks } from "./potsdamerStationPhotoStrip";
export { POTSDAMER_SOUTH_STATION_PHOTO_RECEIPT } from "./potsdamerStationPhotoOwnership";
import {
  BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { letteringStrokePaths } from "./drawnLettering";
import { POTSDAMER_DETAIL_PROFILE } from "./expandedCityProfiles";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import type { VoxelPayload, VoxelBuildingColumn } from "./terrainPayload";

type Point = readonly [number, number, number];
export type StationPhotoBlock = { position: Point; size: Point; color: number; role: string; glass?: boolean };
type Prism = { id?: unknown; ring?: unknown; holes?: unknown };

const profile = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls;
const hall = profile.halls[1];
const steel = profile.ownerPhotoRecognition.steelTone;

function point(x: number, y: number, z: number): [number, number, number] {
  const c = Math.cos(hall.rotationY), s = Math.sin(hall.rotationY);
  return [hall.centerWorldM[0] + x * c + z * s, y,
    hall.centerWorldM[1] - x * s + z * c];
}

function inRing(x: number, z: number, ring: readonly (readonly number[])[] = hall.footprintRingWorldM): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) &&
      x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Independent world-axis-aligned Minecraft construction, never voxelized
 * smooth meshes. Bay counts, glass, roof height and the open north approach
 * follow the retained hall; small courses/fittings remain display estimates. */
export function potsdamerSouthStationPhotoBlocks(): StationPhotoBlock[] {
  const rows: StationPhotoBlock[] = [];
  const [width, depth] = hall.footprintSizeM;
  const halfWidth = width / 2, halfDepth = depth / 2;
  const top = hall.sourceRoofYM;
  const height = top - hall.groundY;
  const rear = -hall.frontSide;
  const glazedHeight = height - .82 - .34;
  const glassCenter = hall.groundY + glazedHeight / 2 + .17;
  const put = (role: string, position: Point, size: Point, color: number = steel, glass = false) => {
    rows.push({ position, size, color, role, ...(glass ? { glass } : {}) });
  };
  const span = (role: string, a: Point, b: Point, height: number,
    color: number = steel, thickness = .48, glass = false) => {
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const count = Math.max(1, Math.ceil(length / (thickness * .88)));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      put(role, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t], [thickness, height, thickness], color, glass);
    }
  };
  const localSpan = (role: string, x0: number, y: number, z0: number,
    x1: number, z1: number, height: number, color: number = steel, thickness = .48, glass = false) =>
    span(role, point(x0, y, z0), point(x1, y, z1), height, color, thickness, glass);
  const segment = (role: string, a: Point, b: Point, color: number = steel, grid = .15) => {
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const count = Math.max(1, Math.ceil(distance / (grid * .72)));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      put(role, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t], [grid, grid, grid], color);
    }
  };
  // Roof cells are inscribed in the complete ten-vertex measured plan.
  const grid = .8;
  const minX = Math.min(...hall.footprintRingWorldM.map(p => p[0]));
  const maxX = Math.max(...hall.footprintRingWorldM.map(p => p[0]));
  const minZ = Math.min(...hall.footprintRingWorldM.map(p => p[1]));
  const maxZ = Math.max(...hall.footprintRingWorldM.map(p => p[1]));
  for (let x = Math.ceil(minX / grid) * grid; x < maxX; x += grid) {
    for (let z = Math.ceil(minZ / grid) * grid; z < maxZ; z += grid) {
      if (![-1, 1].every(sx => [-1, 1].every(sz => inRing(x + sx * grid / 2, z + sz * grid / 2)))) continue;
      put("glass-roof", [x, top - .06, z], [grid, .12, grid], 0x94b5b3, true);
    }
  }
  // Three transparent walls; there is intentionally no front wall or sill.
  localSpan("rear-glass", -halfWidth + .48, glassCenter, rear * (halfDepth - .40),
    halfWidth - .48, rear * (halfDepth - .40), glazedHeight, 0x94b5b3, .48, true);
  for (const side of [-1, 1]) {
    localSpan("side-glass", side * (halfWidth - .40), glassCenter, -halfDepth + .48,
      side * (halfWidth - .40), halfDepth - .48, glazedHeight, 0x94b5b3, .48, true);
    localSpan("perimeter-fascia", -halfWidth + .40, top - .41, side * (halfDepth - .40),
      halfWidth - .40, side * (halfDepth - .40), .82);
    localSpan("perimeter-fascia", side * (halfWidth - .40), top - .41, -halfDepth + .40,
      side * (halfWidth - .40), halfDepth - .40, .82);
    for (const end of [-1, 1]) put("corner-post",
      point(side * (halfWidth - .40), hall.groundY + height / 2, end * (halfDepth - .40)),
      [.48, height, .48]);
    localSpan("side-sill", side * (halfWidth - .40), hall.groundY + .15, -halfDepth + .40,
      side * (halfWidth - .40), halfDepth - .40, .30);
  }
  localSpan("rear-sill", -halfWidth + .40, hall.groundY + .15, rear * (halfDepth - .40),
    halfWidth - .40, rear * (halfDepth - .40), .30);
  for (let bay = 1; bay < profile.roofBayCountAcross; bay++) {
    const x = -halfWidth + width * bay / profile.roofBayCountAcross;
    localSpan("roof-across-carrier", x, top - .18, -halfDepth + .40, x, halfDepth - .40, .26, steel, .22);
    put("rear-mullion", point(x, glassCenter, rear * (halfDepth - .40)), [.20, glazedHeight, .20]);
  }
  for (let bay = 1; bay < profile.roofBayCountDepth; bay++) {
    const z = -halfDepth + depth * bay / profile.roofBayCountDepth;
    localSpan("roof-depth-carrier", -halfWidth + .40, top - .18, z, halfWidth - .40, z, .26, steel, .22);
    for (const side of [-1, 1]) put("side-mullion",
      point(side * (halfWidth - .40), glassCenter, z), [.20, glazedHeight, .20]);
  }
  for (let row = 1; row < profile.wallPanelRows; row++) {
    const y = hall.groundY + glazedHeight * row / profile.wallPanelRows;
    localSpan("rear-transom", -halfWidth + .40, y, rear * (halfDepth - .40),
      halfWidth - .40, rear * (halfDepth - .40), .13, steel, .20);
    for (const side of [-1, 1]) localSpan("side-transom", side * (halfWidth - .40), y,
      -halfDepth + .40, side * (halfWidth - .40), halfDepth - .40, .13, steel, .20);
  }
  for (const side of [-1, 1]) for (let bay = 0; bay < profile.roofBayCountDepth; bay += 2) {
    const z0 = -halfDepth + depth * bay / profile.roofBayCountDepth + (bay === 0 ? .40 : 0);
    const z1 = -halfDepth + depth * (bay + 2) / profile.roofBayCountDepth - (bay + 2 === profile.roofBayCountDepth ? .40 : 0);
    const x = side * (halfWidth - .40), low = hall.groundY + .30, high = top - .86;
    segment("cross-brace", point(x, low, z0), point(x, high, z1));
    segment("cross-brace", point(x, high, z0), point(x, low, z1));
  }
  // The two existing diagrammatic stair banks remain in their original frame.
  for (const bank of [-5, 5]) {
    for (let step = 0; step < 11; step++) {
      const y = hall.groundY + .16 - step * .14;
      const z = hall.frontSide * (halfDepth - 1.8 - step * .84);
      for (let course = 0; course < 9; course++) put("stair-step",
        point(bank - 2.2 + (course + .5) * 4.4 / 9, y, z), [4.4 / 9, .16, .88], 0xbdb9ae);
    }
    for (const side of [-1, 1]) segment("stair-handrail",
      point(bank + side * 2.05, hall.groundY + 1.05, hall.frontSide * (halfDepth - 1.45)),
      point(bank + side * 2.05, hall.groundY - .90, hall.frontSide * (halfDepth - 10.7)), 0x7c8587, .13);
  }
  // Same original procedural alphabet; no image texture in native mode.
  const letters = (side: boolean) => {
    const cap = .74 * .58;
    const paths = letteringStrokePaths("BAHNHOF POTSDAMER PLATZ", cap);
    const baseline = top - .43 - cap / 2;
    for (const path of paths) for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const p = (v: readonly number[]) => side
        ? point(halfWidth - .13, baseline + v[1], -v[0])
        : point(v[0], baseline + v[1], -hall.frontSide * (halfDepth - .13));
      segment("fascia-lettering", p(a), p(b), 0xf1eee6, .085);
    }
  };
  letters(false); letters(true);
  rows.push(...potsdamerStationStripPhotoNativeBlocks());
  return rows;
}

/** Fail closed: native retirement needs both unchanged exact source prisms,
 * all 43 hall + 2 separate strip tuples, the original cell size, and no foreign cell-centre owner.
 * This is the exact building_cells/rasterise_buildings generation convention,
 * rather than treating a neighbouring cell-edge intersection as ownership.
 * Both original source prisms and every unlisted native tuple remain preserved. */
export function preparePotsdamerSouthStationPhotoTransfer(
  prisms: readonly unknown[] | undefined, payload: VoxelPayload,
): { group: Group; replacesColumn: (...row: VoxelBuildingColumn) => boolean } | null {
  if (!prisms || payload.cell_m !== 4 || !canReplacePotsdamerSouthStationPhoto(prisms)) return null;
  const matched = prisms.filter(p => (p as Prism)?.id === "K0000BRX");
  if (matched.length !== 1 || !isPotsdamerSouthStationPhotoSource(matched[0])) return null;
  const receipt = [...POTSDAMER_SOUTH_STATION_PHOTO_RECEIPT.columns,
    ...POTSDAMER_STATION_PHOTO_STRIP_RECEIPT.columns];
  const expected = new Set<string>(receipt.map(r => r.join("/")));
  const sourceCells = new Set(receipt.map(r => `${r[0]}/${r[1]}`));
  const found = new Set<string>();
  let ambiguous = false;
  const inspect = (row: number[]) => {
    const key = row.join("/");
    if (expected.has(key)) found.add(key);
    else if (sourceCells.has(`${row[0]}/${row[1]}`)) ambiguous = true;
  };
  if (payload.building_rows) {
    for (let zi = 0; zi < payload.building_rows.length; zi++) {
      const z = payload.grid.min_z_idx + zi;
      if (z < 281 || z > 287) continue;
      for (const [offset, span, low, high, kind] of payload.building_rows[zi]) {
        for (let i = 0; i < span; i++) {
          const row = [payload.grid.min_x_idx + offset + i, z, low, high, kind];
          inspect(row);
        }
      }
    }
  } else for (const row of payload.buildings ?? []) {
    inspect(row);
  }
  if (ambiguous || found.size !== expected.size) return null;
  for (const raw of prisms) {
    if (raw === matched[0] || isPotsdamerStationPhotoStripSource(raw) || !raw || typeof raw !== "object") continue;
    const p = raw as Prism;
    if (!Array.isArray(p.ring) || p.ring.length < 3) continue;
    const ring = p.ring as number[][];
    const holes = Array.isArray(p.holes) ? p.holes as number[][][] : [];
    if (receipt.some(([x, z]) => inRing((x + .5) * 40, (z + .5) * 40, ring) &&
      !holes.some(h => inRing((x + .5) * 40, (z + .5) * 40, h)))) return null;
  }
  const rows = potsdamerSouthStationPhotoBlocks();
  const group = new Group();
  group.name = "Potsdamer Platz south station — independent native photo recognition";
  group.userData = { potsdamerStationPhoto: true, blockNative: true, keepInMinecraft: true,
    nativeMinecraft: true, textureFree: true, fullStaticDetailOnTouch: true,
    sourceBuildingId: hall.sourceBuildingId, sourceGeometryRetained: true,
    transferredColumns: receipt.length, originalSourcePrismRetained: true,
    sourceBuildingIds: [hall.sourceBuildingId, "OSM-way-464904393"],
    stripHeightStatus: POTSDAMER_STATION_PHOTO_STRIP_RECEIPT.heightStatus };
  for (const glass of [false, true]) {
    const selected = rows.filter(r => Boolean(r.glass) === glass);
    const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
    const day = new MeshBasicMaterial({ color: 0xffffff, transparent: glass,
      opacity: glass ? .36 : 1, depthWrite: !glass });
    const night = new MeshStandardMaterial({ color: 0xffffff, transparent: glass,
      opacity: glass ? .36 : 1, depthWrite: !glass, roughness: .85, flatShading: true });
    const mesh = new InstancedMesh(geometry, day, selected.length);
    const matrix = new Matrix4(), color = new Color();
    selected.forEach((r, i) => {
      matrix.makeScale(...r.size).setPosition(...r.position);
      mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.setHex(r.color));
    });
    mesh.name = glass ? "South station native transparent glass" : "South station native steel, lettering and stairs";
    mesh.userData = { dayMaterial: day, nightMaterial: night, blockNative: true,
      keepInMinecraft: true, textureFree: true, sourceBuildingId: hall.sourceBuildingId };
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh);
  }
  return { group: freezeStaticSceneTransforms(group),
    replacesColumn: (...row) => expected.has(row.join("/")) };
}
