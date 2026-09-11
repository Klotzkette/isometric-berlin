import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { createBuilder, finishDrawnGroup, paintGeometry } from "./drawnKit";
import { letteringStrokePaths } from "./drawnLettering";
import { BISMARCK_MOLTKE_PROFILES } from "./bismarckMoltkeProfiles";
export {
  BISMARCK_MOLTKE_PROFILES,
  BISMARCK_MOLTKE_OSM_KEYS,
  BISMARCK_MOLTKE_PRISM_IDS,
  bismarckMoltkeSourceColumnAt,
} from "./bismarckMoltkeProfiles";

type V3 = readonly [number, number, number];
type Solid = {
  shape: "box" | "ellipsoid" | "taper";
  p: V3;
  size: V3;
  q: Quaternion;
  color: number;
  cue: string;
  taper: number;
  ink: boolean;
};
type Key = keyof typeof BISMARCK_MOLTKE_PROFILES;
export type BismarckMoltkeOptions = { mobileLike?: boolean };
const BRONZE = 0x709185,
  BRONZE_DARK = 0x415f55,
  BRONZE_LIGHT = 0x91aa9a;
const GRANITE = 0xa17564,
  GRANITE_DARK = 0x825c50,
  MARBLE = 0xe4ddcc,
  SHADE = 0xc3bdaa,
  GOLD = 0xba9245;
const Y_AXIS = new Vector3(0, 1, 0);

