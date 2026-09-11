import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import buildingSource from "./bebelplatzBuildingSource.json";
import { letteringStrokePaths } from "./drawnLettering";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number, number];
type XZ = readonly [number, number];
type Axis = { start: XZ; end: XZ; side: -1 | 1 };
type Kind = "box" | "column" | "head" | "robe";
type Instance = { matrix: number[]; color: number };
const UP = new Vector3(0, 1, 0);
const LIBRARY_RING = buildingSource.profiles.alteBibliothek.parts[0].ring.map(
  (p) => [p[0], p[1]] as XZ,
);
const STONE = 0xd9d3c2,
  LIGHT = 0xe6dfcf,
  SHADOW = 0xb0aa9c;
const GLASS = 0x526d75,
  FRAME = 0xb8bba9,
  METAL = 0x343d3d;
const SAND = 0xcdbb97,
  HOTEL = 0xbebdb3,
  GOLD = 0xbfa24a;

export const BEBELPLATZ_FACADES_GROUP_NAME =
  "Humboldt entrance and Bebelplatz source-bound facades";
export const MINECRAFT_BEBELPLATZ_FACADES_GROUP_NAME =
  "Block-native Humboldt and Bebelplatz facades";

// Positions follow the retained building polygons. Architectural subdivisions
// follow the monument inventory and external licensed photographs, not a survey.
export const BEBELPLATZ_FACADE_PROFILES = {
  humboldt: {
    osmKey: "relation/6647",
    previousPrismId: "ion-6647",
    lod2Parent: "DEBE01YYK0000Cm9",
    centralAxis: {
      start: [1494.135, 136.511],
      end: [1522.051, 134.087],
      side: -1,
    } as Axis,
    westAxis: {
      start: [1469.323, 133.647],
      end: [1493.234, 131.571],
      side: -1,
    } as Axis,
    eastAxis: {
      start: [1522.117, 129.063],
      end: [1546.027, 126.986],
      side: -1,
    } as Axis,
    gatewayAxis: {
      start: [1436.4, 184.4],
      end: [1586.5, 171.1],
      side: -1,
    } as Axis,
    mainBayCount: 17,
    centralBayCount: 5,
    centralColumnCount: 6,
    courtWingAxes: [
      { start: [1469.323, 133.647], end: [1473.188, 181.393], side: 1 },
      { start: [1546.027, 126.986], end: [1550.169, 174.708], side: -1 },
    ] as Axis[],
    streetWingAxes: [
      { start: [1436.287, 184.596], end: [1473.188, 181.393], side: -1 },
      { start: [1550.169, 174.708], end: [1587.11, 171.501], side: -1 },
    ] as Axis[],
    streetWingFronts: [
      { axis: { start: [1436.287, 184.596], end: [1446.08, 183.746], side: -1 } as Axis, bays: 2, risalit: false },
      { axis: { start: [1446.276, 184.492], end: [1463.322, 183.022], side: -1 } as Axis, bays: 3, risalit: true },
      { axis: { start: [1463.395, 182.243], end: [1473.188, 181.393], side: -1 } as Axis, bays: 2, risalit: false },
      { axis: { start: [1550.169, 174.708], end: [1559.982, 173.856], side: -1 } as Axis, bays: 2, risalit: false },
      { axis: { start: [1560.177, 174.602], end: [1577.213, 173.123], side: -1 } as Axis, bays: 3, risalit: true },
      { axis: { start: [1577.277, 172.354], end: [1587.11, 171.501], side: -1 } as Axis, bays: 2, risalit: false },
    ],
  },
  hotel: {
    osmKey: "node/1598987141",
    previousPrismId: "29982781",
    lod2Parent: "DEBE01YYK00002GD",
    lod2FrontPart: "DEBE3De9BgB1NI84",
    frontAxis: {
      start: [1508.0, 374.042],
      end: [1546.447, 370.946],
      side: 1,
    } as Axis,
    columnCount: 6,
    centralBayCount: 5,
  },
  library: {
    osmKey: "way/24247456",
    previousPrismId: "24247456",
    lod2Parent: "DEBE01YYK00000v2",
    libraryNode: "node/639552895",
    // Exact east-facing official chain: no rectangular proxy for the Kommode.
    frontChain: LIBRARY_RING.slice(3, 29),
    northWing: LIBRARY_RING.slice(5, 16),
    southWing: LIBRARY_RING.slice(18, 29),
    centralAxis: {
      start: [1477.233, 295.343],
      end: [1479.147, 316.737],
      side: 1,
    } as Axis,
  },
  textureFree: true,
  photographsBundled: false,
  catalogueAddition: false,
  geometryStatus:
    "Measured source envelopes and facade axes; bay spacing, reveals, capitals, gate masonry and sculptural silhouettes are procedural recognition detail, not surveyed dimensions.",
} as const;

