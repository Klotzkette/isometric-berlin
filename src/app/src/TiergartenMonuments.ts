import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  ARCHITECTURAL_INK_PALETTE,
  markArchitecturalInk,
} from "./architecturalInk";
import { BERLINER_ENSEMBLE_PUBLIC_ART_OSM_KEYS } from "./BerlinerEnsemble";
import { CSD_ATTACK_MEMORIAL_OSM_KEY } from "./CsdAttackMemorial";
import { createLetteringTexture } from "./drawnLettering";
import { createKindertransportMemorial, KINDERTRANSPORT_MEMORIAL_OSM_KEY } from "./KindertransportMemorial";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";
import type { StreetDetailsPayload } from "./TrafficSignals";

/**
 * "Alle Denkmäler im Tiergarten supergenau isometrisch": every OSM
 * monument/memorial inside the bounds gets a drawn model in the
 * ligne-claire city. The seven landmarks the verified recognition
 * layer already models in full (Holocaust stelae field, Soviet War
 * Memorial with its T-34s, Sinti-und-Roma, Homosexuellen-Denkmal,
 * Goethe, the composers, Zeugen Jehovas) are skipped here; this layer
 * adds everything else — the Potsdamer Platz Verkehrsturm replica,
 * the Euthanasie memorial's blue glass wall, the ML-20 howitzers, the
 * Weiße Kreuze, the Grundgesetz-49 glass
 * panels, statues on plinths for Lessing/Grimm/Bruno/Der Rufer, and
 * subtype-aware quiet markers. Positions, footprints and memorial types
 * are OSM (ODbL); the drawing is ours.
 */

export const MONUMENT_INK = ARCHITECTURAL_INK_PALETTE.day.detail;

const STONE = 0x8f8a80;
const STONE_LIGHT = 0xb9b6ac;
const MEMORIAL_BRASS = 0xc49a36;
const BRONZE = 0x5d7264;
const SOVIET_GREEN = 0x6b7a5c;
const DARK_CUBE = 0x8f9497;
const WHITE = 0xf2f2ee;
const GLASS_BLUE = 0x5f9fc4;
const TOWER_GREEN = 0x4a6b52;
const MARBLE = 0xe8e5dc;
const GRANITE_RED = 0x9d7a6e;
const CANOPY_ROOF = 0xa8543f;
const CANOPY_POST = 0x7d7a72;
const FLOWER_RED = 0xc95564;
const FLOWER_GOLD = 0xe8bf4c;
const FLOWER_PINK = 0xc77da4;
const FLOWER_WHITE = 0xf0eee4;
const FLORAPLATZ_GRANITE = 0xaaa69d;
const FLORAPLATZ_BRONZE = 0x344b43;
const GRAEFE_SANDSTONE = 0xd8cbb0;
const GRAEFE_SANDSTONE_LIGHT = 0xeee6d5;
const GRAEFE_BRONZE = 0x60857a;
const GRAEFE_BRONZE_LIGHT = 0x7b9b91;
const GRAEFE_BRONZE_DARK = 0x45665d;
const GRAEFE_NICHE_BRONZE = 0x87744f;
const GRAEFE_MAJOLICA = 0x6d7168;
const GRAEFE_MAJOLICA_BLUE = 0x66818a;
const GRAEFE_MAJOLICA_OCHRE = 0xb38a58;
const GRAEFE_MAJOLICA_TERRACOTTA = 0xa8664e;
const GRAEFE_HEDGE = 0x3f724b;
const GRAEFE_IRON = 0x4f5755;
const MUSCHELKALK = 0xb8b2a4;
const WEATHERED_MUSCHELKALK = 0x77786f;
const ROUSSEAU_SANDSTONE = 0xb89262;

export const GRAEFE_CHARITE_OSM_WORLD = [539.4, -512.9] as const;
export const GRAEFE_CHARITE_FACING_TARGET_WORLD = [557.75, -499.72] as const;
export const GRAEFE_CHARITE_YAW_DEGREES =
  (Math.atan2(
    GRAEFE_CHARITE_FACING_TARGET_WORLD[0] - GRAEFE_CHARITE_OSM_WORLD[0],
    GRAEFE_CHARITE_FACING_TARGET_WORLD[1] - GRAEFE_CHARITE_OSM_WORLD[1],
  ) *
    180) /
  Math.PI;
export const GRAEFE_STATUE_HEIGHT_M = 1.66;
export const GRAEFE_REAR_FENCE_HEIGHT_M = 1.84;
export const GRAEFE_MONUMENT_SOURCE_URL =
  "https://bildhauerei-in-berlin.de/bildwerk/albrecht-von-graefe-denkmal-7878/";
export const GRAEFE_CHARITE_SOURCE_URL =
  "https://denkmaeler.charite.de/graefe/";

type Builder = {
  edges: BufferGeometry[];
  parts: BufferGeometry[];
};

function appendOrientedBuilder(
  target: Builder,
  source: Builder,
  x: number,
  y: number,
  z: number,
  rotationY: number,
): void {
  for (const geometry of source.parts) {
    geometry.rotateY(rotationY);
    geometry.translate(x, y, z);
    target.parts.push(geometry);
  }
  for (const geometry of source.edges) {
    geometry.rotateY(rotationY);
    geometry.translate(x, y, z);
    target.edges.push(geometry);
  }
}

function box(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  rotationY = 0,
): void {
  const geometry = new BoxGeometry(sx, sy, sz);
  if (rotationY !== 0) {
    geometry.rotateY(rotationY);
  }
  geometry.translate(cx, cy, cz);
  geometry.deleteAttribute("uv");
  const paint = new Color(color);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    colors[index * 3] = paint.r;
    colors[index * 3 + 1] = paint.g;
    colors[index * 3 + 2] = paint.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  builder.parts.push(geometry);
  builder.edges.push(
    new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES)
  );
}

/** A sub-pixel ground insert must not grow a competing ink silhouette. */
function boxWithoutInk(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
): void {
  const geometry = new BoxGeometry(sx, sy, sz);
  geometry.translate(cx, cy, cz);
  geometry.deleteAttribute("uv");
  const paint = new Color(color);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    colors[index * 3] = paint.r;
    colors[index * 3 + 1] = paint.g;
    colors[index * 3 + 2] = paint.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  builder.parts.push(geometry);
}

function addPaintedGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  edgeThreshold = ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
): void {
  geometry.deleteAttribute("uv");
  const paint = new Color(color);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    colors[index * 3] = paint.r;
    colors[index * 3 + 1] = paint.g;
    colors[index * 3 + 2] = paint.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  builder.parts.push(geometry);
  builder.edges.push(new EdgesGeometry(geometry, edgeThreshold));
}

function cylinder(
  builder: Builder,
  color: number,
  x: number,
  baseY: number,
  z: number,
  bottomRadius: number,
  topRadius: number,
  height: number,
  segments = 16,
): void {
  const geometry = new CylinderGeometry(
    topRadius,
    bottomRadius,
    height,
    segments,
    1
  );
  geometry.translate(x, baseY + height / 2, z);
  addPaintedGeometry(builder, geometry, color, 22);
}

function orientedPoint(
  x: number,
  y: number,
  z: number,
  local: readonly [number, number, number],
  rotationY: number,
): Vector3 {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return new Vector3(
    x + local[0] * cosine + local[2] * sine,
    y + local[1],
    z - local[0] * sine + local[2] * cosine
  );
}

function ellipsoid(
  builder: Builder,
  color: number,
  x: number,
  y: number,
  z: number,
  local: readonly [number, number, number],
  scale: readonly [number, number, number],
  rotationY: number,
): void {
  const centre = orientedPoint(x, y, z, local, rotationY);
  const geometry = new SphereGeometry(1, 10, 6);
  geometry.scale(...scale);
  geometry.rotateY(rotationY);
  geometry.translate(centre.x, centre.y, centre.z);
  addPaintedGeometry(builder, geometry, color, 24);
}

function rod(
  builder: Builder,
  color: number,
  x: number,
  y: number,
  z: number,
  startLocal: readonly [number, number, number],
  endLocal: readonly [number, number, number],
  radius: number,
  rotationY: number,
  taper = 0.72,
): void {
  const start = orientedPoint(x, y, z, startLocal, rotationY);
  const end = orientedPoint(x, y, z, endLocal, rotationY);
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length < 0.01) return;
  const geometry = new CylinderGeometry(radius * taper, radius, length, 7, 1);
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction.normalize())
  );
  const centre = start.clone().add(end).multiplyScalar(0.5);
  geometry.translate(centre.x, centre.y, centre.z);
  addPaintedGeometry(builder, geometry, color, 24);
}

function floraplatzPlinth(
  builder: Builder,
  x: number,
  y: number,
  z: number,
  rotationY: number,
  length = 3.35
): number {
  box(builder, STONE_LIGHT, x, y + 0.09, z, length + 0.3, 0.18, 1.85, rotationY);
  box(
    builder,
    FLORAPLATZ_GRANITE,
    x,
    y + 0.55,
    z,
    length,
    0.92,
    1.58,
    rotationY
  );
  box(builder, STONE_LIGHT, x, y + 1.05, z, length + 0.12, 0.12, 1.7, rotationY);
  return 1.11;
}

function foldedLegs(
  builder: Builder,
  x: number,
  y: number,
  z: number,
  rotationY: number,
  deck: number
): void {
  for (const side of [-0.34, 0.34]) {
    rod(
      builder,
      FLORAPLATZ_BRONZE,
      x,
      y,
      z,
      [0.45, deck + 0.55, side],
      [1.1, deck + 0.2, side],
      0.12,
      rotationY,
      0.9
    );
    rod(
      builder,
      FLORAPLATZ_BRONZE,
      x,
      y,
      z,
      [-0.45, deck + 0.48, side],
      [-0.95, deck + 0.2, side],
      0.11,
      rotationY,
      0.9,
    );
  }
}

function branchedAntlers(
  builder: Builder,
  x: number,
  y: number,
  z: number,
  rotationY: number,
  base: readonly [number, number, number],
  spread = 0.72,
): void {
  for (const side of [-1, 1]) {
    const root: [number, number, number] = [base[0], base[1], side * 0.12];
    const middle: [number, number, number] = [
      base[0] - 0.08,
      base[1] + 0.52,
      side * spread * 0.55
    ];
    const tip: [number, number, number] = [
      base[0] + 0.08,
      base[1] + 1.02,
      side * spread
    ];
    rod(builder, FLORAPLATZ_BRONZE, x, y, z, root, middle, 0.055, rotationY);
    rod(builder, FLORAPLATZ_BRONZE, x, y, z, middle, tip, 0.045, rotationY);
    for (const offset of [0.12, 0.42, 0.72]) {
      rod(
        builder,
        FLORAPLATZ_BRONZE,
        x,
        y,
        z,
        [base[0], base[1] + offset, side * (spread * 0.32 + offset * 0.25)],
        [base[0] - 0.28, base[1] + offset + 0.32, side * (spread * 0.46 + offset * 0.34)],
        0.035,
        rotationY,
      );
    }
  }
}

/** Berlin's documented 10 x 10 cm pavement memorial, with no false ink halo. */
function buildStolperstein(builder: Builder, x: number, y: number, z: number): void {
  boxWithoutInk(builder, MEMORIAL_BRASS, x, y + 0.0125, z, 0.1, 0.025, 0.1);
}

/** Conservative presentation for an OSM plaque whose supporting wall is unknown. */
function buildPlaque(builder: Builder, x: number, y: number, z: number): void {
  boxWithoutInk(builder, MEMORIAL_BRASS, x, y + 0.015, z, 0.36, 0.03, 0.24);
}

function buildMemorialStele(
  builder: Builder,
  x: number,
  y: number,
  z: number,
  height = 1.65
): void {
  box(builder, STONE_LIGHT, x, y + 0.06, z, 0.72, 0.12, 0.52);
  box(builder, STONE, x, y + 0.12 + height / 2, z, 0.5, height, 0.24);
}

function buildMemorialBust(builder: Builder, x: number, y: number, z: number): void {
  box(builder, STONE_LIGHT, x, y + 0.48, z, 0.54, 0.96, 0.48);
  ellipsoid(builder, BRONZE, x, y, z, [0, 1.13, 0], [0.34, 0.25, 0.23], 0);
  ellipsoid(builder, BRONZE, x, y, z, [0, 1.49, 0], [0.19, 0.23, 0.18], 0);
}

function buildMemorialStatue(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  box(builder, STONE_LIGHT, x, y + 0.36, z, 0.82, 0.72, 0.68);
  rod(builder, BRONZE, x, y, z, [-0.16, 0.72, 0], [-0.16, 1.45, 0], 0.1, 0);
  rod(builder, BRONZE, x, y, z, [0.16, 0.72, 0], [0.16, 1.45, 0], 0.1, 0);
  ellipsoid(builder, BRONZE, x, y, z, [0, 1.72, 0], [0.3, 0.48, 0.2], 0);
  ellipsoid(builder, BRONZE, x, y, z, [0, 2.2, 0], [0.18, 0.22, 0.17], 0);
}

function buildMemorialObelisk(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  box(builder, STONE_LIGHT, x, y + 0.18, z, 1.0, 0.36, 1.0);
  cylinder(builder, STONE, x, y + 0.36, z, 0.42, 0.14, 2.65, 4);
}

function buildMemorialBench(builder: Builder, x: number, y: number, z: number): void {
  box(builder, STONE, x, y + 0.48, z, 1.6, 0.12, 0.48);
  box(builder, STONE, x, y + 0.83, z + 0.2, 1.6, 0.58, 0.1);
  for (const dx of [-0.58, 0.58]) {
    box(builder, STONE, x + dx, y + 0.24, z, 0.1, 0.48, 0.38);
  }
}

function buildGhostBike(builder: Builder, x: number, y: number, z: number): void {
  for (const dx of [-0.52, 0.52]) {
    const wheel = new TorusGeometry(0.34, 0.035, 5, 14);
    wheel.translate(x + dx, y + 0.36, z);
    addPaintedGeometry(builder, wheel, WHITE, 28);
  }
  rod(builder, WHITE, x, y, z, [-0.5, 0.36, 0], [0, 0.72, 0], 0.035, 0, 1);
  rod(builder, WHITE, x, y, z, [0, 0.72, 0], [0.5, 0.36, 0], 0.035, 0, 1);
  rod(builder, WHITE, x, y, z, [-0.5, 0.36, 0], [0.2, 0.36, 0], 0.035, 0, 1);
  rod(builder, WHITE, x, y, z, [0.2, 0.36, 0], [0, 0.72, 0], 0.035, 0, 1);
  rod(builder, WHITE, x, y, z, [0.2, 0.36, 0], [0.18, 0.93, 0], 0.03, 0, 1);
}

