import { SIEGESSAEULE_PROFILE } from "./SiegessaeuleProfile";

export type SiegessaeulePart = {
  name: string;
  tone: number;
  triangles: Float32Array;
  inked: boolean;
};

/** Shared display stack. Only the overall and Viktoria heights are measured. */
export function siegessaeuleShaftStack(hallRoofTopY: number, statueBaseY: number) {
  const footHeight = 1.8;
  const crownHeight = 4.1;
  const bandHeight = 0.3;
  const proportions = [8, 9, 10, 11];
  const bodyHeight = statueBaseY - hallRoofTopY - footHeight - crownHeight - 4 * bandHeight;
  let bottomY = hallRoofTopY + footHeight;
  const drums = proportions.map((proportion, index) => {
    const height = bodyHeight * proportion / 38;
    const drum = { bottomY, topY: bottomY + height, radius: 2.65 - index * 0.06 };
    bottomY += height + bandHeight;
    return drum;
  });
  return { drums, bandHeight, footHeight, crownBottomY: bottomY, statueBaseY };
}

type Point = readonly [number, number, number];

/** Closed faceted shell with an optional physically recessed flute contour. */
function shell(
  x: number, z: number, bottomY: number, topY: number,
  bottomRadius: number, topRadius: number, segments = 24, fluted = false,
): Float32Array {
  const vertices: number[] = [];
  const contour = (i: number, radius: number, y: number): Point => {
    const angle = i / segments * Math.PI * 2;
    const recess = fluted ? [0, 0.065, 0.11, 0.065][i % 4] : 0;
    return [x + Math.cos(angle) * (radius - recess), y, z + Math.sin(angle) * (radius - recess)];
  };
  for (let i = 0; i < segments; i += 1) {
    const b0 = contour(i, bottomRadius, bottomY);
    const b1 = contour(i + 1, bottomRadius, bottomY);
    const t0 = contour(i, topRadius, topY);
    const t1 = contour(i + 1, topRadius, topY);
    vertices.push(...b0, ...t1, ...b1, ...b0, ...t0, ...t1,
      x, topY, z, ...t1, ...t0, x, bottomY, z, ...b0, ...b1);
  }
  return new Float32Array(vertices);
}

/** Square beam along any 3D line, used for open rails and curved festoons. */
function beam(a: Point, b: Point, width: number): Float32Array {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz);
  const horizontal = Math.hypot(dx, dz);
  const u = horizontal > 0.00001 ? [-dz / horizontal, 0, dx / horizontal] : [1, 0, 0];
  const v = [dy * u[2] / length, (dz * u[0] - dx * u[2]) / length, -dy * u[0] / length];
  const points = [a, b].flatMap((p) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) =>
    [p[0] + width / 2 * (su * u[0] + sv * v[0]), p[1] + width / 2 * (su * u[1] + sv * v[1]), p[2] + width / 2 * (su * u[2] + sv * v[2])]));
  const result: number[] = [];
  for (const [a0, b0, c0, d0] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) {
    result.push(...points[a0], ...points[b0], ...points[c0], ...points[a0], ...points[c0], ...points[d0]);
  }
  return new Float32Array(result);
}

/**
 * Strack's slender sandstone architecture, independently bounded from the
 * already detailed Drake figure. The full-height BugWarp CC0 reference and
 * official monument inventory guide the forms; local dimensions are estimates.
 */