/** One shared authored solid list drives smooth geometry, blocks and collision. */
function model(key: Key, mobileLike = false): Solid[] {
  const a: Solid[] = [];
  let cue = "base";
  const add = (
    shape: Solid["shape"],
    color: number,
    p: V3,
    size: V3,
    taper = 1,
    q = new Quaternion(),
    ink = false,
  ): void => {
    a.push({ shape, color, p, size, q, taper, ink, cue });
  };
  const box = (c: number, p: V3, s: V3, ink = false): void =>
    add("box", c, p, s, 1, new Quaternion(), ink);
  const oval = (c: number, p: V3, s: V3): void => add("ellipsoid", c, p, s);
  const taper = (c: number, p: V3, s: V3, t: number): void =>
    add("taper", c, p, s, t);
  const beam = (
    c: number,
    from: V3,
    to: V3,
    width: number,
    depth = width,
  ): void => {
    const d = new Vector3(...to).sub(new Vector3(...from));
    add(
      "taper",
      c,
      [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
      [width, d.length(), depth],
      0.82,
      new Quaternion().setFromUnitVectors(Y_AXIS, d.normalize()),
    );
  };
  const face = (c: number, p: V3, width: number, front = 1): void => {
    oval(c, p, [width, width * 1.22, width * 0.9]);
    oval(
      c,
      [p[0], p[1] - 0.035, p[2] + front * width * 0.45],
      [width * 0.22, width * 0.32, width * 0.32],
    );
    if (!mobileLike)
      for (const side of [-1, 1]) {
        oval(
          c,
          [p[0] + side * width * 0.5, p[1], p[2]],
          [width * 0.13, width * 0.3, width * 0.23],
        );
        beam(
          key === "moltke" ? SHADE : BRONZE_DARK,
          [
            p[0] + side * width * 0.1,
            p[1] + width * 0.12,
            p[2] + front * width * 0.44,
          ],
          [
            p[0] + side * width * 0.29,
            p[1] + width * 0.09,
            p[2] + front * width * 0.4,
          ],
          width * 0.065,
        );
      }
  };
  const text = (
    word: string,
    y: number,
    z: number,
    height: number,
    color: number,
  ): void => {
    for (const path of letteringStrokePaths(word, height))
      for (let i = 1; i < path.length; i++) {
        const p = path[i - 1],
          q = path[i];
        beam(
          color,
          [p[0], y + p[1], z],
          [q[0], y + q[1], z],
          height * 0.075,
          height * 0.075,
        );
      }
  };
  const cornerScrolls = (
    color: number,
    y: number,
    x: number,
    z: number,
    height: number,
  ): void => {
    for (const side of [-1, 1])
      for (const back of [-1, 1]) {
        for (let k = 0; k < 8; k++) {
          const t = k / 7;
          const next = (k + 1) / 7;
          if (k < 7)
            beam(
              color,
              [
                side * (x + 0.23 * Math.pow(1 - t, 3)),
                y + t * height,
                back * z,
              ],
              [
                side * (x + 0.23 * Math.pow(1 - next, 3)),
                y + next * height,
                back * z,
              ],
              0.27,
              0.3,
            );
        }
        oval(
          color,
          [side * (x + 0.22), y + 0.05, back * z],
          [0.43, 0.45, 0.36],
        );
        oval(
          key === "moltke" ? SHADE : GRANITE_DARK,
          [side * (x + 0.22), y + 0.05, back * (z + 0.16)],
          [0.2, 0.22, 0.08],
        );
      }
  };
  if (key === "bismarck") {
    // The 14.9 m source outline supplies the cross-shaped base envelope.
    for (let step = 0; step < 3; step++) {
      box(
        GRANITE,
        [0, 0.1 + step * 0.2, 0],
        [15.0 - step * 0.55, 0.2, 5.1 - step * 0.35],
        true,
      );
      // Rounded front/rear apses, with no invented return of the six lost reliefs.
      taper(
        GRANITE,
        [0, 0.1 + step * 0.2, 0],
        [7.0 - step * 0.45, 0.2, 7.7 - step * 0.4],
        1,
      );
    }
    box(GRANITE, [0, 1.35, 0], [12.8, 1.5, 3.15], true);
    taper(GRANITE, [0, 1.35, 0], [5.4, 1.5, 6.1], 1);
    for (const sign of [-1, 1])
      for (let i = 0; i < 3; i++) {
        // Quiet recessed replacement slabs and their surviving fixing rosettes.
        const x = (i - 1) * 1.25,
          z =
            sign * Math.sqrt(Math.max(0, 3.05 ** 2 - ((x * 3.05) / 2.7) ** 2));
        for (const sy of [0.88, 1.82])
          oval(BRONZE_DARK, [x, sy, z + 0.035 * sign], [0.085, 0.085, 0.045]);
      }
    box(GRANITE_DARK, [0, 2.26, 0], [4.1, 0.32, 3.6], true);
    box(GRANITE, [0, 2.62, 0], [3.55, 0.4, 3.05], true);
    box(GRANITE, [0, 5.18, 0], [2.95, 4.72, 2.62], true);
    cornerScrolls(GRANITE, 2.78, 1.47, 1.29, 1.15);
    box(GRANITE_DARK, [0, 7.62, 0], [3.12, 0.18, 2.8], true);
    box(GRANITE, [0, 7.88, 0], [3.68, 0.34, 3.16], true);
    taper(GRANITE, [0, 8.14, 0], [3.3, 0.18, 2.85], 0.9);
    box(BRONZE, [0, 8.315, 0], [2.65, 0.17, 2.3], true);
    cue = "bismarck-standing";
    beam(BRONZE_DARK, [-0.49, 8.58, 0.3], [-0.46, 10.8, 0.02], 0.62, 0.67);
    beam(BRONZE, [0.48, 8.58, 0.15], [0.48, 10.8, 0.02], 0.63, 0.65);
    oval(BRONZE, [-0.51, 8.55, 0.5], [0.68, 0.3, 1.02]);
    oval(BRONZE, [0.48, 8.55, 0.35], [0.67, 0.3, 1.0]);
    taper(BRONZE, [0, 11.19, 0], [2.32, 2.56, 1.34], 0.69);
    oval(BRONZE, [0, 12.84, 0], [2.03, 1.75, 1.19]);
    beam(BRONZE, [-0.9, 13.13, 0], [-1.23, 11.22, 0.28], 0.53, 0.57);
    beam(BRONZE, [0.91, 13.1, 0.03], [1.29, 11.72, 0.42], 0.54, 0.55);
    face(BRONZE, [0, 14.18, 0.11], 0.83);
    for (const side of [-1, 1])
      oval(BRONZE_DARK, [side * 0.14, 14.07, 0.51], [0.32, 0.095, 0.12]);
    taper(BRONZE_DARK, [0, 13.62, 0.05], [0.86, 0.32, 0.75], 0.9);
    oval(BRONZE, [0, 14.6, 0.07], [1.01, 0.51, 0.96]);
    box(BRONZE_DARK, [0, 14.52, 0.46], [0.93, 0.075, 0.42]);
    taper(BRONZE, [0, 14.88, 0.07], [0.19, 0.24, 0.19], 0.12);
    for (const side of [-1, 1])
      for (let i = 0; i < 5; i++)
        oval(
          BRONZE_LIGHT,
          [side * 0.43, 11.9 + i * 0.3, 0.62],
          [0.085, 0.095, 0.065],
        );
    // Right hand at the draped document support; left hand holds the sabre.
    taper(BRONZE_DARK, [-1.17, 9.88, -0.18], [1.05, 2.98, 1.18], 0.72);
    box(BRONZE_LIGHT, [-1.13, 11.22, 0.34], [0.93, 0.13, 0.81]);
    oval(BRONZE, [-1.28, 11.25, 0.43], [0.31, 0.42, 0.3]);
    oval(BRONZE, [1.32, 11.63, 0.48], [0.33, 0.44, 0.32]);
    beam(BRONZE_DARK, [1.37, 11.7, 0.47], [0.64, 8.63, 0.52], 0.13);
    beam(BRONZE, [1.08, 11.74, 0.47], [1.64, 11.74, 0.47], 0.16);
    if (!mobileLike)
      for (let i = 0; i < 5; i++)
        beam(
          BRONZE_LIGHT,
          [-0.9 + i * 0.43, 10.1, 0.57],
          [-0.48 + i * 0.21, 11.65, 0.67],
          0.055,
        );
    cue = "atlas-globe-front";
    oval(BRONZE_DARK, [0, 2.24, 2.04], [3.12, 0.3, 2.36]);
    beam(BRONZE, [-0.68, 2.42, 2.36], [-0.57, 3.68, 2.1], 0.75, 0.83);
    beam(BRONZE, [0.65, 2.48, 2.48], [0.87, 3.28, 1.65], 0.7, 0.7);
    oval(BRONZE, [0, 3.53, 1.83], [1.45, 2.2, 1.36]);
    face(BRONZE_DARK, [0.16, 4.26, 2.67], 0.66);
    oval(BRONZE, [0, 5.31, 2.15], [2.12, 2.12, 2.12]);
    for (const s of [-1, 1]) {
      beam(BRONZE, [s * 0.63, 4.25, 2.15], [s * 1.02, 4.7, 2.37], 0.39);
      beam(BRONZE, [s * 1.02, 4.7, 2.37], [s * 0.7, 5.69, 2.88], 0.34);
      oval(BRONZE_LIGHT, [s * 0.64, 5.66, 2.97], [0.45, 0.62, 0.22]);
    }
    if (!mobileLike) {
      beam(BRONZE_LIGHT, [-0.24, 5.83, 3.0], [-0.48, 5.64, 3.08], 0.19, 0.06);
      beam(BRONZE_LIGHT, [-0.48, 5.64, 3.08], [-0.3, 5.39, 3.18], 0.23, 0.05);
      beam(BRONZE_LIGHT, [-0.3, 5.39, 3.18], [-0.18, 5.18, 3.16], 0.17, 0.05);
    }
    cue = "sibyl-sphinx-left";
    oval(BRONZE_DARK, [-4.6, 2.23, 0], [3.8, 0.3, 2.65]);
    oval(BRONZE, [-4.43, 2.96, 0.01], [2.77, 1.14, 1.22]);
    beam(BRONZE, [-5.23, 2.64, 0.53], [-5.68, 2.34, 0.75], 0.51);
    face(BRONZE, [-5.5, 3.55, 0.49], 0.64);
    oval(BRONZE, [-4.1, 3.77, 0.0], [1.75, 1.1, 1.53]);
    oval(BRONZE, [-4.35, 4.61, -0.12], [1.22, 1.78, 0.99]);
    face(BRONZE_DARK, [-4.36, 5.54, 0.06], 0.64);
    oval(BRONZE, [-4.36, 5.68, -0.12], [0.91, 0.86, 0.86]);
    face(BRONZE_DARK, [-4.36, 5.53, 0.3], 0.51);
    beam(BRONZE, [-4.86, 4.98, 0.1], [-5.35, 4.25, 0.69], 0.31);
    beam(BRONZE, [-3.89, 4.9, 0.13], [-3.43, 4.56, 0.92], 0.31);
    add(
      "box",
      BRONZE_DARK,
      [-3.62, 4.38, 1.01],
      [1.34, 0.14, 1.06],
      1,
      new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.55),
    );
    for (let i = 0; i < (mobileLike ? 3 : 7); i++)
      beam(
        BRONZE_LIGHT,
        [-4.85 + i * 0.24, 3.8, 0.5],
        [-5.2 + i * 0.34, 2.27, 1.03],
        0.065,
      );
    cue = "state-power-panther-right";
    oval(BRONZE_DARK, [4.5, 2.22, 0], [3.77, 0.26, 2.65]);
    oval(BRONZE, [4.0, 2.63, 0.28], [2.89, 0.72, 0.8]);
    face(BRONZE_DARK, [5.42, 2.6, 0.66], 0.54);
    for (const side of [-1, 1])
      beam(
        BRONZE,
        [4.93, 2.48, 0.28 + side * 0.32],
        [5.67, 2.31, 0.32 + side * 0.37],
        0.24,
      );
    beam(BRONZE, [2.57, 2.59, 0.25], [2.1, 2.84, 0.13], 0.12);
    taper(BRONZE, [4.49, 3.39, -0.12], [1.34, 2.5, 1.04], 0.48);
    oval(BRONZE, [4.49, 4.73, -0.12], [1.15, 1.3, 0.79]);
    face(BRONZE, [4.49, 5.69, 0.0], 0.58);
    oval(BRONZE, [4.49, 5.98, -0.06], [0.71, 0.45, 0.65]);
    box(BRONZE_DARK, [4.49, 6.17, -0.05], [0.49, 0.18, 0.42]);
    beam(BRONZE, [4.91, 4.98, 0], [4.92, 4.03, 0.39], 0.32);
    beam(BRONZE, [4.04, 4.94, 0.04], [3.93, 4.08, 0.3], 0.31);
    beam(BRONZE, [3.97, 4.12, 0.45], [5.52, 3.68, 0.49], 0.13);
    oval(BRONZE_LIGHT, [4.9, 3.17, 0.55], [0.63, 1.13, 0.68]);
    for (let i = 0; i < (mobileLike ? 3 : 6); i++)
      beam(
        BRONZE_LIGHT,
        [4.13 + i * 0.13, 4.45, 0.27],
        [3.83 + i * 0.25, 2.31, 0.8],
        0.065,
      );
    cue = "siegfried-forging-rear";
    oval(BRONZE_DARK, [0, 2.25, -2.24], [3.48, 0.3, 2.23]);
    oval(BRONZE, [0.1, 3.01, -2.14], [1.43, 1.39, 1.33]);
    oval(BRONZE, [0, 4.1, -2.2], [1.49, 1.52, 1.0]);
    face(BRONZE, [0.15, 5.18, -2.29], 0.68, -1);
    beam(BRONZE, [-0.59, 4.46, -2.13], [-1.03, 5.0, -2.38], 0.41);
    beam(BRONZE, [-1.03, 5.0, -2.38], [-0.61, 5.64, -2.5], 0.34);
    beam(BRONZE_DARK, [-0.61, 5.64, -2.5], [-0.28, 6.1, -2.64], 0.15);
    box(BRONZE_DARK, [-0.27, 6.04, -2.64], [0.69, 0.31, 0.28]);
    box(BRONZE_DARK, [0.87, 3.08, -2.77], [1.16, 1.47, 0.78]);
    box(BRONZE, [0.87, 3.89, -2.77], [1.52, 0.24, 0.89]);
    beam(BRONZE, [0.52, 4.47, -2.23], [0.89, 3.99, -2.82], 0.35);
    beam(BRONZE_LIGHT, [0.14, 4.03, -2.83], [1.71, 4.03, -2.83], 0.13);
    cue = "pedestal-name";
    text("BISMARCK", 6.52, 1.328, 0.28, BRONZE_DARK);
  } else {
    // Source main body is 3.4 m square; the missing historic broad stair is excluded.
    for (const [y, h, w] of [
      [0.12, 0.24, 4.1],
      [0.36, 0.24, 3.79],
      [0.62, 0.28, 3.45],
      [0.85, 0.18, 3.25],
    ])
      box(MARBLE, [0, y, 0], [w, h, w], true);
    box(MARBLE, [0, 1.98, 0], [2.7, 2.08, 2.65], true);
    cornerScrolls(MARBLE, 1.09, 1.35, 1.3, 1.6);
    for (const [y, h, w] of [
      [3.09, 0.14, 3.1],
      [3.25, 0.14, 3.36],
      [3.39, 0.13, 3.08],
    ])
      box(MARBLE, [0, y, 0], [w, h, w], true);
    taper(MARBLE, [0, 3.52, 0], [3.1, 0.2, 3.05], 0.8);
    box(MARBLE, [0, 3.65, 0], [2.43, 0.1, 2.25], true);
    cue = "moltke-two-column-support";
    box(SHADE, [0, 4.58, -0.4], [1.51, 1.73, 0.52]);
    for (const side of [-1, 1]) {
      taper(MARBLE, [side * 0.94, 4.63, -0.45], [0.42, 1.78, 0.42], 0.9);
      box(MARBLE, [side * 0.94, 3.82, -0.45], [0.56, 0.22, 0.56]);
      box(MARBLE, [side * 0.94, 5.53, -0.45], [0.56, 0.2, 0.56]);
      for (let f = 0; f < (mobileLike ? 4 : 7); f++) {
        const ang = (f * Math.PI * 2) / (mobileLike ? 4 : 7);
        beam(
          SHADE,
          [
            side * 0.94 + 0.205 * Math.sin(ang),
            3.97,
            -0.45 + 0.205 * Math.cos(ang),
          ],
          [
            side * 0.94 + 0.18 * Math.sin(ang),
            5.35,
            -0.45 + 0.18 * Math.cos(ang),
          ],
          0.035,
        );
      }
    }
    box(MARBLE, [0, 5.67, -0.45], [2.48, 0.2, 0.78], true);
    cue = "moltke-crossed-legs";
    beam(MARBLE, [-0.5, 5.68, 0.09], [0.26, 3.96, 0.51], 0.5, 0.54);
    beam(MARBLE, [0.43, 5.67, -0.1], [-0.34, 3.97, 0.13], 0.46, 0.5);
    oval(MARBLE, [0.31, 3.87, 0.67], [0.57, 0.27, 0.89]);
    oval(MARBLE, [-0.32, 3.86, 0.19], [0.53, 0.27, 0.81]);
    cue = "moltke-uniform";
    taper(MARBLE, [0, 6.18, 0.04], [1.66, 1.76, 1.03], 0.72);
    oval(MARBLE, [0, 7.34, 0.04], [1.65, 1.61, 0.97]);
    taper(MARBLE, [0, 8.05, 0.05], [0.61, 0.37, 0.54], 0.9);
    face(MARBLE, [0, 8.51, 0.14], 0.68);
    cue = "moltke-peaked-cap";
    taper(MARBLE, [0, 8.91, 0.1], [0.79, 0.3, 0.73], 1.13);
    oval(MARBLE, [0, 9.06, 0.1], [0.94, 0.28, 0.88]);
    box(SHADE, [0, 8.84, 0.49], [0.78, 0.085, 0.35]);
    cue = "moltke-clasped-hands";
    beam(MARBLE, [-0.73, 7.77, 0.01], [-0.78, 6.77, 0.14], 0.47);
    beam(MARBLE, [-0.78, 6.77, 0.14], [0.04, 6.47, 0.66], 0.43);
    beam(MARBLE, [0.73, 7.77, 0.01], [0.72, 6.72, 0.17], 0.47);
    beam(MARBLE, [0.72, 6.72, 0.17], [-0.07, 6.49, 0.7], 0.43);
    oval(MARBLE, [0, 6.5, 0.75], [0.66, 0.35, 0.31]);
    if (!mobileLike)
      for (let i = 0; i < 4; i++)
        beam(
          SHADE,
          [-0.17 + i * 0.1, 6.49, 0.897],
          [-0.05 + i * 0.1, 6.63, 0.879],
          0.02,
        );
    cue = "moltke-uniform";
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++)
        oval(SHADE, [side * 0.41, 6.93 + i * 0.22, 0.48], [0.065, 0.075, 0.06]);
    box(MARBLE, [0, 7.72, 0.54], [0.1, 0.26, 0.04]);
    box(MARBLE, [0, 7.75, 0.54], [0.24, 0.08, 0.04]);
    beam(SHADE, [0.75, 6.78, -0.32], [0.85, 4.22, -0.52], 0.08);
    cue = "pedestal-name";
    text("MOLTKE", 2.46, 1.347, 0.36, GOLD);
    // Shallow incised shield, without resurrecting the lost large 1905 arms.
    cue = "moltke-incised-shield";
    const shield: V3[] = [
      [-0.36, 1.82, 1.337],
      [0.36, 1.82, 1.337],
      [0.28, 1.37, 1.337],
      [0, 1.18, 1.337],
      [-0.28, 1.37, 1.337],
      [-0.36, 1.82, 1.337],
    ];
    for (let i = 1; i < shield.length; i++)
      beam(SHADE, shield[i - 1], shield[i], 0.022);
  }
  return a;
}