function length(axis: Axis): number {
  return Math.hypot(axis.end[0] - axis.start[0], axis.end[1] - axis.start[1]);
}
function yaw(axis: Axis): number {
  return -Math.atan2(axis.end[1] - axis.start[1], axis.end[0] - axis.start[0]);
}
function point(axis: Axis, u: number, y: number, out = 0): Point {
  const dx = axis.end[0] - axis.start[0],
    dz = axis.end[1] - axis.start[1],
    l = length(axis);
  return [
    axis.start[0] + (dx * u + dz * out * axis.side) / l,
    y,
    axis.start[1] + (dz * u - dx * out * axis.side) / l,
  ];
}

class Builder {
  readonly batches = new Map<Kind, Instance[]>();
  readonly matrix = new Matrix4();
  readonly rotation = new Quaternion();
  constructor(readonly minecraft: boolean) {}
  add(
    kind: Kind,
    p: Point,
    size: Point,
    color: number,
    rotation = new Quaternion(),
  ): void {
    if (this.minecraft) {
      kind = "box";
      rotation = new Quaternion();
      size = size.map((v) => Math.max(0.22, v)) as Point;
    }
    const batch = this.batches.get(kind) ?? [];
    this.matrix.compose(new Vector3(...p), rotation, new Vector3(...size));
    batch.push({ matrix: this.matrix.toArray(), color });
    this.batches.set(kind, batch);
  }
  box(
    axis: Axis,
    u: number,
    y: number,
    out: number,
    size: Point,
    color: number,
  ): void {
    if (this.minecraft) {
      const dx = Math.abs(axis.end[0] - axis.start[0]) / length(axis),
        dz = Math.abs(axis.end[1] - axis.start[1]) / length(axis);
      const n = size[0] > 2.5 && size[0] > size[2] * 2 ? Math.ceil(size[0] / 1.4) : 1;
      for (let i = 0; i < n; i++) {
        const w = size[0] / n;
        this.add("box", point(axis, u - size[0] / 2 + (i + 0.5) * w, y, out),
          [w * dx + size[2] * dz, size[1], w * dz + size[2] * dx], color);
      }
      return;
    }
    this.add(
      "box",
      point(axis, u, y, out),
      size,
      color,
      this.rotation.setFromAxisAngle(UP, yaw(axis)),
    );
  }
  column(
    axis: Axis,
    u: number,
    bottom: number,
    top: number,
    out: number,
    r: number,
    color: number,
  ): void {
    this.add(
      "column",
      point(axis, u, (bottom + top) / 2, out),
      [r, top - bottom, r],
      color,
    );
    for (const y of [bottom, bottom + 0.28, top - 0.35, top])
      this.box(axis, u, y, out, [r * 1.38, 0.22, r * 1.38], color);
    if (this.minecraft) return;
    // Bounded leaf/volute cues, repeated through the same instance batches.
    for (const sign of [-1, 1]) {
      this.add(
        "head",
        point(axis, u + sign * r * 0.42, top - 0.25, out + 0.12),
        [r * 0.45, 0.45, 0.4],
        LIGHT,
      );
      this.box(
        axis,
        u + sign * r * 0.42,
        top - 0.58,
        out + 0.1,
        [r * 0.3, 0.65, 0.32],
        LIGHT,
      );
    }
  }
  beam(a: Point, b: Point, t: number, color: number): void {
    const direction = new Vector3(...b).sub(new Vector3(...a)),
      l = direction.length();
    if (l < 0.001) return;
    this.add(
      "box",
      a.map((v, i) => (v + b[i]) / 2) as Point,
      [t, l, t],
      color,
      new Quaternion().setFromUnitVectors(UP, direction.multiplyScalar(1 / l)),
    );
  }
  arch(
    axis: Axis,
    u: number,
    spring: number,
    out: number,
    width: number,
    rise: number,
    t: number,
    color: number,
  ): void {
    if (this.minecraft) {
      for (let i = 0; i < 7; i++) {
        const a = (Math.PI * i) / 6;
        this.add(
          "box",
          point(
            axis,
            u + (Math.cos(a) * width) / 2,
            spring + Math.sin(a) * rise,
            out,
          ),
          [0.42, 0.42, 0.42],
          color,
        );
      }
      return;
    }
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * i) / n,
        b = (Math.PI * (i + 1)) / n;
      this.beam(
        point(
          axis,
          u + (Math.cos(a) * width) / 2,
          spring + Math.sin(a) * rise,
          out,
        ),
        point(
          axis,
          u + (Math.cos(b) * width) / 2,
          spring + Math.sin(b) * rise,
          out,
        ),
        t,
        color,
      );
    }
  }
}

