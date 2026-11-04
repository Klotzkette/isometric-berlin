import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, ShapeGeometry, type Shape,
} from "three";

import type { SurfacePolygon } from "./IsometricCityWorld";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { groundTopSampler, type VoxelPayload } from "./terrainPayload";

/** The mapped outline bounds the correction; the stone uses published dimensions. */
const BASIN_RING_DM = [
  [-2742, -16166], [-2736, -16134], [-2734, -16069], [-2740, -15997],
  [-2747, -15985], [-2756, -15985], [-2769, -15987], [-2781, -15994],
  [-2793, -16003], [-2801, -16012], [-2845, -16170], [-2845, -16182],
  [-2838, -16196], [-2823, -16206], [-2787, -16210], [-2766, -16203],
  [-2752, -16190], [-2742, -16166],
] as const;

const NATIVE_BASIN_CELLS = [
  [-284, -1620], [-280, -1620],
  [-284, -1616], [-280, -1616], [-276, -1616],
  [-284, -1612], [-280, -1612], [-276, -1612],
  [-280, -1608], [-276, -1608],
  [-280, -1604], [-276, -1604],
] as const;

export const OTTO_WEIDT_WATER_STONE_V314 = {
  center: [-278.0, -1610.65],
  angle: 1.315,
  length: 16,
  width: 8,
  rise: 0.65,
  sourceWay: "1313858079",
} as const;

export function matchesOttoWeidtBasinV314(surface: SurfacePolygon): boolean {
  return surface.kind === "basin" && surface.area_m2 === 180 &&
    !surface.holes?.length && surface.ring.length === BASIN_RING_DM.length &&
    BASIN_RING_DM.every(([x, z], i) => surface.ring[i][0] === x && surface.ring[i][1] === z);
}

type Point = readonly [number, number, number];
type Jet = readonly [number, number, number];

// A representative summer spray pattern. Individual nozzle positions, heights
// and the rounded vertical section are display fits, not installation plans.
const JETS: readonly Jet[] = [
  [-5.8, 0.24, 0.37], [-4.8, -1.05, 0.60], [-4.0, 1.10, 0.75],
  [-3.1, -0.37, 0.90], [-2.8, 2.01, 0.48], [-2.0, -1.72, 0.51],
  [-1.1, 0.68, 0.98], [-0.3, -2.25, 0.57], [0.4, -0.50, 0.82],
  [0.8, 1.95, 0.71], [1.9, 0.12, 1.04], [2.4, -1.69, 0.61],
  [3.2, 1.39, 0.71], [4.0, -0.40, 0.68], [4.9, 0.71, 0.51],
  [5.8, -0.22, 0.40],
];

const cosine = Math.cos(OTTO_WEIDT_WATER_STONE_V314.angle);
const sine = Math.sin(OTTO_WEIDT_WATER_STONE_V314.angle);
const GRANITE = 0x606665;
const APRON = 0xa3a8a1;

function worldPoint(u: number, y: number, v: number): Point {
  const [x, z] = OTTO_WEIDT_WATER_STONE_V314.center;
  return [x + cosine * u - sine * v, y, z + sine * u + cosine * v];
}

function radiusSquared(u: number, v: number): number {
  const along = u / (OTTO_WEIDT_WATER_STONE_V314.length / 2);
  const width = OTTO_WEIDT_WATER_STONE_V314.width / 2 * (0.96 + 0.08 * along);
  return along * along + (v / width) ** 2;
}

function stoneHeight(u: number, v: number): number {
  const rise = OTTO_WEIDT_WATER_STONE_V314.rise;
  return 0.065 + (rise - 0.065) * Math.pow(Math.max(0, 1 - radiusSquared(u, v)), 0.86);
}

function ringPoint(angle: number, radius: number, expansion = 0): readonly [number, number] {
  const { length, width } = OTTO_WEIDT_WATER_STONE_V314;
  const along = radius * Math.cos(angle);
  return [(length / 2 + expansion) * along,
    (width / 2 + expansion) * radius * Math.sin(angle) * (0.96 + 0.08 * along)];
}