/** Preserve the OSM subtype without inventing a landmark-sized replacement. */
function buildTypedMemorial(
  builder: Builder,
  x: number,
  y: number,
  z: number,
  memorialType: string
): void {
  switch (memorialType) {
    case "stolperstein":
      buildStolperstein(builder, x, y, z);
      return;
    case "plaque":
    case "pavement_plaque":
      buildPlaque(builder, x, y, z);
      return;
    case "statue":
      buildMemorialStatue(builder, x, y, z);
      return;
    case "bust":
      buildMemorialBust(builder, x, y, z);
      return;
    case "stele":
      buildMemorialStele(builder, x, y, z);
      return;
    case "war_memorial":
      buildMemorialStele(builder, x, y, z, 2.2);
      return;
    case "obelisk":
      buildMemorialObelisk(builder, x, y, z);
      return;
    case "bench":
      buildMemorialBench(builder, x, y, z);
      return;
    case "ghost_bike":
      buildGhostBike(builder, x, y, z);
      return;
    case "headstone":
      buildMemorialStele(builder, x, y, z, 1.05);
      return;
    case "sculpture":
      box(builder, STONE_LIGHT, x, y + 0.12, z, 0.8, 0.24, 0.68);
      ellipsoid(builder, BRONZE, x, y, z, [0, 1.0, 0], [0.42, 0.78, 0.3], 0.35);
      return;
    case "stone":
      box(builder, STONE, x, y + 0.28, z, 0.68, 0.56, 0.5);
      return;
    default:
      // The source says only `historic=memorial`: keep a low marker instead
      // of asserting the former universal 0.7 m upright block.
      boxWithoutInk(builder, STONE, x, y + 0.04, z, 0.32, 0.08, 0.24);
  }
}

/** Günter Anlauf's documented 2.2 m three-zone Rousseau column (1987). */
function buildRousseauColumn(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  box(builder, ROUSSEAU_SANDSTONE, x, y + 0.08, z, 1.25, 0.16, 1.25);
  cylinder(builder, ROUSSEAU_SANDSTONE, x, y + 0.16, z, 0.43, 0.4, 1.0, 18);
  // The lower zone's shallow spiral bossing, then the contracted neck and
  // bowl-like middle described by Berlin's sculpture inventory.
  for (let index = 0; index < 9; index += 1) {
    const angle = index * 1.9;
    ellipsoid(
      builder,
      0xc6a579,
      x,
      y,
      z,
      [Math.cos(angle) * 0.4, 0.3 + index * 0.09, Math.sin(angle) * 0.4],
      [0.12, 0.075, 0.08],
      angle,
    );
  }
  cylinder(builder, ROUSSEAU_SANDSTONE, x, y + 1.16, z, 0.36, 0.3, 0.18, 18);
  cylinder(builder, ROUSSEAU_SANDSTONE, x, y + 1.34, z, 0.32, 0.5, 0.34, 18);
  cylinder(builder, ROUSSEAU_SANDSTONE, x, y + 1.68, z, 0.46, 0.44, 0.38, 16);
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    ellipsoid(
      builder,
      0xd0b083,
      x,
      y,
      z,
      [Math.cos(angle) * 0.43, 1.94, Math.sin(angle) * 0.43],
      [0.17, 0.15, 0.09],
      angle,
    );
  }
  cylinder(builder, ROUSSEAU_SANDSTONE, x, y + 2.06, z, 0.47, 0.38, 0.12, 16);
}

/** Gustav Eberlein's 6.5 m marble Lortzing monument (1904-06). */
function buildLortzingMemorial(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  box(builder, MARBLE, x, y + 0.1, z, 4.6, 0.2, 3.7);
  box(builder, MARBLE, x, y + 0.28, z, 4.05, 0.16, 3.2);
  box(builder, STONE_LIGHT, x, y + 0.48, z, 3.55, 0.24, 2.75);
  box(builder, MARBLE, x, y + 1.68, z, 1.75, 2.16, 1.62);
  cylinder(builder, MARBLE, x, y + 0.6, z + 0.76, 0.88, 0.88, 2.02, 18);

  // Five putti on the apsidal front refer to Lortzing's principal operas.
  for (let index = 0; index < 5; index += 1) {
    const px = x + (index - 2) * 0.55;
    ellipsoid(
      builder, MARBLE, px, y, z,
      [0, 1.45 + (index % 2) * 0.08, 1.35],
      [0.22, 0.33, 0.2], 0
    );
    ellipsoid(
      builder, MARBLE, px, y, z,
      [0, 1.86 + (index % 2) * 0.08, 1.35],
      [0.16, 0.17, 0.16], 0
    );
  }

  // Contemporary coat, separate legs/head, pen in the right hand and score
  // in the left. The tree-stump support is partly covered by the coat.
  rod(builder, MARBLE, x, y, z, [-0.28, 2.75, 0], [-0.32, 4.25, 0], 0.2, 0, 0.9);
  rod(builder, MARBLE, x, y, z, [0.28, 2.75, 0], [0.3, 4.25, 0], 0.2, 0, 0.9);
  const coat = new CylinderGeometry(0.48, 0.68, 1.9, 10);
  coat.scale(1, 1, 0.72);
  coat.translate(x, y + 4.65, z);
  addPaintedGeometry(builder, coat, MARBLE, 24);
  ellipsoid(builder, MARBLE, x, y, z, [0, 5.92, 0], [0.33, 0.39, 0.31], 0);
  rod(builder, MARBLE, x, y, z, [-0.38, 5.05, 0], [-0.73, 5.55, 0.12], 0.1, 0);
  rod(builder, MARBLE, x, y, z, [0.38, 5.05, 0], [0.72, 4.73, 0.18], 0.1, 0);
  rod(builder, 0xb6aa94, x, y, z, [-0.73, 5.55, 0.12], [-0.9, 6.28, 0.12], 0.025, 0, 1);
  box(builder, 0xe7e2d8, x + 0.74, y + 4.74, z + 0.19, 0.62, 0.08, 0.78, -0.15);
  cylinder(builder, STONE_LIGHT, x - 0.6, y + 2.65, z - 0.28, 0.24, 0.2, 1.65, 10);
}

/** Karl Wenke's four-part shell-limestone tree-donation stele (1951/52). */
function buildTreeDonationStele(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  box(builder, MUSCHELKALK, x, y + 0.1, z, 1.65, 0.2, 1.65);
  const courses = [0.72, 0.8, 0.8, 0.8];
  let base = 0.2;
  courses.forEach((height, index) => {
    box(
      builder,
      index % 2 === 0 ? WEATHERED_MUSCHELKALK : 0x85857b,
      x,
      y + base + height / 2,
      z,
      0.92 - index * 0.015,
      height,
      0.92 - index * 0.015,
    );
    base += height;
  });
  // Fine raised text/relief registers on three faces, not a blank cuboid.
  for (const height of [0.65, 1.0, 1.35, 1.7, 2.05, 2.4, 2.75]) {
    box(builder, 0xc2bdae, x, y + height, z + 0.466, 0.58, 0.025, 0.025);
    box(builder, 0xc2bdae, x + 0.466, y + height, z, 0.025, 0.025, 0.58);
  }
}

/** Louis Tuaillon's 1916 seated marble Robert Koch monument. */
function buildRobertKochMemorial(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  // Broad four-step marble base and inscribed pedestal.
  box(builder, STONE_LIGHT, x, y + 0.12, z, 5.0, 0.24, 4.3);
  box(builder, MARBLE, x, y + 0.34, z, 4.25, 0.22, 3.55);
  box(builder, MARBLE, x, y + 0.64, z, 3.65, 0.38, 3.0);
  box(builder, MARBLE, x, y + 1.58, z, 2.85, 1.5, 2.3);
  box(builder, STONE_LIGHT, x, y + 2.4, z, 3.15, 0.2, 2.6);
  // High-backed chair, seated coat, two separately readable legs and arms.
  box(builder, MARBLE, x, y + 3.58, z + 0.28, 2.5, 2.2, 0.5);
  box(builder, MARBLE, x, y + 3.65, z, 1.65, 1.85, 1.2);
  box(builder, MARBLE, x - 0.52, y + 3.05, z - 0.2, 0.55, 1.35, 0.75, -0.12);
  box(builder, MARBLE, x + 0.52, y + 3.05, z - 0.2, 0.55, 1.35, 0.75, 0.12);
  box(builder, MARBLE, x - 0.92, y + 3.78, z, 0.38, 1.45, 0.42, -0.35);
  box(builder, MARBLE, x + 0.92, y + 3.78, z, 0.38, 1.45, 0.42, 0.35);
  box(builder, MARBLE, x, y + 5.0, z - 0.03, 0.72, 0.82, 0.68);
}

