import {
  BoxGeometry, BufferGeometry, Color, EdgesGeometry, Float32BufferAttribute,
  Group, InstancedMesh, LineBasicMaterial, LineSegments, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, Vector3,
} from "three";
import { markArchitecturalInk } from "./architecturalInk";

/** Retained LoD2 envelope: display/collision replacement only, never source deletion. */
export const BERLIN_JUNCTION_PRISM_IDS: ReadonlySet<string> = new Set(["K0003UOE"]);
export const BERLIN_JUNCTION_SOURCE_RING_DM = [
  [-2011, 9395], [-2010, 9366], [-2015, 9335], [-2029, 9304],
  [-2049, 9276], [-2036, 9268], [-2013, 9296], [-2002, 9317],
  [-1996, 9339], [-1993, 9361], [-1997, 9394],
] as const;

export function berlinJunctionReplacesSourceColumn(x: number, z: number): boolean {
  if (x < -204.9 || x > -199.3 || z < 926.8 || z > 939.5) return false;
  let inside = false;
  const ring = BERLIN_JUNCTION_SOURCE_RING_DM;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z * 10) !== (bz > z * 10) && x * 10 < ((bx - ax) * (z * 10 - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

/** Source dimensions and photographic display fits are deliberately separate. */
export const BERLIN_JUNCTION_PROFILE = Object.freeze({
  name: "Berlin Junction",
  osmKey: "way/187360886",
  worldM: [-201.8, 931.8] as const,
  modelWorldM: [-201.017, 932.914] as const,
  groundYM: 4,
  rotationY: Math.PI + Math.atan2(3.85, 12.25),
  plateCount: 2,
  plateLengthM: 14,
  plateHeightM: 3.4,
  plateThicknessM: 0.055,
  groundPlateSeparationM: 1.75,
  topInwardDisplacementM: 0.625,
  middleRadiusM: 17,
  arcSegments: 48,
  heightSegments: 4,
  minecraftCellM: 0.2,
  sourceUrl: "https://bildhauerei-in-berlin.de/bildwerk/berlin-junction-6427/",
  geometryStatus:
    "OSM identity retained; placement and bend follow retained LoD2 K0003UOE. BiB publishes 14 m length and 3.4 m height per plate. " +
    "Radius, inward lean, gap, thickness and patina are owner-photo display fits, not surveyed. " +
    "The former 13.65 x 3.90 x 0.055 m attribution to BiB is corrected in the source notes.",
});

const P = BERLIN_JUNCTION_PROFILE;
const TAPER = P.topInwardDisplacementM / P.plateHeightM;
const HALF_ANGLE = P.plateLengthM / (2 * (P.middleRadiusM + P.topInwardDisplacementM / 2));
const HALF_THICKNESS = P.plateThicknessM / 2;

/** The two congruent conical strips are inverted vertically, bending the same way. */
export function berlinJunctionPlatePoint(side: number, angle: number, height: number): Vector3 {
  const radius = P.middleRadiusM + side * TAPER * (height - P.plateHeightM / 2);
  return new Vector3(
    side * (P.groundPlateSeparationM / 2 - P.topInwardDisplacementM / 2) +
      P.middleRadiusM - radius * Math.cos(angle),
    height,
    radius * Math.sin(angle),
  );
}

function normalAt(side: number, angle: number): Vector3 {
  return new Vector3(-Math.cos(angle), -side * TAPER, Math.sin(angle)).normalize();
}

function plateGeometry(side: number): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const rust = new Color(0xa07855);
  const surface = (angle: number, height: number, skin: number) =>
    berlinJunctionPlatePoint(side, angle, height)
      .addScaledVector(normalAt(side, angle), skin * HALF_THICKNESS);
  const vertex = (point: Vector3, normal: Vector3, inside: boolean) => {
    positions.push(point.x, point.y, point.z);
    normals.push(normal.x, normal.y, normal.z);
    const paint = new Color(inside ? 0x71655b : 0x8b7d73);
    // Subtle continuous, deterministic weathering; no photograph or runtime texture.
    const bottomRust = Math.max(0, 1 - point.y / 0.55) * 0.24;
    paint.lerp(rust, bottomRust);
    const variation = 1 + 0.028 * Math.sin(point.z * 2.1 + point.y * 0.4) +
      0.018 * Math.sin(point.z * 6.2 - point.y * 0.9);
    paint.multiplyScalar(variation * (0.86 + 0.14 * Math.max(0, normal.x * -0.6 + normal.z * 0.5)));
    colors.push(paint.r, paint.g, paint.b);
  };
  const quad = (points: Vector3[], ns: Vector3[], inside: boolean) => {
    const cross = new Vector3().subVectors(points[1], points[0])
      .cross(new Vector3().subVectors(points[2], points[0]));
    const indices = cross.dot(ns[0]) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const index of indices) vertex(points[index], ns[index], inside);
  };
  for (let i = 0; i < P.arcSegments; i += 1) {
    const a = -HALF_ANGLE + (2 * HALF_ANGLE * i) / P.arcSegments;
    const b = -HALF_ANGLE + (2 * HALF_ANGLE * (i + 1)) / P.arcSegments;
    for (const skin of [-1, 1]) {
      for (let j = 0; j < P.heightSegments; j += 1) {
        const low = (j / P.heightSegments) * P.plateHeightM;
        const high = ((j + 1) / P.heightSegments) * P.plateHeightM;
        quad([surface(a, low, skin), surface(b, low, skin), surface(b, high, skin), surface(a, high, skin)],
          [a, b, b, a].map(angle => normalAt(side, angle).multiplyScalar(skin)), skin === side);
      }
    }
    for (const height of [0, P.plateHeightM]) {
      const n = new Vector3(0, height === 0 ? -1 : 1, 0);
      quad([surface(a, height, -1), surface(b, height, -1), surface(b, height, 1), surface(a, height, 1)],
        [n, n, n, n], false);
    }
  }
  for (const angle of [-HALF_ANGLE, HALF_ANGLE]) {
    const n = new Vector3(Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(Math.sign(angle));
    quad([surface(angle, 0, -1), surface(angle, P.plateHeightM, -1),
      surface(angle, P.plateHeightM, 1), surface(angle, 0, 1)], [n, n, n, n], false);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

function localSolidAt(x: number, y: number, z: number, padding: number): boolean {
  if (y < -padding || y > P.plateHeightM + padding || Math.abs(z) > 7.1 + padding) return false;
  const height = Math.max(0, Math.min(P.plateHeightM, y));
  for (const side of [-1, 1]) {
    const radius = P.middleRadiusM + side * TAPER * (height - P.plateHeightM / 2);
    const centerX = side * (P.groundPlateSeparationM / 2 - P.topInwardDisplacementM / 2) + P.middleRadiusM;
    const angle = Math.atan2(z, centerX - x);
    if (Math.abs(angle) > HALF_ANGLE) {
      const endAngle = Math.sign(angle) * HALF_ANGLE;
      if (Math.hypot(x - (centerX - radius * Math.cos(endAngle)), z - radius * Math.sin(endAngle)) <= HALF_THICKNESS + padding) return true;
    } else if (Math.abs(Math.hypot(centerX - x, z) - radius) <= HALF_THICKNESS + padding) return true;
  }
  return false;
}

/** Only the represented steel is solid: neither the passage nor a tall source bbox. */
export function berlinJunctionSolidAt(x: number, y: number, z: number, radius = 0): boolean {
  const dx = x - P.modelWorldM[0];
  const dz = z - P.modelWorldM[1];
  if (Math.abs(dx) > 10 + radius || Math.abs(dz) > 10 + radius) return false;
  const c = Math.cos(P.rotationY);
  const s = Math.sin(P.rotationY);
  return localSolidAt(dx * c - dz * s, y - P.groundYM, dx * s + dz * c, radius);
}

function minecraftPlates(): InstancedMesh {
  const cell = P.minecraftCellM;
  const blocks: Vector3[] = [];
  // One outward-rounded voxel per plate/row: every inner cube corner stays
  // outside the real passage, including at head height beneath the leaning steel.
  for (let iy = 0; iy < Math.round(P.plateHeightM / cell); iy += 1) {
    const y = (iy + 0.5) * cell;
    for (const side of [-1, 1]) {
      const radius = P.middleRadiusM + side * TAPER * (y - P.plateHeightM / 2);
      const centerX = side * (P.groundPlateSeparationM / 2 - P.topInwardDisplacementM / 2) + P.middleRadiusM;
      for (let iz = -35; iz < 35; iz += 1) {
        const z = (iz + 0.5) * cell;
        if (Math.abs(z) > radius * Math.sin(HALF_ANGLE)) continue;
        const surfaceX = centerX - Math.sqrt(radius * radius - z * z);
        let ix = Math.floor(surfaceX / cell);
        for (let attempt = 0; attempt < 4; attempt += 1, ix += side) {
          const x = (ix + 0.5) * cell;
          let outside = true;
          for (const dx of [-cell / 2, cell / 2]) {
            for (const dy of [-cell / 2, cell / 2]) {
              for (const dz of [-cell / 2, cell / 2]) {
                const r = P.middleRadiusM + side * TAPER * (y + dy - P.plateHeightM / 2);
                if (-side * (Math.hypot(centerX - (x + dx), z + dz) - r) < HALF_THICKNESS) outside = false;
              }
            }
          }
          if (outside) {
            blocks.push(new Vector3(x, y, z));
            break;
          }
        }
      }
    }
  }
  const geometry = new BoxGeometry(cell, cell, cell);
  const normals = geometry.getAttribute("normal");
  const shades: number[] = [];
  for (let i = 0; i < normals.count; i += 1) {
    const shade = 0.8 + 0.16 * normals.getY(i) - 0.1 * normals.getX(i) + 0.06 * normals.getZ(i);
    shades.push(shade, shade, shade);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(shades, 3));
  const dayMaterial = new MeshBasicMaterial({ color: 0x59483b, vertexColors: true });
  const mesh = new InstancedMesh(geometry, dayMaterial, blocks.length);
  mesh.name = "Berlin Junction Minecraft steel";
  const transform = new Object3D();
  blocks.forEach((point, index) => {
    transform.position.copy(point);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.userData.berlinJunctionMinecraft = true;
  return mesh;
}

export function createBerlinJunction(groundYM: number = P.groundYM): Group {
  const group = new Group();
  group.name = P.name;
  group.position.set(P.modelWorldM[0], groundYM, P.modelWorldM[1]);
  group.rotation.y = P.rotationY;
  group.userData.berlinJunction = P;
  group.userData.schwellenraumGeschuetzt = true;
  group.userData.geometryStatus = P.geometryStatus;
  const smooth = new Group();
  smooth.name = "Berlin Junction continuous steel plates";
  smooth.userData.berlinJunctionSmooth = true;
  for (const side of [-1, 1]) {
    const geometry = plateGeometry(side);
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.12 });
    const body = new Mesh(geometry, dayMaterial);
    body.name = `Berlin Junction steel plate ${side}`;
    body.userData.dayMaterial = dayMaterial;
    body.userData.nightMaterial = nightMaterial;
    body.castShadow = true;
    body.receiveShadow = true;
    smooth.add(body);
    const ink = new LineSegments(new EdgesGeometry(geometry, 28), markArchitecturalInk(new LineBasicMaterial(), "detail"));
    ink.name = "Berlin Junction plate perimeter";
    smooth.add(ink);
  }
  group.add(smooth);
  const minecraft = minecraftPlates();
  minecraft.visible = false;
  group.add(minecraft);
  return group;
}

export function setBerlinJunctionPresentation(root: Object3D, minecraft: boolean): void {
  const group = root.name === P.name ? root : root.getObjectByName(P.name);
  if (!group) return;
  for (const child of group.children) {
    if (child.userData.berlinJunctionSmooth) child.visible = !minecraft;
    if (child.userData.berlinJunctionMinecraft) child.visible = minecraft;
  }
}
