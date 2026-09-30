import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  StaticDrawUsage,
} from "three";
import { GEDAECHTNISKIRCHE_RETAINED_WINGS } from "./gedaechtniskircheSourceParts";
import { CITY_WEST_PROFILE } from "./CityWestDetails";
import { GEDAECHTNISKIRCHE_RUIN_PROFILE as RUIN } from "./gedaechtniskircheRuinProfile";
import { GEDAECHTNISKIRCHE_CLOCK_STROKES } from "./gedaechtniskircheClock";

const PROFILE = CITY_WEST_PROFILE.gedaechtniskirche;
const GROUND = CITY_WEST_PROFILE.groundY;
export const MINECRAFT_GEDAECHTNISKIRCHE_GROUP_NAME =
  "Minecraft Gedächtniskirche five-building ensemble";
export const GEDAECHTNISKIRCHE_MINECRAFT_REPLACEMENT_IDS = [
  "15218371",
  "15218372",
  "15218373",
  "15218374",
  "15218375",
] as const;

// Exact rings from the committed OSM-derived prism payload, in viewer metres.
// Only these two generic bodies are present in that payload. The church,
// chapel and foyer have no generic body to discard.
const REPLACEMENT_RINGS = [
  [
    [-2471.7, 1514.7],
    [-2466.9, 1518.6],
    [-2467.9, 1524.5],
    [-2473.6, 1526.9],
    [-2478.4, 1522.7],
    [-2477.3, 1517],
  ],
  [
    [-2498.5, 1498.9],
    [-2496.9, 1499.2],
    [-2496.6, 1498.3],
    [-2495.6, 1496.9],
    [-2494.1, 1496],
    [-2492.4, 1495.6],
    [-2490.7, 1495.9],
    [-2489.2, 1496.8],
    [-2488.2, 1498.2],
    [-2487.7, 1499.9],
    [-2487.8, 1500.8],
    [-2486.2, 1501.1],
    [-2486.7, 1503.9],
    [-2485.4, 1504.1],
    [-2489.3, 1526],
    [-2491, 1525.7],
    [-2491.6, 1528.8],
    [-2493.1, 1528.5],
    [-2493.5, 1529.7],
    [-2494.1, 1530.7],
    [-2495, 1531.5],
    [-2496.1, 1532.1],
    [-2497.3, 1532.3],
    [-2498.6, 1532.3],
    [-2499.7, 1531.9],
    [-2500.8, 1531.3],
    [-2501.6, 1530.4],
    [-2502.2, 1529.3],
    [-2502.4, 1528.1],
    [-2502.3, 1526.4],
    [-2503.5, 1526.2],
    [-2503.4, 1525.1],
    [-2504.1, 1525],
    [-2504.2, 1525.6],
    [-2505, 1525.4],
    [-2505.8, 1525.3],
    [-2505.7, 1524.7],
    [-2507.4, 1524.4],
    [-2506.4, 1519.1],
    [-2505.7, 1519.2],
    [-2503.1, 1504.3],
    [-2503.6, 1504.2],
    [-2502.6, 1498.9],
    [-2500.8, 1499.2],
    [-2500.7, 1498.6],
    [-2499.4, 1498.9],
    [-2499.5, 1499.4],
    [-2498.6, 1499.6],
  ],
] as const;

export function isGedaechtniskircheReplacementCell(
  x: number,
  z: number,
): boolean {
  if (x < -2508 || x > -2466 || z < 1495 || z > 1533) return false;
  return REPLACEMENT_RINGS.some((ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i],
        b = ring[j];
      if (
        a[1] > z !== b[1] > z &&
        x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
      )
        inside = !inside;
    }
    return inside;
  });
}

/** The authored central ruin occupies this local rectangle. Its mapped low
 * apse projections outside it must survive the source-column replacement. */
export function gedaechtniskircheRuinLocalPoint(
  x: number,
  z: number,
): readonly [number, number] {
  const profile = PROFILE.oldTower;
  const dx = x - profile.centerWorldM[0],
    dz = z - profile.centerWorldM[1];
  const c = Math.cos(profile.rotationY),
    s = Math.sin(profile.rotationY);
  return [dx * c - dz * s, dx * s + dz * c];
}
export function isGedaechtniskircheAuthoredRuinPoint(
  x: number,
  z: number,
): boolean {
  const [u, v] = gedaechtniskircheRuinLocalPoint(x, z);
  return Math.abs(u) <= 15.5 && Math.abs(v) <= 9;
}