function geometry(s: Solid, mobileLike: boolean): BufferGeometry {
  const segments = mobileLike ? 8 : 12;
  const g =
    s.shape === "box"
      ? new BoxGeometry(...s.size)
      : s.shape === "ellipsoid"
        ? new SphereGeometry(0.5, segments, mobileLike ? 5 : 8).scale(...s.size)
        : new CylinderGeometry(0.5 * s.taper, 0.5, s.size[1], segments).scale(
            s.size[0],
            1,
            s.size[2],
          );
  g.applyQuaternion(s.q);
  g.translate(...s.p);
  return g;
}

export function createBismarckMoltkeMonuments(
  options: BismarckMoltkeOptions = {},
): Group {
  const root = new Group();
  root.name = "Bismarck and Moltke source-bound monuments";
  root.userData = {
    sourceBounded: true,
    textureFree: true,
    bismarckMoltkeSmooth: true,
    modes: ["day", "night", "snowstorm", "schwellenraum"],
  };
  for (const key of ["bismarck", "moltke"] as const) {
    const profile = BISMARCK_MOLTKE_PROFILES[key],
      b = createBuilder(),
      solids = model(key, false);
    for (const s of solids) {
      const g = geometry(s, false);
      if (s.ink) b.edges.push(new EdgesGeometry(g, 30));
      paintGeometry(g, s.color);
      b.parts.push(g);
    }
    const group = finishDrawnGroup(b, { name: profile.name })!;
    group.position.set(profile.worldM[0], profile.worldM[1], profile.worldM[2]);
    group.rotation.y = profile.rotationY;
    group.userData = {
      monumentKey: key,
      profile,
      ownedOsmKey: profile.osmKey,
      sourceBounded: true,
      textureFree: true,
      solidCues: [...new Set(solids.map((s) => s.cue))],
    };
    group.traverse((o) => {
      o.userData.textureFree = true;
    });
    root.add(group);
    const snow = createBuilder();
    for (const s of solids.filter(
      (s) => s.cue === "base" && s.shape === "box" && s.size[1] < 0.45,
    )) {
      const g = new BoxGeometry(
        s.size[0] * 0.99,
        0.055,
        s.size[2] * 0.99,
      ).translate(s.p[0], s.p[1] + s.size[1] / 2 + 0.0275, s.p[2]);
      paintGeometry(g, 0xf0f3ef);
      snow.parts.push(g);
    }
    const cap = finishDrawnGroup(snow, {
      name: profile.name + " reversible snow",
    })!;
    cap.position.copy(group.position);
    cap.rotation.copy(group.rotation);
    cap.traverse((o) => {
      o.visible = false;
      o.userData.bismarckMoltkeSnow = true;
      o.userData.snowOnly = true;
    });
    root.add(cap);
  }
  return root;
}

