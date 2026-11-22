import { Mesh, type Group } from "three";
import core from "./data/brandenburgGatehouseCoresV374.json";

/** Thin LoD2 footprint prisms standing where the photographs show open colonnades.
 * K0000APP/K00008CG are the two closed guard rooms. Their official triangles are
 * transferred separately, including every measured ridge and wall vertex. */
export const GATE_COLONNADE_PRISMS_V374 = [
  "eFGax25F",
  "PQ6fnwZI",
  "TEHsJHGG",
  "kuj9G14s",
  "X9jEff6H",
  "Gqf7is1F",
  "6cPbX9wD",
  "SPq0oRzs",
  "ya3usNuH",
] as const;

export type GateHall = {
  x: number;
  z: number;
  length: number;
  width: number;
  east: boolean;
  ridge: number;
};
export const gateHallsV374: GateHall[] = [
  { x: 0.0, z: -23.3, length: 15.86, width: 10.32, east: false, ridge: 10.8 },
  { x: -0.09, z: 25.08, length: 16.27, width: 10.14, east: false, ridge: 10.9 },
  { x: 13.96, z: -24.65, length: 17.88, width: 10.46, east: true, ridge: 11.13 },
  { x: 13.9, z: 26.56, length: 17.96, width: 10.38, east: true, ridge: 11.08 },
];

/** Use local longitudinal u and cross-ridge v. Western ridge runs N/S, eastern
 * ridge E/W. The hall sizes follow their separate LoD2 parts, not a mirrored
 * rectangle of half the published width of the complete central monument. */
export function hallPoint(h: GateHall, u: number, y: number, v: number): [number, number, number] {
  return h.east ? [h.x + u, y, h.z + v] : [h.x + v, y, h.z + u];
}

export function gateHallColumns(hall: GateHall): [number, number][] {
  const halfL = hall.length / 2 - 0.61,
    halfW = hall.width / 2 - 0.6;
  const longAxes = hall.east ? 6 : 5;
  const columns: [number, number][] = [];
  for (const side of [-1, 1]) {
    for (let axis = 0; axis < longAxes; axis++) {
      const [x, , z] = hallPoint(
        hall,
        -halfL + (2 * halfL * axis) / (longAxes - 1),
        0,
        side * halfW,
      );
      columns.push([x, z]);
    }
    if (!hall.east || side === 1) {
      for (const third of [-1, 1]) {
        const [x, , z] = hallPoint(hall, side * halfL, 0, (third * halfW) / 3);
        columns.push([x, z]);
      }
    }
  }
  return columns;
}

const accessHallByOwner = new Map<string, number>([
  ["QDYNK7dL", 0],
  ["Gqf7is1F", 0],
  ["VpZW4Luf", 1],
  ["X9jEff6H", 2],
  ["6cPbX9wD", 2],
  ["SPq0oRzs", 2],
  ["ya3usNuH", 2],
  ["eFGax25F", 3],
  ["PQ6fnwZI", 3],
  ["TEHsJHGG", 3],
  ["kuj9G14s", 3],
]);
const footprints = gateHallsV374.map((hall) => ({ hall, columns: gateHallColumns(hall) }));
const angle = (core.rotation * Math.PI) / 180;
const cosine = Math.cos(angle),
  sine = Math.sin(angle);

// Same 16 m DGM knots as the surveyed forecourt, elevations in decimetres.
// The signature can be built before the regular terrain mesh is available.
const gateTerrainDm = [
  [51, 52, 51, 48],
  [50, 51, 50, 49],
  [50, 50, 50, 48],
  [50, 50, 49, 48],
  [50, 50, 49, 49],
  [50, 50, 49, 49],
];

export function gatePavementTopV374(localX: number, localZ: number): number {
  const x = (core.anchor[0] + localX * cosine + localZ * sine - 396) / 16;
  const z = (core.anchor[2] - localX * sine + localZ * cosine - 260) / 16;
  const col = Math.max(0, Math.min(2, Math.floor(x)));
  const row = Math.max(0, Math.min(4, Math.floor(z)));
  const tx = Math.max(0, Math.min(1, x - col)),
    tz = Math.max(0, Math.min(1, z - row));
  const north = gateTerrainDm[row][col] * (1 - tx) + gateTerrainDm[row][col + 1] * tx;
  const south = gateTerrainDm[row + 1][col] * (1 - tx) + gateTerrainDm[row + 1][col + 1] * tx;
  return ((1 - tz) * north + tz * south) / 10 + 0.32 - core.anchor[1];
}

export function gateHallWalkableV374(x: number, y: number, z: number, sourceId?: string): boolean {
  const owner = sourceId ? accessHallByOwner.get(sourceId) : undefined;
  if (owner === undefined) return false;
  const dx = x - core.anchor[0],
    dz = z - core.anchor[2],
    localY = y - core.anchor[1];
  const localX = dx * cosine - dz * sine,
    localZ = dx * sine + dz * cosine;
  // These two rooms have real walls and closed doors. Only the surrounding
  // open colonnades transfer the former source prism's free space.
  if (
    localX > 7.42 &&
    localX < 21.1 &&
    ((localZ > -27.91 && localZ < -21.34) || (localZ > 23.23 && localZ < 29.75))
  )
    return false;
  const { hall } = footprints[owner];
  const lx = Math.abs(localX - hall.x),
    lz = Math.abs(localZ - hall.z);
  if (
    localY < -0.45 ||
    localY > hall.ridge - 2.38 ||
    (hall.east ? lx : lz) > hall.length / 2 + 0.4 ||
    (hall.east ? lz : lx) > hall.width / 2 + 0.4
  )
    return false;
  return !footprints.some((part) =>
    part.columns.some(([cx, cz]) => Math.hypot(localX - cx, localZ - cz) < 0.6),
  );
}

export function transferGatehouseCoresV374(group: Group, packet: string): void {
  if (packet !== core.packet) return;
  const mesh = group.children.find((child) => child instanceof Mesh);
  if (!(mesh instanceof Mesh)) return;
  const index = mesh.geometry.index;
  const pos = mesh.geometry.getAttribute("position");
  if (!index || !pos) return;
  // Inspect the live, fully decoded owner before transferring any face.
  for (const [i, [x, y, z]] of core.positionCm.entries()) {
    const v = core.firstVertex + i;
    if (pos.getX(v) !== x || pos.getY(v) !== y || pos.getZ(v) !== z) return;
  }
  for (const [i, face] of core.faces.entries()) {
    for (let j = 0; j < 3; j++) {
      if (index.getX(3 * (core.firstTriangle + i) + j) !== core.firstVertex + face[j]) return;
    }
  }
  for (let i = 0; i < core.faces.length; i++) {
    const offset = 3 * (core.firstTriangle + i);
    index.setX(offset + 1, index.getX(offset));
    index.setX(offset + 2, index.getX(offset));
  }
  index.needsUpdate = true;
  group.userData.gatehouseCoreFacesV374 = core.faces.length;
}