function window(
  b: Builder,
  axis: Axis,
  u: number,
  y: number,
  width: number,
  height: number,
  out: number,
  arched = false,
  stone = LIGHT,
): void {
  b.box(axis, u, y, out, [width, height, 0.15], GLASS);
  b.box(
    axis,
    u,
    y - height / 2 - 0.16,
    out + 0.13,
    [width + 0.48, 0.22, 0.42],
    stone,
  );
  if (b.minecraft) return;
  for (const sign of [-1, 1])
    b.box(
      axis,
      u + sign * (width / 2 + 0.1),
      y,
      out + 0.12,
      [0.18, height + 0.25, 0.24],
      stone,
    );
  b.box(axis, u, y, out + 0.2, [0.08, height, 0.09], FRAME);
  for (const dy of [-height * 0.15, height * 0.22])
    b.box(axis, u, y + dy, out + 0.2, [width, 0.075, 0.09], FRAME);
  if (arched) {
    // Curved glazing head remains blue, framed with a shallow elliptical arch.
    for (let i = 0; i < 6; i++) {
      const dx = ((i + 0.5) / 6) * width - width / 2,
        h = Math.sqrt(Math.max(0, 1 - (dx / (width / 2)) ** 2)) * width * 0.33;
      b.box(
        axis,
        u + dx,
        y + height / 2 + h / 2,
        out,
        [width / 6 + 0.015, h, 0.15],
        GLASS,
      );
    }
    b.arch(
      axis,
      u,
      y + height / 2,
      out + 0.13,
      width + 0.2,
      width * 0.34,
      0.16,
      stone,
    );
  } else
    b.box(
      axis,
      u,
      y + height / 2 + 0.12,
      out + 0.13,
      [width + 0.45, 0.22, 0.35],
      stone,
    );
}
function inscription(
  b: Builder,
  axis: Axis,
  text: string,
  u: number,
  y: number,
  out: number,
  height: number,
  color: number,
): void {
  if (b.minecraft) return;
  const direction = axis.side === 1 ? -1 : 1;
  for (const path of letteringStrokePaths(text, height))
    for (let i = 1; i < path.length; i++)
      b.beam(
        point(axis, u + direction * path[i - 1][0], y + path[i - 1][1], out),
        point(axis, u + direction * path[i][0], y + path[i][1], out),
        height * 0.095,
        color,
      );
}
function balustrade(
  b: Builder,
  axis: Axis,
  bottom: number,
  out: number,
  start = 0,
  end = length(axis),
): void {
  b.box(
    axis,
    (start + end) / 2,
    bottom + 0.95,
    out,
    [end - start, 0.18, 0.45],
    LIGHT,
  );
  b.box(axis, (start + end) / 2, bottom, out, [end - start, 0.22, 0.55], LIGHT);
  const count = Math.max(
    1,
    Math.floor((end - start) / (b.minecraft ? 1.55 : 0.82)),
  );
  for (let i = 0; i <= count; i++)
    b.box(
      axis,
      start + ((end - start) * i) / count,
      bottom + 0.48,
      out,
      [0.2, 0.83, 0.25],
      LIGHT,
    );
}
function statue(
  b: Builder,
  axis: Axis,
  u: number,
  bottom: number,
  out: number,
  height: number,
): void {
  b.box(axis, u, bottom + 0.12, out, [0.95, 0.24, 0.8], SHADOW);
  b.add(
    "robe",
    point(axis, u, bottom + height * 0.4, out),
    [0.9, height * 0.56, 0.7],
    LIGHT,
  );
  b.add(
    "head",
    point(axis, u, bottom + height * 0.85, out),
    [0.44, 0.53, 0.42],
    LIGHT,
  );
  if (!b.minecraft) {
    b.beam(
      point(axis, u - 0.28, bottom + height * 0.65, out),
      point(axis, u - 0.6, bottom + height * 0.4, out + 0.12),
      0.19,
      LIGHT,
    );
    b.beam(
      point(axis, u + 0.28, bottom + height * 0.65, out),
      point(axis, u + 0.55, bottom + height * 0.81, out + 0.09),
      0.19,
      LIGHT,
    );
  }
}