/** Match the represented door and elevated circular breach, with body clearance. */
function ruinFacadeOpening(
  u: number,
  h: number,
  radius = 0,
  east = false,
): boolean {
  const door = RUIN.portal;
  return (
    (h >= -radius &&
      Math.hypot(u, Math.max(0, h - door.springHeightM)) + radius <
        door.archRadiusM) ||
    (east
      ? h > RUIN.eastBreach.bottomHeightM + radius &&
        Math.hypot(u, Math.max(0, h - RUIN.eastBreach.springHeightM)) + radius <
          RUIN.eastBreach.radiusM
      : Math.hypot(u, h - RUIN.roseBreach.centerHeightM) + radius <
        RUIN.roseBreach.radiusM)
  );
}

function gableWindow(u: number, h: number, side = false, radius = 0): boolean {
  if (side)
    return (
      Math.hypot(u, h - 27.6) + radius < 1.25 ||
      (h > 24 + radius &&
        [-3.3, 3.3].some(
          (axis) => Math.hypot(u - axis, Math.max(0, h - 25.6)) + radius < 0.95,
        ))
    );
  return (
    Math.hypot(u, h - 29) + radius < 1 ||
    (h > 24 + radius &&
      [-5, 0, 5].some(
        (axis) =>
          Math.hypot(u - axis, Math.max(0, h - (axis === 0 ? 26.1 : 26))) +
            radius <
          (axis === 0 ? 1.1 : 1.25),
      ))
  );
}
function eastGableHeight(u: number): number {
  return Math.abs(u) < 4.8
    ? 23
    : Math.abs(u) < 7.2
      ? 25.7
      : Math.abs(u) < 8.7
        ? 26.9
        : 28.4;
}

function belfryOpening(
  side: number,
  u: number,
  h: number,
  radius = 0,
): boolean {
  if (side % 2 === 0)
    return (
      (h > 44.2 + radius &&
        [-1.5, 1.5].some(
          (axis) => Math.hypot(u - axis, Math.max(0, h - 51.4)) + radius < 1.18,
        )) ||
      Math.hypot(u, h - 54) + radius < 1
    );
  // Conservative three-lobed clearance, matching the authored trefoil.
  return (
    h > 44.2 + radius &&
    ((h <= 51.3 && Math.abs(u) + radius < 2.5) ||
      Math.hypot(u, h - 53.5) + radius < 1.5 ||
      [-1.5, 1.5].some(
        (axis) => Math.hypot(u - axis, h - 51.6) + radius < 1.02,
      ))
  );
}

function crownOutline(side: number): readonly (readonly [number, number])[] {
  const width = 2 * RUIN.crownRadiusM * Math.sin(Math.PI / 8);
  const top = RUIN.crownTopHeightsM[side],
    topR = RUIN.crownTopHeightsM[(side + 1) % 8] - 0.45;
  return [
    [-width / 2, RUIN.crownBaseHeightM],
    [width / 2, RUIN.crownBaseHeightM],
    [width / 2, topR],
    [width * 0.12, topR],
    [width * 0.12, top],
    [0, top],
    [-width * 0.1, top],
    [-width * 0.1, top - 0.8],
    [-width / 2, top - 0.8],
  ];
}
function crownDormer(side: number, u: number, h: number, radius = 0): boolean {
  return (
    RUIN.crownTopHeightsM[side] > 65 &&
    h > 61.3 + radius &&
    Math.hypot(u, Math.max(0, h - 62.7)) + radius < 0.55
  );
}

/** Solid masonry only: the hall, high circular breach, bell openings and
 * broken crown remain voids rather than closed collision envelopes. */
