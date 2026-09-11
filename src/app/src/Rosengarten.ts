import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Mesh,
  Object3D,
  Path,
  Shape,
  ShapeGeometry,
  Vector2,
} from "three";
import { ROSENGARTEN_PROFILE as source, rosengartenInsideRing } from "./rosengartenProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
export { ROSENGARTEN_PROFILE, rosengartenInsideRing } from "./rosengartenProfile";

type Point = [number, number];
type Part = {
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  color: number;
  angle?: number;
};

/** Deterministic display planting, wholly inside the mapped beds, never the lawn. */
export function rosengartenPlanting(): { x: number; z: number; bedId: string }[] {
  const plants: { x: number; z: number; bedId: string }[] = [];
  for (const bed of source.beds) {
    const ring = bed.ring as Point[];
    const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]);
    for (let x = Math.min(...xs) + 0.65; x < Math.max(...xs); x += 1.9) {
      for (let z = Math.min(...zs) + 0.65; z < Math.max(...zs); z += 1.9) {
        // Keep the entire foliage envelope off the gravel and around the
        // small circular cut-outs in the original four formal flower beds.
        if ([-0.5, 0, 0.5].every((dx) => [-0.5, 0, 0.5].every((dz) =>
          rosengartenInsideRing(x + dx, z + dz, ring)))) {
          plants.push({ x, z, bedId: bed.osmWayId });
        }
      }
    }
  }
  return plants;
}