export function setBismarckMoltkeSnow(
  root: Object3D | null,
  enabled: boolean,
): void {
  root?.traverse((o) => {
    if (o.userData.bismarckMoltkeSnow === true) {
      o.visible = enabled;
      o.userData.snowActive = enabled;
    }
  });
}

function contains(s: Solid, p: Vector3, pad = 0): boolean {
  const q = p
    .clone()
    .sub(new Vector3(...s.p))
    .applyQuaternion(s.q.clone().invert());
  if (Math.abs(q.y) > s.size[1] / 2 + pad) return false;
  if (s.shape === "box")
    return (
      Math.abs(q.x) <= s.size[0] / 2 + pad &&
      Math.abs(q.z) <= s.size[2] / 2 + pad
    );
  const x = q.x / (s.size[0] / 2 + pad),
    y = q.y / (s.size[1] / 2 + pad),
    z = q.z / (s.size[2] / 2 + pad);
  if (s.shape === "ellipsoid") return x * x + y * y + z * z <= 1;
  const radius =
    1 + (s.taper - 1) * Math.max(0, Math.min(1, q.y / s.size[1] + 0.5));
  return x * x + z * z <= radius * radius;
}

const COLLISION_MODELS = {
  bismarck: model("bismarck", true),
  moltke: model("moltke", true),
};
/** Sculpture solids only; neighbouring park paths and the Moltke forecourt remain open. */
export function bismarckMoltkeSolidAt(
  x: number,
  y: number,
  z: number,
  radiusM = 0,
): boolean {
  if (![x, y, z, radiusM].every(Number.isFinite)) return false;
  for (const key of ["bismarck", "moltke"] as const) {
    const p = BISMARCK_MOLTKE_PROFILES[key],
      dx = x - p.worldM[0],
      dz = z - p.worldM[2];
    if (Math.abs(dx) > 10 + radiusM || Math.abs(dz) > 10 + radiusM) continue;
    const c = Math.cos(p.rotationY),
      s = Math.sin(p.rotationY),
      v = new Vector3(c * dx - s * dz, y - p.worldM[1], s * dx + c * dz);
    if (
      COLLISION_MODELS[key].some((s) =>
        contains(s, v, Math.max(0, radiusM) + 0.26),
      )
    )
      return true;
  }
  return false;
}