function humboldt(
  b: Builder,
  ground: (x: number, z: number) => number | null,
): void {
  const p = BEBELPLATZ_FACADE_PROFILES.humboldt;
  const base = 5.2;
  // Six axes on either side of the five-axis middle, as documented by LDA.
  for (const [axis, bays] of [
    [p.westAxis, 6],
    [p.centralAxis, 5],
    [p.eastAxis, 6],
  ] as const) {
    const l = length(axis),
      central = axis === p.centralAxis;
    for (const y of [base + 0.55, 10.3, 24.15, 24.75])
      b.box(axis, l / 2, y, 0.3, [l, 0.28, 0.55], LIGHT);
    for (let i = 0; i < bays; i++) {
      const u = ((i + 0.5) * l) / bays;
      window(b, axis, u, 7.45, central ? 2.5 : 1.9, 3.6, 0.34, false);
      window(b, axis, u, 14.4, central ? 2.9 : 2.15, 4.7, 0.34, true);
      window(b, axis, u, 20.25, 2.15, 2.5, 0.34);
    }
    if (!central) balustrade(b, axis, 25.07, 0.32);
    if (!b.minecraft)
      for (let row = 0; row < 9; row++)
        b.box(
          axis,
          l / 2,
          base + 0.45 + row * 0.49,
          0.39,
          [l, 0.045, 0.05],
          SHADOW,
        );
  }
  const axis = p.centralAxis,
    l = length(axis);
  for (let i = 0; i < 6; i++) {
    const u = 0.65 + (i * (l - 1.3)) / 5;
    b.column(axis, u, 10.45, 23.9, 0.96, 0.95, STONE);
    statue(b, axis, u, 26.1, 0.5, 2.45);
  }
  b.box(axis, l / 2, 25.12, 0.36, [l + 0.8, 1.05, 0.72], STONE);
  inscription(b, axis, "HUMBOLDT UNIVERSITAET", l / 2, 24.85, 0.76, 0.5, GOLD);
  // The open three-wing palace must read from an oblique camera, not only
  // straight on: exact LoD2 courtyard returns and the two Linden end fronts.
  for (const [wing, n, endFront] of [
    ...p.courtWingAxes.map((a) => [a, 9, false] as const),
    ...p.streetWingFronts.map((p) => [p.axis, p.bays, p.risalit] as const),
  ]) {
    const span = length(wing);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) * span / n;
      window(b, wing, u, 7.45, 1.9, 3.6, 0.45);
      window(b, wing, u, 14.4, 2.15, 4.7, 0.45, true);
      window(b, wing, u, 20.25, 2.15, 2.5, 0.45);
      if (!b.minecraft && endFront) {
        b.add("head", point(wing, u, 17.9, 0.72), [0.45, 0.55, 0.34], LIGHT);
        for (const side of [-1, 1])
          b.arch(wing, u + side * 0.8, 17.0, 0.7, 1.0, -0.3, 0.1, SHADOW);
      }
    }
    for (const y of [5.75, 10.3, 24.15, 24.75])
      b.box(wing, span / 2, y, 0.45, [span, 0.28, 0.58], LIGHT);
    balustrade(b, wing, 25.07, 0.43);
    if (endFront) {
      // LDA identifies flattened pilaster orders on the wing end risalits.
      for (let i = 0; i < 4; i++) {
        const u = 0.3 + (span - 0.6) * i / 3;
        b.box(wing, u, 17.05, 0.62, [0.86, 13.1, 0.34], STONE);
        b.box(wing, u, 23.66, 0.69, [1.25, 0.5, 0.55], LIGHT);
      }
      for (const u of [1.35, span - 1.35]) statue(b, wing, u, 26.12, 0.45, 1.85);
    }
    if (!b.minecraft) for (let row = 0; row < 9; row++)
      b.box(wing, span / 2, base + 0.45 + row * 0.49, 0.48, [span, 0.045, 0.045], SHADOW);
  }
  // The central portal: dark paired doors, shallow stone reveals and clear steps.
  window(b, axis, l / 2, 7.5, 3.5, 4.6, 0.53, true);
  b.box(axis, l / 2, 6.75, 0.69, [0.13, 3.0, 0.1], GOLD);
  for (let i = 0; i < 3; i++)
    b.box(
      axis,
      l / 2,
      base + 0.11 + i * 0.15,
      1.25 - i * 0.3,
      [6.2 - i * 0.3, 0.2, 1.6 - i * 0.3],
      STONE,
    );
  // The open street gateway is separate from the recessed palace entrance.
  const gate = p.gatewayAxis,
    centre = length(gate) / 2;
  const gatePoint = point(gate, centre, 0),
    g = ground(gatePoint[0], gatePoint[2]) ?? base;
  for (const sign of [-1, 1]) {
    const u = centre + sign * 4.7;
    b.box(gate, u, g + 2.3, 0, [2.2, 4.6, 2.2], STONE);
    b.box(gate, u, g + 4.65, 0, [2.65, 0.35, 2.65], LIGHT);
    b.box(gate, u, g + 0.3, 0, [2.6, 0.6, 2.5], SHADOW);
    if (!b.minecraft)
      for (let j = 0; j < 7; j++)
        b.box(gate, u, g + 0.75 + j * 0.53, 0.04, [2.25, 0.055, 2.25], SHADOW);
    b.add("head", point(gate, u, g + 5.35, 0), [0.75, 0.85, 0.68], LIGHT);
  }
  for (const sign of [-1, 1]) {
    const start = centre + sign * 6.2,
      end = centre + sign * 21;
    for (const y of [g + 0.35, g + 2.3])
      b.box(
        gate,
        (start + end) / 2,
        y,
        0,
        [Math.abs(end - start), 0.13, 0.12],
        METAL,
      );
    const n = b.minecraft ? 13 : 38;
    for (let i = 0; i <= n; i++)
      b.box(
        gate,
        start + ((end - start) * i) / n,
        g + 1.35,
        0,
        [0.09, 2.6, 0.09],
        METAL,
      );
  }
}

