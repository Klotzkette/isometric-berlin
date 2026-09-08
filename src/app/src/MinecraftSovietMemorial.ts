import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from "three";
import {
  SOVIET_MEMORIAL_SOURCE,
  sovietMemorialLocalXZ,
  sovietMemorialWorldXZ,
} from "./SovietMemorialSource";

type Block = {
  position: [number, number, number];
  size: [number, number, number];
  color: number;
  yaw?: number;
};

/** One block-native draw; source positions are identical on desktop and mobile. */
export function createMinecraftSovietMemorial(
  profile: "full" | "mobile" = "full",
): Group {
  const root = new Group();
  root.name = "Minecraft Soviet memorial";
  const [x, z] = sovietMemorialWorldXZ(0, 0);
  root.position.set(x, SOVIET_MEMORIAL_SOURCE.groundY, z);
  root.rotation.y = SOVIET_MEMORIAL_SOURCE.rotationY;
  const blocks: Block[] = [];
  const stone = 0xc6c5ba,
    darkStone = 0x989b91,
    joint = 0x6d766c,
    gold = 0xc7a53c,
    green = 0x718264,
    track = 0x222b21;
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    yaw = 0,
  ) => blocks.push({ position: [x, y, z], size: [w, h, d], color, yaw });
  const segment = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    width: number,
    color: number,
  ) => {
    const n = Math.max(
      1,
      Math.ceil(
        Math.hypot(bx - ax, by - ay, bz - az) /
          (profile === "mobile" ? 0.5 : 0.3),
      ),
    );
    for (let i = 0; i < n; i += 1) {
      const t = (i + 0.5) / n;
      box(
        ax + (bx - ax) * t,
        ay + (by - ay) * t,
        az + (bz - az) * t,
        width,
        Math.max(width, Math.abs(by - ay) / n),
        width,
        color,
      );
    }
  };
  box(0, 0.07, 24, 78, 0.14, 53, 0xbcbdb1);
  box(0, 0.77, 15.9, 57, 1.4, 24, stone);
  for (let i = 0; i < 8; i += 1)
    box(
      0,
      0.18 + i * 0.18,
      31.6 - i * 0.475,
      29.7,
      0.18,
      8.5 - i * 0.95,
      stone,
    );
  for (let i = 0; i < 4; i += 1)
    box(0, 1.57 + i * 0.18, 1 - i * 0.5, 43 - i * 0.8, 0.18, 9.5 - i, stone);
  box(0, 1.68, -3, 7.2, 1.12, 4.8, 0x383c39);
  box(0, 7.7, -3, 5.8, 10.75, 3.8, darkStone);
  box(0, 12.92, -3, 6.55, 0.62, 4.24, stone);
  for (const side of [-1, 1])
    box(side * 3.25, 5.35, -3, 0.82, 6.3, 4.18, stone);
  for (let i = 0; i < 9; i += 1)
    box(0, 9.75 - i * 0.49, -1.03, 3.8 - (i % 3) * 0.3, 0.12, 0.13, gold);
  for (let i = 0; i < 12; i += 1) {
    const a = (i * Math.PI) / 6;
    box(
      Math.cos(a) * 0.76,
      10.78 + Math.sin(a) * 0.82,
      -0.95,
      0.22,
      0.22,
      0.18,
      gold,
    );
  }
  for (const [px, pz] of SOVIET_MEMORIAL_SOURCE.piers) {
    const width = Math.abs(px) > 18 ? 2.7 : 2.35;
    box(px, 4.98, pz, width, 5.62, 2.82, stone);
    box(px, 2.04, pz, width + 0.22, 0.72, 3.04, 0x383c39);
    box(px, 7.95, pz, width + 0.32, 0.46, 3.12, darkStone);
    box(px, 4.88, pz + 1.43, width - 0.48, 3.8, 0.12, darkStone);
    for (let i = 0; i < 6; i += 1)
      box(px, 6.02 - i * 0.48, pz + 1.5, width - 1, 0.1, 0.1, gold);
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4;
      box(
        px + Math.cos(a) * 0.4,
        6.87 + Math.sin(a) * 0.4,
        pz + 1.51,
        0.13,
        0.13,
        0.14,
        gold,
      );
    }
  }
  for (const side of [-1, 1]) {
    const nodes: [[number, number], ...[number, number][]] = [
      [side * 3.25, -2.9],
      ...SOVIET_MEMORIAL_SOURCE.piers
        .filter(([px]) => Math.sign(px) === side)
        .sort(([a], [b]) => Math.abs(a) - Math.abs(b))
        .map(([px, pz]) => [px, pz] as [number, number]),
    ];
    for (let i = 0; i < nodes.length - 1; i += 1) {
      const [ax, az] = nodes[i],
        [bx, bz] = nodes[i + 1];
      const length = Math.hypot(bx - ax, bz - az),
        yaw = -Math.atan2(bz - az, bx - ax);
      box((ax + bx) / 2, 8.03, (az + bz) / 2, length, 0.75, 2.9, stone, yaw);
      box(
        (ax + bx) / 2,
        8.53,
        (az + bz) / 2,
        length,
        0.25,
        3.7,
        darkStone,
        yaw,
      );
      box((ax + bx) / 2, 1.89, (az + bz) / 2, length, 0.55, 3.62, stone, yaw);
    }
    box(side * 6.8, 1.4, 29, 2.4, 1.04, 3.5, 0x383c39);
    box(side * 6.8, 2.09, 29, 2.65, 0.34, 3.72, darkStone);
    box(side * 24.5, 0.2, 42, 21, 0.08, 12.5, 0x526d3d);
    box(side * 7.8, 0.23, 42, 3.1, 0.2, 12.5, 0x453c2d);
    for (let row = 0; row < 3; row += 1)
      for (let i = 0; i < 12; i += 1)
        box(
          side * 7.8 - 1.1 + row * 1.1,
          0.59,
          36.6 + i * 0.99,
          0.34,
          0.2,
          0.3,
          (row + i) % 3 ? 0xc44234 : 0xe2ded2,
        );
    // Square-stepped rings read as circular fountain basins in block style.
    for (let i = 0; i < 16; i += 1) {
      const a = (i * Math.PI) / 8;
      box(
        side * 17.7 + Math.cos(a) * 1.9,
        0.3,
        -19.5 + Math.sin(a) * 1.9,
        0.75,
        0.36,
        0.75,
        darkStone,
      );
    }
    box(side * 17.7, 0.44, -19.5, 3.1, 0.09, 3.1, 0x709796);
    box(side * 17.7, 1.25, -19.5, 0.18, 1.6, 0.18, 0xa1c6c4);
    box(side * 28, 0.75, -20, 14.5, 1.15, 1.5, 0x4c6a3c);
  }
  // Eight-metre static soldier: open legs, greatcoat, asymmetrical arms and rifle.
  for (const side of [-1, 1])
    box(side * 0.55, 14.35, -3, 0.66, 2.6, 0.98, 0x4f6657);
  for (let i = 0; i < 6; i += 1)
    box(
      0,
      15.1 + i * 0.64,
      -3.1,
      3.05 - i * 0.16,
      0.68,
      2.0 - i * 0.1,
      0x4f6657,
    );
  box(0, 19.37, -3, 2.62, 0.92, 1.24, 0x4f6657);
  box(0, 20.0, -2.92, 0.94, 1.1, 0.9, 0x4f6657);
  box(0, 20.5, -2.98, 1.45, 0.52, 1.5, 0x4f6657);
  segment(-1.15, 19.23, -2.92, -0.72, 17.8, -2.28, 0.48, 0x4f6657);
  segment(1.16, 19.22, -3, 1.34, 16.67, -2.78, 0.48, 0x4f6657);
  segment(1.5, 20.91, -3.66, 0.78, 15.45, -3.42, 0.2, 0x3c5144);
  for (const tank of SOVIET_MEMORIAL_SOURCE.tanks) {
    const [tx, tz] = sovietMemorialLocalXZ(tank.worldXZ[0], tank.worldXZ[1]);
    box(tx, 0.675, tz, 8.1, 1.35, 4.8, darkStone);
    box(tx, 1.44, tz, 7.6, 0.18, 4.3, stone);
    const c = Math.cos(tank.yaw),
      s = Math.sin(tank.yaw);
    const part = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: number,
    ) =>
      box(
        tx + c * x + s * z,
        1.53 + y,
        tz - s * x + c * z,
        w,
        h,
        d,
        color,
        tank.yaw,
      );
    for (const side of [-1, 1]) {
      part(side * 1.29, 0.4, 0, 0.43, 0.67, 5.9, track);
      for (let i = 0; i < 5; i += 1) {
        part(side * 1.52, 0.4, -2.08 + i * 1.04, 0.22, 0.69, 0.72, green);
        part(side * 1.66, 0.4, -2.08 + i * 1.04, 0.12, 0.2, 0.2, track);
      }
      part(side * 1.34, 1.15, 0, 0.23, 0.12, 5.7, green);
      for (let i = 0; i < (profile === "mobile" ? 8 : 12); i += 1)
        part(
          side * 1.52,
          0.08,
          -2.65 + i * (5.3 / (profile === "mobile" ? 7 : 11)),
          0.2,
          0.18,
          0.25,
          joint,
        );
    }
    part(0, 0.77, 0, 2.53, 0.72, 5.7, green);
    part(0, 1.2, 0, 2.1, 0.38, 4.9, green);
    part(0, 1.57, -0.18, 2.08, 0.3, 2.4, green);
    part(0, 1.92, -0.18, 1.72, 0.62, 2.02, green);
    part(0.28, 2.29, -0.06, 0.65, 0.18, 0.65, track);
    part(0, 1.91, -1.3, 0.9, 0.52, 0.4, green);
    part(0, 1.98, -2.76, 0.16, 0.16, 2.75, green);
    // Contrasting procedural 200/300 pixel numerals on both turret sides.
    const glyphs: Record<string, string[]> = {
      "2": ["111", "001", "111", "100", "111"],
      "3": ["111", "001", "111", "001", "111"],
      "0": ["111", "101", "101", "101", "111"],
    };
    for (const side of [-1, 1])
      for (let digit = 0; digit < 3; digit += 1)
        glyphs[tank.number[digit]].forEach((line, row) =>
          [...line].forEach((bit, col) => {
            if (bit === "1")
              part(
                side * 0.9,
                2.13 - row * 0.065,
                -0.18 - side * ((digit - 1) * 0.24 + (col - 1) * 0.064),
                0.045,
                0.055,
                0.055,
                0xeee8d7,
              );
          }),
        );
  }
  for (const gun of SOVIET_MEMORIAL_SOURCE.guns) {
    const [gx, gz] = sovietMemorialLocalXZ(gun.worldXZ[0], gun.worldXZ[1]);
    box(gx, 0.575, gz, 10.5, 1.15, 8.5, darkStone);
    box(gx, 2.33, gz, 1.1, 0.62, 2.1, green);
    box(gx, 2.65, gz + 0.85, 2.5, 1.35, 0.18, green);
    for (const side of [-1, 1]) {
      box(gx + side * 1.16, 1.87, gz, 0.32, 1.4, 1.4, track);
      box(gx + side * 1.34, 1.87, gz, 0.14, 0.6, 0.6, green);
      segment(gx, 2.1, gz - 0.4, gx + side * 1.5, 1.5, gz - 4.4, 0.23, green);
    }
    segment(gx, 2.57, gz + 0.9, gx, 3.35, gz + 5.4, 0.22, green);
    box(gx, 3.39, gz + 5.55, 0.38, 0.38, 0.5, track);
  }
  const batch = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      flatShading: true,
    }),
    blocks.length,
  );
  batch.name = "Soviet memorial source-bound stone bronze and vehicle blocks";
  const dummy = new Object3D(),
    color = new Color();
  blocks.forEach((b, i) => {
    dummy.position.set(...b.position);
    dummy.rotation.set(0, b.yaw ?? 0, 0);
    dummy.scale.set(...b.size);
    dummy.updateMatrix();
    batch.setMatrixAt(i, dummy.matrix);
    batch.setColorAt(i, color.setHex(b.color));
  });
  batch.instanceMatrix.needsUpdate = true;
  if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
  batch.computeBoundingBox();
  batch.computeBoundingSphere();
  batch.castShadow = true;
  batch.receiveShadow = true;
  root.add(batch);
  root.userData = {
    ...root.userData,
    detailProfile: profile,
    blockCount: blocks.length,
    drawCalls: 1,
    referenceImagesBundled: false,
    source: SOVIET_MEMORIAL_SOURCE,
    texturePolicy: "procedural blocks only",
  };
  return root;
}

export function setSovietMemorialSmoothVisibility(
  root: Object3D | null,
  visible: boolean,
): void {
  const memorial = root?.getObjectByName(SOVIET_MEMORIAL_SOURCE.name);
  if (memorial?.userData.sovietMemorialSmooth === true)
    memorial.visible = visible;
}