/** Rasterise each authored solid, retaining only the union's visible boundary cells. */
export function createMinecraftBismarckMoltkeMonuments(
  options: BismarckMoltkeOptions = {},
): Group {
  const root = new Group();
  root.name = "Minecraft Bismarck and Moltke monuments";
  root.userData = {
    blockNative: true,
    textureFree: true,
    modes: ["minecraft"],
  };
  const cell = options.mobileLike ? 0.36 : 0.27;
  for (const key of ["bismarck", "moltke"] as const) {
    const solids = model(key, !!options.mobileLike),
      cells = new Map<
        string,
        { x: number; y: number; z: number; color: number }
      >();
    for (const s of solids) {
      const g = geometry(s, true);
      g.computeBoundingBox();
      const b = g.boundingBox!;
      g.dispose();
      // Thin sculptural details still occupy their nearest block centre.
      const low = b.min.clone().divideScalar(cell).floor(),
        high = b.max.clone().divideScalar(cell).floor();
      for (let x = low.x; x <= high.x; x++)
        for (let y = low.y; y <= high.y; y++)
          for (let z = low.z; z <= high.z; z++) {
            if (
              !contains(
                s,
                new Vector3(
                  (x + 0.5) * cell,
                  (y + 0.5) * cell,
                  (z + 0.5) * cell,
                ),
                cell * 0.21,
              )
            )
              continue;
            cells.set(`${x},${y},${z}`, { x, y, z, color: s.color });
          }
    }
    const blocks = [...cells.values()].filter((b) =>
      [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ].some((d) => !cells.has(`${b.x + d[0]},${b.y + d[1]},${b.z + d[2]}`)),
    );
    const material = new MeshStandardMaterial({
      roughness: 0.91,
      flatShading: true,
    });
    const mesh = new InstancedMesh(
      new BoxGeometry(cell, cell, cell),
      material,
      blocks.length,
    );
    const m = new Matrix4();
    blocks.forEach((b, i) => {
      m.makeTranslation(
        (b.x + 0.5) * cell,
        (b.y + 0.5) * cell,
        (b.z + 0.5) * cell,
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, new Color(b.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    const p = BISMARCK_MOLTKE_PROFILES[key];
    mesh.name = `Minecraft ${p.name} blocks`;
    mesh.position.set(p.worldM[0], p.worldM[1], p.worldM[2]);
    mesh.rotation.y = p.rotationY;
    mesh.userData = {
      blockNative: true,
      textureFree: true,
      sourceBounded: true,
      ownedOsmKey: p.osmKey,
      monumentKey: key,
      blockCount: blocks.length,
      cellM: cell,
      profile: p,
      solidCues: [...new Set(solids.map((s) => s.cue))],
    };
    root.add(mesh);
  }
  return root;
}
