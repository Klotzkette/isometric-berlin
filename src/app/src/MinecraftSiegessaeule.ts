import { siegessaeuleShaftStack } from "./SiegessaeuleArchitecture";
import { SIEGESSAEULE_MOSAIC_TONES, SIEGESSAEULE_PROFILE } from "./SiegessaeuleProfile";

type Block = {
  color: number;
  position: [number, number, number];
  size: [number, number, number];
  rotationY?: number;
  feature: string;
};

export const SIEGESSAEULE_LEVELS = {
  groundY: 2.1,
  basePlatformTopY: 3.5,
  baseTopY: 10.1,
  hallFloorY: 10.72,
  hallRoofBottomY: 15.42,
  hallRoofTopY: 16.12,
  statueBaseY: 2.1 + SIEGESSAEULE_PROFILE.heightM - SIEGESSAEULE_PROFILE.viktoria.heightM,
} as const;

/** A source-bound stepped counterpart, entirely inside one existing cube batch. */
export function minecraftSiegessaeuleBlocks(x: number, z: number, facing: readonly [number, number]): Block[] {
  const blocks: Block[] = [];
  const add = (feature: string, px: number, y: number, pz: number, sx: number, sy: number, sz: number, color: number) => {
    blocks.push({ feature, position: [x + px, y, z + pz], size: [sx, sy, sz], color });
  };
  const levels = SIEGESSAEULE_LEVELS;
  const sandstone = 0xb9ae94;
  const highlight = 0xc8bda3;
  const gold = 0xf4d16f;
  for (let step = 0; step < 5; step += 1) {
    const width = 28.3 - step * 0.52;
    add("square approach step", 0, 2.1 + (step + 0.5) * 0.28, 0, width, 0.28, width, 0xc6c1b5);
  }
  add("red granite base", 0, 6.8, 0, 25.3, 6.6, 25.3, 0x855345);
  add("base cornice", 0, 9.94, 0, 26.12, 0.32, 26.12, 0xa77a68);
  add("colonnade floor", 0, 10.41, 0, 17.5, 0.62, 17.5, highlight);
  add("mosaic core", 0, 13.07, 0, 10, 4.7, 10, SIEGESSAEULE_MOSAIC_TONES[0]);
  add("colonnade entablature", 0, 15.77, 0, 18, 0.7, 18, highlight);
  const stack = siegessaeuleShaftStack(levels.hallRoofTopY, levels.statueBaseY);
  add("shaft foot", 0, 16.62, 0, 7.2, 1, 7.2, sandstone);
  add("shaft foot upper moulding", 0, 17.52, 0, 6, 0.8, 6, highlight);
  const octagon = (feature: string, radius: number, bottomY: number, topY: number, color: number) => {
    const height = topY - bottomY;
    // Three adjacent rectangular slices form a chamfered square footprint.
    add(feature, 0, (bottomY + topY) / 2, 0, radius * 2, height, radius * 0.9, color);
    for (const side of [-1, 1]) add(feature, 0, (bottomY + topY) / 2, side * radius * 0.725, radius * 1.38, height, radius * 0.55, color);
  };
  stack.drums.forEach(({ radius, bottomY, topY }, drum) => {
    octagon("sandstone drum", radius, bottomY, topY, sandstone);
    octagon("stone drum annulet", radius + 0.14, topY, topY + stack.bandHeight, highlight);
    if (drum < 3) {
      for (let gun = 0; gun < 20; gun += 1) {
        const angle = (gun + 0.5) / 20 * Math.PI * 2;
        const px = Math.cos(angle) * radius, pz = Math.sin(angle) * radius;
        const height = (topY - bottomY) * 0.28;
        add("captured gilded cannon", px, bottomY + 0.45 + height / 2, pz, 0.26, height, 0.26, gold);
        add("cannon breech", px, bottomY + 0.65, pz, 0.4, 0.24, 0.4, gold);
      }
    } else {
      for (let festoon = 0; festoon < 20; festoon += 1) {
        const angle = festoon / 20 * Math.PI * 2;
        add("upper drum laurel", Math.cos(angle) * (radius + 0.05), bottomY + 0.7, Math.sin(angle) * (radius + 0.05), 0.24, 0.7, 0.24, gold);
      }
    }
  });
  const crown = stack.crownBottomY;
  octagon("capital neck", 2.7, crown, crown + 0.65, highlight);
  octagon("capital bell", 3.2, crown + 0.65, crown + 1.55, sandstone);
  for (let eagle = 0; eagle < 8; eagle += 1) {
    const angle = eagle / 8 * Math.PI * 2;
    add("capital eagle body", Math.cos(angle) * 3.2, crown + 1.06, Math.sin(angle) * 3.2, 0.3, 0.86, 0.3, highlight);
    for (const wing of [-1, 1]) {
      add("capital eagle wing", Math.cos(angle + wing * 0.16) * 3.3, crown + 1.28, Math.sin(angle + wing * 0.16) * 3.3, 0.4, 0.25, 0.4, highlight);
    }
  }
  octagon("octagonal observation floor", 3.66, crown + 1.55, crown + 1.85, highlight);
  const floorY = crown + 1.85;
  add("statue pedestal", 0, (floorY + levels.statueBaseY - 0.3) / 2, 0, 2.6, levels.statueBaseY - 0.3 - floorY, 2.6, sandstone);
  add("statue pedestal cornice", 0, levels.statueBaseY - 0.15, 0, 3.3, 0.3, 3.3, highlight);
  for (let side = 0; side < 8; side += 1) {
    const a = side / 8 * Math.PI * 2, b = (side + 1) / 8 * Math.PI * 2;
    const ax = Math.cos(a) * 3.56, az = Math.sin(a) * 3.56;
    const bx = Math.cos(b) * 3.56, bz = Math.sin(b) * 3.56;
    for (let post = 0; post < 4; post += 1) {
      add("open balcony baluster", ax + (bx - ax) * post / 4, floorY + 0.55, az + (bz - az) * post / 4, 0.12, 1.1, 0.12, gold);
    }
    for (const rise of [0.15, 1.1]) {
      add("octagonal balcony rail", (ax + bx) / 2, floorY + rise, (az + bz) / 2, Math.hypot(bx - ax, bz - az), 0.1, 0.1, gold);
      blocks[blocks.length - 1].rotationY = -Math.atan2(bz - az, bx - ax);
    }
  }
  // West-facing figure: an open wreath, stepped feather fans, robe, helmet,
  // folded standard arm and an Iron Cross. No smooth Goldelse is duplicated.
  const figure = (feature: string, fx: number, fy: number, fz: number, sx: number, sy: number, sz: number, tone = gold) => {
    // Match the drawn figure: local +z is her left (up × facing).
    add(feature, facing[0] * fx + facing[1] * fz, levels.statueBaseY + fy,
      facing[1] * fx - facing[0] * fz, sx, sy, sz, tone);
    blocks[blocks.length - 1].rotationY = -Math.atan2(facing[1], facing[0]);
  };
  figure("left shoe", 0.2, 0.16, 0.32, 0.92, 0.32, 0.42);
  figure("right shoe", 0.45, 0.16, -0.32, 0.92, 0.32, 0.42);
  for (let fold = 0; fold < 5; fold += 1) figure("draped robe", -0.15 + fold * 0.06, 0.6 + fold * 0.59, 0.12 - fold * 0.025, 1.45 - fold * 0.08, 0.65, 2.2 - fold * 0.27, fold % 2 === 0 ? gold : 0xe4b849);
  figure("torso", 0.13, 3.65, 0, 1.16, 1.28, 1.54);
  figure("neck", 0.16, 4.43, 0, 0.5, 0.42, 0.5);
  figure("head", 0.18, 4.88, 0, 0.82, 0.65, 0.7);
  figure("eagle helmet", 0.05, 5.33, 0, 1.03, 0.24, 0.98);
  figure("helmet eagle", 0.05, 5.58, 0, 0.25, 0.36, 0.92);
  for (const wing of [-1, 1]) {
    for (let feather = 0; feather < 5; feather += 1) {
      figure("stepped wing feather", -0.68 - feather * 0.12, 4.02 - feather * 0.15, wing * (0.72 + feather * 0.53), 0.32, 1.5 - feather * 0.15, 0.64, feather % 2 ? 0xffe3a0 : gold);
    }
  }
  figure("raised wreath upper arm", 0.36, 4.05, -0.95, 0.42, 0.9, 0.42);
  figure("raised wreath forearm", 0.62, 4.74, -1.32, 0.4, 0.9, 0.4);
  figure("raised wreath wrist", 0.83, 5.3, -1.62, 0.36, 0.55, 0.36);
  for (let leaf = 0; leaf < 12; leaf += 1) {
    const angle = leaf / 12 * Math.PI * 2;
    figure("open laurel wreath", 0.9, 6.12 + Math.sin(angle) * 0.67, -1.72 + Math.cos(angle) * 0.67, 0.23, 0.29, 0.29);
  }
  figure("standard arm", 0.42, 3.63, 0.92, 0.42, 0.5, 0.78);
  figure("standard shaft", 0.65, 4.7, 1.42, 0.14, 6.5, 0.14);
  figure("Iron Cross vertical", 0.65, 7.46, 1.42, 0.22, 0.85, 0.32);
  figure("Iron Cross transverse", 0.65, 7.46, 1.42, 0.22, 0.28, 0.94);
  figure("standard finial", 0.65, 8.12, 1.42, 0.28, 0.4, 0.28);
  for (let ribbon = 0; ribbon < 3; ribbon += 1) figure("standard ribbon", 0.47 - ribbon * 0.27, 6.78 - ribbon * 0.26, 1.63 + ribbon * 0.24, 0.24, 0.7, 0.32);
  return blocks;
}
