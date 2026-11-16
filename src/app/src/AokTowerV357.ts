import { BoxGeometry, Color, ExtrudeGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Shape } from "three";
import { letteringStrokePaths } from "./drawnLettering";
import type { PrismBuilding } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";
import data from "./data/aokTowerV357.json";

type Point = [number, number];
type Solid = { role: string; ring: Point[]; bottom: number; top: number; color: number };
type Column = [x: number, z: number, top: number, role: string];
type Fitting = [x: number, y: number, z: number, width: number, height: number, depth: number, rotation: number, color: number, roll?: number];

const shapes = data.shapes as Solid[];
const columns = data.native as Column[];
const COLORS = {
  body: 0x7a7971,
  glazing: 0x4b5555,
  frame: 0xc3c6bd,
  logoPanel: 0x267046,
  logo: 0xe1e9db,
};

function supportsPodium(prisms: readonly PrismBuilding[], voxel?: VoxelPayload): boolean {
  const owner = prisms.find(prism => prism.id === data.sourceOwner);
  const [base, height] = data.retainedHeightDm;
  if (!owner || owner.y0_dm !== base || owner.h_dm !== height ||
      owner.ring.length !== data.sourceRing.length ||
      !owner.ring.every(([x, z], i) => x === data.sourceRing[i][0] && z === data.sourceRing[i][1])) {
    return false;
  }
  if (!voxel) return true;
  if (voxel.cell_m !== 4 || !voxel.building_rows) return false;
  return columns.every(([x, z]) => voxel.building_rows?.[z - voxel.grid.min_z_idx]?.some(
    ([start, length, bottom, top]) => {
      const index = x - voxel.grid.min_x_idx;
      return start <= index && index < start + length && bottom === base && top === base + height;
    },
  ));
}

function bodyMesh(solid: Solid): Mesh {
  const path = new Shape();
  solid.ring.forEach(([x, z], i) => i === 0 ? path.moveTo(x, -z) : path.lineTo(x, -z));
  path.closePath();
  const geometry = new ExtrudeGeometry(path, { depth: solid.top - solid.bottom, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, solid.bottom, 0);
  return new Mesh(geometry, new MeshStandardMaterial({ color: solid.color, roughness: 0.88 }));
}

function front(ring: Point[], visit: (a: Point, b: Point) => void): void {
  const area = ring.reduce((sum, [x, z], i) => {
    const next = ring[(i + 1) % ring.length];
    return sum + x * next[1] - z * next[0];
  }, 0);
  const clockwise = area < 0 ? ring : [...ring].reverse();
  clockwise.forEach((a, i) => visit(a, clockwise[(i + 1) % clockwise.length]));
}

function fittingsOnWall(
  target: Fitting[], a: Point, b: Point,
  fill: (place: (u: number, y: number, width: number, height: number, depth: number, color: number, roll?: number) => void, length: number) => void,
): void {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 1.9) return;
  const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
  const rotation = -Math.atan2(dz, dx);
  fill((u, y, width, height, depth, color, roll = 0) => {
    const distance = length / 2 + u;
    target.push([a[0] + distance * dx - depth * dz, y, a[1] + distance * dz + depth * dx,
      width, height, 0.045, rotation, color, roll]);
  }, length);
}

function addWindowBands(fittings: Fitting[], a: Point, b: Point, top: number, native: boolean): void {
  fittingsOnWall(fittings, a, b, (place, length) => {
    const width = length - 0.18;
    const count = native ? 2 : Math.max(1, Math.round(width / 1.65));
    for (let y = 19.75; y + 0.9 < Math.min(top, 58.7); y += 3.43) {
      place(0, y, width, 1.66, 0.09, COLORS.frame);
      place(0, y, width - 0.065, 1.48, 0.13, COLORS.glazing);
      for (let i = 1; i < count; i++) place(width * (i / count - 0.5), y, 0.065, 1.49, 0.16, COLORS.frame);
    }
  });
}

function addAokSigns(fittings: Fitting[], a: Point, b: Point, top: number): void {
  fittingsOnWall(fittings, a, b, (place, length) => {
    const y = top - 0.87;
    place(0, y, length - 0.025, 1.72, 0.09, COLORS.logoPanel);
    const scale = Math.min(1.05, length / 2.35);
    for (const path of letteringStrokePaths("AOK", scale)) {
      for (let i = 1; i < path.length; i++) {
        const [x, dy] = path[i - 1], [xe, dye] = path[i];
        place((x + xe) / 2, y + (dy + dye) / 2 - 0.4 * scale,
          Math.hypot(xe - x, dye - dy) + 0.045, 0.085, 0.14, COLORS.logo, Math.atan2(dye - dy, xe - x));
      }
    }
  });
}

function addBlocksAndBands(fittings: Fitting[]): void {
  const grid = new Map(columns.map(column => [`${column[0]}_${column[1]}`, column]));
  const colors = new Map(shapes.map(shape => [shape.role, shape.color]));
  for (const [x, z, top, role] of columns) {
    const bottom = 17.2;
    fittings.push([x * 4 + 2, (top + bottom) / 2, z * 4 + 2, 4, top - bottom, 4, 0, colors.get(role) ?? COLORS.body]);
    const loX = x * 4, loZ = z * 4, hiX = loX + 4, hiZ = loZ + 4;
    const walls: [number, number, Point, Point][] = [
      [0, -1, [hiX, loZ], [loX, loZ]], [-1, 0, [loX, loZ], [loX, hiZ]],
      [0, 1, [loX, hiZ], [hiX, hiZ]], [1, 0, [hiX, hiZ], [hiX, loZ]],
    ];
    for (const [dx, dz, a, b] of walls) {
      const neighbor = grid.get(`${x + dx}_${z + dz}`);
      if (!neighbor) addWindowBands(fittings, a, b, top, true);
      if (role === "shaft" && (!neighbor || neighbor[2] < top - 1.8)) addAokSigns(fittings, a, b, top);
    }
  }
}

function addFittings(root: Group, rows: Fitting[]): void {
  const material = new MeshStandardMaterial({ roughness: 0.85 });
  const instances = new InstancedMesh(new BoxGeometry(), material, rows.length);
  const transform = new Matrix4(), scale = new Matrix4(), tilt = new Matrix4(), color = new Color();
  rows.forEach(([x, y, z, width, height, depth, rotation, tint, roll = 0], i) => {
    transform.makeRotationY(rotation).multiply(tilt.makeRotationZ(roll))
      .multiply(scale.makeScale(width, height, depth)).setPosition(x, y, z);
    instances.setMatrixAt(i, transform);
    instances.setColorAt(i, color.setHex(tint));
  });
  root.add(instances);
}

/** Vertical completion above the exact retained AOK podium at Wilhelmstraße 1. */
export function createAokTowerV357(prisms: readonly PrismBuilding[], voxel?: VoxelPayload): Group | null {
  if (!supportsPodium(prisms, voxel)) return null;
  const root = new Group();
  root.name = "AOK Nordost · Verwaltungshochhaus";
  root.userData = { sourceOwner: data.sourceOwner, referenceUrl: data.visualReference };
  const fittings: Fitting[] = [];
  if (voxel) {
    addBlocksAndBands(fittings);
  } else {
    for (const solid of shapes) {
      root.add(bodyMesh(solid));
      if (solid.role === "main") front(solid.ring, (a, b) => addWindowBands(fittings, a, b, solid.top, false));
      if (solid.role === "shaft") front(solid.ring, (a, b) => addAokSigns(fittings, a, b, solid.top));
    }
  }
  addFittings(root, fittings);
  return root;
}
