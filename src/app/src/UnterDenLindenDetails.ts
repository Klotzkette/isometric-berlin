import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  type FacadeAxis,
  UNTER_DEN_LINDEN_DETAILS_GROUP_NAME,
  UNTER_DEN_LINDEN_DETAILS_PROFILE,
  UNTER_DEN_LINDEN_FINE_LAYER_NAME,
} from "./unterDenLindenProfiles";

type Point = [number, number, number];
type Kind = "box" | "column";
type Instance = { color: number; matrix: number[] };

const UP = new Vector3(0, 1, 0);
const IDENTITY = new Quaternion();
const STONE = 0xd2d0c5;
const STONE_LIGHT = 0xe5e2d8;
const STONE_DARK = 0xa8a79e;
const GLASS = 0x506268;
const GLASS_LIGHT = 0x789397;
const METAL = 0x454b4c;
const BLUE = 0x244b84;
const RED = 0xb53a34;
const WHITE = 0xebe9df;

class DetailBuilder {
  readonly batches = new Map<Kind, Instance[]>();
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly rotation = new Quaternion();

  add(
    kind: Kind,
    position: Point,
    size: Point,
    color: number,
    rotation = IDENTITY,
  ): void {
    const batch = this.batches.get(kind) ?? [];
    this.matrix.compose(
      this.position.set(...position),
      rotation,
      this.scale.set(...size),
    );
    batch.push({ color, matrix: this.matrix.toArray() });
    this.batches.set(kind, batch);
  }

  box(
    position: Point,
    size: Point,
    color: number,
    yaw = 0,
  ): void {
    this.add(
      "box",
      position,
      size,
      color,
      this.rotation.setFromAxisAngle(UP, yaw),
    );
  }

  column(position: Point, diameter: number, height: number, color: number): void {
    this.add("column", position, [diameter, height, diameter], color);
  }

  beam(a: Point, b: Point, thickness: number, color: number): void {
    const direction = new Vector3(...b).sub(new Vector3(...a));
    const length = direction.length();
    if (length < 0.001) return;
    this.add(
      "box",
      a.map((value, index) => (value + b[index]) / 2) as Point,
      [thickness, length, thickness],
      color,
      this.rotation.setFromUnitVectors(UP, direction.multiplyScalar(1 / length)),
    );
  }
}

function materials(): [MeshBasicMaterial, MeshStandardMaterial] {
  return [
    new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }),
    new MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      metalness: 0,
      roughness: 0.86,
      side: DoubleSide,
    }),
  ];
}

function attachMaterials(
  mesh: Mesh,
  pair: ReturnType<typeof materials>,
): void {
  mesh.material = pair[0];
  mesh.userData.dayMaterial = pair[0];
  mesh.userData.nightMaterial = pair[1];
  mesh.userData.textureFree = true;
}

function unitGeometry(kind: Kind): BufferGeometry {
  const geometry =
    kind === "box"
      ? new BoxGeometry(1, 1, 1)
      : new CylinderGeometry(0.5, 0.5, 1, 10);
  geometry.deleteAttribute("uv");
  return geometry;
}