function addGraefePediment(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  const halfWidth = 1.55;
  const bottom = y + 4.03;
  const top = y + 4.73;
  const front = z + 0.46;
  const back = z - 0.38;
  const vertices = [
    x - halfWidth,
    bottom,
    front,
    x + halfWidth,
    bottom,
    front,
    x,
    top,
    front,
    x + halfWidth,
    bottom,
    back,
    x - halfWidth,
    bottom,
    back,
    x,
    top,
    back,
    x - halfWidth,
    bottom,
    back,
    x - halfWidth,
    bottom,
    front,
    x,
    top,
    front,
    x - halfWidth,
    bottom,
    back,
    x,
    top,
    front,
    x,
    top,
    back,
    x + halfWidth,
    bottom,
    front,
    x + halfWidth,
    bottom,
    back,
    x,
    top,
    back,
    x + halfWidth,
    bottom,
    front,
    x,
    top,
    back,
    x,
    top,
    front,
    x - halfWidth,
    bottom,
    back,
    x + halfWidth,
    bottom,
    back,
    x + halfWidth,
    bottom,
    front,
    x - halfWidth,
    bottom,
    back,
    x + halfWidth,
    bottom,
    front,
    x - halfWidth,
    bottom,
    front,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(
    Array.from({ length: vertices.length / 3 }, (_, index) => index)
  );
  geometry.computeVertexNormals();
  addPaintedGeometry(builder, geometry, GRAEFE_SANDSTONE_LIGHT, 18);
}

function addGraefeReliefFigures(
  builder: Builder,
  x: number,
  y: number,
  z: number,
  side: -1 | 1
): void {
  const panelX = x + side * 2.55;
  const colours = [
    GRAEFE_MAJOLICA_BLUE,
    GRAEFE_MAJOLICA_OCHRE,
    GRAEFE_MAJOLICA_TERRACOTTA,
    GRAEFE_SANDSTONE_LIGHT,
  ] as const;
  for (let index = 0; index < 9; index += 1) {
    const figureX = panelX - 1.08 + index * 0.27;
    const height = 0.42 + ((index * 2) % 4) * 0.055;
    const baseY = 2.25 + (index % 2) * 0.035;
    const colour = colours[index % colours.length];
    ellipsoid(
      builder,
      colour,
      figureX,
      y,
      z,
      [0, baseY + height / 2, 0.5],
      [0.095, height / 2, 0.052],
      0
    );
    ellipsoid(
      builder,
      colours[(index + 1) % colours.length],
      figureX,
      y,
      z,
      [0, baseY + height + 0.075, 0.505],
      [0.07, 0.082, 0.05],
      0,
    );
    const stride = index % 2 === 0 ? 0.07 : -0.06;
    rod(
      builder,
      colour,
      figureX,
      y,
      z,
      [-0.035, baseY + 0.03, 0.505],
      [stride, baseY - 0.11, 0.505],
      0.026,
      0,
      0.78
    );
    rod(
      builder,
      colour,
      figureX,
      y,
      z,
      [0.035, baseY + 0.03, 0.505],
      [-stride, baseY - 0.11, 0.505],
      0.026,
      0,
      0.78
    );
    rod(
      builder,
      colour,
      figureX,
      y,
      z,
      [-0.075, baseY + height * 0.72, 0.505],
      [-0.15, baseY + height * 0.48, 0.51],
      0.023,
      0,
    );
    rod(
      builder,
      colour,
      figureX,
      y,
      z,
      [0.075, baseY + height * 0.72, 0.505],
      [0.15, baseY + height * 0.58, 0.51],
      0.023,
      0,
    );
  }
}

/**
 * Rudolf Siemering's 1882 monument at Schumann-/Luisenstrasse.
 *
 * The OSM point fixes the location. The 1.66 m bronze figure is documented;
 * the surrounding architecture is a proportioned presentation reconstruction
 * from the Charite and Bildhauerei-in-Berlin descriptions plus the owner's
 * supplied frontal references, not a measured facade survey.
 */
function buildGraefeChariteMemorialLocal(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  // Stepped sandstone base and three-axis neo-Renaissance screen.
  box(builder, GRAEFE_SANDSTONE, x, y + 0.16, z, 9.2, 0.32, 1.3);
  box(builder, GRAEFE_SANDSTONE_LIGHT, x, y + 0.4, z, 8.8, 0.18, 1.12);
  for (const side of [-1, 1]) {
    box(
      builder,
      GRAEFE_SANDSTONE,
      x + side * 2.58,
      y + 1.92,
      z,
      3.3,
      2.86,
      0.72
    );
    box(
      builder,
      GRAEFE_MAJOLICA,
      x + side * 2.55,
      y + 2.68,
      z + 0.405,
      2.6,
      1.02,
      0.08
    );
    for (const frameY of [2.12, 3.24]) {
      box(
        builder,
        GRAEFE_NICHE_BRONZE,
        x + side * 2.55,
        y + frameY,
        z + 0.465,
        2.86,
        0.09,
        0.07
      );
    }
    for (const frameX of [-1.39, 1.39]) {
      box(
        builder,
        GRAEFE_NICHE_BRONZE,
        x + side * 2.55 + frameX,
        y + 2.68,
        z + 0.465,
        0.09,
        1.2,
        0.07
      );
    }
    box(
      builder,
      GRAEFE_SANDSTONE_LIGHT,
      x + side * 2.55,
      y + 1.7,
      z + 0.42,
      2.72,
      0.46,
      0.1
    );
    // The Schiller inscriptions read as four incised text rows at map scale.
    for (let row = 0; row < 4; row += 1) {
      box(
        builder,
        0x8f765d,
        x + side * 2.55,
        y + 1.81 - row * 0.095,
        z + 0.485,
        2.2 - (row % 2) * 0.2,
        0.025,
        0.025
      );
    }
    addGraefeReliefFigures(builder, x, y, z, side as -1 | 1);
  }

  // Tall central bay, bronze/fayence shell niche and moulded round arch.
  box(builder, GRAEFE_SANDSTONE_LIGHT, x, y + 2.25, z, 2.75, 3.62, 0.84);
  box(
    builder,
    GRAEFE_NICHE_BRONZE,
    x,
    y + 2.45,
    z + 0.475,
    1.86,
    1.86,
    0.06
  );
  const nicheCrown = new CircleGeometry(0.93, 24, 0, Math.PI);
  nicheCrown.translate(x, y + 3.38, z + 0.505);
  addPaintedGeometry(builder, nicheCrown, GRAEFE_NICHE_BRONZE, 22);
  const arch = new TorusGeometry(1.08, 0.14, 6, 30, Math.PI);
  arch.translate(x, y + 3.38, z + 0.53);
  addPaintedGeometry(builder, arch, GRAEFE_SANDSTONE, 20);
  for (let index = 1; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI;
    rod(
      builder,
      0x6d6249,
      x,
      y,
      z,
      [0, 3.37, 0.54],
      [Math.cos(angle) * 0.82, 3.37 + Math.sin(angle) * 0.82, 0.545],
      0.022,
      0,
      0.72,
    );
  }
  for (const side of [-1, 1]) {
    box(
      builder,
      GRAEFE_SANDSTONE,
      x + side * 1.08,
      y + 2.42,
      z + 0.46,
      0.28,
      1.9,
      0.18
    );
    for (const ornamentY of [3.55, 3.78]) {
      const ornament = new TorusGeometry(0.11, 0.025, 5, 12);
      ornament.translate(x + side * 0.72, y + ornamentY, z + 0.57);
      addPaintedGeometry(builder, ornament, GRAEFE_SANDSTONE, 20);
    }
  }
  addGraefePediment(builder, x, y, z);

  // Corner piers, moulded caps and the central crest above the pediment.
  for (const side of [-1, 1]) {
    const pierX = x + side * 4.0;
    box(builder, GRAEFE_SANDSTONE_LIGHT, pierX, y + 1.9, z, 0.62, 3, 0.84);
    box(builder, GRAEFE_SANDSTONE, pierX, y + 3.46, z, 0.86, 0.18, 1.04);
    const cap = new CylinderGeometry(0.08, 0.39, 0.54, 4);
    cap.rotateY(Math.PI / 4);
    cap.translate(pierX, y + 3.82, z);
    addPaintedGeometry(builder, cap, GRAEFE_SANDSTONE_LIGHT, 18);
  }
  ellipsoid(
    builder,
    GRAEFE_SANDSTONE_LIGHT,
    x,
    y,
    z,
    [0, 5.02, 0],
    [0.25, 0.42, 0.15],
    0
  );

  // Siemering's documented 1.66 m bronze: long frock coat, narrow stance,
  // full beard, raised ophthalmoscope and the ornate support under his left
  // hand. The top of the hair is exactly 1.66 m above the shoe line.
  const footY = 1.02;
  box(builder, GRAEFE_SANDSTONE, x, y + 0.79, z + 0.24, 1.55, 0.4, 0.9);
  for (const [shoeX, shoeZ] of [
    [-0.16, 0.64],
    [0.2, 0.62],
  ] as const) {
    ellipsoid(
      builder,
      GRAEFE_BRONZE,
      x,
      y,
      z,
      [shoeX, footY + 0.055, shoeZ],
      [0.13, 0.055, 0.2],
      0
    );
  }
  rod(
    builder,
    GRAEFE_BRONZE,
    x,
    y,
    z,
    [-0.16, footY + 0.08, 0.57],
    [-0.11, footY + 0.69, 0.55],
    0.095,
    0,
    0.82
  );
  rod(
    builder,
    GRAEFE_BRONZE,
    x,
    y,
    z,
    [0.2, footY + 0.08, 0.55],
    [0.1, footY + 0.69, 0.55],
    0.095,
    0,
    0.82
  );
  const coatSkirt = new CylinderGeometry(0.28, 0.36, 0.76, 12);
  coatSkirt.scale(1, 1, 0.55);
  coatSkirt.translate(x, y + footY + 0.62, z + 0.55);
  addPaintedGeometry(builder, coatSkirt, GRAEFE_BRONZE, 25);
  ellipsoid(
    builder,
    GRAEFE_BRONZE,
    x,
    y,
    z,
    [0, footY + 1.08, 0.55],
    [0.31, 0.43, 0.17],
    0
  );
  ellipsoid(
    builder,
    GRAEFE_BRONZE,
    x,
    y,
    z,
    [0, footY + 1.47, 0.55],
    [0.15, 0.19, 0.145],
    0
  );
  // The portrait follows the reference's centre-parted hair, long full beard,
  // deep eyes and narrow nose. Slight patina shifts remain flat colours, but
  // make the expression legible in the unlit isometric day material.
  ellipsoid(
    builder,
    GRAEFE_BRONZE_LIGHT,
    x,
    y,
    z,
    [0, footY + 1.49, 0.69],
    [0.112, 0.13, 0.046],
    0
  );
  ellipsoid(
    builder,
    GRAEFE_BRONZE_DARK,
    x,
    y,
    z,
    [0, footY + 1.61, 0.575],
    [0.13, 0.05, 0.12],
    0
  );
  for (const hairX of [-0.108, 0.108]) {
    rod(
      builder,
      GRAEFE_BRONZE_DARK,
      x,
      y,
      z,
      [hairX * 0.45, footY + 1.62, 0.65],
      [hairX * 1.18, footY + 1.43, 0.69],
      0.034,
      0,
      0.9,
    );
  }
  for (const side of [-1, 1]) {
    ellipsoid(
      builder,
      GRAEFE_BRONZE_LIGHT,
      x,
      y,
      z,
      [side * 0.14, footY + 1.49, 0.61],
      [0.025, 0.045, 0.024],
      0
    );
    ellipsoid(
      builder,
      GRAEFE_BRONZE_DARK,
      x,
      y,
      z,
      [side * 0.043, footY + 1.535, 0.731],
      [0.018, 0.011, 0.01],
      0
    );
    rod(
      builder,
      GRAEFE_BRONZE_DARK,
      x,
      y,
      z,
      [side * 0.078, footY + 1.565, 0.728],
      [side * 0.018, footY + 1.56, 0.737],
      0.009,
      0,
      0.75,
    );
    ellipsoid(
      builder,
      GRAEFE_BRONZE_DARK,
      x,
      y,
      z,
      [side * 0.06, footY + 1.38, 0.714],
      [0.064, 0.12, 0.04],
      0
    );
  }
  rod(
    builder,
    GRAEFE_BRONZE_LIGHT,
    x,
    y,
    z,
    [0, footY + 1.535, 0.716],
    [0.008, footY + 1.475, 0.765],
    0.018,
    0,
    0.8
  );
  for (const side of [-1, 1]) {
    rod(
      builder,
      GRAEFE_BRONZE_DARK,
      x,
      y,
      z,
      [side * 0.006, footY + 1.445, 0.755],
      [side * 0.078, footY + 1.43, 0.737],
      0.015,
      0,
      0.8,
    );
  }
  ellipsoid(
    builder,
    GRAEFE_BRONZE_DARK,
    x,
    y,
    z,
    [0, footY + 1.32, 0.708],
    [0.075, 0.145, 0.045],
    0
  );
  // Lapels, waist seam and four coat buttons sharpen the contemporary dress.
  rod(
    builder,
    0x3f6259,
    x,
    y,
    z,
    [-0.17, footY + 1.32, 0.69],
    [0, footY + 1.02, 0.72],
    0.028,
    0,
    0.8
  );
  rod(
    builder,
    0x3f6259,
    x,
    y,
    z,
    [0.17, footY + 1.32, 0.69],
    [0, footY + 1.02, 0.72],
    0.028,
    0,
    0.8
  );
  for (const buttonY of [0.82, 0.94, 1.06, 1.18]) {
    ellipsoid(
      builder,
      0x2d4942,
      x,
      y,
      z,
      [0.035, footY + buttonY, 0.725],
      [0.018, 0.018, 0.012],
      0
    );
  }
  rod(
    builder,
    GRAEFE_BRONZE_DARK,
    x,
    y,
    z,
    [0, footY + 0.24, 0.71],
    [0, footY + 0.78, 0.73],
    0.014,
    0,
    0.7
  );
  for (const foldX of [-0.15, 0.15]) {
    rod(
      builder,
      GRAEFE_BRONZE_LIGHT,
      x,
      y,
      z,
      [foldX * 0.45, footY + 0.72, 0.72],
      [foldX, footY + 0.25, 0.69],
      0.014,
      0,
      0.65,
    );
  }
  // Raised right forearm crosses the chest and presents Helmholtz's
  // ophthalmoscope; the left hand rests on the carved support.
  rod(
    builder,
    GRAEFE_BRONZE,
    x,
    y,
    z,
    [-0.24, footY + 1.25, 0.55],
    [-0.32, footY + 1.02, 0.62],
    0.065,
    0
  );
  rod(
    builder,
    GRAEFE_BRONZE,
    x,
    y,
    z,
    [-0.32, footY + 1.02, 0.62],
    [-0.03, footY + 0.94, 0.72],
    0.058,
    0
  );
  rod(
    builder,
    GRAEFE_BRONZE,
    x,
    y,
    z,
    [0.25, footY + 1.24, 0.55],
    [0.35, footY + 0.93, 0.6],
    0.065,
    0
  );
  rod(
    builder,
    GRAEFE_BRONZE,
    x,
    y,
    z,
    [0.35, footY + 0.93, 0.6],
    [0.52, footY + 0.72, 0.62],
    0.058,
    0
  );
  const ophthalmoscope = new CylinderGeometry(0.052, 0.052, 0.035, 12);
  ophthalmoscope.rotateX(Math.PI / 2);
  ophthalmoscope.translate(x - 0.03, y + footY + 0.95, z + 0.75);
  addPaintedGeometry(builder, ophthalmoscope, GRAEFE_BRONZE_DARK, 24);
  ellipsoid(
    builder,
    GRAEFE_BRONZE_LIGHT,
    x,
    y,
    z,
    [-0.03, footY + 0.95, 0.735],
    [0.066, 0.054, 0.038],
    0
  );
  for (const supportX of [0.48, 0.58]) {
    rod(
      builder,
      0x304b44,
      x,
      y,
      z,
      [supportX, footY + 0.08, 0.52],
      [supportX, footY + 0.72, 0.56],
      0.045,
      0,
      0.82
    );
  }
  ellipsoid(
    builder,
    GRAEFE_BRONZE_DARK,
    x,
    y,
    z,
    [0.53, footY + 0.76, 0.57],
    [0.13, 0.11, 0.09],
    0
  );
  ellipsoid(
    builder,
    GRAEFE_BRONZE_LIGHT,
    x,
    y,
    z,
    [0.52, footY + 0.77, 0.65],
    [0.07, 0.045, 0.04],
    0
  );
  for (const supportY of [0.2, 0.48]) {
    const ornament = new TorusGeometry(0.09, 0.025, 5, 12);
    ornament.rotateY(Math.PI / 2);
    ornament.translate(x + 0.53, y + footY + supportY, z + 0.59);
    addPaintedGeometry(builder, ornament, GRAEFE_BRONZE_DARK, 20);
  }

  // The Charite boundary fence stands immediately behind the architecture in
  // every supplied frontal view. It is taller and straighter than the reduced
  // 2004 reconstruction around the planted forecourt.
  const rearFenceZ = -1.08;
  const rearFenceHalfWidth = 5.45;
  const rearFencePickets = 31;
  const rearFencePoints: Array<[number, number, number]> = [];
  for (let index = 0; index < rearFencePickets; index += 1) {
    const picketX =
      -rearFenceHalfWidth +
      (index / (rearFencePickets - 1)) * rearFenceHalfWidth * 2;
    rearFencePoints.push([picketX, 0, rearFenceZ]);
    const isPost = index % 5 === 0;
    rod(
      builder,
      GRAEFE_IRON,
      x,
      y,
      z,
      [picketX, 0.03, rearFenceZ],
      [picketX, GRAEFE_REAR_FENCE_HEIGHT_M, rearFenceZ],
      isPost ? 0.055 : 0.028,
      0,
      1,
    );
    const finial = new CylinderGeometry(0, isPost ? 0.08 : 0.052, 0.15, 4);
    finial.translate(
      x + picketX,
      y + GRAEFE_REAR_FENCE_HEIGHT_M + 0.075,
      z + rearFenceZ
    );
    addPaintedGeometry(builder, finial, GRAEFE_IRON, 18);
  }
  for (const railY of [0.28, 1.42, 1.7]) {
    rod(
      builder,
      GRAEFE_IRON,
      x,
      y,
      z,
      [-rearFenceHalfWidth, railY, rearFenceZ],
      [rearFenceHalfWidth, railY, rearFenceZ],
      0.035,
      0,
      1,
    );
  }
  for (let index = 1; index < rearFencePickets - 1; index += 2) {
    const ring = new TorusGeometry(0.105, 0.018, 5, 12);
    ring.translate(
      x + rearFencePoints[index][0],
      y + 0.84,
      z + rearFenceZ + 0.004
    );
    addPaintedGeometry(builder, ring, GRAEFE_IRON, 24);
  }

  // Low clipped hedge and the reconstructed curved street-side enclosure.
  for (const hedgeX of [-3.25, -1.65, 1.65, 3.25]) {
    box(builder, GRAEFE_HEDGE, x + hedgeX, y + 0.4, z + 0.95, 1.5, 0.48, 0.7);
  }
  const fencePoints: Array<[number, number, number]> = [];
  for (let step = 0; step <= 10; step += 1) {
    const localX = -4.5 + step * 0.9;
    const localZ = 1.22 + 0.42 * (1 - (localX / 4.5) ** 2);
    fencePoints.push([localX, 0, localZ]);
    rod(
      builder,
      GRAEFE_IRON,
      x,
      y,
      z,
      [localX, 0.05, localZ],
      [localX, 1.02, localZ],
      0.045,
      0,
      1
    );
    ellipsoid(
      builder,
      GRAEFE_IRON,
      x,
      y,
      z,
      [localX, 1.08, localZ],
      [0.075, 0.09, 0.075],
      0
    );
  }
  for (let index = 1; index < fencePoints.length; index += 1) {
    for (const railY of [0.42, 0.82]) {
      const previous = fencePoints[index - 1];
      const current = fencePoints[index];
      rod(
        builder,
        GRAEFE_IRON,
        x,
        y,
        z,
        [previous[0], railY, previous[2]],
        [current[0], railY, current[2]],
        0.028,
        0,
        1,
      );
    }
  }
}

function buildGraefeChariteMemorial(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  const localBuilder: Builder = { edges: [], parts: [] };
  buildGraefeChariteMemorialLocal(localBuilder, 0, 0, 0);
  appendOrientedBuilder(
    builder,
    localBuilder,
    x,
    y,
    z,
    (GRAEFE_CHARITE_YAW_DEGREES * Math.PI) / 180
  );
}

function createGraefeNamePlate(x: number, y: number, z: number): Mesh {
  const createLine = (text: string): Mesh => {
    const texture = createLetteringTexture({
      bandHeightM: 0.14,
      bandWidthM: 1.2,
      capHeightM: 0.09,
      fieldColor: "#d8cbb0",
      letterColor: "#765e48",
      text,
      texelsPerMetre: 300,
    });
    const dayMaterial = texture
      ? new MeshBasicMaterial({ map: texture, side: DoubleSide })
      : new MeshBasicMaterial({ color: GRAEFE_SANDSTONE });
    const nightMaterial = texture
      ? new MeshStandardMaterial({
          map: texture,
          roughness: 0.85,
          side: DoubleSide,
        })
      : new MeshStandardMaterial({ color: GRAEFE_SANDSTONE, roughness: 0.85 });
    const line = new Mesh(new PlaneGeometry(1.2, 0.14), dayMaterial);
    line.userData.dayMaterial = dayMaterial;
    line.userData.nightMaterial = nightMaterial;
    return line;
  };
  const plate = createLine("ALBRECHT");
  plate.name = "ALBRECHT VON GRAEFE monument inscription";
  plate.position.copy(
    orientedPoint(
      x,
      y,
      z,
      [0, 0.97, 0.73],
      (GRAEFE_CHARITE_YAW_DEGREES * Math.PI) / 180)
  );
  plate.rotation.y = (GRAEFE_CHARITE_YAW_DEGREES * Math.PI) / 180;
  const secondLine = createLine("VON GRAEFE");
  secondLine.name = "VON GRAEFE monument inscription second line";
  secondLine.position.set(0, -0.15, 0.006);
  plate.add(secondLine);
  return plate;
}


/**
 * The remaining named OSM artworks are not memorial markers.  These compact
 * presentation archetypes give each its documented reading (animal, mounted
 * figure, statue, fountain, wall, portal or abstract vertical) while keeping
 * one merged draw-call-friendly mesh.  They are deliberately larger and more
 * articulated than the conservative subtype-aware quiet-marker fallbacks.
 * Reference basis: Wikimedia Commons/Wikipedia and the Berlin sculpture
 * database; all are reference-based presentation geometry, never survey data.
 */
type ArtworkBuilder = (builder: Builder, x: number, y: number, z: number) => void;

function buildAnimalArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE, x, y + 0.25 * s, z, 3.4 * s, 0.5 * s, 2.2 * s);
  box(builder, BRONZE, x, y + 1.25 * s, z, 2.45 * s, 1.35 * s, 1.1 * s);
  box(builder, BRONZE, x - 1.35 * s, y + 1.75 * s, z, 0.65 * s, 1.35 * s, 0.78 * s, 0.25);
  box(builder, BRONZE, x - 1.75 * s, y + 2.45 * s, z, 0.72 * s, 0.58 * s, 0.62 * s);
  for (const [dx, dz] of [[-0.8, -0.38], [-0.8, 0.38], [0.86, -0.38], [0.86, 0.38],
  ] as const) {
    box(builder, BRONZE, x + dx * s, y + 0.65 * s, z + dz * s, 0.26 * s, 1.15 * s, 0.26 * s);
  }
}
function buildMountedArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  buildAnimalArtwork(builder, x, y, z, s);
  box(builder, BRONZE, x + 0.2 * s, y + 3.0 * s, z, 0.52 * s, 1.65 * s, 0.48 * s);
  box(builder, BRONZE, x + 0.2 * s, y + 4.02 * s, z, 0.4 * s, 0.42 * s, 0.4 * s);
  box(builder, BRONZE, x + 0.45 * s, y + 2.25 * s, z - 0.5 * s, 0.25 * s, 1.25 * s, 0.22 * s);
}
function buildStandingArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE_LIGHT, x, y + 0.28 * s, z, 2.7 * s, 0.56 * s, 2.7 * s);
  box(builder, GRANITE_RED, x, y + 1.25 * s, z, 1.85 * s, 1.4 * s, 1.85 * s);
  box(builder, BRONZE, x, y + 2.75 * s, z, 0.76 * s, 1.65 * s, 0.68 * s);
  box(builder, BRONZE, x, y + 3.78 * s, z, 0.46 * s, 0.46 * s, 0.46 * s);
  box(builder, BRONZE, x + 0.55 * s, y + 2.85 * s, z, 0.22 * s, 1.05 * s, 0.22 * s, -0.3);
}
function buildFigureGroupArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE, x, y + 0.25 * s, z, 4.0 * s, 0.5 * s, 2.8 * s);
  for (const [dx, dz, h] of [[-0.9, -0.25, 1.55], [0.2, 0.35, 1.15], [1.05, -0.2, 1.38],
  ] as const) {
    box(builder, BRONZE, x + dx * s, y + (0.55 + h / 2) * s, z + dz * s, 0.66 * s, h * s, 0.62 * s);
    box(builder, BRONZE, x + dx * s, y + (0.7 + h) * s, z + dz * s, 0.38 * s, 0.38 * s, 0.38 * s);
  }
}
function buildFountainArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE_LIGHT, x, y + 0.16 * s, z, 5.0 * s, 0.32 * s, 5.0 * s);
  box(builder, 0x608e9e, x, y + 0.35 * s, z, 4.15 * s, 0.14 * s, 4.15 * s);
  box(builder, STONE, x, y + 1.0 * s, z, 1.1 * s, 1.35 * s, 1.1 * s);
  box(builder, BRONZE, x, y + 2.05 * s, z, 0.45 * s, 0.95 * s, 0.45 * s);
}
function buildWallArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE, x, y + 0.2 * s, z, 7.0 * s, 0.4 * s, 1.35 * s);
  for (const dx of [-2.5, -0.85, 0.85, 2.5]) box(builder, DARK_CUBE, x + dx * s, y + 1.45 * s, z, 1.35 * s, 2.1 * s, 0.36 * s);
}
function buildPortalArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE_LIGHT, x, y + 0.2 * s, z, 5.2 * s, 0.4 * s, 1.5 * s);
  for (const dx of [-1.85, 1.85]) box(builder, BRONZE, x + dx * s, y + 2.1 * s, z, 0.55 * s, 3.8 * s, 0.72 * s);
  box(builder, BRONZE, x, y + 4.0 * s, z, 4.3 * s, 0.5 * s, 0.72 * s);
}
function buildVerticalArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE, x, y + 0.24 * s, z, 3.1 * s, 0.48 * s, 2.4 * s);
  box(builder, BRONZE, x, y + 2.3 * s, z, 0.75 * s, 3.75 * s, 0.72 * s, 0.18);
  box(builder, BRONZE, x + 0.55 * s, y + 3.1 * s, z, 1.9 * s, 0.34 * s, 0.36 * s, -0.45);
}
function buildAbstractArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE, x, y + 0.22 * s, z, 3.8 * s, 0.44 * s, 2.8 * s);
  box(builder, BRONZE, x - 0.7 * s, y + 1.35 * s, z, 0.75 * s, 2.25 * s, 0.62 * s, 0.35);
  box(builder, BRONZE, x + 0.75 * s, y + 1.12 * s, z, 0.65 * s, 1.75 * s, 0.68 * s, -0.55);
  box(builder, BRONZE, x, y + 2.28 * s, z, 2.25 * s, 0.28 * s, 0.42 * s, 0.18);
}