function hotel(b: Builder): void {
  const axis = BEBELPLATZ_FACADE_PROFILES.hotel.frontAxis,
    l = length(axis),
    pitch = l / 9,
    centre = l / 2;
  for (const y of [5.65, 11.2, 25.0, 25.8])
    b.box(axis, centre, y, 0.34, [l, 0.34, 0.52], HOTEL);
  const columnAxis: Axis = {
    start: [1515.651, 372.724],
    end: [1538.603, 370.811],
    side: 1,
  };
  const leftAxis: Axis = {
    start: [1508.0, 374.042],
    end: [1515.692, 373.422],
    side: 1,
  };
  const rightAxis: Axis = {
    start: [1538.686, 371.516],
    end: [1546.447, 370.946],
    side: 1,
  };
  const axes = [
    [leftAxis, 2],
    [columnAxis, 5],
    [rightAxis, 2],
  ] as const;
  for (const [a, bays] of axes) {
    for (let i = 0; i < bays; i++) {
      const u = ((i + 0.5) * length(a)) / bays,
        central = a === columnAxis;
      window(
        b,
        a,
        u,
        7.4,
        central && i === 2 ? 3.5 : 2.35,
        3.55,
        0.42,
        true,
        HOTEL,
      );
      window(b, a, u, 15, 2.5, 4.3, 0.43, false, LIGHT);
      window(b, a, u, 21.2, 2.5, 3.6, 0.43, false, LIGHT);
      b.arch(a, u, 17.65, 0.64, 3.5, 0.6, 0.2, HOTEL);
      if (!central && i === 0) {
        b.beam(
          point(a, u - 1.6, 17.6, 0.75),
          point(a, u, 18.6, 0.75),
          0.24,
          LIGHT,
        );
        b.beam(
          point(a, u, 18.6, 0.75),
          point(a, u + 1.6, 17.6, 0.75),
          0.24,
          LIGHT,
        );
      }
      if (!b.minecraft)
        for (let j = 0; j < 5; j++)
          b.box(a, u - 1.1 + j * 0.55, 12.6, 0.72, [0.14, 0.72, 0.2], LIGHT);
    }
  }
  for (let i = 0; i < 6; i++)
    b.column(
      columnAxis,
      (i * length(columnAxis)) / 5,
      11.7,
      24.25,
      0.58,
      0.95,
      LIGHT,
    );
  b.box(axis, centre, 24.95, 0.7, [5 * pitch + 1.8, 0.65, 0.65], HOTEL);
  inscription(b, axis, "HOTEL DE ROME", centre, 25.28, 0.76, 0.63, GOLD);
  balustrade(b, axis, 26.4, 0.65);
  // Rusticated courses follow the projected central face as well as the wings.
  if (!b.minecraft)
    for (const [a] of axes)
      for (let row = 0; row < 8; row++) {
        const y = 5.75 + row * 0.67,
          n = Math.ceil(length(a) / 1.9);
        b.box(a, length(a) / 2, y, 0.53, [length(a), 0.075, 0.09], SHADOW);
        for (let col = 0; col < n; col++)
          b.box(
            a,
            ((col + 0.3 + (row % 2) * 0.4) * length(a)) / n,
            y + 0.3,
            0.53,
            [0.065, 0.54, 0.09],
            SHADOW,
          );
      }
  b.box(axis, centre, 9.8, 2, [6.2, 0.18, 3.6], METAL);
  window(
    b,
    columnAxis,
    length(columnAxis) / 2,
    7.45,
    3.25,
    3.9,
    0.7,
    true,
    HOTEL,
  );
  for (const sign of [-1, 1])
    b.box(axis, centre + sign * 4.0, 6.0, 1.4, [1.25, 1.6, 1.25], METAL);
}