function batch(group: Group, name: string, geometry: BufferGeometry, parts: Part[]): void {
  const mesh = new InstancedMesh(geometry, new MeshStandardMaterial({ roughness: 0.92 }), parts.length);
  mesh.name = name;
  const object = new Object3D(), color = new Color();
  parts.forEach((part, index) => {
    object.position.set(...part.position);
    object.scale.set(...part.scale);
    object.rotation.set(0, part.angle ?? 0, 0);
    object.updateMatrix();
    mesh.setMatrixAt(index, object.matrix);
    mesh.setColorAt(index, color.setHex(part.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);
}

function build(minecraft: boolean): Group {
  const group = new Group();
  group.name = minecraft ? "Rosengarten block-native flowers and pergola" : "Rosengarten roses and historic stone pergola";
  group.userData.geometryStatus = source.source.geometryStatus;
  group.userData.sourceUrls = [source.source.garden, source.source.officialDescription, source.source.dop];
  const boxes: Part[] = [], leaves: Part[] = [], flowers: Part[] = [];
  const groundY = source.groundY;
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number, angle = 0): void => {
    boxes.push({ position: [x, groundY + y, z], scale: [w, h, d], color, angle });
  };
  const beam = (a: Point, b: Point, y: number, height: number, width: number, color: number): void => {
    box((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2,
      Math.hypot(b[0] - a[0], b[1] - a[1]), height, width, color,
      -Math.atan2(b[1] - a[1], b[0] - a[0]));
  };
  // Fine stone edging traces the retained bed polygons; it does not replace
  // the existing OSM garden/grass plates, path network or perimeter hedge.
  for (const bed of source.beds) {
    const ring = bed.ring as Point[];
    ring.forEach((a, index) => beam(a, ring[(index + 1) % ring.length], 0.11, 0.12, 0.13, 0xb6ac96));
  }
  const plants = rosengartenPlanting();
  const palette = [0xc94762, 0xefadc1, 0xf1e1bd, 0xc872a1, 0x98507f];
  plants.forEach(({ x, z }, index) => {
    const height = 0.45 + (index % 4) * 0.09;
    leaves.push({ position: [x, groundY + height * 0.6, z], scale: [0.5, height * 0.65, 0.48], color: index % 3 ? 0x56764c : 0x728653 });
    for (let bloom = 0; bloom < 3; bloom++) {
      const angle = bloom * Math.PI * 2 / 3 + (index % 5);
      flowers.push({ position: [x + Math.cos(angle) * 0.3, groundY + height, z + Math.sin(angle) * 0.3],
        scale: [0.17, 0.13, 0.17], color: palette[(Math.floor(index / 11) + bloom % 2) % palette.length] });
    }
  });

  // The existing mapped footway follows the southeast pergola corridor.
  // Two stone post rows and open radial rafters preserve its walk-through
  // character; no roof slab, filled arcade or water basin is introduced.
  const path = source.pergola.pathWorldM as Point[];
  const rows: [Point[], Point[]] = [[], []];
  for (let index = 0; index < path.length; index++) {
    const previous = path[Math.max(0, index - 1)], next = path[Math.min(path.length - 1, index + 1)];
    const dx = next[0] - previous[0], dz = next[1] - previous[1];
    const length = Math.hypot(dx, dz);
    const normal: Point = [-dz / length, dx / length];
    for (let row = 0; row < 2; row++) {
      const side = row === 0 ? -1 : 1;
      const point: Point = [path[index][0] + normal[0] * 1.55 * side, path[index][1] + normal[1] * 1.55 * side];
      rows[row].push(point);
      box(point[0], 0.15, point[1], 0.62, 0.3, 0.62, 0xb3ac9c);
      box(point[0], 1.61, point[1], 0.4, 2.72, 0.4, 0xc4bca8);
      box(point[0], 3.02, point[1], 0.66, 0.17, 0.66, 0xd4cdbb);
    }
    beam(rows[0][index], rows[1][index], 3.22, 0.18, 0.18, 0x817662);
    if (index > 0) {
      for (let row = 0; row < 2; row++) beam(rows[row][index - 1], rows[row][index], 3.12, 0.24, 0.28, 0xc1b8a2);
      for (let t = 1; t < 4; t++) {
        const interpolate = (row: number): Point => [
          rows[row][index - 1][0] + (rows[row][index][0] - rows[row][index - 1][0]) * t / 4,
          rows[row][index - 1][1] + (rows[row][index][1] - rows[row][index - 1][1]) * t / 4,
        ];
        beam(interpolate(0), interpolate(1), 3.22, 0.14, 0.12, 0x817662);
      }
    }
  }
  // Four timber seats on the central circular walk are visible in DOP2025.
  // Their dimensions are modest display estimates; the lawn stays open.
  const center: Point = [-1000.1, 538.45];
  for (const angle of [0.65, 1.5, 3.75, 4.6]) {
    const x = center[0] + Math.cos(angle) * 8.9, z = center[1] + Math.sin(angle) * 8.9;
    const direction = Math.PI / 2 - angle;
    box(x, 0.48, z, 1.7, 0.12, 0.44, 0x7a5e43, direction);
    box(x + Math.cos(angle) * 0.23, 0.87, z + Math.sin(angle) * 0.23, 1.7, 0.54, 0.08, 0x7a5e43, direction);
    for (const side of [-1, 1]) box(x - Math.sin(angle) * side * 0.6, 0.23, z + Math.cos(angle) * side * 0.6, 0.1, 0.46, 0.38, 0x454b43, direction);
  }
  if (minecraft) {
    // Minecraft never constructs the smooth ParkDetails layer. Retain its
    // exact mapped paths and hedge here, bounded to this garden alone.
    const shapes = source.minecraftGravel.polygons.map((polygon) => {
      const shape = new Shape(polygon.ring.map(([x, z]) => new Vector2(x, -z)));
      shape.holes = polygon.holes.map((ring) => new Path(ring.map(([x, z]) => new Vector2(x, -z))));
      return shape;
    });
    const gravelGeometry = new ShapeGeometry(shapes);
    gravelGeometry.rotateX(-Math.PI / 2);
    gravelGeometry.translate(0, groundY + 0.075, 0);
    const gravel = new Mesh(gravelGeometry, new MeshStandardMaterial({ color: 0xc9ba96, roughness: 1 }));
    gravel.name = "Rosengarten exact mapped Minecraft gravel paths";
    gravel.receiveShadow = true;
    group.add(gravel);
    const hedge = source.hedge.points;
    for (let i = 1; i < hedge.length; i++) {
      beam([hedge[i - 1][0], hedge[i - 1][2]], [hedge[i][0], hedge[i][2]],
        source.hedge.height_m / 2, source.hedge.height_m, source.hedge.width_m, 0x4e713f);
    }
    // Box-native petals/foliage share the structural cube and one draw call.
    const planting = [...leaves, ...flowers].map((part): Part => ({
      ...part,
      // Icosahedron sizes are radii; a unit cube needs their full extent.
      scale: [part.scale[0] * 2, part.scale[1] * 2, part.scale[2] * 2],
    }));
    batch(group, "Rosengarten Minecraft stone, timber and flower blocks", new BoxGeometry(1, 1, 1), [...boxes, ...planting]);
  } else {
    batch(group, "Rosengarten stone edging and open pergola", new BoxGeometry(1, 1, 1), boxes);
    const foliage = new IcosahedronGeometry(1, 0);
    batch(group, "Rosengarten clipped rose foliage", foliage, leaves);
    batch(group, "Rosengarten rose and perennial flowers", foliage, flowers);
  }
  group.userData.plantedBedCount = source.beds.length;
  group.userData.plantCount = plants.length;
  group.userData.bloomCount = flowers.length;
  group.userData.pergolaPostCount = path.length * 2;
  group.userData.centralLawnUnplanted = true;
  return freezeStaticSceneTransforms(group);
}

export function createRosengarten(): Group { return build(false); }
export function createRosengartenMinecraft(): Group { return build(true); }