/** Panzernashorn: reference-based presentation silhouette, not surveyed geometry. */
function buildPanzernashorn(builder: Builder, x: number, y: number, z: number): void {
  // Rico Rensmeyer's Zoo Berlin bronze reads as a low, very broad Indian
  // rhinoceros. The paired nose horns make it legible at city-view distance.
  // Reference: https://danpearlman.com/news/zoo-berlin/
  buildAnimalArtwork(builder, x, y, z, 1.45);
  box(builder, BRONZE, x - 2.55, y + 3.25, z, 0.82, 0.24, 0.24, 0.32);
  box(builder, BRONZE, x - 2.27, y + 2.98, z, 0.5, 0.18, 0.18, 0.32);
}

/** Blindenhund: reference-based presentation silhouette, not surveyed geometry. */
function buildBlindenhund(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Knut: reference-based presentation silhouette, not surveyed geometry. */
function buildKnut(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Wildschwein: reference-based presentation silhouette, not surveyed geometry. */
function buildWildschwein(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Stab und Scheibe 2: reference-based presentation silhouette, not surveyed geometry. */
function buildStabUndScheibe2(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Schifferbrunnen: reference-based presentation silhouette, not surveyed geometry. */
function buildSchifferbrunnen(builder: Builder, x: number, y: number, z: number): void {
  // Hosaeus's polygonal basin, central fountain stock and seated young
  // boatman on a bollard; the water itself is now planted but the basin
  // remains the work's unmistakable footprint.
  // Reference: https://bildhauerei-in-berlin.de/bildwerk/schiffer-brunnen-6443/
  buildFountainArtwork(builder, x, y, z, 1.2);
  box(builder, BRONZE, x, y + 3.05, z, 0.56, 1.05, 0.5);
  box(builder, BRONZE, x, y + 3.85, z, 0.38, 0.38, 0.38);
  box(builder, BRONZE, x + 0.42, y + 2.62, z, 0.82, 0.25, 0.28);
}

/** Hand mit Uhr: reference-based presentation silhouette, not surveyed geometry. */
function buildHandMitUhr(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.0);
}

/** Klinkerbär: reference-based presentation silhouette, not surveyed geometry. */
function buildKlinkerbar(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Morgendämmerung Nr. 1: reference-based presentation silhouette, not surveyed geometry. */
function buildMorgendammerungNr1(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Pfeilerfigur Bär: reference-based presentation silhouette, not surveyed geometry. */
function buildPfeilerfigurBar(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Vegetative Plastik I: reference-based presentation silhouette, not surveyed geometry. */
function buildVegetativePlastikI(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Pfeilerfigur Bär mit Wappen ZG: reference-based presentation silhouette, not surveyed geometry. */
function buildPfeilerfigurBarMitWappenZg(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Interbau-Freiplastik: reference-based presentation silhouette, not surveyed geometry. */
function buildInterbauFreiplastik(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Liegende weibliche Figur: reference-based presentation silhouette, not surveyed geometry. */
function buildLiegendeWeiblicheFigur(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** Georgia: reference-based presentation silhouette, not surveyed geometry. */
function buildGeorgia(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.0);
}

/** Fuchsjagd: reference-based presentation silhouette, not surveyed geometry. */
function buildFuchsjagd(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Hasenhetze: reference-based presentation silhouette, not surveyed geometry. */
function buildHasenhetze(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Silberfisch im Englischen Garten: reference-based presentation silhouette, not surveyed geometry. */
function buildSilberfischImEnglischenGarten(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.0);
}

/** Sonnenuhr: reference-based presentation silhouette, not surveyed geometry. */
function buildSonnenuhr(builder: Builder, x: number, y: number, z: number): void {
  buildFountainArtwork(builder, x, y, z, 1.2);
}

/** Theodor Fontane: reference-based presentation silhouette, not surveyed geometry. */
function buildTheodorFontane(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Vier Bären: reference-based presentation silhouette, not surveyed geometry. */
function buildVierBaren(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Büffeljagd: reference-based presentation silhouette, not surveyed geometry. */
function buildBuffeljagd(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Eberjagd: reference-based presentation silhouette, not surveyed geometry. */
function buildEberjagd(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Das deutsche Volkslied: reference-based presentation silhouette, not surveyed geometry. */
function buildDasDeutscheVolkslied(builder: Builder, x: number, y: number, z: number): void {
  // Three-step shell-limestone pedestal and the close seated pair: the older
  // music muse with lyre and laurel, embracing the younger braided "Lied".
  box(builder, STONE, x, y + 0.08, z, 3.8, 0.16, 3.25);
  box(builder, MUSCHELKALK, x, y + 0.24, z, 3.25, 0.16, 2.75);
  box(builder, MUSCHELKALK, x, y + 0.44, z, 2.8, 0.24, 2.35);
  box(builder, MARBLE, x, y + 0.78, z, 2.35, 0.44, 1.9);
  for (const [dx, height] of [[-0.48, 1.35], [0.48, 1.18],
  ] as const) {
    ellipsoid(builder, MARBLE, x, y, z, [dx, 1.55, 0], [0.48, 0.68, 0.43], 0);
    ellipsoid(builder, MARBLE, x, y, z, [dx, 2.25 + height * 0.05, 0], [0.27, 0.31, 0.25], 0);
  }
  rod(builder, MARBLE, x, y, z, [-0.2, 1.82, 0], [0.4, 1.72, 0], 0.1, 0);
  for (const side of [-1, 1]) {
    rod(builder, 0xb39b70, x, y, z, [-0.86 + side * 0.12, 1.1, 0.48], [-0.82 + side * 0.18, 2.0, 0.48], 0.045, 0, 1);
  }
  rod(builder, 0xb39b70, x, y, z, [-1.0, 1.98, 0.48], [-0.63, 1.98, 0.48], 0.045, 0, 1);
  for (const offset of [-0.1, 0, 0.1]) {
    rod(builder, 0xcbb995, x, y, z, [-0.82 + offset, 1.2, 0.49], [-0.82 + offset, 1.94, 0.49], 0.012, 0, 1);
  }
}

/** Viktoria: reference-based presentation silhouette, not surveyed geometry. */
function buildViktoria(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Chance Of Direction: reference-based presentation silhouette, not surveyed geometry. */
function buildChanceOfDirection(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Galatea: reference-based presentation silhouette, not surveyed geometry. */
function buildGalatea(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Knabe mit Pony: reference-based presentation silhouette, not surveyed geometry. */
function buildKnabeMitPony(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Wings of Mexico: reference-based presentation silhouette, not surveyed geometry. */
function buildWingsOfMexico(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Alebrije: reference-based presentation silhouette, not surveyed geometry. */
function buildAlebrije(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Anna Elisabeth Louise: reference-based presentation silhouette, not surveyed geometry. */
function buildAnnaElisabethLouise(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Florastatue: reference-based presentation silhouette, not surveyed geometry. */
function buildFlorastatue(builder: Builder, x: number, y: number, z: number): void {
  // Rosengarten copy of Flora/Pomona: multipart rectangular plinth, full
  // draped goddess with fruit/flower garlands, tree support and small putto.
  box(builder, STONE_LIGHT, x, y + 0.11, z, 2.7, 0.22, 2.25);
  box(builder, ROUSSEAU_SANDSTONE, x, y + 0.38, z, 2.25, 0.32, 1.85);
  box(builder, STONE_LIGHT, x, y + 0.64, z, 1.9, 0.2, 1.55);
  const drapery = new CylinderGeometry(0.45, 0.66, 1.75, 10);
  drapery.scale(1, 1, 0.75);
  drapery.translate(x - 0.2, y + 1.75, z);
  addPaintedGeometry(builder, drapery, ROUSSEAU_SANDSTONE, 24);
  ellipsoid(builder, ROUSSEAU_SANDSTONE, x, y, z, [-0.2, 2.88, 0], [0.3, 0.36, 0.28], -0.25);
  rod(builder, ROUSSEAU_SANDSTONE, x, y, z, [-0.54, 2.25, 0], [-0.7, 1.35, 0.16], 0.11, 0);
  rod(builder, ROUSSEAU_SANDSTONE, x, y, z, [0.2, 2.28, 0], [0.48, 2.72, 0.18], 0.11, 0);
  ellipsoid(builder, 0xb77f51, x, y, z, [0.52, 2.79, 0.18], [0.12, 0.13, 0.12], 0);
  cylinder(builder, 0x8a6c4f, x - 0.72, y + 0.74, z - 0.18, 0.16, 0.12, 1.35, 9);
  ellipsoid(builder, ROUSSEAU_SANDSTONE, x, y, z, [0.76, 1.3, 0.12], [0.27, 0.38, 0.25], 0);
  ellipsoid(builder, ROUSSEAU_SANDSTONE, x, y, z, [0.76, 1.8, 0.12], [0.2, 0.22, 0.19], 0);
  rod(builder, ROUSSEAU_SANDSTONE, x, y, z, [0.9, 1.5, 0.12], [1.02, 2.25, 0.12], 0.07, 0);
  ellipsoid(builder, 0xb77f51, x, y, z, [1.03, 2.35, 0.12], [0.1, 0.11, 0.1], 0);
}

/** Waffen: reference-based presentation silhouette, not surveyed geometry. */
function buildWaffen(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Der Rhein: reference-based presentation silhouette, not surveyed geometry. */
function buildDerRhein(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** Die Elbe: reference-based presentation silhouette, not surveyed geometry. */
function buildDieElbe(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** Die Oder: reference-based presentation silhouette, not surveyed geometry. */
function buildDieOder(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** Die Weichsel: reference-based presentation silhouette, not surveyed geometry. */
function buildDieWeichsel(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** Künstliche Natur: reference-based presentation silhouette, not surveyed geometry. */
function buildKunstlicheNatur(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Anatolische Zugvögel: reference-based presentation silhouette, not surveyed geometry. */
function buildAnatolischeZugvogel(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Skulptur Liebe (Gewächs): reference-based presentation silhouette, not surveyed geometry. */
function buildSkulpturLiebeGewachs(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Abschied des Kriegers von seiner Familie: reference-based presentation silhouette, not surveyed geometry. */
function buildAbschiedDesKriegersVonSeinerFamilie(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** Der Kampf: reference-based presentation silhouette, not surveyed geometry. */
function buildDerKampf(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** Die glückliche Heimkehr des Kriegers: reference-based presentation silhouette, not surveyed geometry. */
function buildDieGlucklicheHeimkehrDesKriegers(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** Richard Wagner: reference-based presentation silhouette, not surveyed geometry. */
function buildRichardWagner(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.0);
}

/** Der verwundete Krieger: reference-based presentation silhouette, not surveyed geometry. */
function buildDerVerwundeteKrieger(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** Wegzeichen 3a: reference-based presentation silhouette, not surveyed geometry. */
function buildWegzeichen3A(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Zusammenhalt: reference-based presentation silhouette, not surveyed geometry. */
function buildZusammenhalt(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Foundation: reference-based presentation silhouette, not surveyed geometry. */
function buildFoundation(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Herkules: reference-based presentation silhouette, not surveyed geometry. */
function buildHerkules(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Friedrich Wilhelm III. von Preußen: reference-based presentation silhouette, not surveyed geometry. */
function buildFriedrichWilhelmIiiVonPreuen(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Large Divided Oval: Butterfly: reference-based presentation silhouette, not surveyed geometry. */
function buildLargeDividedOvalButterfly(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Der Sieger: reference-based presentation silhouette, not surveyed geometry. */
function buildDerSieger(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Wilhelm von Preußen: reference-based presentation silhouette, not surveyed geometry. */
function buildWilhelmVonPreuen(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** HKW: reference-based presentation silhouette, not surveyed geometry. */
function buildHkw(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Großer Janus II: reference-based presentation silhouette, not surveyed geometry. */
function buildGroerJanusIi(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Klanginstallation Klopfzeichen: reference-based presentation silhouette, not surveyed geometry. */
function buildKlanginstallationKlopfzeichen(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Panoptikum: reference-based presentation silhouette, not surveyed geometry. */
function buildPanoptikum(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Köpfe und Schwanz: reference-based presentation silhouette, not surveyed geometry. */
function buildKopfeUndSchwanz(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Polis: reference-based presentation silhouette, not surveyed geometry. */
function buildPolis(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Berlin Block for Charlie Chaplin: reference-based presentation silhouette, not surveyed geometry. */
function buildBerlinBlockForCharlieChaplin(builder: Builder, x: number, y: number, z: number): void {
  buildWallArtwork(builder, x, y, z, 1.15);
}

/** Altar: reference-based presentation silhouette, not surveyed geometry. */
function buildAltar(builder: Builder, x: number, y: number, z: number): void {
  buildPortalArtwork(builder, x, y, z, 1.1);
}

/** Imperial Love: reference-based presentation silhouette, not surveyed geometry. */
function buildImperialLove(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Zeitnadel: reference-based presentation silhouette, not surveyed geometry. */
function buildZeitnadel(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** "Der Ring" von Norbert Radermacher: reference-based presentation silhouette, not surveyed geometry. */
function buildDerRingVonNorbertRadermacher(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.0);
}

/** Denkmal Gustav Hartmann: reference-based presentation silhouette, not surveyed geometry. */
function buildDenkmalGustavHartmann(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.0);
}

/** Vier Vierecke im Geviert: reference-based presentation silhouette, not surveyed geometry. */
function buildVierViereckeImGeviert(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Der Bogenschütze: reference-based presentation silhouette, not surveyed geometry. */
function buildDerBogenschutze(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Echo I: reference-based presentation silhouette, not surveyed geometry. */
function buildEchoI(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Todes Mauer Bruch: reference-based presentation silhouette, not surveyed geometry. */
function buildTodesMauerBruch(builder: Builder, x: number, y: number, z: number): void {
  buildWallArtwork(builder, x, y, z, 1.15);
}

/** Tor auf dem Karlsbad: reference-based presentation silhouette, not surveyed geometry. */
function buildTorAufDemKarlsbad(builder: Builder, x: number, y: number, z: number): void {
  buildPortalArtwork(builder, x, y, z, 1.1);
}

/** Echo II: reference-based presentation silhouette, not surveyed geometry. */
function buildEchoIi(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** One of Siemering's paired reclining Floraplatz deer. */
function buildHirsch(builder: Builder, x: number, y: number, z: number): void {
  const rotationY = x < -180 ? 0.15 : Math.PI + 0.15;
  const deck = floraplatzPlinth(builder, x, y, z, rotationY, 3.45);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [0.15, deck + 0.58, 0], [1.35, 0.55, 0.52], rotationY);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [0.95, deck + 0.56, 0], [0.62, 0.58, 0.55], rotationY);
  foldedLegs(builder, x, y, z, rotationY, deck);
  rod(builder, FLORAPLATZ_BRONZE, x, y, z, [-0.85, deck + 0.7, 0], [-1.3, deck + 1.62, 0], 0.22, rotationY, 0.8);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [-1.48, deck + 1.82, 0], [0.46, 0.3, 0.28], rotationY);
  rod(builder, FLORAPLATZ_BRONZE, x, y, z, [-1.55, deck + 1.88, -0.12], [-1.75, deck + 2.18, -0.34], 0.065, rotationY);
  rod(builder, FLORAPLATZ_BRONZE, x, y, z, [-1.55, deck + 1.88, 0.12], [-1.75, deck + 2.18, 0.34], 0.065, rotationY);
  branchedAntlers(builder, x, y, z, rotationY, [-1.38, deck + 2.02, 0], 0.62);
}

/** Große Knospe III/63: reference-based presentation silhouette, not surveyed geometry. */
function buildGroeKnospeIii63(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Simón Bolívar: reference-based presentation silhouette, not surveyed geometry. */
function buildSimonBolivar(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Himmelschlüssel: reference-based presentation silhouette, not surveyed geometry. */
function buildHimmelschlussel(builder: Builder, x: number, y: number, z: number): void {
  buildPortalArtwork(builder, x, y, z, 1.1);
}

/** Siemering's single reclining bear at Floraplatz. */
function buildBar(builder: Builder, x: number, y: number, z: number): void {
  const rotationY = -0.18;
  const deck = floraplatzPlinth(builder, x, y, z, rotationY, 3.2);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [0.25, deck + 0.65, 0], [1.35, 0.72, 0.65], rotationY);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [-0.9, deck + 0.82, 0], [0.68, 0.62, 0.58], rotationY);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [-1.35, deck + 0.75, 0], [0.43, 0.3, 0.32], rotationY);
  for (const side of [-0.28, 0.28]) {
    ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [-0.92, deck + 1.31, side], [0.13, 0.16, 0.12], rotationY);
  }
  foldedLegs(builder, x, y, z, rotationY, deck);
}

/** Pferdekopf: reference-based presentation silhouette, not surveyed geometry. */
function buildPferdekopf(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Vertical Highways: reference-based presentation silhouette, not surveyed geometry. */
function buildVerticalHighways(builder: Builder, x: number, y: number, z: number): void {
  buildWallArtwork(builder, x, y, z, 1.15);
}

/** Contact: reference-based presentation silhouette, not surveyed geometry. */
function buildContact(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** One of the paired reclining Floraplatz elk. */
function buildElch(builder: Builder, x: number, y: number, z: number): void {
  const rotationY = x < -150 ? -0.1 : Math.PI - 0.1;
  const deck = floraplatzPlinth(builder, x, y, z, rotationY, 3.65);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [0.2, deck + 0.66, 0], [1.45, 0.6, 0.56], rotationY);
  foldedLegs(builder, x, y, z, rotationY, deck);
  rod(builder, FLORAPLATZ_BRONZE, x, y, z, [-0.9, deck + 0.75, 0], [-1.24, deck + 1.82, 0], 0.24, rotationY, 0.78);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [-1.48, deck + 2.02, 0], [0.5, 0.31, 0.3], rotationY);
  branchedAntlers(builder, x, y, z, rotationY, [-1.4, deck + 2.18, 0], 0.96);
}

/** José de San Martín: reference-based presentation silhouette, not surveyed geometry. */
function buildJoseDeSanMartin(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Siemering's single reclining bull at Floraplatz. */
function buildStier(builder: Builder, x: number, y: number, z: number): void {
  const rotationY = Math.PI - 0.2;
  const deck = floraplatzPlinth(builder, x, y, z, rotationY, 3.55);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [0.25, deck + 0.65, 0], [1.48, 0.67, 0.62], rotationY);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [-0.9, deck + 0.84, 0], [0.72, 0.62, 0.62], rotationY);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [-1.42, deck + 0.72, 0], [0.5, 0.34, 0.35], rotationY);
  foldedLegs(builder, x, y, z, rotationY, deck);
  for (const side of [-1, 1]) {
    rod(builder, FLORAPLATZ_BRONZE, x, y, z, [-1.45, deck + 0.87, side * 0.18], [-1.62, deck + 1.18, side * 0.62], 0.075, rotationY, 0.25,
    );
  }
}

/** Partenza: reference-based presentation silhouette, not surveyed geometry. */
function buildPartenza(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Amazone zu Pferde: reference-based presentation silhouette, not surveyed geometry. */
function buildAmazoneZuPferde(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

function buildFloraplatzBison(
  builder: Builder,
  x: number,
  y: number,
  z: number,
  rotationY: number
): void {
  const deck = floraplatzPlinth(builder, x, y, z, rotationY, 3.7);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [0.32, deck + 0.68, 0], [1.5, 0.69, 0.64], rotationY);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [-0.7, deck + 1.08, 0], [0.85, 0.86, 0.72], rotationY);
  ellipsoid(builder, FLORAPLATZ_BRONZE, x, y, z, [-1.42, deck + 0.78, 0], [0.57, 0.46, 0.45], rotationY);
  foldedLegs(builder, x, y, z, rotationY, deck);
  for (const side of [-1, 1]) {
    rod(builder, FLORAPLATZ_BRONZE, x, y, z, [-1.48, deck + 0.94, side * 0.2], [-1.62, deck + 1.17, side * 0.52], 0.065, rotationY, 0.22,
    );
  }
}

/** The eastern reclining bison, retained over its duplicate OSM node. */
function buildLiegenderBisonIi(builder: Builder, x: number, y: number, z: number): void {
  buildFloraplatzBison(builder, x, y, z, Math.PI + 0.05);
}

/** The western partner of the paired Floraplatz bison. */
function buildBison(builder: Builder, x: number, y: number, z: number): void {
  buildFloraplatzBison(builder, x, y, z, 0.05);
}

/** Buddy Bear Tierpark: reference-based presentation silhouette, not surveyed geometry. */
function buildBuddyBearTierpark(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Der Schreitende: reference-based presentation silhouette, not surveyed geometry. */
function buildDerSchreitende(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Berlin-WELCOME-Bear: reference-based presentation silhouette, not surveyed geometry. */
function buildBerlinWelcomeBear(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Orpheus: reference-based presentation silhouette, not surveyed geometry. */
function buildOrpheus(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Rolling Horse: reference-based presentation silhouette, not surveyed geometry. */
function buildRollingHorse(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Berlin: reference-based presentation silhouette, not surveyed geometry. */
function buildBerlin(builder: Builder, x: number, y: number, z: number): void {
  // Matschinsky-Denninghoff's Berlin is a broken steel chain: four open,
  // non-touching tube arcs rather than an upright marker block.
  // Reference: https://en.wikipedia.org/wiki/Berlin_(sculpture)
  box(builder, STONE, x, y + 0.25, z, 5.6, 0.5, 4.2);
  for (const [dx, dz, turn] of [
    [-1.35, -0.9, 0.45],
    [1.35, -0.9, -0.45],
    [-1.35, 0.9, -0.45],
    [1.35, 0.9, 0.45],
  ] as const) {
    box(builder, BRONZE, x + dx, y + 2.0, z + dz, 0.5, 3.5, 0.5, turn);
    box(builder, BRONZE, x + dx * 0.72, y + 3.62, z + dz * 0.72, 1.7, 0.46, 0.5, turn);
  }
}

/** Boxers: reference-based presentation silhouette, not surveyed geometry. */
function buildBoxers(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** Double Cage Piece: reference-based presentation silhouette, not surveyed geometry. */
function buildDoubleCagePiece(builder: Builder, x: number, y: number, z: number): void {
  buildPortalArtwork(builder, x, y, z, 1.1);
}

/** Prince Frederick Arthur of Homburg, General of Cav: reference-based presentation silhouette, not surveyed geometry. */
function buildPrinceFrederickArthurOfHomburgGeneralOfCav(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Galileo: reference-based presentation silhouette, not surveyed geometry. */
function buildGalileo(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Volk Ding Zero: reference-based presentation silhouette, not surveyed geometry. */
function buildVolkDingZero(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Statue of Liberty: reference-based presentation silhouette, not surveyed geometry. */
function buildStatueOfLiberty(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Global Stone Project: reference-based presentation silhouette, not surveyed geometry. */
function buildGlobalStoneProject(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Berlin Wall: reference-based presentation silhouette, not surveyed geometry. */
function buildBerlinWall(builder: Builder, x: number, y: number, z: number): void {
  buildWallArtwork(builder, x, y, z, 1.15);
}

/** Lichtschleife mit Datumsgrenze: reference-based presentation silhouette, not surveyed geometry. */
function buildLichtschleifeMitDatumsgrenze(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Drehmoment: reference-based presentation silhouette, not surveyed geometry. */
function buildDrehmoment(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Hanging: reference-based presentation silhouette, not surveyed geometry. */
function buildHanging(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Riding Bikes: reference-based presentation silhouette, not surveyed geometry. */
function buildRidingBikes(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Beefeater: reference-based presentation silhouette, not surveyed geometry. */
function buildBeefeater(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** Löwengruppe: reference-based presentation silhouette, not surveyed geometry. */
function buildLowengruppe(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.0);
}

/** Wilhelm Griesinger: reference-based presentation silhouette, not surveyed geometry. */
function buildWilhelmGriesinger(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Sinkende Mauer: reference-based presentation silhouette, not surveyed geometry. */
function buildSinkendeMauer(builder: Builder, x: number, y: number, z: number): void {
  // Christophe Girot's Invalidenpark sculpture is a single walkable granite
  // wall descending through a water basin, not a row of separate markers.
  // Reference: https://www.berlin.de/mauer/orte/gedenkorte/die-sinkende-mauer-297836.php
  box(builder, STONE_LIGHT, x, y + 0.12, z, 10.5, 0.24, 6.8);
  box(builder, 0x608e9e, x, y + 0.28, z, 9.8, 0.14, 6.1);
  const descending = [
    [-3.6, 6.6],
    [-2.35, 5.6],
    [-1.1, 4.5],
    [0.15, 3.35],
    [1.4, 2.25],
    [2.65, 1.25],
    [3.75, 0.58],
  ] as const;
  for (const [dx, height] of descending) {
    box(builder, STONE, x + dx, y + 0.35 + height / 2, z, 1.25, height, 0.72);
  }
}

/** Herkules Musagetes: reference-based presentation silhouette, not surveyed geometry. */
function buildHerkulesMusagetes(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** wir: reference-based presentation silhouette, not surveyed geometry. */
function buildWir(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** Roter Niedersachsen-Elefant: reference-based presentation silhouette, not surveyed geometry. */
function buildRoterNiedersachsenElefant(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Figurenrelief: reference-based presentation silhouette, not surveyed geometry. */
function buildFigurenrelief(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.1);
}

/** 25 Jahre Deutsche Einheit: reference-based presentation silhouette, not surveyed geometry. */
function buildArtwork25JahreDeutscheEinheit(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Quadriga mit Victoria: reference-based presentation silhouette, not surveyed geometry. */
function buildQuadrigaMitVictoria(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Miracolo - L’idea di un’immagine: reference-based presentation silhouette, not surveyed geometry. */
function buildMiracoloLideaDiUnimmagine(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.1);
}

/** Mehr Licht: reference-based presentation silhouette, not surveyed geometry. */
function buildMehrLicht(builder: Builder, x: number, y: number, z: number): void {
  buildWallArtwork(builder, x, y, z, 1.15);
}

/** Werdendes: reference-based presentation silhouette, not surveyed geometry. */
function buildWerdendes(builder: Builder, x: number, y: number, z: number): void {
  buildWallArtwork(builder, x, y, z, 1.15);
}

function presentationVariant(
  archetype: (
    builder: Builder,
    x: number,
    y: number,
    z: number,
    scale: number
  ) => void,
  scale: number,
): ArtworkBuilder {
  return (builder, x, y, z) => archetype(builder, x, y, z, scale);
}

export const ARTWORK_BUILDERS: Readonly<Record<string, ArtworkBuilder>> = {
  Panzernashorn: buildPanzernashorn,
  Blindenhund: buildBlindenhund,
  Knut: buildKnut,
  Wildschwein: buildWildschwein,
  "Stab und Scheibe 2": buildStabUndScheibe2,
  Schifferbrunnen: buildSchifferbrunnen,
  "Hand mit Uhr": buildHandMitUhr,
  Klinkerbär: buildKlinkerbar,
  "Morgendämmerung Nr. 1": buildMorgendammerungNr1,
  "Pfeilerfigur Bär": buildPfeilerfigurBar,
  "Vegetative Plastik I": buildVegetativePlastikI,
  "Pfeilerfigur Bär mit Wappen ZG": buildPfeilerfigurBarMitWappenZg,
  "Interbau-Freiplastik": buildInterbauFreiplastik,
  "Liegende weibliche Figur": buildLiegendeWeiblicheFigur,
  Georgia: buildGeorgia,
  Fuchsjagd: buildFuchsjagd,
  Hasenhetze: buildHasenhetze,
  "Silberfisch im Englischen Garten": buildSilberfischImEnglischenGarten,
  Sonnenuhr: buildSonnenuhr,
  "Theodor Fontane": buildTheodorFontane,
  "Vier Bären": buildVierBaren,
  Büffeljagd: buildBuffeljagd,
  Eberjagd: buildEberjagd,
  "Das deutsche Volkslied": buildDasDeutscheVolkslied,
  Viktoria: buildViktoria,
  "Chance Of Direction": buildChanceOfDirection,
  Galatea: buildGalatea,
  "Knabe mit Pony": buildKnabeMitPony,
  "Wings of Mexico": buildWingsOfMexico,
  Alebrije: buildAlebrije,
  "Anna Elisabeth Louise": buildAnnaElisabethLouise,
  Florastatue: buildFlorastatue,
  Waffen: buildWaffen,
  "Der Rhein": buildDerRhein,
  "Die Elbe": buildDieElbe,
  "Die Oder": buildDieOder,
  "Die Weichsel": buildDieWeichsel,
  "Künstliche Natur": buildKunstlicheNatur,
  "Anatolische Zugvögel": buildAnatolischeZugvogel,
  "Skulptur Liebe (Gewächs)": buildSkulpturLiebeGewachs,
  "Abschied des Kriegers von seiner Familie": buildAbschiedDesKriegersVonSeinerFamilie,
  "Der Kampf": buildDerKampf,
  "Die glückliche Heimkehr des Kriegers": buildDieGlucklicheHeimkehrDesKriegers,
  "Richard Wagner": buildRichardWagner,
  "Der verwundete Krieger": buildDerVerwundeteKrieger,
  "Wegzeichen 3a": buildWegzeichen3A,
  Zusammenhalt: buildZusammenhalt,
  Foundation: buildFoundation,
  Herkules: buildHerkules,
  "Friedrich Wilhelm III. von Preußen": buildFriedrichWilhelmIiiVonPreuen,
  "Large Divided Oval: Butterfly": buildLargeDividedOvalButterfly,
  "Der Sieger": buildDerSieger,
  "Wilhelm von Preußen": buildWilhelmVonPreuen,
  HKW: buildHkw,
  "Großer Janus II": buildGroerJanusIi,
  "Klanginstallation Klopfzeichen": buildKlanginstallationKlopfzeichen,
  Panoptikum: buildPanoptikum,
  "Köpfe und Schwanz": buildKopfeUndSchwanz,
  Polis: buildPolis,
  "Berlin Block for Charlie Chaplin": buildBerlinBlockForCharlieChaplin,
  Altar: buildAltar,
  "Imperial Love": buildImperialLove,
  Zeitnadel: buildZeitnadel,
  '"Der Ring" von Norbert Radermacher': buildDerRingVonNorbertRadermacher,
  "Denkmal Gustav Hartmann": buildDenkmalGustavHartmann,
  "Vier Vierecke im Geviert": buildVierViereckeImGeviert,
  "Der Bogenschütze": buildDerBogenschutze,
  "Echo I": buildEchoI,
  "Todes Mauer Bruch": buildTodesMauerBruch,
  "Tor auf dem Karlsbad": buildTorAufDemKarlsbad,
  "Echo II": buildEchoIi,
  Hirsch: buildHirsch,
  "Große Knospe III/63": buildGroeKnospeIii63,
  "Simón Bolívar": buildSimonBolivar,
  Himmelschlüssel: buildHimmelschlussel,
  Bär: buildBar,
  Pferdekopf: buildPferdekopf,
  "Vertical Highways": buildVerticalHighways,
  Contact: buildContact,
  Elch: buildElch,
  "José de San Martín": buildJoseDeSanMartin,
  Stier: buildStier,
  Partenza: buildPartenza,
  "Amazone zu Pferde": buildAmazoneZuPferde,
  "Liegender Bison Ⅱ": buildLiegenderBisonIi,
  Bison: buildBison,
  "Buddy Bear Tierpark": buildBuddyBearTierpark,
  "Der Schreitende": buildDerSchreitende,
  "Berlin-WELCOME-Bear": buildBerlinWelcomeBear,
  Orpheus: buildOrpheus,
  "Rolling Horse": buildRollingHorse,
  Berlin: buildBerlin,
  Boxers: buildBoxers,
  "Double Cage Piece": buildDoubleCagePiece,
  "Prince Frederick Arthur of Homburg, General of Cav": buildPrinceFrederickArthurOfHomburgGeneralOfCav,
  Galileo: buildGalileo,
  "Volk Ding Zero": buildVolkDingZero,
  "Statue of Liberty": buildStatueOfLiberty,
  "Global Stone Project": buildGlobalStoneProject,
  "Berlin Wall": buildBerlinWall,
  "Lichtschleife mit Datumsgrenze": buildLichtschleifeMitDatumsgrenze,
  Drehmoment: buildDrehmoment,
  Hanging: buildHanging,
  "Riding Bikes": buildRidingBikes,
  Beefeater: buildBeefeater,
  Löwengruppe: buildLowengruppe,
  "Wilhelm Griesinger": buildWilhelmGriesinger,
  "Sinkende Mauer": buildSinkendeMauer,
  "Herkules Musagetes": buildHerkulesMusagetes,
  wir: buildWir,
  "Roter Niedersachsen-Elefant": buildRoterNiedersachsenElefant,
  Figurenrelief: buildFigurenrelief,
  "25 Jahre Deutsche Einheit": buildArtwork25JahreDeutscheEinheit,
  "Quadriga mit Victoria": buildQuadrigaMitVictoria,
  "Miracolo - L’idea di un’immagine": buildMiracoloLideaDiUnimmagine,
  "Mehr Licht": buildMehrLicht,
  Werdendes: buildWerdendes,
  // Named works introduced by the task-10 north/south expansion. OSM fixes
  // their position; these deliberately modest, category-specific silhouettes
  // keep them above the marker band without claiming surveyed sculpture mesh.
  "0° Breite": presentationVariant(buildWallArtwork, 0.9),
  "Aufbau der Republik": presentationVariant(buildFigureGroupArtwork, 1.15),
  "Berlin History": presentationVariant(buildWallArtwork, 1.05),
  "Buddy Bear Friedrich": presentationVariant(buildAnimalArtwork, 1.0),
  "Buddy Bear ISF 2004": presentationVariant(buildAnimalArtwork, 1.0),
  "Der Kopf": presentationVariant(buildAbstractArtwork, 0.95),
  "Die goldene Stunde": presentationVariant(buildVerticalArtwork, 1.05),
  "Felix-Mendelssohn-Bartholdy-Stein": presentationVariant(buildWallArtwork, 0.8),
  "Friede sei mit Dir": presentationVariant(buildVerticalArtwork, 1.25),
  Genesung: presentationVariant(buildStandingArtwork, 1.0),
  Houseball: presentationVariant(buildAbstractArtwork, 1.15),
  "Helene Weigel": presentationVariant(buildStandingArtwork, 1.0),
  Jakarta: presentationVariant(buildAbstractArtwork, 1.05),
  Kaninchenfeld: presentationVariant(buildAnimalArtwork, 0.65),
  "Kreuzberg Tower": presentationVariant(buildVerticalArtwork, 1.15),
  "Liegendes Pferd": presentationVariant(buildAnimalArtwork, 1.1),
  "Mauern durchbrechen": presentationVariant(buildWallArtwork, 1.15),
  "Memoria Urbana Berlin": presentationVariant(buildWallArtwork, 1.2),
  "Mitte-Ndnn-Bar": presentationVariant(buildAbstractArtwork, 0.95),
  "Nie wieder Krieg": presentationVariant(buildWallArtwork, 0.9),
  "One World-Bär": presentationVariant(buildAnimalArtwork, 1.0),
  Theaterstele: presentationVariant(buildVerticalArtwork, 1.1),
  "Tilted Donut Wedge with Two Balls": presentationVariant(buildAbstractArtwork, 1.2),
  "Walther Tell": presentationVariant(buildStandingArtwork, 1.0),
  "not caring is no option": presentationVariant(buildWallArtwork, 1.05),
};

/**
 * Resolve newly mapped outer-context works to an explicit, name-qualified
 * presentation archetype. Exact researched builders above always win. The
 * fallback preserves each OSM position/name without pretending that the
 * sculpture's surveyed mesh or dimensions are known.
 */
export function resolveArtworkBuilder(name: string): ArtworkBuilder {
  const researched = ARTWORK_BUILDERS[name];
  if (researched) return researched;

  const hash = Array.from(name).reduce((value, character) => (value * 33 + character.codePointAt(0)!) >>> 0, 5381);
  const scale = 0.88 + (hash % 6) * 0.055;
  if (
    /Bär|Bear|Löw|Stier|Bison|Büffel|Hirsch|Elch|Pferd|Pony|Eber|Ziege|Katze|Hund|Schwan|Vogel|Pelik|Gorilla|Orang|Elefant|Iguanodon|Polacanthus|Beluga|Tier|Fisch|Ammonit/i.test(
      name,
    )
  ) {
    return presentationVariant(buildAnimalArtwork, scale);
  }
  if (/Brunnen|Wasser|Quelle|Fluss|Splash|fishing/i.test(name)) {
    return presentationVariant(buildFountainArtwork, scale);
  }
  if (/Tor|Portal|Gate|Flügel|Tür/i.test(name)) {
    return presentationVariant(buildPortalArtwork, scale);
  }
  if (/Mauer|Wand|Wall|Relief|Tafel|Museum|Technik/i.test(name)) {
    return presentationVariant(buildWallArtwork, scale);
  }
  if (
    /Gruppe|Kinder|Knabe|Mädchen|Mann|Frau|Krieger|Engel|Herkules|Prometheus|Spieler|Trägerin|Sinnende|Willy.Brandt|Lesser/i.test(
      name,
    )
  ) {
    return presentationVariant(buildFigureGroupArtwork, scale);
  }
  if (/Säule|Stein|Flamme|Nadel|Zeichen|Motor|Uhr|Skulptur|Plastik/i.test(name)) {
    return presentationVariant(buildVerticalArtwork, scale);
  }
  return presentationVariant(buildAbstractArtwork, scale);
}

/** Statue on a plinth: the poets, philosophers and callers. */
function buildStatue(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  const scale = 1;
  box(builder, STONE, x, y + 0.4 * scale, z, 3 * scale, 0.8 * scale, 3 * scale);
  box(
    builder, STONE_LIGHT,
    x, y + (0.8 + 0.9) * scale, z,
    1.6 * scale, 1.8 * scale, 1.6 * scale
  );
  box(
    builder, BRONZE,
    x, y + (2.6 + 1.1) * scale, z,
    1 * scale, 2.2 * scale, 1 * scale
  );
}

/**
 * Otto Lessing's 1890 Lessing-Denkmal: a 3 m white-marble Gotthold
 * Ephraim Lessing on a 4 m reddish-granite pedestal, with the bronze
 * "Genius der Humanität" -- a winged youth holding a flaming bowl and
 * a laurel branch -- reclining against the front of the pedestal.
 * Reference: https://de.wikipedia.org/wiki/Lessing-Denkmal_(Berlin)
 * and https://bildhauerei-in-berlin.de/bildwerk/lessingdenkmal-4997/ .
 */
function buildLessingMemorial(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  // Stepped granite base, grey lower steps then the reddish pedestal.
  box(builder, STONE_LIGHT, x, y + 0.25, z, 4.6, 0.5, 4.6);
  box(builder, GRANITE_RED, x, y + 0.85, z, 3.6, 0.7, 3.6);
  box(builder, GRANITE_RED, x, y + 2.0, z, 2.4, 1.6, 2.4);
  box(builder, GRANITE_RED, x, y + 3.15, z, 2.9, 0.65, 2.9); // cornice
  // Lessing himself: coat-draped torso, book-holding stance, head --
  // three elevations rather than one bronze cuboid, in pale marble.
  box(builder, STONE_LIGHT, x, y + 4.1, z, 1.0, 1.7, 0.9); // coat/legs
  box(builder, STONE_LIGHT, x, y + 5.25, z, 0.85, 0.65, 0.75); // torso
  box(builder, STONE_LIGHT, x, y + 5.85, z, 0.5, 0.45, 0.5); // head
  // Genius der Humanität: a small winged bronze figure at the pedestal
  // foot, reclining, holding its bowl up at chest height.
  box(builder, BRONZE, x, y + 3.7, z + 1.7, 1.3, 0.6, 0.9); // reclining body
  box(builder, BRONZE, x + 0.3, y + 4.15, z + 1.7, 0.4, 0.4, 0.4); // raised arm/bowl
}

function buildCannon(builder: Builder, x: number, y: number, z: number): void {
  box(builder, STONE, x, y + 0.5, z, 5.6, 1, 3);
  box(builder, SOVIET_GREEN, x, y + 1.5, z, 3.4, 1, 1.4);
  box(builder, SOVIET_GREEN, x + 2.2, y + 2.1, z, 4.4, 0.32, 0.32);
}

/** The 1924 Verkehrsturm replica: the Potsdamer Platz light tower. */
function buildVerkehrsturm(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  box(builder, TOWER_GREEN, x, y + 2.8, z, 0.55, 5.6, 0.55);
  box(builder, TOWER_GREEN, x, y + 6.9, z, 2.5, 2.6, 2.5, Math.PI / 5);
  box(builder, WHITE, x, y + 7.55, z, 2.62, 0.55, 2.62, Math.PI / 5);
  const lampTones = [0xff453a, 0xffb63b, 0x30d158];
  lampTones.forEach((tone, index) => {
    box(builder, tone, x, y + 7 - index * 0.62, z + 1.32, 0.34, 0.34, 0.12);
    box(builder, tone, x, y + 7 - index * 0.62, z - 1.32, 0.34, 0.34, 0.12);
  });
  box(builder, TOWER_GREEN, x, y + 8.5, z, 1.4, 0.8, 1.4, Math.PI / 5);
}

/** The Euthanasie (T4) memorial's long blue glass wall. */
function buildBlueWall(builder: Builder, x: number, y: number, z: number): void {
  box(builder, DARK_CUBE, x, y + 0.15, z, 26, 0.3, 3.2);
  box(builder, GLASS_BLUE, x, y + 1.6, z, 24, 2.6, 0.35);
}

function buildWhiteCrosses(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  for (let index = -3; index <= 3; index += 1) {
    const px = x + index * 1.4;
    box(builder, WHITE, px, y + 1.05, z, 0.14, 1.8, 0.14);
    box(builder, WHITE, px, y + 1.45, z, 0.7, 0.14, 0.14);
  }
}

/** Grundgesetz 49: the row of glass panels along the Spree. */
function buildGlassPanels(builder: Builder, x: number, y: number, z: number): void {
  for (let index = -2; index <= 2; index += 1) {
    box(builder, GLASS_BLUE, x + index * 5.4, y + 1.5, z, 4.6, 2.6, 0.3);
  }
}

/**
 * Eberlein's 1903 Carrara marble group under the flat reddish roof that
 * was put over it to keep the weather off the marble. The roof is the
 * thing you recognise the monument by from any distance, so it is drawn
 * as its own element: four slim posts and a low overhanging canopy.
 */
function buildWagnerMemorial(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  box(builder, STONE_LIGHT, x, y + 0.35, z, 8, 0.7, 6.4);
  box(builder, MARBLE, x, y + 1.5, z, 4.6, 1.6, 3.4);
  // Wagner sits; the allegorical figures crouch around the base.
  box(builder, MARBLE, x, y + 3.1, z - 0.3, 1.7, 1.8, 1.5);
  box(builder, MARBLE, x, y + 4.3, z - 0.3, 1.1, 0.7, 1.1);
  for (const [dx, dz] of [
    [-1.7, 1.2],
    [1.7, 1.2],
  ]) {
    box(builder, MARBLE, x + dx, y + 2.9, z + dz, 1, 1.2, 1);
  }
  for (const dx of [-3.6, 3.6]) {
    for (const dz of [-2.8, 2.8]) {
      box(builder, CANOPY_POST, x + dx, y + 3.4, z + dz, 0.24, 6.1, 0.24);
    }
  }
  // The real 1987/88 Schutzdach (Marianne Wagner, architect) is a steel
  // barrel vault under plexiglass, not a flat gable -- five stepped
  // slabs of shrinking width approximate the half-round cross-section
  // running east-west over the monument, per
  // https://bildhauerei-in-berlin.de/bildwerk/wagnerdenkmal-5372/ and
  // https://de.wikipedia.org/wiki/Richard-Wagner-Denkmal_(Berlin) .
  box(builder, CANOPY_ROOF, x, y + 6.55, z, 9.6, 0.4, 7.8);
  const vaultSteps = [
    { dy: 6.95, sx: 8.6, sy: 0.42, sz: 6.9 },
    { dy: 7.35, sx: 7.2, sy: 0.42, sz: 5.7 },
    { dy: 7.72, sx: 5.6, sy: 0.4, sz: 4.4 },
    { dy: 8.06, sx: 3.8, sy: 0.36, sz: 2.9 },
  ];
  for (const step of vaultSteps) {
    box(builder, CANOPY_ROOF, x, y + step.dy, z, step.sx, step.sy, step.sz);
  }
  box(builder, CANOPY_ROOF, x, y + 8.32, z, 1.6, 0.3, 1.2); // vault ridge cap
}

/**
 * The Luiseninsel figures — Encke's Königin Luise (1880, cylindrical
 * pedestal with a Befreiungskriege relief band, downcast standing
 * queen), Drake's Friedrich Wilhelm III (1849, tall square pedestal,
 * mantled king), and Brütt's Jung-Wilhelm (1904, low pedestal with a
 * tree-stump prop, young Garde-Füsilier officer with sabre and
 * gloves). They used to share one 5-box stack per the v0.57 marble
 * blob; each now gets a shape that matches its real composition, with
 * a head/torso/arm silhouette instead of a single body box, per
 * https://de.wikipedia.org/wiki/Luiseninsel and
 * https://bildhauerei-in-berlin.de/bildwerk/koenigin-luise-denkmal-6298/
 * and https://bildhauerei-in-berlin.de/bildwerk/jung-wilhelm-4679/ .
 * Presentation geometry approximating the documented composition —
 * not a survey model (Vertrag 5).
 */
function buildMarbleFigure(
  builder: Builder,
  x: number,
  y: number,
  z: number,
  variant: "luise" | "friedrich-wilhelm" | "wilhelm" = "luise",
): void {
  if (variant === "friedrich-wilhelm") {
    // Drake's 1849 king: tall square granite-look pedestal, mantled
    // standing figure with a crown-height head — the tallest of the
    // three so he reads across the water from the queen's island.
    box(builder, STONE_LIGHT, x, y + 0.3, z, 4.4, 0.6, 4.4);
    box(builder, MARBLE, x, y + 1.5, z, 3, 2.4, 3);
    box(builder, MARBLE, x, y + 2.85, z, 3.4, 0.3, 3.4);
    box(builder, MARBLE, x, y + 4.55, z, 1.7, 3.1, 1.4); // mantled torso
    box(builder, MARBLE, x, y + 6.35, z, 0.55, 0.55, 0.55); // head
    for (const side of [-1, 1]) {
      box(builder, MARBLE, x + side * 0.95, y + 4.9, z, 0.42, 2.2, 0.42);
    }
    return;
  }
  if (variant === "wilhelm") {
    // Brütt's 1904 Jung-Wilhelm: low two-step pedestal, a tree-stump
    // prop behind the figure, young officer in a peaked Garde cap with
    // a sabre held to his side.
    box(builder, STONE_LIGHT, x, y + 0.22, z, 2.6, 0.44, 2.2);
    box(builder, STONE_LIGHT, x, y + 0.58, z, 2.2, 0.28, 1.9);
    box(builder, MARBLE, x, y + 1.95, z, 1.5, 2.5, 1.3); // pedestal block
    box(builder, MARBLE, x - 0.55, y + 3.8, z - 0.35, 0.42, 2.7, 0.42); // stump
    box(builder, MARBLE, x, y + 4.15, z, 0.85, 2.3, 0.7); // torso
    box(builder, MARBLE, x, y + 5.9, z, 0.42, 0.42, 0.42); // head
    box(builder, MARBLE, x, y + 6.2, z, 0.5, 0.16, 0.5); // peaked cap
    box(builder, MARBLE, x + 0.55, y + 3.9, z + 0.1, 0.2, 1.9, 0.2); // sabre arm
    return;
  }
  // Encke's 1880 Königin Luise: cylindrical relief pedestal (the
  // Befreiungskriege frieze), downcast standing figure in a long gown.
  box(builder, STONE_LIGHT, x, y + 0.25, z, 3.4, 0.5, 3.4);
  box(builder, MARBLE, x, y + 1.25, z, 2.6, 1.6, 2.6); // relief drum
  box(builder, MARBLE, x, y + 2.15, z, 2.9, 0.24, 2.9); // drum cap
  box(builder, MARBLE, x, y + 3.85, z, 1.5, 3.2, 1.1); // gown/torso, tapers up
  box(builder, MARBLE, x, y + 5.6, z, 0.95, 0.6, 0.75); // shoulders
  box(builder, MARBLE, x, y + 6.22, z, 0.44, 0.44, 0.44); // downcast head
  for (const side of [-1, 1]) {
    box(builder, MARBLE, x + side * 0.55, y + 4.25, z + 0.15, 0.28, 1.7, 0.28);
  }
}

function buildLuiseninselFlowerBeds(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  const colors = [FLOWER_RED, FLOWER_GOLD, FLOWER_WHITE, FLOWER_PINK];
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const radius = index % 2 === 0 ? 8.2 : 6.3;
    box(
      builder,
      colors[index % colors.length],
      x + Math.cos(angle) * radius,
      y + 0.13,
      z + Math.sin(angle) * radius,
      2.8,
      0.16,
      1.25,
      -angle,
    );
  }
}

/** Moltke and Roon: a bronze general on a tall granite pedestal. */
function buildGeneralColumn(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  box(builder, STONE_LIGHT, x, y + 0.35, z, 6, 0.7, 6);
  box(builder, GRANITE_RED, x, y + 1.4, z, 3.6, 1.4, 3.6);
  box(builder, GRANITE_RED, x, y + 4.6, z, 2.6, 5, 2.6);
  box(builder, GRANITE_RED, x, y + 7.4, z, 3.2, 0.55, 3.2);
  box(builder, BRONZE, x, y + 9.6, z, 1.5, 3.9, 1.5);
  box(builder, BRONZE, x, y + 11.8, z, 0.8, 0.7, 0.8);
}

/**
 * Louis Tuaillon's "Amazone zu Pferde" (1895), the bronze amazon riding
 * bareback on the Großer Weg: a granite plinth carrying a standing horse
 * — barrel, arched neck, head, tail and four legs — with the upright
 * rider sitting well back the way Tuaillon posed her. Reference:
 * https://de.wikipedia.org/wiki/Amazone_zu_Pferde .
 */
function buildAmazone(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  // Granite pedestal with a stepped foot.
  box(builder, STONE, x, y + 0.3, z, 4.2, 0.6, 2.2);
  box(builder, GRANITE_RED, x, y + 1.35, z, 3.4, 1.5, 1.7);
  const deck = y + 2.1;
  // Horse: barrel, chest, croup, neck, head, tail, four legs.
  box(builder, BRONZE, x, deck + 1.65, z, 2.6, 0.95, 0.85);
  box(builder, BRONZE, x - 1.35, deck + 1.6, z, 0.6, 0.85, 0.8);
  box(builder, BRONZE, x + 1.3, deck + 1.7, z, 0.55, 0.8, 0.8);
  box(builder, BRONZE, x - 1.62, deck + 2.5, z, 0.5, 1.05, 0.55, 0.35);
  box(builder, BRONZE, x - 1.95, deck + 3.06, z, 0.78, 0.42, 0.42);
  box(builder, BRONZE, x + 1.68, deck + 1.2, z, 0.28, 0.9, 0.3, -0.3);
  for (const [legX, legZ] of [
    [-1.05, -0.28], [-1.05, 0.28], [1.05, -0.28], [1.05, 0.28],
  ] as const) {
    box(builder, BRONZE, x + legX, deck + 0.6, z + legZ, 0.24, 1.2, 0.24);
  }
  // Rider: upright torso seated well back, head, both legs along the flank.
  box(builder, BRONZE, x + 0.35, deck + 2.75, z, 0.5, 1.25, 0.45);
  box(builder, BRONZE, x + 0.35, deck + 3.62, z, 0.34, 0.42, 0.34);
  for (const side of [-1, 1]) {
    box(builder, BRONZE, x + 0.42, deck + 1.85, z + side * 0.5, 0.3, 0.95, 0.24);
  }
}

/**
 * Wilhelm Wolff's "Löwengruppe" (1872) at the Großer Weg: a lioness on a
 * low rock bringing prey to her cubs. Drawn as the flat rock, the large
 * reclining lioness — body, raised head with muzzle, forepaws — and two
 * small cubs pressed against her flank. Reference:
 * https://de.wikipedia.org/wiki/L%C3%B6wengruppe_(Berlin) .
 */
function buildLionGroup(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  // Low natural-rock base, two overlapping slabs.
  box(builder, STONE, x, y + 0.35, z, 4.6, 0.7, 2.8);
  box(builder, STONE_LIGHT, x - 0.3, y + 0.85, z + 0.1, 3.4, 0.35, 2.1, 0.12);
  const deck = y + 1.0;
  // Lioness: long reclining body, chest rising to the alert head.
  box(builder, BRONZE, x - 0.2, deck + 0.55, z - 0.3, 2.9, 0.85, 1.05);
  box(builder, BRONZE, x - 1.35, deck + 1.05, z - 0.3, 0.85, 1.0, 0.95);
  box(builder, BRONZE, x - 1.55, deck + 1.85, z - 0.3, 0.62, 0.6, 0.58, 0.2);
  box(builder, BRONZE, x - 1.92, deck + 1.7, z - 0.3, 0.45, 0.32, 0.4);
  // Forepaws stretched ahead of the chest, tail along the rock.
  for (const side of [-1, 1]) {
    box(builder, BRONZE, x - 1.7, deck + 0.25, z - 0.3 + side * 0.32, 0.85, 0.4, 0.26);
  }
  box(builder, BRONZE, x + 1.45, deck + 0.3, z - 0.15, 0.9, 0.22, 0.22, -0.4);
  // Two cubs against the flank.
  box(builder, BRONZE, x + 0.35, deck + 0.32, z + 0.75, 1.05, 0.5, 0.5, 0.15);
  box(builder, BRONZE, x - 0.75, deck + 0.3, z + 0.8, 0.9, 0.45, 0.45, -0.2);
}

/** The white marble on the Luiseninsel's formal garden. */

const LUISENINSEL_NAMES = /Königin Luise|Wilhelm( I+\.)? von Preußen/i;

const STATUE_NAMES =
  /Lessing|Grimm|Bruno|Rufer|Lortzing|Moore|Reichstagsabgeordneten/i;

// Memorials the verified recognition layer (MemorialLandmarks) already
// models completely — the Holocaust stelae field, the Soviet memorial
// with its T-34s and soldier, Sinti-und-Roma, the Homosexuellen cuboid,
// Goethe and the composers. Drawing them twice doubles the geometry.
// Bismarck is here too: createSiegessaeule() in IsometricCityWorld.ts
// already draws the Bismarck-Nationaldenkmal as part of its verified
// Großer Stern recognition model (fixed offset from the Siegessäule,
// matching the real 1938/39 relocation next to the column) — v0.58.0
// found this OSM "Otto von Bismarck" artwork point was drawing a
// *second*, independently-positioned Bismarck about 58 m away from
// the recognition model's placement, i.e. two chancellors at the same
// intersection. Skipping it here removes the duplicate; the detailed
// figure now lives solely in createSiegessaeule().
export const MONUMENTS_ALREADY_MODELLED =
  /ermordeten Juden Europas|Sowjetisches Ehrenmal|Sowjetischer Soldat|Sinti und Roma|Homosexuellen|Beethoven-Haydn-Mozart|Goethe|Zeugen Jehovas|^Otto von Bismarck$|^Quadriga mit Victoria$|^Fahne der Einheit$/i;

function addMergedMonumentBatch(parent: Group, builder: Builder): void {
  const merged = builder.parts.length > 0 ? mergeGeometries(builder.parts, false) : null;
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.name = "monument bodies";
    mesh.userData.nightMaterial = nightMaterial;
    mesh.userData.dayMaterial = dayMaterial;
    parent.add(mesh);
  }
  for (const part of builder.parts) part.dispose();

  const inkGeometry = builder.edges.length > 0 ? mergeGeometries(builder.edges, false) : null;
  if (inkGeometry) {
    const ink = new LineSegments(inkGeometry, markArchitecturalInk(new LineBasicMaterial(), "detail"));
    ink.name = "monument ink lines";
    ink.renderOrder = 2;
    parent.add(ink);
  }
  for (const edge of builder.edges) edge.dispose();
}

export function createTiergartenMonuments(
  street: StreetDetailsPayload,
  ground: VoxelPayload
): Group | null {
  if (!street.monuments || street.monuments.length === 0) {
    return null;
  }
  const sample = worldGroundSampler(ground);
  const ordinaryBuilder: Builder = { edges: [], parts: [] };
  const protectedBuilder: Builder = { edges: [], parts: [] };
  let floraplatzAnimalCount = 0;
  let fallbackArtworkCount = 0;
  let graefeChariteAnchor: {
    anchor: [number, number, number];
    protected: boolean;
  } | null = null;
  let kindertransportAnchor: { groundYM: number; protected: boolean } | null = null;
  const memorialTypeCounts: Record<string, number> = {};
  const protectedSourceKeys: string[] = [];
  const protectedRenderedSourceKeys: string[] = [];
  const protectedExternallyModelledSourceKeys: string[] = [];
  for (const entry of street.monuments) {
    const x = entry.x_dm / 10;
    const z = entry.z_dm / 10;
    const y = sample(x, z);
    if (y === null) {
      continue;
    }
    const name = entry.name;
    const isProtected = entry.schwellenraum_protected === true;
    const builder = isProtected ? protectedBuilder : ordinaryBuilder;
    if (isProtected) protectedSourceKeys.push(entry.osm_key);
    const partCountBefore = builder.parts.length;
    const memorialType = entry.memorial_type || "unclassified";
    memorialTypeCounts[memorialType] = (memorialTypeCounts[memorialType] ?? 0) + 1;
    if (
      /^(Hirsch|Bison|Liegender Bison Ⅱ|Elch|Bär|Stier)$/.test(name) &&
      x >= -210 &&
      x <= -120 &&
      z >= 410 &&
      z <= 520
    ) {
      floraplatzAnimalCount += 1;
    }
    if (entry.osm_key === KINDERTRANSPORT_MEMORIAL_OSM_KEY) {
      // This exact seven-figure ensemble owns its OSM point. Keeping it out of
      // the subtype dispatcher prevents the former generic sculpture marker
      // from surviving underneath the detailed model.
      kindertransportAnchor = { groundYM: y, protected: isProtected };
      if (isProtected) protectedRenderedSourceKeys.push(entry.osm_key);
    } else if (
      entry.osm_key === CSD_ATTACK_MEMORIAL_OSM_KEY ||
      BERLINER_ENSEMBLE_PUBLIC_ART_OSM_KEYS.has(entry.osm_key) ||
      MONUMENTS_ALREADY_MODELLED.test(name) ||
      entry.kind === "tank"
    ) {
      // The verified recognition layer carries these (incl. both T-34s).
      if (isProtected) protectedExternallyModelledSourceKeys.push(entry.osm_key);
    } else if (entry.kind === "cannon") {
      buildCannon(builder, x, y, z);
    } else if (/Verkehrsturm/i.test(name)) {
      buildVerkehrsturm(builder, x, y, z);
    } else if (/Euthanasie|Aktion T4/i.test(name)) {
      buildBlueWall(builder, x, y, z);
    } else if (/Weiße Kreuze/i.test(name)) {
      buildWhiteCrosses(builder, x, y, z);
    } else if (/Grundgesetz/i.test(name)) {
      buildGlassPanels(builder, x, y, z);
    } else if (/^Robert Koch$/i.test(name)) {
      buildRobertKochMemorial(builder, x, y, z);
    } else if (/^Albrecht von Graefe$/i.test(name) && x > 0) {
      buildGraefeChariteMemorial(builder, x, y, z);
      graefeChariteAnchor = { anchor: [x, y, z], protected: isProtected };
    } else if (/^Lortzing-Denkmal$/i.test(name)) {
      buildLortzingMemorial(builder, x, y, z);
    } else if (/^Rousseau-Säule$/i.test(name)) {
      buildRousseauColumn(builder, x, y, z);
    } else if (/^Baumdank-Denkmal$/i.test(name)) {
      buildTreeDonationStele(builder, x, y, z);
    } else if (/Richard Wagner|Wagner-Denkmal/i.test(name)) {
      buildWagnerMemorial(builder, x, y, z);
    } else if (/Moltke|Roon/i.test(name)) {
      buildGeneralColumn(builder, x, y, z);
    } else if (LUISENINSEL_NAMES.test(name)) {
      const variant = /Friedrich Wilhelm/i.test(name)
        ? "friedrich-wilhelm"
        : /Königin Luise/i.test(name)
          ? "luise"
          : "wilhelm";
      buildMarbleFigure(builder, x, y, z, variant);
      if (variant === "luise") {
        buildLuiseninselFlowerBeds(builder, x, y, z);
      }
    } else if (/^Lessing-Denkmal$|Gotthold Ephraim Lessing/i.test(name)) {
      buildLessingMemorial(builder, x, y, z);
    } else if (/Amazone zu Pferde/i.test(name)) {
      buildAmazone(builder, x, y, z);
    } else if (/Löwengruppe/i.test(name)) {
      buildLionGroup(builder, x, y, z);
    } else if (entry.kind === "artwork") {
      // Researched names retain their dedicated builders. Newly mapped works
      // in the 500 m context ring receive a clearly labelled, name-qualified
      // archetype rather than disappearing or masquerading as surveyed mesh.
      if (!
      ARTWORK_BUILDERS[name]) fallbackArtworkCount += 1;
      resolveArtworkBuilder(name)(builder, x, y, z);
    } else if (STATUE_NAMES.test(name)) {
      buildStatue(builder, x, y, z);
    } else {
      buildTypedMemorial(builder, x, y, z, memorialType);
    }

  if (isProtected && builder.parts.length > partCountBefore) {
      protectedRenderedSourceKeys.push(entry.osm_key);
    }
  }
  if (ordinaryBuilder.parts.length === 0&& protectedBuilder.parts.length === 0 && kindertransportAnchor === null) {
    return null;
  }
  const group = new Group();
  group.name = "OSM Tiergarten monuments";
  // Vertrag 5: every figure in this file is referenced-based presentation
  // geometry built from OSM point positions plus Wikipedia/Wikimedia
  // photographs and Landesdenkmalamt/bildhauerei-in-berlin.de
  // descriptions, not a survey or photogrammetry model. Individual
  // monuments merge into one mesh for draw-call economy, so the label
  // lives on the whole group rather than per-figure.
  group.userData.geometryStatus =
    "OSM-positioned presentation geometry: researched works use " +
    "Wikipedia/Wikimedia/Denkmaldatenbank descriptions; newly mapped outer-context " +
    "works use labelled name-qualified archetypes - never a surveyed mesh";
  group.userData.fallbackArtworkCount = fallbackArtworkCount;
  group.userData.fallbackArtworkGeometry =
    "Name-qualified presentation archetypes for current OSM artwork points without a dedicated researched builder; position/name are mapped, form and scale are not surveyed";
  group.userData.luiseninselFormalGarden =
    "Reference-based Schmuckbeete around the OSM-positioned Koenigin Luise figure";
  group.userData.floraplatzAnimalCount = floraplatzAnimalCount;
  group.userData.floraplatzGeometry =
    "Eight species-specific life-size bronze presentation models on OSM-positioned granite plinths; paired species face opposite directions";
  group.userData.memorialTypeCounts = memorialTypeCounts;
  group.userData.protectedSourceCount = protectedSourceKeys.length;
  group.userData.protectedSourceKeys = protectedSourceKeys;
  group.userData.protectedRenderedSourceKeys = protectedRenderedSourceKeys;
  group.userData.protectedExternallyModelledSourceKeys = protectedExternallyModelledSourceKeys;
  group.userData.quietMemorialGeometry =
    "OSM memorial subtypes preserved; Stolpersteine use Berlin's documented 0.10 m brass top, while unclassified points stay conservative low markers";
  group.userData.tiergartenHeritageModels = {
    baumdank:
      "Four-part shell-limestone pillar with relief/text registers at the OSM point",
    flora:
      "Draped Flora/Pomona with fruit, tree support and putto on a multipart plinth",
    lortzing:
      "Documented 6.5 m marble monument with apsidal pedestal, five putti, pen and score",
    rousseau:
      "Documented 2.2 m three-zone carved column with spiral bossing and floral crown",
    volkslied:
      "Seated embracing pair with lyre on a three-step shell-limestone pedestal",
  };
  group.userData.graefeCharite = {
    architecture:
      "three-axis sandstone screen with pedimented shell niche, paired polychrome majolica reliefs, articulated 1.66 m bronze, curved street enclosure, hedges and the tall Charite boundary fence behind",
    facingTargetWorld: GRAEFE_CHARITE_FACING_TARGET_WORLD,
    osmWorld: GRAEFE_CHARITE_OSM_WORLD,
    rearFenceHeightM: GRAEFE_REAR_FENCE_HEIGHT_M,
    rearFencePickets: 31,
    statueHeightM: GRAEFE_STATUE_HEIGHT_M,
    status:
      "OSM-positioned, reference-proportioned presentation reconstruction; only the bronze statue height is documented",
    yawDegrees: GRAEFE_CHARITE_YAW_DEGREES,
  };
  group.userData.sourceUrls = [
    "https://www.berlin.de/ba-mitte/ueber-den-bezirk/sehenswertes/denkmaeler/denkmaeler-suchen/index.php/detail/216",
    "https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2020/pressemitteilung.939111.php",
    "https://www.berlin.de/landesdenkmalamt/aktivitaeten/presse/2023/pressemitteilung.1375900.php",
    "https://bildhauerei-in-berlin.de/bildwerk/acht-tierfiguren-am-floraplatz/",
    "https://bildhauerei-in-berlin.de/bildwerk/gedenkstein-als-dank-fuer-baumspenden-5350/",
    "https://bildhauerei-in-berlin.de/bildwerk/das-deutsche-volkslied-6305/",
    "https://bildhauerei-in-berlin.de/bildwerk/flora-mit-putto-6302/",
    "https://bildhauerei-in-berlin.de/bildwerk/lortzingdenkmal-4548/",
    "https://bildhauerei-in-berlin.de/bildwerk/rousseau-saeule-4593/",
    "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/geschichte/stolpersteine/",
    "https://wiki.openstreetmap.org/wiki/Key:memorial",
    GRAEFE_CHARITE_SOURCE_URL,
    GRAEFE_MONUMENT_SOURCE_URL,
  ];

  // Ordinary artworks retain the established merged batch. Source-flagged
  // memorial geometry lives in a second batch whose ancestor forces exact Day
  // material/ink presentation whenever Schwellenraum is active.
  addMergedMonumentBatch(group, ordinaryBuilder);
  const protectedBatch = new Group();
  protectedBatch.name = "OSM protected memorial Day batch";
  protectedBatch.userData.schwellenraumGeschuetzt = true;
  protectedBatch.userData.sourceKeys = protectedSourceKeys;
  protectedBatch.userData.renderedSourceKeys = protectedRenderedSourceKeys;
  protectedBatch.userData.externallyModelledSourceKeys = protectedExternallyModelledSourceKeys;
  protectedBatch.userData.presentationContract = "Exact ordinary Day material, ink and transform in Schwellenraum";
  addMergedMonumentBatch(protectedBatch, protectedBuilder);
  group.add(protectedBatch);
  if (kindertransportAnchor) {
    const kindertransport = createKindertransportMemorial(kindertransportAnchor.groundYM);
    (kindertransportAnchor.protected ? protectedBatch :
    group).add(kindertransport);
  }
  if (graefeChariteAnchor) {
    const plate =createGraefeNamePlate(...graefeChariteAnchor.anchor);
    (graefeChariteAnchor.protected ? protectedBatch : group).add(plate);
  }

  return group;
}