function library(b: Builder): void {
  const p = BEBELPLATZ_FACADE_PROFILES.library;
  const chain = p.frontChain;
  // Continuous source-following cornices preserve the "Kommode" concavity.
  for (let i = 1; i < chain.length; i++) {
    const axis: Axis = { start: chain[i - 1], end: chain[i], side: 1 };
    for (const y of [5.65, 11.6, 25.8, 26.4])
      b.box(
        axis,
        length(axis) / 2,
        y,
        0.2,
        [length(axis) + 0.03, 0.32, 0.48],
        SAND,
      );
    if (i !== 14) balustrade(b, axis, 27.18, 0.24);
  }
  const axis = p.centralAxis,
    l = length(axis);
  for (let i = 0; i < 3; i++) {
    const u = ((i + 0.5) * l) / 3;
    window(b, axis, u, 7.8, 2.7, 4.6, 0.35, true, LIGHT);
    window(b, axis, u, 15.1, 2.75, 4.55, 0.35, true, LIGHT);
    window(b, axis, u, 20.6, 2.65, 2.8, 0.35, false, LIGHT);
  }
  for (const u of [0.7, 3.0, l - 3.0, l - 0.7])
    b.column(axis, u, 11.65, 25.3, 0.85, 0.9, SAND);
  b.box(axis, l / 2, 26.75, 0.35, [l + 0.8, 1.0, 0.6], SAND);
  inscription(
    b,
    axis,
    "HUMBOLDT UNIVERSITAET",
    l / 2,
    26.51,
    0.72,
    0.43,
    SHADOW,
  );
  inscription(
    b,
    axis,
    "JURISTISCHE FAKULTAET",
    l / 2,
    10.65,
    0.72,
    0.37,
    METAL,
  );
  // Four window bands on each recessed curved wing. Interpolation follows the
  // source chain rather than flattening either wing to a rectangular plane.
  for (const points of [p.northWing, p.southWing] as const) {
    const lens = points
      .slice(1)
      .map((v, i) => Math.hypot(v[0] - points[i][0], v[1] - points[i][1]));
    const total = lens.reduce((a, v) => a + v, 0);
    for (let bay = 0; bay < 5; bay++) {
      let u = ((bay + 0.5) * total) / 5,
        idx = 0;
      while (idx < lens.length - 1 && u > lens[idx]) {
        u -= lens[idx];
        idx++;
      }
      const a: Axis = { start: points[idx], end: points[idx + 1], side: 1 };
      for (const [y, h] of [
        [6.8, 1.5],
        [9.65, 1.8],
        [15.05, 3.8],
        [20.3, 2.45],
      ])
        window(b, a, u, y, 2.1, h, 0.4, y === 15.05, LIGHT);
      for (const side of [-1, 1])
        b.box(a, u + side * 1.7, 17.75, 0.38, [0.48, 11.1, 0.4], SAND);
    }
  }
  // The round end pavilions are sampled on the actual polygon ends.
  for (const [start, end] of [
    [
      [1481.537, 261.242],
      [1482.707, 272.147],
    ],
    [
      [1487.837, 338.97],
      [1488.717, 349.712],
    ],
  ] as const) {
    const a: Axis = { start, end, side: 1 },
      n = length(a);
    window(b, a, n / 2, 8.0, 3.1, 4.8, 0.5, true, LIGHT);
    window(b, a, n / 2, 15.1, 2.6, 4.2, 0.5, true, LIGHT);
    window(b, a, n / 2, 20.4, 2.6, 2.8, 0.5, false, LIGHT);
    for (const u of [0.6, n - 0.6]) b.column(a, u, 11.6, 25.3, 0.9, 1.0, SAND);
    b.box(a, n / 2, 26.65, 0.35, [n + 0.4, 0.6, 0.6], SAND);
    balustrade(b, a, 27.2, 0.45);
    for (const u of [1.2, n - 1.2]) statue(b, a, u, 28.3, 0.4, 1.65);
  }
  // Central cartouche and two flanking allegorical silhouettes.
  b.add("head", point(axis, l / 2, 29.1, 0.5), [2.7, 2.4, 0.65], SAND);
  for (const u of [1.5, 4.1, l - 4.1, l - 1.5])
    statue(b, axis, u, 28.28, 0.4, 1.8);
}