function finishBatches(
  builder: DetailBuilder,
  root: Group,
  name: string,
  geometries: Map<Kind, BufferGeometry>,
  pair: ReturnType<typeof materials>,
): void {
  for (const [kind, instances] of builder.batches) {
    let geometry = geometries.get(kind);
    if (!geometry) {
      geometry = unitGeometry(kind);
      geometries.set(kind, geometry);
    }
    const mesh = new InstancedMesh(geometry, pair[0], 0);
    const matrices = new Float32Array(instances.length * 16);
    const colors = new Float32Array(instances.length * 3);
    const color = new Color();
    instances.forEach((instance, index) => {
      matrices.set(instance.matrix, index * 16);
      color.setHex(instance.color).toArray(colors, index * 3);
    });
    mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
    mesh.count = instances.length;
    mesh.name = `${name} ${kind}`;
    attachMaterials(mesh, pair);
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
}

function axisLength(axis: FacadeAxis): number {
  return Math.hypot(
    axis.endWorldXZ[0] - axis.startWorldXZ[0],
    axis.endWorldXZ[1] - axis.startWorldXZ[1],
  );
}

function axisYaw(axis: FacadeAxis): number {
  return -Math.atan2(
    axis.endWorldXZ[1] - axis.startWorldXZ[1],
    axis.endWorldXZ[0] - axis.startWorldXZ[0],
  );
}

function facadePoint(
  axis: FacadeAxis,
  u: number,
  y: number,
  outward: number,
): Point {
  const dx = axis.endWorldXZ[0] - axis.startWorldXZ[0];
  const dz = axis.endWorldXZ[1] - axis.startWorldXZ[1];
  const length = Math.hypot(dx, dz);
  const signedOutward = outward * axis.outwardSide;
  return [
    axis.startWorldXZ[0] + (dx * u + dz * signedOutward) / length,
    y,
    axis.startWorldXZ[1] + (dz * u - dx * signedOutward) / length,
  ];
}

function inscription(
  builder: DetailBuilder,
  text: string,
  centre: Point,
  yaw: number,
  capHeight: number,
  color: number,
): void {
  const point = ([u, y]: [number, number]): Point => [
    centre[0] + Math.cos(yaw) * u,
    centre[1] + y,
    centre[2] - Math.sin(yaw) * u,
  ];
  for (const path of letteringStrokePaths(text, capHeight)) {
    for (let index = 1; index < path.length; index += 1) {
      builder.beam(
        point(path[index - 1]),
        point(path[index]),
        capHeight * 0.1,
        color,
      );
    }
  }
}

type GridOptions = {
  axis: FacadeAxis;
  baseY: number;
  bays: number;
  floors: number;
  floorPitch: number;
  firstFloorY: number;
  glass?: number;
  outward?: number;
  pierColor?: number;
};

function facadeGrid(
  builder: DetailBuilder,
  fine: DetailBuilder,
  options: GridOptions,
): void {
  const length = axisLength(options.axis);
  const pitch = length / options.bays;
  const yaw = axisYaw(options.axis);
  const outward = options.outward ?? 0.34;
  const glass = options.glass ?? GLASS;
  const pierColor = options.pierColor ?? STONE_LIGHT;
  const gridBottom = options.baseY + options.firstFloorY - 1.55;
  const gridHeight = (options.floors - 1) * options.floorPitch + 3.25;

  for (let bay = 0; bay < options.bays; bay += 1) {
    const u = (bay + 0.5) * pitch;
    for (let floor = 0; floor < options.floors; floor += 1) {
      const y =
        options.baseY + options.firstFloorY + floor * options.floorPitch;
      builder.box(
        facadePoint(options.axis, u, y, outward),
        [pitch * 0.73, 2.25, 0.2],
        floor % 2 === 0 ? glass : GLASS_LIGHT,
        yaw,
      );
      builder.box(
        facadePoint(options.axis, u, y - 1.3, outward + 0.03),
        [pitch * 0.86, 0.26, 0.3],
        pierColor,
        yaw,
      );
      fine.box(
        facadePoint(options.axis, u, y, outward + 0.13),
        [0.09, 2.16, 0.09],
        0xc8d0ce,
        yaw,
      );
      // Shallow exterior reveals share the existing fine-detail instance batch.
      for (const side of [-1, 1]) {
        fine.box(
          facadePoint(options.axis, u + side * pitch * 0.375, y, outward + 0.14),
          [0.12, 2.42, 0.16],
          pierColor,
          yaw,
        );
      }
      fine.box(
        facadePoint(options.axis, u, y + 0.46, outward + 0.17),
        [pitch * 0.73, 0.075, 0.08],
        0xc8d0ce,
        yaw,
      );
    }
  }
  for (let boundary = 0; boundary <= options.bays; boundary += 1) {
    builder.box(
      facadePoint(options.axis, boundary * pitch, gridBottom + gridHeight / 2, outward + 0.04),
      [0.28, gridHeight, 0.32],
      pierColor,
      yaw,
    );
  }
}

function addRussianEmbassy(
  builder: DetailBuilder,
  fine: DetailBuilder,
): void {
  const profile = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.russianEmbassy;
  const baseY = profile.anchorWorldM[1];
  // The former overlay occupied the Behrenstraße rear. Each new shallow sheet
  // follows one retained LoD2 edge, leaving the recessed Ehrenhof completely open.
  for (const [section, axis] of profile.frontageAxes.entries()) {
    const length = axisLength(axis), yaw = axisYaw(axis);
    const central = section === 2;
    builder.box(facadePoint(axis, length / 2, baseY + 2.1, .24),
      [length, 4.2, .28], STONE_DARK, yaw);
    facadeGrid(builder, fine, { axis, baseY, bays: central ? 4 : 4,
      floors: 3, floorPitch: 5.0, firstFloorY: 7.3,
      outward: .28, glass: 0x46565a });
    for (const y of [4.3, 20.0, 21.3]) builder.box(
      facadePoint(axis, length / 2, baseY + y, .48),
      [length, y === 20 ? .65 : .3, .65], STONE_LIGHT, yaw);
    for (let row = 0; row < 9; row++) fine.box(
      facadePoint(axis, length / 2, baseY + .45 + row * .44, .42),
      [length, .065, .06], 0xb7b4a9, yaw);
    if (central) {
      // Colossal fluted half-columns and open entrance bays, display dimensions.
      for (let column = 0; column < 6; column++) {
        const u = .8 + column * (length - 1.6) / 5;
        builder.column(facadePoint(axis, u, baseY + 12.3, .58), .78, 14.3, STONE_LIGHT);
        for (const y of [5.1, 19.4]) builder.box(facadePoint(axis, u, baseY + y, .65),
          [1.05, .38, .9], STONE_LIGHT, yaw);
        for (const offset of [-.2, 0, .2]) fine.box(
          facadePoint(axis, u + offset, baseY + 12.3, 1),
          [.055, 13.8, .07], 0xbab8ad, yaw);
      }
      builder.box(facadePoint(axis, length / 2, baseY + 2.3, .52),
        [4.1, 4.3, .16], 0x273438, yaw);
      builder.box(facadePoint(axis, length / 2, baseY + 4.8, .82),
        [7.1, .6, .5], STONE_LIGHT, yaw);
      // Restrained relief and balustrade cues do not reproduce a historic emblem.
      for (let baluster = 0; baluster < 19; baluster++) fine.column(
        facadePoint(axis, .65 + baluster * (length - 1.3) / 18, baseY + 21.95, .46),
        .14, .85, STONE_LIGHT);
      builder.box(facadePoint(axis, length / 2, baseY + 22.48, .5),
        [length, .22, .45], STONE_LIGHT, yaw);
    }
  }
  // The official LoD2 tower part fixes this rear-world position and top.
  const [towerX, towerZ] = profile.towerWorldXZ;
  for (const [x, z] of [
    [towerX - 2.0, towerZ - 3.15],
    [towerX + 2.0, towerZ - 3.15],
    [towerX - 2.0, towerZ + 3.15],
    [towerX + 2.0, towerZ + 3.15],
  ] as const) {
    builder.column([x, baseY + 26.1, z], 0.55, 6.9, STONE_LIGHT);
  }
  builder.box(
    [towerX, baseY + 22.75, towerZ],
    [5.2, 0.65, 7.8],
    STONE,
  );
  builder.box(
    [towerX, baseY + 29.75, towerZ],
    [5.7, 0.7, 8.3],
    STONE_LIGHT,
  );
  builder.column([towerX, baseY + 34.0, towerZ], 0.13, 7.8, METAL);
  for (const [offsetY, color] of [
    [36.45, WHITE],
    [36.1, BLUE],
    [35.75, RED],
  ] as const) {
    builder.box([towerX + 0.9, baseY + offsetY, towerZ], [1.8, 0.34, 0.08], color);
  }

}

function addAeroflot(
  builder: DetailBuilder,
  fine: DetailBuilder,
): void {
  const profile = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.aeroflot;
  const axis = profile.streetFacade;
  const baseY = profile.anchorWorldM[1];
  const yaw = axisYaw(axis);
  const length = axisLength(axis);

  builder.box(
    facadePoint(axis, length / 2, baseY + 2.35, 0.42),
    [length - 0.8, 4.3, 0.32],
    0x3f545b,
    yaw,
  );
  facadeGrid(builder, fine, {
    axis,
    baseY,
    bays: 8,
    floors: 4,
    floorPitch: 3.28,
    firstFloorY: 6.25,
    outward: 0.44,
    glass: 0x647b80,
    pierColor: 0xe4e3dd,
  });
  for (const y of [baseY + 4.5, baseY + 17.65]) {
    builder.box(
      facadePoint(axis, length / 2, y, 0.58),
      [length, 0.42, 0.48],
      STONE_LIGHT,
      yaw,
    );
  }

  builder.box(facadePoint(axis, length / 2, baseY + 18.8, .38),
    [length, .55, .5], STONE_LIGHT, yaw);
  inscription(
    fine,
    "AEROFLOT",
    facadePoint(axis, length * .27, baseY + 19.2, .58),
    yaw,
    1.45,
    0x5a6063,
  );
  builder.box(
    facadePoint(axis, length * 0.39, baseY + 2.8, 0.68),
    [11.8, 1.15, 0.2],
    BLUE,
    yaw,
  );
  inscription(
    fine,
    "AEROFLOT",
    facadePoint(axis, length * 0.39, baseY + 2.55, 0.84),
    yaw,
    0.58,
    WHITE,
  );
  // Shallow square concrete lattice on the right; no solid wall closes its holes.
  for (let row = 0; row < 10; row++) builder.box(
    facadePoint(axis, length - .55, baseY + 5 + row * 1.35, .63),
    [1.2, .22, .2], STONE_LIGHT, yaw);
  for (const u of [length - 1.15, length - .55, length + .05]) builder.box(
    facadePoint(axis, u, baseY + 11.1, .63), [.2, 13.5, .2], STONE_LIGHT, yaw);
  for (let chevron = 0; chevron < 17; chevron++) {
    const u = length * .49 + chevron * .92;
    fine.beam(facadePoint(axis, u + .4, baseY + 20.3, .6),
      facadePoint(axis, u, baseY + 19.75, .6), .09, METAL);
    fine.beam(facadePoint(axis, u, baseY + 19.75, .6),
      facadePoint(axis, u + .4, baseY + 19.2, .6), .09, METAL);
  }
}

function addEinstein(
  builder: DetailBuilder,
  fine: DetailBuilder,
): void {
  const profile = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.einstein;
  const baseY = profile.anchorWorldM[1];
  for (const [side, axis] of [profile.streetFacade, profile.westFacade].entries()) {
    const length = axisLength(axis), yaw = axisYaw(axis);
    const usable = side === 0 ? length - profile.glassAtriumWidthM : length;
    const bays = side === 0 ? 3 : 10;
    const windowAxis: FacadeAxis = { ...axis,
      endWorldXZ: facadePoint(axis, usable, 0, 0).filter((_, i) => i !== 1) as [number, number] };
    facadeGrid(builder, fine, { axis: windowAxis, baseY, bays, floors: 5,
      floorPitch: 4.1, firstFloorY: 6.8, outward: .3,
      glass: 0x53676c, pierColor: 0xd7d2c6 });
    builder.box(facadePoint(axis, usable / 2, baseY + 1.9, .32),
      [usable, 3.8, .24], 0x293a3d, yaw);
    for (let bay = 0; bay <= bays; bay++) builder.box(
      facadePoint(axis, bay * usable / bays, baseY + 2, .5),
      [.22, 4, .32], STONE_LIGHT, yaw);
    // Current recognizable cafe strip; lettering is original procedural strokes.
    builder.box(facadePoint(axis, usable / 2, baseY + 3.95, .85),
      [usable - .4, .6, .65], 0x75332e, yaw);
    inscription(fine, "EINSTEIN", facadePoint(axis, usable / 2, baseY + 3.8, 1.2),
      yaw, .38, 0xe1cfac);
    builder.box(facadePoint(axis, length / 2, baseY + 25.8, .32),
      [length, 3.1, .2], 0x789396, yaw);
    for (let mullion = 0; mullion <= Math.ceil(length / 1.6); mullion++) fine.box(
      facadePoint(axis, mullion * length / Math.ceil(length / 1.6), baseY + 25.8, .48),
      [.09, 3.1, .12], STONE_LIGHT, yaw);
    for (const y of [24.2, 27.5]) builder.box(facadePoint(axis, length / 2, baseY + y, .5),
      [length, .24, .55], STONE_LIGHT, yaw);
    for (let rail = 0; rail <= Math.ceil(length / .65); rail++) fine.box(
      facadePoint(axis, rail * length / Math.ceil(length / .65), baseY + 24.75, .9),
      [.065, 1, .08], STONE_LIGHT, yaw);
    builder.box(facadePoint(axis, length / 2, baseY + 25.3, .9),
      [length, .07, .08], STONE_LIGHT, yaw);
    if (side === 0) {
      const u = length - profile.glassAtriumWidthM / 2;
      builder.box(facadePoint(axis, u, baseY + 14, .44),
        [profile.glassAtriumWidthM, 27, .18], 0x78989c, yaw);
      for (let row = 0; row < 10; row++) fine.box(
        facadePoint(axis, u, baseY + 1.2 + row * 2.75, .6),
        [profile.glassAtriumWidthM, .09, .1], STONE_LIGHT, yaw);
      fine.box(facadePoint(axis, u, baseY + 14, .62), [.08, 27, .1], STONE_LIGHT, yaw);
    }
  }
}

function addDussmannFacade(
  builder: DetailBuilder, fine: DetailBuilder, axis: FacadeAxis, baseY: number, bays: number,
): void {
  const length = axisLength(axis), angle = axisYaw(axis), pitch = length / bays;
  // A deep, tall arcade and broad rectangular piers, as distinct from the
  // neighbouring nineteenth-century returns. Upper windows form four rows.
  builder.box(facadePoint(axis, length / 2, baseY + 4.1, .42), [length, 8.2, .28], 0x38474b, angle);
  for (let bay = 0; bay < bays; bay++) {
    const u = (bay + .5) * pitch;
    for (let floor = 0; floor < 4; floor++) {
      const y = baseY + 10.5 + floor * 4.1;
      builder.box(facadePoint(axis, u, y, .55), [pitch * .79, 3.2, .25], 0x65797e, angle);
      // Red panels occupy selected lower commercial windows, not whole glass rows.
      if ((floor === 0 && bay > 3) || (floor === 1 && bay < 3))
        builder.box(facadePoint(axis, u, y, .75), [pitch * .72, 2.6, .12], RED, angle);
      for (const offset of [-.26, 0, .26])
        fine.box(facadePoint(axis, u + pitch * offset, y, .87), [.07, 3.2, .12], 0xd0cec3, angle);
      builder.box(facadePoint(axis, u, y - 1.83, .73), [pitch, .44, .5], STONE_LIGHT, angle);
    }
    builder.box(facadePoint(axis, u, baseY + 2.0, .67), [pitch * .76, 3.7, .2], 0x506268, angle);
  }
  for (let boundary = 0; boundary <= bays; boundary++) {
    builder.box(facadePoint(axis, boundary * pitch, baseY + 4.1, 1.12), [.82, 8.2, 1.35], STONE_LIGHT, angle);
    builder.box(facadePoint(axis, boundary * pitch, baseY + 16.25, .79), [.52, 16.1, .44], STONE_LIGHT, angle);
  }
  builder.box(facadePoint(axis, length / 2, baseY + 8.3, 1.05), [length, .65, 1.4], STONE_LIGHT, angle);
  // Two shallow setback-storey window bands follow the retained stepped roof.
  for (const y of [27.4, 30.45]) {
    builder.box(facadePoint(axis, length / 2, baseY + y, -.9), [length - 3, 1.75, .2], GLASS, angle);
    builder.box(facadePoint(axis, length / 2, baseY + y - 1, -.72), [length - 2, .3, .35], STONE_LIGHT, angle);
  }
}

function addDussmannHistoricReturn(builder: DetailBuilder, fine: DetailBuilder, axis: FacadeAxis, baseY: number): void {
  const l = axisLength(axis) - 11.2, pitch = l / 8, angle = axisYaw(axis);
  for (let bay = 0; bay < 8; bay++) for (let floor = 0; floor < 4; floor++) {
    const u = (bay + .5) * pitch, y = baseY + 2.7 + floor * 5;
    builder.box(facadePoint(axis, u, y, .58), [pitch * .52, 3.1, .24], 0x52676b, angle);
    builder.box(facadePoint(axis, u, y - 1.7, .76), [pitch * .76, .28, .4], STONE_LIGHT, angle);
    fine.box(facadePoint(axis, u, y, .82), [.08, 3.1, .1], STONE_LIGHT, angle);
    if (floor === 1 || floor === 2) {
      fine.beam(facadePoint(axis, u - pitch * .36, y + 1.8, .86), facadePoint(axis, u, y + 2.3, .86), .16, STONE_LIGHT);
      fine.beam(facadePoint(axis, u, y + 2.3, .86), facadePoint(axis, u + pitch * .36, y + 1.8, .86), .16, STONE_LIGHT);
    }
  }
  for (const y of [4.8, 10, 15, 20.8]) builder.box(facadePoint(axis, l / 2, baseY + y, .75), [l, .3, .4], STONE_LIGHT, angle);
}

function addDussmann(builder: DetailBuilder, fine: DetailBuilder): void {
  const p = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.dussmann, base = p.anchorWorldM[1];
  addDussmannFacade(builder, fine, p.eastFacade, base, 9);
  for (const axis of [p.northFacade, p.southFacade]) {
    addDussmannHistoricReturn(builder, fine, axis, base);
    const l = axisLength(axis), start = facadePoint(axis, l - 11.2, base, 0);
    addDussmannFacade(builder, fine, { ...axis, startWorldXZ: [start[0], start[2]] }, base, 2);
  }
  const east = p.eastFacade, angle = axisYaw(east), l = axisLength(east);
  // Northern Dorotheenstraße entrance: the previous southern red roof box had
  // no source counterpart. The vertical identity blade now faces Friedrichstraße.
  builder.box(facadePoint(east, l * .32, base + 15.6, 1.28), [1.25, 14.2, .55], STONE_LIGHT, angle);
  for (let i = 0; i < 8; i++) inscription(fine, "DUSSMANN"[i], facadePoint(east, l * .32, base + 21.2 - i * 1.55, 1.64), angle, .82, RED);
  inscription(fine, "DUSSMANN", facadePoint(east, l * .5, base + 7.55, 1.81), angle, .66, WHITE);
  const flag = facadePoint(east, 5.5, base + 35.6, -2.6);
  builder.column(flag, .12, 6.1, METAL);
  builder.box([flag[0] + .68, flag[1] + 1.1, flag[2]], [1.3, 3.0, .08], RED);
}

function addKomischeOper(builder: DetailBuilder, fine: DetailBuilder): void {
  const profile = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.komischeOper;
  const axis = profile.streetFacade, base = profile.anchorWorldM[1];
  const length = axisLength(axis), yaw = axisYaw(axis);
  // Original sandstone sheets remain authoritative; joints sit shallowly outside.
  for (let row = 0; row < 8; row++) fine.box(facadePoint(axis, length / 2, base + .7 + row * 1.85, .1),
    [length, .035, .035], 0xa99f8b, yaw);
  for (let joint = 0; joint <= 36; joint++) fine.box(facadePoint(axis, joint * length / 36, base + 7.7, .1),
    [.035, 15.3, .035], 0xaaa18e, yaw);
  const portal = profile.entranceRisalit, span = axisLength(portal), portalYaw = axisYaw(portal);
  builder.box(facadePoint(portal, span / 2, base + 9.8, .24), [span, 9.6, .3], 0x465d62, portalYaw);
  for (let mullion = 0; mullion <= 12; mullion++) builder.box(
    facadePoint(portal, mullion * span / 12, base + 9.8, .44), [.085, 9.7, .18], 0x333d3c, portalYaw);
  for (const y of [5.05, 9.0, 14.65]) builder.box(facadePoint(portal, span / 2, base + y, .46),
    [span, .18, .2], 0x364541, portalYaw);
  for (const y of [5.1, 14.75]) {
    builder.box(facadePoint(portal, span / 2, base + y, .46), [span, .85, .32], 0x465346, portalYaw);
    // Original procedural copper folds reference material without tracing artwork.
    for (let fold = 0; fold < 42; fold++) fine.beam(
      facadePoint(portal, fold * span / 42, base + y - .31, .64),
      facadePoint(portal, (fold + .65) * span / 42, base + y + .3, .7), .075, fold % 2 ? 0x728071 : 0x2c3e36);
  }
  for (let door = 0; door < 3; door++) {
    const u = (door + .5) * span / 3;
    builder.box(facadePoint(portal, u, base + 1.7, .16), [3.1, 3.35, .2], 0x283637, portalYaw);
    builder.box(facadePoint(portal, u + 1.65, base + 1.7, .3), [.5, 3.4, .6], 0xcabda3, portalYaw);
  }
  inscription(fine, "KOMISCHE OPER BERLIN", facadePoint(portal, span / 2, base + 3.95, .6), portalYaw, .45, 0x384444);
}

type BuildingSpec = {
  fine: DetailBuilder;
  name: string;
  structure: DetailBuilder;
};

export function createUnterDenLindenDetails(): Group {
  const group = new Group();
  group.name = UNTER_DEN_LINDEN_DETAILS_GROUP_NAME;
  group.userData = {
    ...UNTER_DEN_LINDEN_DETAILS_PROFILE,
    buildingCount: 6,
    collisionRole: "visual facade overlays; existing LoD2 solids remain authoritative",
  };

  const specs: BuildingSpec[] = [
    {
      name: "Russian Embassy source-bound facade",
      structure: new DetailBuilder(),
      fine: new DetailBuilder(),
    },
    {
      name: "Aeroflot and Trade Mission source-bound facade",
      structure: new DetailBuilder(),
      fine: new DetailBuilder(),
    },
    {
      name: "Haus Pietzsch and Einstein source-bound facade",
      structure: new DetailBuilder(),
      fine: new DetailBuilder(),
    },
    {
      name: "Dussmann KulturKaufhaus source-bound facade",
      structure: new DetailBuilder(),
      fine: new DetailBuilder(),
    },
    { name: "Komische Oper source-bound facade", structure: new DetailBuilder(), fine: new DetailBuilder() },
  ];
  addRussianEmbassy(specs[0].structure, specs[0].fine);
  addAeroflot(specs[1].structure, specs[1].fine);
  addEinstein(specs[2].structure, specs[2].fine);
  addDussmann(specs[3].structure, specs[3].fine);
  addKomischeOper(specs[4].structure, specs[4].fine);

  const geometries = new Map<Kind, BufferGeometry>();
  const pair = materials();
  const fineRoot = new Group();
  fineRoot.name = UNTER_DEN_LINDEN_FINE_LAYER_NAME;
  fineRoot.userData.detailFadeM = [420, 700];
  for (const spec of specs) {
    const building = new Group();
    building.name = spec.name;
    finishBatches(
      spec.structure,
      building,
      `${spec.name} persistent`,
      geometries,
      pair,
    );
    group.add(building);

    const fineBuilding = new Group();
    fineBuilding.name = `${spec.name} fine`;
    finishBatches(
      spec.fine,
      fineBuilding,
      `${spec.name} close`,
      geometries,
      pair,
    );
    fineRoot.add(fineBuilding);
  }
  group.add(fineRoot);
  return freezeStaticSceneTransforms(group);
}