export function createSiegessaeuleArchitecture(
  x: number, z: number, hallRoofTopY: number, statueBaseY: number,
) {
  const stack = siegessaeuleShaftStack(hallRoofTopY, statueBaseY);
  const parts: SiegessaeulePart[] = [];
  const add = (name: string, triangles: Float32Array, tone = 0xb9ae94, inked = false) =>
    parts.push({ name, triangles, tone, inked });
  const point = (angle: number, radius: number, y: number): Point =>
    [x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius];
  const gold = 0xe4be58;
  const stoneHighlight = 0xc8bda3;
  for (const [rise, height, bottomRadius, topRadius] of [[0, 0.48, 3.75, 3.75], [0.48, 0.64, 3.55, 2.95], [1.12, 0.36, 3.04, 3.04], [1.48, 0.32, 2.94, 2.68]]) {
    add("shaft foot moulding", shell(x, z, hallRoofTopY + rise, hallRoofTopY + rise + height, bottomRadius, topRadius), stoneHighlight, true);
  }
  stack.drums.forEach(({ bottomY, topY, radius }, drum) => {
    add("fluted sandstone drum", shell(x, z, bottomY, topY, radius, radius - 0.035, SIEGESSAEULE_PROFILE.shaft.flutesPerDrum * 4, true));
    // Stone annulets, not the former thick gold separator rings.
    add("sandstone drum annulet", shell(x, z, topY, topY + stack.bandHeight, radius + 0.13, radius + 0.13), stoneHighlight, true);
    for (let flute = 0; flute < 20; flute += 1) {
      const angle = (flute + 0.5) / 20 * Math.PI * 2;
      if (drum < 3) {
        // The short muzzle-up trophies occupy the foot of each flute.
        const barrelHeight = (topY - bottomY) * 0.28;
        const barrelBottom = bottomY + 0.45;
        const p = point(angle, radius - 0.005, barrelBottom);
        add("gilded captured cannon", shell(p[0], p[2], barrelBottom, barrelBottom + barrelHeight, 0.15, 0.095, 6), gold);
        add("cannon breech collar", shell(p[0], p[2], barrelBottom + 0.12, barrelBottom + 0.38, 0.19, 0.19, 6), gold);
        add("cannon muzzle collar", shell(p[0], p[2], barrelBottom + barrelHeight - 0.16, barrelBottom + barrelHeight, 0.135, 0.135, 6), 0xf4d37a);
      } else {
        // The fourth register has hanging laurel, not another row of guns.
        const radiusAtGold = radius + 0.075;
        for (let segment = 0; segment < 4; segment += 1) {
          const a0 = (flute + segment / 4) / 20 * Math.PI * 2;
          const a1 = (flute + (segment + 1) / 4) / 20 * Math.PI * 2;
          const y0 = bottomY + 0.95 - Math.sin(segment / 4 * Math.PI) * 0.58;
          const y1 = bottomY + 0.95 - Math.sin((segment + 1) / 4 * Math.PI) * 0.58;
          add("upper drum laurel festoon", beam(point(a0, radiusAtGold, y0), point(a1, radiusAtGold, y1), 0.11), gold);
        }
      }
    }
  });
  const crown = stack.crownBottomY;
  add("capital neck", shell(x, z, crown, crown + 0.45, 2.54, 2.56), stoneHighlight, true);
  add("eagle-frieze capital bell", shell(x, z, crown + 0.45, crown + 1.55, 2.56, 3.24), 0xb3a68b);
  // Berlin's on-site historical panel identifies an eagle frieze. Eight
  // bounded silhouettes suggest its repeated heraldic carving; this display
  // sampling is not an inventory claim about the original number of figures.
  for (let eagle = 0; eagle < 8; eagle += 1) {
    const angle = eagle / 8 * Math.PI * 2;
    const chest = point(angle, 3.02, crown + 1.03);
    add("capital eagle body", beam(point(angle, 2.78, crown + 0.58), point(angle, 3.28, crown + 1.43), 0.2), stoneHighlight);
    for (const wing of [-1, 1]) {
      add("capital eagle wing", beam(chest, point(angle + wing * 0.19, 3.32, crown + 1.38), 0.2), stoneHighlight);
    }
    const head = point(angle, 3.32, crown + 1.43);
    add("capital eagle head", shell(head[0], head[2], crown + 1.38, crown + 1.6, 0.12, 0.12, 4), stoneHighlight);
  }
  const platformY = crown + 1.85;
  add("octagonal viewing platform", shell(x, z, crown + 1.55, platformY, 3.66, 3.66, 8), stoneHighlight, true);
  // A clear annular walkway around the central pedestal, with a real open rail.
  add("Viktoria central pedestal", shell(x, z, platformY, statueBaseY - 0.3, 1.45, 1.18, 16), 0xa99e87);
  add("Viktoria pedestal cornice", shell(x, z, statueBaseY - 0.3, statueBaseY, 1.65, 1.65, 16), stoneHighlight, true);
  for (let side = 0; side < SIEGESSAEULE_PROFILE.shaft.observationPlatformSides; side += 1) {
    const a = point(side / 8 * Math.PI * 2, 3.56, platformY);
    const b = point((side + 1) / 8 * Math.PI * 2, 3.56, platformY);
    for (const rise of [0.13, 1.1]) {
      add("octagonal viewing rail", beam([a[0], platformY + rise, a[2]], [b[0], platformY + rise, b[2]], 0.085), gold);
    }
    for (let post = 0; post < 5; post += 1) {
      const px = a[0] + (b[0] - a[0]) * post / 5;
      const pz = a[2] + (b[2] - a[2]) * post / 5;
      add("open viewing rail baluster", shell(px, pz, platformY, platformY + 1.1, 0.038, 0.038, 4), gold);
    }
  }
  return {
    parts,
    stack,
    metrics: {
      cannonCount: 60,
      drumCount: 4,
      flutesPerDrum: 20,
      laurelFestoonCount: 20,
      platformSides: 8,
      platformBalusterCount: 40,
      vertexCount: parts.reduce((sum, part) => sum + part.triangles.length / 3, 0),
      geometryStatus: SIEGESSAEULE_PROFILE.shaft.geometryStatus,
    },
  };
}