export function gedaechtniskircheRuinSolidAt(
  x: number,
  y: number,
  z: number,
  radius = 0,
): boolean {
  const [u, v] = gedaechtniskircheRuinLocalPoint(x, z);
  const h = y - GROUND;
  const inside = (
    width: number,
    depth: number,
    bottom: number,
    top: number,
  ): boolean =>
    Math.abs(u) <= width / 2 + radius &&
    Math.abs(v) <= depth / 2 + radius &&
    h >= bottom - radius &&
    h <= top + radius;
  if (inside(31, 18, 0, 23)) {
    if (Math.abs(u) >= 14.4 - radius && Math.abs(v) <= 8.5 + radius)
      return true;
    if (
      Math.abs(v) >= 8.3 - radius &&
      Math.abs(v) <= 8.95 + radius &&
      !ruinFacadeOpening(u, h, radius, v > 0)
    )
      return true;
    if (
      Math.abs(u) <= 14.5 + radius &&
      Math.abs(v) <= 8 + radius &&
      h >= 7.675 - radius &&
      h <= 8.125 + radius
    )
      return true;
  }
  if (inside(21, 16.4, 31, 40.5)) return true;
  if (inside(21, 16.4, 23, 31) && Math.abs(u) >= 9.6 - radius) return true;
  if (Math.abs(u) <= 10.5 + radius && h >= 23 - radius) {
    if (
      v >= 8.3 - radius &&
      v <= 8.95 + radius &&
      h <= eastGableHeight(u) + radius
    )
      return true;
    if (
      v <= -8.3 + radius &&
      v >= -8.95 - radius &&
      h <= 32 - (Math.abs(u) * 9) / 10.5 + radius &&
      !gableWindow(u, h, false, radius)
    )
      return true;
  }
  if (
    Math.abs(u) >= 15 - radius &&
    Math.abs(u) <= 15.65 + radius &&
    Math.abs(v) <= 8.9 + radius &&
    h >= 23 - radius &&
    h <= 30.3 - (Math.abs(v) * 7.3) / 8.9 + radius &&
    !gableWindow(v, h, true, radius)
  )
    return true;
  for (const xx of [-9.7, 9.7])
    for (const zz of [-7.6, 7.6]) {
      const d = Math.hypot(u - xx, v - zz);
      if (h >= 26 - radius && h <= 33 + radius && d < 1.1 + radius) return true;
      if (
        h >= 33 - radius &&
        h <= 37 + radius &&
        d < (1.5 * (37 - h)) / 4 + radius
      )
        return true;
    }
  for (const turret of RUIN.sideTurrets) {
    const d = Math.hypot(
      u - turret.centerLocalM[0],
      v - turret.centerLocalM[1],
    );
    if (h >= -radius && h <= turret.roofTopM + radius) {
      const r =
        h <= turret.shaftTopM
          ? turret.radiusM
          : 0.12 +
            (turret.radiusM + 0.18) *
              Math.max(
                0,
                (turret.roofTopM - h) / (turret.roofTopM - turret.shaftTopM),
              );
      if (d <= r + radius) return true;
    }
    if (
      h > turret.roofTopM &&
      h <= turret.crossTopM + radius &&
      d < 0.3 + radius
    )
      return true;
  }
  const apothem = RUIN.belfry.radiusM * Math.cos(Math.PI / 8);
  const halfWidth = RUIN.belfry.radiusM * Math.sin(Math.PI / 8);
  for (let side = 0; side < 8; side += 1) {
    const angle = (side * Math.PI) / 4;
    const tangent = u * Math.cos(angle) - v * Math.sin(angle);
    const normal = u * Math.sin(angle) + v * Math.cos(angle);
    if (
      h >= 40 - radius &&
      h <= 43.5 + radius &&
      Math.abs(tangent) <= halfWidth + radius &&
      normal >= apothem - 0.5 - radius &&
      normal <= apothem + 0.15 + radius
    )
      return true;
    if (
      h >= 43.7 - radius &&
      h <= RUIN.belfry.gableHeightM + radius &&
      Math.abs(tangent) <= halfWidth + radius &&
      normal >= apothem - 0.65 - radius &&
      normal <= apothem + radius
    ) {
      const top =
        RUIN.belfry.eavesHeightM +
        (RUIN.belfry.gableHeightM - RUIN.belfry.eavesHeightM) *
          (1 - Math.min(1, Math.abs(tangent) / halfWidth));
      if (h <= top + radius && !belfryOpening(side, tangent, h, radius))
        return true;
    }
    const crownNormal =
      RUIN.crownRadiusM * Math.cos(Math.PI / 8) -
      0.11 * (h - RUIN.crownBaseHeightM);
    if (Math.abs(normal - crownNormal - 0.095) > 0.095 + radius * 1.007)
      continue;
    const crownApothem = RUIN.crownRadiusM * Math.cos(Math.PI / 8);
    const widthScale = crownNormal / crownApothem;
    if (widthScale <= 0) continue;
    const parameterU = tangent / widthScale;
    const parameterRadius = radius / widthScale;
    const ring = crownOutline(side);
    const onFace =
      pointInWing(parameterU, h, ring) ||
      (radius > 0 &&
        [
          [parameterRadius, 0],
          [-parameterRadius, 0],
          [0, radius],
          [0, -radius],
        ].some(([du, dh]) => pointInWing(parameterU + du, h + dh, ring)));
    if (onFace && !crownDormer(side, parameterU, h, parameterRadius))
      return true;
  }
  return false;
}

function pointInWing(
  x: number,
  z: number,
  ring: readonly (readonly [number, number])[],
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

type Block = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  yaw: number;
  color: number;
};