function finish(b: Builder, name: string): Group {
  const root = new Group();
  root.name = name;
  root.userData = {
    ...BEBELPLATZ_FACADE_PROFILES,
    facadeOnly: true,
    keepInMinecraft: b.minecraft,
    blockNative: b.minecraft,
  };
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({
    color: 0xffffff,
    flatShading: true,
    roughness: 0.84,
    metalness: 0.05,
  });
  for (const [kind, instances] of b.batches) {
    const geometry: BufferGeometry =
      kind === "box"
        ? new BoxGeometry(1, 1, 1)
        : kind === "column"
          ? new CylinderGeometry(0.46, 0.5, 1, 12)
          : kind === "head"
            ? new SphereGeometry(0.5, 8, 6)
            : new CylinderGeometry(0.24, 0.5, 1, 7);
    geometry.deleteAttribute("uv");
    const mesh = new InstancedMesh(geometry, day, 0),
      matrices = new Float32Array(instances.length * 16),
      colors = new Float32Array(instances.length * 3),
      color = new Color();
    instances.forEach((v, i) => {
      matrices.set(v.matrix, i * 16);
      color.setHex(v.color).toArray(colors, i * 3);
    });
    mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
    mesh.count = instances.length;
    mesh.name = `${name} ${kind}`;
    mesh.userData.dayMaterial = day;
    mesh.userData.nightMaterial = night;
    mesh.userData.textureFree = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
export function createBebelplatzFacades(ground: VoxelPayload): Group {
  const b = new Builder(false);
  humboldt(b, worldGroundSampler(ground));
  hotel(b);
  library(b);
  return finish(b, BEBELPLATZ_FACADES_GROUP_NAME);
}
export function createMinecraftBebelplatzFacades(ground: VoxelPayload): Group {
  const b = new Builder(true);
  humboldt(b, worldGroundSampler(ground));
  hotel(b);
  library(b);
  return finish(b, MINECRAFT_BEBELPLATZ_FACADES_GROUP_NAME);
}