function geometryFrom(positions: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function opaque(geometry: BufferGeometry, name: string, dayColor: number, nightColor: number): Mesh {
  const dayMaterial = new MeshBasicMaterial({ color: dayColor, side: DoubleSide });
  const nightMaterial = new MeshStandardMaterial({
    color: nightColor, side: DoubleSide, roughness: 0.84,
  });
  const mesh = new Mesh(geometry, dayMaterial);
  mesh.name = name;
  mesh.userData = { dayMaterial, nightMaterial, textureFree: true };
  return mesh;
}

function graniteShell(baseY: number): Mesh {
  const positions: number[] = [], segments = 40;
  const row = (radius: number, i: number): Point => {
    const [u, v] = ringPoint(i * Math.PI * 2 / segments, radius);
    return worldPoint(u, baseY + stoneHeight(u, v), v);
  };
  const radii = [1, 0.86, 0.67, 0.44, 0.22, 0];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radii.length - 1; j++) {
      const a = row(radii[j], i), b = row(radii[j], i + 1), c = row(radii[j + 1], i + 1);
      positions.push(...a, ...c, ...b);
      if (radii[j + 1] > 0) positions.push(...a, ...row(radii[j + 1], i), ...c);
    }
    const [u, v] = ringPoint(i * Math.PI * 2 / segments, 1);
    const [nextU, nextV] = ringPoint((i + 1) * Math.PI * 2 / segments, 1);
    const foot = worldPoint(u, baseY, v), nextFoot = worldPoint(nextU, baseY, nextV);
    positions.push(...foot, ...nextFoot, ...row(1, i + 1), ...foot, ...row(1, i + 1), ...row(1, i));
  }
  return opaque(geometryFrom(positions), "Otto-Weidt-Platz rounded granite water stone", GRANITE, 0x525a5c);
}