/** One reusable cube, one material, one draw call; all five OSM anchors remain. */
export function createMinecraftGedaechtniskirche(): Group {
  const blocks: Block[] = [];
  const box = (
    center: readonly [number, number],
    yaw: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ): void => {
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    blocks.push({
      x: center[0] + x * c + z * s,
      y: GROUND + y,
      z: center[1] - x * s + z * c,
      w,
      h,
      d,
      yaw,
      color,
    });
  };
  const ruin = RUIN;
  // Keep the retained low-wing colours unchanged; refined ruin stone has its
  // own palette, so source parts and the modern ensemble keep their buffers.
  const stone = 0x847a69,
    pale = 0xa69b85;
  const ruinStone = 0xaaa292,
    ruinPale = 0xc0b8a7,
    shadow = 0x45423c,
    patina = 0x6e8076;
  const stoneColor = (row: number, col: number): number =>
    (row * 7 + col * 11) % 13 === 0
      ? 0x8d867b
      : (row * 7 + col * 11) % 5 === 0
        ? ruinPale
        : ruinStone;
  const shell = (
    width: number,
    depth: number,
    bottom: number,
    top: number,
    openings = false,
  ): void => {
    for (let face = 0; face < 4; face += 1) {
      const yaw = ruin.rotationY + (face * Math.PI) / 2;
      const length = face % 2 === 0 ? width : depth;
      const thickness = face % 2 === 0 ? 0.65 : 1.1;
      const distance =
        (face % 2 === 0 ? depth : width) / 2 - (face % 2 === 0 ? 0.375 : 0.55);
      const columns = Math.ceil(length),
        rows = Math.ceil(top - bottom);
      for (let row = 0; row < rows; row += 1)
        for (let col = 0; col < columns; col += 1) {
          const u = -length / 2 + ((col + 0.5) * length) / columns;
          const y = bottom + ((row + 0.5) * (top - bottom)) / rows;
          if (
            openings &&
            face % 2 === 0 &&
            ruinFacadeOpening(u, y, 0, face === 0)
          )
            continue;
          box(
            ruin.centerWorldM,
            yaw,
            u,
            y,
            distance,
            length / columns,
            (top - bottom) / rows,
            thickness,
            stoneColor(row, col),
          );
        }
    }
  };
  shell(31, 18, 0, 23, true);
  shell(21, 16.4, 31, 40.5);
  for (const side of [-1, 1])
    box(
      ruin.centerWorldM,
      ruin.rotationY,
      side * 10.05,
      27,
      0,
      0.9,
      8,
      16.4,
      ruinStone,
    );
  box(ruin.centerWorldM, ruin.rotationY, 0, 7.9, 0, 29, 0.45, 16, ruinStone);
  // Tall, stepped Romanesque gables over the circular breaches.
  for (const side of [-1, 1]) {
    for (let segment = 0; segment <= 16; segment += 1) {
      const angle = (segment * Math.PI) / 16;
      box(
        ruin.centerWorldM,
        ruin.rotationY,
        Math.cos(angle) * 1.95,
        ruin.portal.springHeightM + Math.sin(angle) * 1.95,
        side * 9.13,
        0.42,
        0.42,
        0.45,
        ruinPale,
      );
    }
    for (const u of [-1.95, 1.95])
      box(
        ruin.centerWorldM,
        ruin.rotationY,
        u,
        ruin.portal.springHeightM / 2,
        side * 9.13,
        0.42,
        ruin.portal.springHeightM,
        0.45,
        ruinPale,
      );
    for (let row = 0; row < 18; row += 1) {
      const y = 23 + (row + 0.5) * 0.5;
      for (let col = 0; col < 42; col += 1) {
        const u = -10.5 + (col + 0.5) * 0.5;
        const top =
          side > 0 ? eastGableHeight(u) : 32 - (Math.abs(u) * 9) / 10.5;
        if (y > top || (side < 0 && gableWindow(u, y))) continue;
        box(
          ruin.centerWorldM,
          ruin.rotationY,
          u,
          y,
          side * 8.625,
          0.5,
          0.5,
          0.65,
          stoneColor(row, col),
        );
      }
    }
    const count = side > 0 ? 23 : 44;
    for (let segment = 0; segment < count; segment += 1) {
      const angle =
        (segment * Math.PI * (side > 0 ? 1 : 2)) / (count - (side > 0 ? 1 : 0));
      box(
        ruin.centerWorldM,
        ruin.rotationY,
        Math.cos(angle) * 6.18,
        (side > 0
          ? ruin.eastBreach.springHeightM
          : ruin.roseBreach.centerHeightM) +
          Math.sin(angle) * 6.18,
        side * 9.1,
        0.7,
        0.7,
        0.7,
        segment % 5 === 0 ? ruinStone : ruinPale,
      );
    }
    if (side > 0)
      for (const u of [-6.18, 6.18])
        box(
          ruin.centerWorldM,
          ruin.rotationY,
          u,
          12.75,
          9.1,
          0.7,
          8.5,
          0.7,
          ruinPale,
        );
    // Independent north/south transept gables.
    for (let row = 0; row < 15; row += 1)
      for (let col = 0; col < 36; col += 1) {
        const u = -8.9 + ((col + 0.5) * 17.8) / 36,
          y = 23 + (row + 0.5) * 0.5;
        if (y > 30.3 - (Math.abs(u) * 7.3) / 8.9 || gableWindow(u, y, true))
          continue;
        box(
          ruin.centerWorldM,
          ruin.rotationY + (side * Math.PI) / 2,
          u,
          y,
          15.325,
          17.8 / 36,
          0.5,
          0.65,
          stoneColor(row, col),
        );
      }
  }

  for (const [y, w, d] of [
    [23, 32.3, 19.2],
    [31, 22.3, 17.7],
    [40.1, 22.4, 17.8],
    [43.2, 23, 18.4],
  ]) {
    for (let face = 0; face < 4; face += 1) {
      const length = face % 2 === 0 ? w : d,
        n = Math.ceil(length / 2);
      for (let i = 0; i < n; i += 1)
        box(
          ruin.centerWorldM,
          ruin.rotationY + (face * Math.PI) / 2,
          -length / 2 + ((i + 0.5) * length) / n,
          y,
          (face % 2 === 0 ? d : w) / 2,
          length / n,
          0.55,
          0.7,
          ruinPale,
        );
    }
  }
  for (let face = 0; face < 4; face += 1) {
    const yaw = ruin.rotationY + (face * Math.PI) / 2,
      depth = face % 2 === 0 ? 8.65 : 10.9;
    // Square-block disc outline, gold hours and hands, without a texture.
    for (let x = -3; x <= 3; x += 1)
      for (let y = -3; y <= 3; y += 1)
        if (x * x + y * y <= 10)
          box(
            ruin.centerWorldM,
            yaw,
            x,
            ruin.clock.centerHeightM + y,
            depth,
            1,
            1,
            0.35,
            shadow,
          );
    for (let mark = 0; mark < 24; mark += 1) {
      const angle = (mark * Math.PI) / 12;
      box(
        ruin.centerWorldM,
        yaw,
        Math.sin(angle) * 3.3,
        ruin.clock.centerHeightM + Math.cos(angle) * 3.3,
        depth + 0.25,
        0.55,
        0.55,
        0.22,
        0xd1ad4a,
      );
    }
    // The same radial Roman dial, represented with small native square blocks.
    for (const [a, b] of GEDAECHTNISKIRCHE_CLOCK_STROKES)
      for (let step = 0; step < 4; step += 1) {
        const t = (step + 0.5) / 4;
        box(
          ruin.centerWorldM,
          yaw,
          a[0] + (b[0] - a[0]) * t,
          ruin.clock.centerHeightM + a[1] + (b[1] - a[1]) * t,
          depth + 0.46,
          Math.abs(b[0] - a[0]) / 4 + 0.065,
          Math.abs(b[1] - a[1]) / 4 + 0.065,
          0.12,
          0xd1ad4a,
        );
      }
    box(
      ruin.centerWorldM,
      yaw,
      0,
      ruin.clock.centerHeightM + 1.1,
      depth + 0.3,
      0.28,
      2.2,
      0.2,
      0xd1ad4a,
    );
    box(
      ruin.centerWorldM,
      yaw,
      -1,
      ruin.clock.centerHeightM,
      depth + 0.3,
      2,
      0.28,
      0.2,
      0xd1ad4a,
    );
    for (let bay = -3; bay <= 3; bay += 1) {
      const u = bay * 2.7;
      box(ruin.centerWorldM, yaw, u, 41.5, depth + 0.05, 1.4, 1.8, 0.3, shadow);
      box(
        ruin.centerWorldM,
        yaw,
        u - 0.9,
        41.5,
        depth + 0.3,
        0.35,
        2.2,
        0.45,
        ruinPale,
      );
    }
  }
  for (const x of [-9.7, 9.7])
    for (const z of [-7.6, 7.6]) {
      const center = [
        ruin.centerWorldM[0] +
          x * Math.cos(ruin.rotationY) +
          z * Math.sin(ruin.rotationY),
        ruin.centerWorldM[1] -
          x * Math.sin(ruin.rotationY) +
          z * Math.cos(ruin.rotationY),
      ] as const;
      for (let face = 0; face < 8; face += 1) {
        const a = (face * Math.PI) / 4;
        for (let y = 26.5; y < 33; y += 1)
          box(center, ruin.rotationY + a, 0, y, 1.05, 0.9, 1, 0.3, ruinStone);
        for (let row = 0; row < 4; row += 1) {
          const r = 1.5 * (1 - (row + 0.5) / 4);
          box(
            center,
            ruin.rotationY + a,
            0,
            33.5 + row,
            r * Math.cos(Math.PI / 8),
            2 * r * Math.sin(Math.PI / 8),
            1,
            0.3,
            ruinPale,
          );
        }
      }
    }
  // Eight real open bell faces, their gables, and a steep hollow broken crown.
  for (let side = 0; side < 8; side += 1) {
    const a = (side * Math.PI) / 4;
    const apothem = ruin.belfry.radiusM * Math.cos(Math.PI / 8);
    const halfWidth = ruin.belfry.radiusM * Math.sin(Math.PI / 8);
    const cols = 15,
      rowCount = 37;
    for (let row = 0; row < rowCount; row += 1)
      for (let col = 0; col < cols; col += 1) {
        const u = -halfWidth + ((col + 0.5) * 2 * halfWidth) / cols;
        const y = 40 + (row + 0.5) * 0.5;
        const top =
          ruin.belfry.eavesHeightM +
          (ruin.belfry.gableHeightM - ruin.belfry.eavesHeightM) *
            (1 - Math.abs(u) / halfWidth);
        if (y > top || belfryOpening(side, u, y)) continue;
        box(
          ruin.centerWorldM,
          ruin.rotationY + a,
          u,
          y,
          apothem - 0.325,
          (2 * halfWidth) / cols,
          0.5,
          0.65,
          stoneColor(row, col),
        );
      }
    for (let col = 0; col < cols; col += 1) {
      const u = -halfWidth + ((col + 0.5) * 2 * halfWidth) / cols;
      for (const y of [39.8, 43, 43.6])
        box(
          ruin.centerWorldM,
          ruin.rotationY + a,
          u,
          y,
          apothem + 0.2,
          (2 * halfWidth) / cols,
          0.4,
          0.85,
          ruinPale,
        );
    }
    for (const u of side % 2 === 0 ? [-2.92, 0, 2.92] : [-2.85, 2.85]) {
      const spring = side % 2 === 0 ? 51.4 : 51.3;
      box(
        ruin.centerWorldM,
        ruin.rotationY + a,
        u,
        spring - 0.27,
        apothem + 0.28,
        0.5,
        0.3,
        0.4,
        shadow,
      );
      box(
        ruin.centerWorldM,
        ruin.rotationY + a,
        u,
        spring - 0.04,
        apothem + 0.32,
        0.72,
        0.17,
        0.55,
        ruinPale,
      );
    }
    const outline = crownOutline(side);
    const base = ruin.crownBaseHeightM;
    const top = Math.max(...outline.map((p) => p[1]));
    const width = 2 * ruin.crownRadiusM * Math.sin(Math.PI / 8);
    const rows = Math.ceil((top - base) / 0.75);
    for (let row = 0; row < rows; row += 1) {
      const h = (top - base) / rows;
      const y = base + (row + 0.5) * h;
      for (let col = 0; col < 12; col += 1) {
        const u = -width / 2 + ((col + 0.5) * width) / 12;
        if (!pointInWing(u, y, outline) || crownDormer(side, u, y)) continue;
        const apothem = ruin.crownRadiusM * Math.cos(Math.PI / 8);
        const radialInset = 0.11 * (y - base);
        const widthScale = (apothem - radialInset) / apothem;
        box(
          ruin.centerWorldM,
          ruin.rotationY + a,
          u * widthScale,
          y,
          apothem - radialInset + 0.095,
          (width / 12) * widthScale,
          h,
          0.24,
          (row + col + side) % 6 === 0 ? 0x8b9484 : patina,
        );
      }
    }
    const jointTop = Math.min(
      ruin.crownTopHeightsM[side] - 0.8,
      ruin.crownTopHeightsM[(side + 1) % 8] - 0.45,
    );
    for (let y = base + 1.8; y < jointTop - 0.25; y += 1.8) {
      const ap = ruin.crownRadiusM * Math.cos(Math.PI / 8);
      const scale = (ap - 0.11 * (y - base)) / ap;
      const spans =
        ruin.crownTopHeightsM[side] > 65 && y >= 61.2 && y <= 63.4
          ? [
              [-width / 2, -0.85],
              [0.85, width / 2],
            ]
          : [[-width / 2, width / 2]];
      for (const [left, right] of spans)
        box(
          ruin.centerWorldM,
          ruin.rotationY + a,
          ((left + right) * scale) / 2,
          y,
          ap - 0.11 * (y - base) + 0.25,
          (right - left) * scale,
          0.065,
          0.08,
          0x526d68,
        );
    }
  }
  for (const turret of ruin.sideTurrets) {
    const center = [
      ruin.centerWorldM[0] +
        turret.centerLocalM[0] * Math.cos(ruin.rotationY) +
        turret.centerLocalM[1] * Math.sin(ruin.rotationY),
      ruin.centerWorldM[1] -
        turret.centerLocalM[0] * Math.sin(ruin.rotationY) +
        turret.centerLocalM[1] * Math.cos(ruin.rotationY),
    ] as const;
    for (let face = 0; face < 8; face += 1) {
      const a = ((face + 0.5) * Math.PI) / 4;
      for (let y = 0; y < turret.shaftTopM; y += 1.5) {
        const h = Math.min(1.5, turret.shaftTopM - y);
        box(
          center,
          ruin.rotationY + a,
          0,
          y + h / 2,
          turret.radiusM * Math.cos(Math.PI / 8),
          2 * turret.radiusM * Math.sin(Math.PI / 8),
          h,
          0.65,
          y > 27 && face % 2 === 0 ? shadow : ruinStone,
        );
      }
      const rows = Math.ceil(turret.roofTopM - turret.shaftTopM);
      for (let row = 0; row < rows; row += 1) {
        const h = (turret.roofTopM - turret.shaftTopM) / rows;
        const r = turret.radiusM * (1 - (row + 0.5) / rows);
        box(
          center,
          ruin.rotationY + a,
          0,
          turret.shaftTopM + (row + 0.5) * h,
          r * Math.cos(Math.PI / 8),
          Math.max(0.2, 2 * r * Math.sin(Math.PI / 8)),
          h,
          0.6,
          ruinPale,
        );
      }
    }
    if (turret.crossTopM > turret.roofTopM) {
      box(
        center,
        ruin.rotationY,
        0,
        (turret.crossTopM + turret.roofTopM) / 2,
        0,
        0.4,
        turret.crossTopM - turret.roofTopM,
        0.4,
        ruinPale,
      );
      box(
        center,
        ruin.rotationY,
        0,
        turret.crossTopM - 0.7,
        0,
        1.5,
        0.35,
        0.4,
        ruinPale,
      );
    }
  }
  const ruinInstanceCount = blocks.length;
  const modern = (
    p: typeof PROFILE.church | typeof PROFILE.bellTower,
  ): void => {
    const radius = p.diameterM / 2,
      sides = p.facadeSides;
    const apothem = radius * Math.cos(Math.PI / sides),
      width = 2 * radius * Math.sin(Math.PI / sides);
    const cols = Math.ceil(width / 1.3),
      rows = Math.ceil(p.heightM / 1.3);
    for (let face = 0; face < sides; face += 1) {
      const yaw = ((face + 0.5) * Math.PI * 2) / sides;
      for (let row = 0; row < rows; row += 1)
        for (let col = 0; col < cols; col += 1) {
          const u = -width / 2 + ((col + 0.5) * width) / cols,
            y = 0.8 + ((row + 0.5) * p.heightM) / rows;
          box(
            p.centerWorldM,
            yaw,
            u,
            y,
            apothem,
            width / cols,
            p.heightM / rows,
            0.65,
            0x8a8d89,
          );
          const band =
            sides === 6 &&
            Math.abs(y - 0.8 - PROFILE.bellTower.bellChamberBandCenterHeightM) <
              1.1;
          if (!band)
            box(
              p.centerWorldM,
              yaw,
              u,
              y,
              apothem + 0.36,
              width / cols - 0.23,
              p.heightM / rows - 0.23,
              0.14,
              (face * 19 + row * 7 + col * 3) % 31 === 0 ? 0x9e784b : 0x244778,
            );
        }
    }
    // Rectangular roof blocks clipped to the actual regular polygon.
    for (let x = -radius; x <= radius; x += 2)
      for (let z = -radius; z <= radius; z += 2) {
        let inside = true;
        for (let side = 0; side < sides; side += 1) {
          const a = ((side + 0.5) * Math.PI * 2) / sides;
          if (Math.sin(a) * x + Math.cos(a) * z > apothem - 0.5) inside = false;
        }
        if (inside)
          box(p.centerWorldM, 0, x, p.heightM + 0.7, z, 2, 0.2, 2, 0x586367);
      }
  };
  modern(PROFILE.church);
  modern(PROFILE.bellTower);
  const bell = PROFILE.bellTower;
  box(
    bell.centerWorldM,
    0,
    0,
    0.8 + bell.heightM + bell.finial.poleLengthM / 2,
    0,
    0.24,
    bell.finial.poleLengthM,
    0.24,
    0xc8a24b,
  );
  box(
    bell.centerWorldM,
    0,
    0,
    0.8 + bell.heightM + bell.finial.poleLengthM + 0.9,
    0,
    0.24,
    1.8,
    0.24,
    0xc8a24b,
  );
  box(
    bell.centerWorldM,
    0,
    0,
    0.8 + bell.heightM + bell.finial.poleLengthM + 1.1,
    0,
    2.1,
    0.24,
    0.24,
    0xc8a24b,
  );
  for (const [center, height, yaw] of [
    [PROFILE.foyerCenterWorldM, 5, 0.24],
    [PROFILE.chapelCenterWorldM, 6.1, 0.2],
  ] as const) {
    for (let face = 0; face < 4; face += 1) {
      const length = face % 2 === 0 ? 24 : 14,
        distance = face % 2 === 0 ? 7 : 12;
      const columns = Math.ceil(length / 2);
      for (let c = 0; c < columns; c += 1)
        for (let y = 1.8; y < height; y += 1.6) {
          box(
            center,
            yaw + (face * Math.PI) / 2,
            -length / 2 + ((c + 0.5) * length) / columns,
            y,
            distance,
            length / columns - 0.16,
            1.4,
            0.65,
            (c + Math.round(y)) % 3 === 0 ? 0x8a8d89 : 0x40586a,
          );
        }
    }
    box(center, yaw, 0, 0.8 + height, 0, 24, 0.25, 14, 0x8a8d89);
  }
  // Retain every source low-wing projection outside the authored core.
  // No interior voxel fill: only the source boundary and roof need blocks.
  for (const wing of GEDAECHTNISKIRCHE_RETAINED_WINGS) {
    for (let edge = 0; edge < wing.ring.length; edge += 1) {
      const a = wing.ring[edge],
        b = wing.ring[(edge + 1) % wing.ring.length];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = Math.max(1, Math.ceil(length / 1.6));
      const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let col = 0; col < count; col += 1)
        for (
          let row = 0;
          row < Math.ceil((wing.topY - wing.baseY) / 1.8);
          row += 1
        ) {
          const t = (col + 0.5) / count;
          box(
            [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
            yaw,
            0,
            wing.baseY -
              GROUND +
              ((row + 0.5) * (wing.topY - wing.baseY)) /
                Math.ceil((wing.topY - wing.baseY) / 1.8),
            0,
            length / count,
            (wing.topY - wing.baseY) /
              Math.ceil((wing.topY - wing.baseY) / 1.8),
            0.5,
            (col + row) % 7 === 0 ? pale : stone,
          );
        }
    }
    const xs = wing.ring.map((p) => p[0]),
      zs = wing.ring.map((p) => p[1]);
    for (let x = Math.min(...xs) + 0.4; x <= Math.max(...xs); x += 1)
      for (let z = Math.min(...zs) + 0.4; z <= Math.max(...zs); z += 1)
        if (pointInWing(x, z, wing.ring))
          box([x, z], 0, 0, wing.topY - GROUND - 0.1, 0, 1, 0.2, 1, stone);
  }
  const root = new Group();
  root.name = MINECRAFT_GEDAECHTNISKIRCHE_GROUP_NAME;
  const mesh = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({
      vertexColors: false,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    }),
    blocks.length,
  );
  const transform = new Object3D(),
    color = new Color();
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    transform.position.set(b.x, b.y, b.z);
    transform.rotation.set(0, b.yaw, 0);
    transform.scale.set(b.w, b.h, b.d);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
    mesh.setColorAt(i, color.setHex(b.color));
  }
  mesh.instanceMatrix.setUsage(StaticDrawUsage);
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.name = "Voxel Gedächtniskirche shell and blue grid";
  mesh.userData = {
    blockNative: true,
    textureFree: true,
    instanceCount: blocks.length,
  };
  root.userData = {
    sourceProfile: PROFILE,
    textureFree: true,
    drawCallBudget: 1,
    instanceBudget: 17_000,
    ruinInstanceCount,
    instanceCount: blocks.length,
    sourceReplacementIds: GEDAECHTNISKIRCHE_MINECRAFT_REPLACEMENT_IDS,
  };
  root.add(mesh);
  return root;
}
