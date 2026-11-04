import {
  BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Shape, ShapeGeometry, Vector3,
} from "three";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import type { VoxelPayload } from "./terrainPayload";

export const SAP_ENTRANCE_V313 = {
  source: "https://www.zugangssysteme-berlin.de/referenzen/sap-niederlassung-berlin/",
  address: "George-Stephenson-Straße 7, Haus A",
  entranceNode: 10981934232,
  buildingWay: 1137662421,
  prismId: "37662421",
  entrance: [-444.32518, -1522.19664],
  facade: [[-455, -1546.9], [-432, -1506.5]],
  lettering: "Welcome to SAP Berlin.",
  widthEstimateM: 5.9,
  heightEstimateM: 0.85,
} as const;

const fasciaY = 8.7;
const depth = 0.42;
const dark = 0x222a2c;
const blue = 0x079ed3;
const white = 0xf3f7f6;
const unit = new Vector3(0, 0, 1);
type Plan = { x: number; z: number; nx: number; nz: number; width: number; native: boolean };

function drawnPlan(): Plan {
  const [start, end] = SAP_ENTRANCE_V313.facade;
  const dx = end[0] - start[0], dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const nx = dz / length, nz = -dx / length;
  const [ex, ez] = SAP_ENTRANCE_V313.entrance;
  const u = ((ex - start[0]) * dx + (ez - start[1]) * dz) / (length * length);
  return { x: start[0] + u * dx, z: start[1] + u * dz, nx, nz, width: SAP_ENTRANCE_V313.widthEstimateM, native: false };
}

function nativePlan(payload: VoxelPayload): Plan | null {
  // The nearest exposed east-facing source cell is x[-444,-440], z[-1524,-1520].
  // The neighbouring row steps west by a full cell, so fit to this one face.
  const xIndex = -111, zIndex = -381;
  const row = payload.building_rows?.[zIndex - payload.grid.min_z_idx];
  const localX = xIndex - payload.grid.min_x_idx;
  const source = row?.some(([first, count, low, high, material]) =>
    first + count - 1 === localX && low === 52 && high === 492 && material === 3);
  if (payload.cell_m !== 4 || !source) return null;
  return { x: -440, z: -1522, nx: 1, nz: 0, width: 3.72, native: true };
}

export function createSapEntranceSignV313(voxels?: VoxelPayload): Group | null {
  const plan = voxels ? nativePlan(voxels) : drawnPlan();
  if (!plan) return null;
  const { x, z, nx, nz, width, native } = plan;
  const root = new Group();
  root.name = "SAP BER01 Haus A entrance fascia";
  root.userData = { ...SAP_ENTRANCE_V313, blockNative: native, keepInMinecraft: native, textureFree: true };
  const at = (u: number, y: number, outward: number) =>
    new Vector3(x + nz * u + nx * outward, fasciaY + y, z - nx * u + nz * outward);
  const material = (color: number, emissive = 0) => ({
    day: new MeshBasicMaterial({ color }),
    night: new MeshStandardMaterial({ color, roughness: 0.75, emissive: color, emissiveIntensity: emissive }),
  });
  const register = (mesh: Mesh, name: string, nightMaterial: MeshStandardMaterial) => {
    mesh.name = name;
    mesh.userData = { dayMaterial: mesh.material, nightMaterial, keepInMinecraft: native, blockNative: native };
    root.add(mesh);
  };
  const height = SAP_ENTRANCE_V313.heightEstimateM;
  const field = material(dark);
  const fascia = new Mesh(new BoxGeometry(native ? depth : width, height, native ? width : depth), field.day);
  fascia.position.copy(at(0, 0, depth / 2));
  if (!native) fascia.rotation.y = Math.atan2(nx, nz);
  register(fascia, "Charcoal entrance fascia", field.night);

  const mark = material(blue, 0.24);
  const markX = -width / 2 + 0.64;
  if (native) {
    // Four cardinal strips retain the characteristic sloping end in block mode.
    for (let row = 0; row < 4; row++) {
      const span = 0.65 + row * 0.057;
      const bar = new Mesh(new BoxGeometry(0.024, 0.108, span), mark.day);
      bar.position.copy(at(markX - 0.41 + span / 2, (row - 1.5) * 0.108, depth + 0.012));
      register(bar, "SAP blue emblem", mark.night);
    }
  } else {
    const shape = new Shape().moveTo(-0.41, -0.215).lineTo(0.22, -0.215)
      .lineTo(0.43, 0.215).lineTo(-0.41, 0.215).closePath();
    const emblem = new Mesh(new ShapeGeometry(shape), mark.day);
    emblem.position.copy(at(markX, 0, depth + 0.024));
    emblem.rotation.y = Math.atan2(nx, nz);
    register(emblem, "SAP blue emblem", mark.night);
  }

  const glyphs = material(white, 0.32);
  const matrices: Matrix4[] = [];
  const whitePaths = [
    ...letteringStrokePaths("SAP", 0.21).map(path => path.map(([u, y]) => [u + markX - 0.055, y - 0.105] as const)),
    ...letteringStrokePaths(SAP_ENTRANCE_V313.lettering.toUpperCase(), native ? 0.115 : 0.20)
      .map(path => path.map(([u, y]) => [u + 0.46, y - (native ? 0.0575 : 0.10)] as const)),
  ];
  const seen = new Set<string>();
  const weight = native ? 0.031 : 0.033;
  for (const path of whitePaths) for (let i = 1; i < path.length; i++) {
    const [u0, y0] = path[i - 1], [u1, y1] = path[i];
    const a = at(u0, y0, depth + 0.040), b = at(u1, y1, depth + 0.040);
    const delta = b.clone().sub(a);
    const span = delta.length();
    if (!native) {
      matrices.push(new Matrix4().compose(a.lerp(b, 0.5), new Quaternion().setFromUnitVectors(unit, delta.normalize()), new Vector3(weight, weight, span + weight)));
      continue;
    }
    const steps = Math.max(1, Math.ceil(span / 0.024));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const u = Math.round((u0 + (u1 - u0) * t) / 0.025);
      const y = Math.round((y0 + (y1 - y0) * t) / 0.025);
      const key = `${u},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matrices.push(new Matrix4().compose(at(u * 0.025, y * 0.025, depth + 0.040), new Quaternion(), new Vector3(0.026, weight, weight)));
    }
  }
  const letters = new InstancedMesh(new BoxGeometry(), glyphs.day, matrices.length);
  matrices.forEach((matrix, i) => letters.setMatrixAt(i, matrix));
  letters.computeBoundingSphere();
  register(letters, "SAP entrance lettering", glyphs.night);
  return freezeStaticSceneTransforms(root);
}
