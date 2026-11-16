import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { letteringStrokePaths } from "./drawnLettering";
import type { PrismBuilding } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";

const OWNER = "06766834";
const SOURCE = "https://mustafas.de/assets/laden.jpeg";
const GROUND = 5.2;
const WALL_X = 1093.7;
const WALL_Z = 2850.1;
const WALL_END_X = 1088.5;
const WALL_END_Z = 2862.1;

function hasDrawnWall(prisms: readonly PrismBuilding[]): boolean {
  const owner = prisms.find(building => building.id === OWNER);
  return !!owner && owner.y0_dm === 52 && owner.h_dm === 165 &&
    owner.ring[0]?.[0] === 10937 && owner.ring[0]?.[1] === 28501 &&
    owner.ring.at(-1)?.[0] === 10885 && owner.ring.at(-1)?.[1] === 28621;
}

function hasNativeWall(payload: VoxelPayload): boolean {
  if (payload.cell_m !== 4 || !payload.building_rows) return false;
  const x = 273 - payload.grid.min_x_idx; // west face at 1092 m
  return [713, 714].every(z => {
    const row = payload.building_rows?.[z - payload.grid.min_z_idx];
    if (!row) return false;
    const covers = (column: number) => row.find(([start, run]) => start <= column && column < start + run);
    const current = covers(x);
    const outside = covers(x - 1);
    return current?.[2] === 52 && current[3] === 252 &&
      (!outside || outside[3] <= 52 || outside[2] > 89);
  });
}

/** Street-level exterior only. The building and its original navigation own the volume. */
export function createMustafaFrontV356(
  prisms: readonly PrismBuilding[], nativePayload?: VoxelPayload,
): Group | null {
  if (!hasDrawnWall(prisms) || (nativePayload && !hasNativeWall(nativePayload))) return null;
  const root = new Group();
  root.name = "Mustafa’s Gemüse Kebap am Mehringdamm 33";
  root.userData.sourceOwner = OWNER;
  root.userData.referenceUrl = SOURCE;
  const dx = WALL_END_X - WALL_X;
  const dz = WALL_END_Z - WALL_Z;
  root.rotation.y = nativePayload ? -Math.PI / 2 : -Math.atan2(dz, dx);
  root.position.set(nativePayload ? 1092 : WALL_X + dx * 0.46, GROUND,
    nativePayload ? 2856 : WALL_Z + dz * 0.46);

  const charcoal = 0x332f2a;
  const edge = 0x484741;
  const timber = 0x624a34;
  const ivory = 0xcec3a8;
  const front = 0.17; // Overlay clears the retained generic glass and trim.
  const rows: Array<[number, number, number, number, number, number, number, number?]> = [
    [0, 1.52, front, 7.22, 2.90, 0.045, charcoal],
    [-2.29, 1.39, front + 0.04, 1.16, 2.43, 0.04, 0x231e19],
    [-2.29, 2.33, front + 0.07, 1.16, 0.14, 0.03, timber],
    [-3.02, 1.43, front + 0.04, 0.26, 2.71, 0.035, edge],
    [-1.34, 1.50, front + 0.07, 0.30, 2.79, 0.05, ivory],
    [2.96, 1.49, front + 0.04, 0.30, 2.77, 0.035, edge],
    [0, 2.96, front + 0.12, 7.24, 0.105, 0.26, 0x494c44],
    [-0.19, 3.31, front + 0.06, 4.39, 0.55, 0.05, 0xe9dda8],
    [-0.19, 3.06, front + 0.096, 4.38, 0.053, 0.024, 0x8d9d4d],
  ];
  for (const x of [-0.54, 0.52, 1.59, 2.41]) {
    rows.push([x, 1.70, front + 0.044, 0.74, 2.06, 0.036, 0x4a514e]);
    rows.push([x, 2.04, front + 0.069, 0.74, 0.07, 0.028, edge]);
    rows.push([x, 0.53, front + 0.049, 0.74, 0.24, 0.040, timber]);
  }
  for (let x = -3.24; x <= 3.35; x += 0.46) {
    rows.push([x, 2.83, front + 0.21, 0.07, 0.07, 0.065, 0xdfbd72]);
  }
  for (const path of letteringStrokePaths("MUSTAFA'S GEMÜSE KEBAP", 0.17)) {
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1], [bx, by] = path[i];
      const length = Math.hypot(bx - ax, by - ay);
      rows.push([(ax + bx) / 2 - 0.19, (ay + by) / 2 + 3.24, front + 0.10,
        length + 0.017, 0.022, 0.010, 0xa4582e, Math.atan2(by - ay, bx - ax)]);
    }
  }
  const opaque = new MeshStandardMaterial({ roughness: 0.83 });
  const fittings = new InstancedMesh(new BoxGeometry(1, 1, 1), opaque, rows.length);
  const transform = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const letteringAxis = new Vector3(0, 0, 1);
  const scale = new Vector3();
  const colour = new Color();
  rows.forEach(([x, y, z, width, height, depth, rgb, angle = 0], index) => {
    transform.compose(position.set(x, y, z), rotation.setFromAxisAngle(letteringAxis, angle),
      scale.set(width, height, depth));
    fittings.setMatrixAt(index, transform);
    fittings.setColorAt(index, colour.setHex(rgb));
  });
  root.add(fittings);
  return root;
}