function drainage(baseY: number): Mesh {
  const positions: number[] = [], segments = 40;
  for (let i = 0; i < segments; i++) {
    const point = (index: number, gap: number): Point => {
      const [u, v] = ringPoint(index * Math.PI * 2 / segments, 1, gap);
      return worldPoint(u, baseY + 0.013, v);
    };
    const a = point(i, 0.12), b = point(i + 1, 0.12), c = point(i + 1, 0.19), d = point(i, 0.19);
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  return opaque(geometryFrom(positions), "Otto-Weidt-Platz water stone drainage slot", 0x525859, 0x333d41);
}

function surfaceWater(baseY: number): Mesh {
  const positions: number[] = [];
  for (const [u, v] of JETS) {
    // Small wet streaks on the actual crowned granite, for the existing
    // Schwellenraum water-light layer and its day/night material hooks.
    const a = worldPoint(u - 0.18, baseY + stoneHeight(u - 0.18, v) + 0.021, v);
    const b = worldPoint(u, baseY + stoneHeight(u, v - 0.21) + 0.021, v - 0.21);
    const c = worldPoint(u + 0.36, baseY + stoneHeight(u + 0.36, v) + 0.021, v);
    const d = worldPoint(u, baseY + stoneHeight(u, v + 0.21) + 0.021, v + 0.21);
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const dayMaterial = new MeshBasicMaterial({
    color: 0x628da1, transparent: true, opacity: 0.48, depthWrite: false, side: DoubleSide,
  });
  const nightMaterial = new MeshBasicMaterial({
    color: 0x476578, transparent: true, opacity: 0.58, depthWrite: false, side: DoubleSide,
  });
  const mesh = new Mesh(geometryFrom(positions), dayMaterial);
  mesh.name = "Otto-Weidt-Platz fountain water";
  mesh.renderOrder = 1;
  mesh.userData = { dayMaterial, nightMaterial, textureFree: true };
  return mesh;
}

function sprays(baseY: number): Mesh {
  const positions: number[] = [];
  for (const [index, [u, v, height]] of JETS.entries()) {
    const y = baseY + stoneHeight(u, v);
    const point = (side: number, top: boolean): Point => {
      const angle = side * Math.PI / 3, radius = top ? 0.023 : 0.042;
      return worldPoint(u + Math.cos(angle) * radius + (top ? 0.08 : 0),
        y + (top ? height : 0.018), v + Math.sin(angle) * radius);
    };
    for (let side = 0; side < 6; side++) {
      const a = point(side, false), b = point(side + 1, false);
      const c = point(side + 1, true), d = point(side, true);
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    for (let drop = 0; drop < 3; drop++) {
      const angle = index * 1.21 + drop * Math.PI * 2 / 3;
      const x = u + 0.16 * Math.cos(angle), z = v + 0.16 * Math.sin(angle);
      const dy = y + height * (0.83 + 0.10 * drop);
      positions.push(...worldPoint(x - 0.025, dy - 0.032, z),
        ...worldPoint(x + 0.025, dy - 0.032, z),
        ...worldPoint(x, dy + 0.045, z + 0.026));
    }
  }
  const dayMaterial = new MeshBasicMaterial({
    color: 0xc0dce0, transparent: true, opacity: 0.85, depthWrite: false, side: DoubleSide,
  });
  const nightMaterial = new MeshBasicMaterial({
    color: 0x8eafb9, transparent: true, opacity: 0.74, depthWrite: false, side: DoubleSide,
  });
  const mesh = new Mesh(geometryFrom(positions), dayMaterial);
  mesh.name = "Otto-Weidt-Platz jets and spray";
  mesh.renderOrder = 2;
  mesh.userData = { dayMaterial, nightMaterial, textureFree: true };
  return mesh;
}

export function createDrawnOttoWeidtFountainV314(apron: Shape, baseY: number): Group {
  const root = new Group();
  root.name = "Otto-Weidt-Platz granite fountain v314";
  const paving = new ShapeGeometry(apron);
  paving.deleteAttribute("uv");
  paving.rotateX(-Math.PI / 2);
  paving.translate(0, baseY, 0);
  root.add(opaque(paving, "Otto-Weidt-Platz fountain floor", APRON, 0x626965),
    graniteShell(baseY), drainage(baseY), surfaceWater(baseY), sprays(baseY));
  root.userData = { sourceWay: OTTO_WEIDT_WATER_STONE_V314.sourceWay, fullMobileIdentical: true };
  return freezeStaticSceneTransforms(root);
}

export function createNativeOttoWeidtFountainV314(payload: VoxelPayload): Group | null {
  if (payload.cell_m !== 4) return null;
  const basin = payload.classes.indexOf("basin");
  if (basin < 0) return null;
  const rows: number[][] = [];
  const { min_x_idx: minX, min_z_idx: minZ } = payload.grid;
  const sample = groundTopSampler(payload);
  let highest = -Infinity;
  // Validate all twelve actual source cells before constructing anything.
  // The original native runs keep their matrices, paint and lifecycle.
  for (const [x, z] of NATIVE_BASIN_CELLS) {
    const col = x / 4 - minX, row = z / 4 - minZ;
    const original = payload.ground_rows[row]?.find(([start, span, kind]) =>
      kind === basin && start <= col && col < start + span);
    if (!original) return null;
    const top = sample(original[0] + original[1] / 2, row);
    if (!Number.isFinite(top)) return null;
    rows.push([x + 2, top + 0.012, z + 2, 4, 0.04, 4, APRON]);
    highest = Math.max(top, highest);
  }
  const [cx, cz] = OTTO_WEIDT_WATER_STONE_V314.center;
  const baseY = highest + 0.032, step = 0.5;
  for (let dx = -6; dx <= 6; dx += step) {
    for (let dz = -8; dz <= 8; dz += step) {
      const u = cosine * dx + sine * dz, v = -sine * dx + cosine * dz;
      if (radiusSquared(u, v) > 1) continue;
      const height = Math.max(0.08, Math.round(stoneHeight(u, v) / 0.08) * 0.08);
      const tone = (Math.round(dx / step - dz / step) % 4 === 0) ? 0x6e7472 : GRANITE;
      rows.push([cx + dx, baseY + height / 2, cz + dz, step, height, step, tone]);
    }
  }
  for (const [u, v, height] of JETS) {
    const [x, y, z] = worldPoint(u, baseY + stoneHeight(u, v), v);
    rows.push([x, y + height / 2, z, 0.082, height + 0.06, 0.082, 0xbddce2]);
    rows.push([x + 0.10, y + height - 0.07, z + 0.10, 0.055, 0.12, 0.055, 0xcadfe2]);
  }
  const mesh = justicePalaceV183Boxes(rows, true);
  mesh.name = "Otto-Weidt-Platz cardinal granite and fountain jets";
  const root = new Group();
  root.name = "Otto-Weidt-Platz native granite fountain v314";
  root.userData = { keepInMinecraft: true, blockNative: true,
    sourceWay: OTTO_WEIDT_WATER_STONE_V314.sourceWay, coveredBasinCells: NATIVE_BASIN_CELLS.length };
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
