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

/** Physical collision for the represented core; leave the lower arch empty. */
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
  if (inside(31, 18, 0, 16.2))
    return Math.abs(u) + radius >= PROFILE.oldTower.portal.clearWidthM / 2;
  return (
    inside(31, 18, 16.2, 20) ||
    inside(21, 16.4, 20, 43) ||
    inside(22.8, 16.6, 43, 58.5)
  );
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
  const ruin = PROFILE.oldTower;
  const stone = 0x847a69,
    pale = 0xa69b85,
    shadow = 0x45423c,
    patina = 0x63847e;
  const shell = (
    width: number,
    depth: number,
    bottom: number,
    top: number,
    opening: boolean,
  ): void => {
    for (let face = 0; face < 4; face += 1) {
      const yaw = ruin.rotationY + (face * Math.PI) / 2;
      const length = face % 2 === 0 ? width : depth;
      const distance = (face % 2 === 0 ? depth : width) / 2;
      const columns = Math.ceil(length / 1.8),
        rows = Math.ceil((top - bottom) / 1.8);
      for (let row = 0; row < rows; row += 1)
        for (let col = 0; col < columns; col += 1) {
          const u = -length / 2 + ((col + 0.5) * length) / columns;
          const y = bottom + ((row + 0.5) * (top - bottom)) / rows;
          if (
            opening &&
            face % 2 === 0 &&
            Math.abs(u) < ruin.portal.clearWidthM / 2 &&
            y <
              ruin.portal.springHeightM +
                Math.sqrt(Math.max(0, ruin.portal.archRadiusM ** 2 - u * u))
          )
            continue;
          if (
            bottom > 42 &&
            face % 2 === 0 &&
            y > 46.5 &&
            y < 53.8 &&
            [-5.4, 0, 5.4].some((axis) => Math.abs(u - axis) < 1.3)
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
            1.0,
            (row * 7 + col * 11) % 9 === 0 ? pale : stone,
          );
        }
    }
  };
  shell(31, 18, 0, 20, true);
  shell(21, 16.4, 20, 43, false);
  shell(22.8, 16.6, 43, 58.5, false);
  for (const [y, w, d] of [
    [20.4, 32.6, 19.5],
    [23.1, 23.2, 17.7],
    [42.9, 24.4, 18.2],
    [58.2, 24.8, 18.4],
  ]) {
    for (let face = 0; face < 4; face += 1) {
      const length = face % 2 === 0 ? w : d;
      const n = Math.ceil(length / 3);
      for (let i = 0; i < n; i += 1)
        box(
          ruin.centerWorldM,
          ruin.rotationY + (face * Math.PI) / 2,
          -length / 2 + ((i + 0.5) * length) / n,
          y,
          (face % 2 === 0 ? d : w) / 2,
          length / n,
          0.8,
          0.65,
          pale,
        );
    }
  }
  for (let face = 0; face < 4; face += 1) {
    const yaw = ruin.rotationY + (face * Math.PI) / 2,
      depth = face % 2 === 0 ? 8.65 : 10.9;
    box(
      ruin.centerWorldM,
      yaw,
      0,
      ruin.clock.centerHeightM,
      depth,
      6.1,
      6.1,
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
        0.62,
        0.62,
        0.22,
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
      -1.0,
      ruin.clock.centerHeightM,
      depth + 0.3,
      2.0,
      0.28,
      0.2,
      0xd1ad4a,
    );
  }
  const heights = [71, 68.3, 64.5, 66.1, 62.9, 64.2, 65.5, 69.1];
  for (let side = 0; side < 8; side += 1) {
    const a = ((side + 0.5) * Math.PI) / 4;
    const top = heights[side],
      rows = Math.ceil((top - 58.6) / 1.1);
    for (let row = 0; row < rows; row += 1) {
      const h = (top - 58.6) / rows,
        y = 58.6 + (row + 0.5) * h;
      const r = 7.5 - ((y - 58.6) / 12.4) * 2.2;
      box(
        ruin.centerWorldM,
        ruin.rotationY + Math.PI / 2 - a,
        0,
        y,
        r,
        5.6,
        h,
        0.85,
        row < 2 ? stone : patina,
      );
    }
  }
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
    instanceBudget: 8_100,
    instanceCount: blocks.length,
    sourceReplacementIds: GEDAECHTNISKIRCHE_MINECRAFT_REPLACEMENT_IDS,
  };
  root.add(mesh);
  return root;
}
