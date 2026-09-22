import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute,
  Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, SphereGeometry, Vector3,
} from "three";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { SCHILLER_MONUMENT_PROFILE as P, SCHILLER_STEP_COURSES, schillerOctagonPoints } from "./schillerMonumentProfile";

export { SCHILLER_MONUMENT_PROFILE } from "./schillerMonumentProfile";

type Point = [number, number, number];
type Kind = "stone blocks" | "carved forms" | "round members" | "octagonal steps";
type Instance = { matrix: number[]; color: number };
type Pose = (side: number, up: number, forward: number) => Point;
const UP = new Vector3(0, 1, 0);
const WHITE = 0xdeddd3, LIGHT = 0xeae9df, RECESS = 0xa7a99f;
const STEP = 0x999c98, IRON = 0x343b39;

/**
 * Source-bound recognition sculpture, not a scan. Only the 8 m lower base and
 * 2.95 m standing figure are published dimensions; subdivision, marble veins,
 * individual anatomy and fence ornaments are procedural display estimates.
 * The photographs resolve Schiller's scroll into his anatomical LEFT hand.
 */
class SculptureBuilder {
  private readonly batches = new Map<Kind, Instance[]>();
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];
  private readonly matrix = new Matrix4();
  private readonly color = new Color();
  constructor(readonly minecraft: boolean) {}

  add(kind: Kind, p: Point, size: Point, color = WHITE, rotation = new Quaternion()): void {
    if (this.minecraft) kind = "stone blocks";
    this.matrix.compose(new Vector3(...p), rotation, new Vector3(...size));
    const batch = this.batches.get(kind) ?? [];
    batch.push({ matrix: this.matrix.toArray(), color });
    this.batches.set(kind, batch);
  }
  box(p: Point, size: Point, color = WHITE, yaw = 0): void {
    this.add("stone blocks", p, size, color, new Quaternion().setFromAxisAngle(UP, yaw));
  }
  round(p: Point, size: Point, color = WHITE): void {
    this.add("carved forms", p, size, color);
  }
  member(a: Point, b: Point, width: number, color = WHITE, depth = width): void {
    const d = new Vector3(...b).sub(new Vector3(...a)), length = d.length();
    if (length < .0001) return;
    this.add("round members", a.map((v, i) => (v + b[i]) / 2) as Point,
      [width, length, depth], color, new Quaternion().setFromUnitVectors(UP, d.multiplyScalar(1 / length)));
  }
  path(points: Point[], width: number, color = WHITE): void {
    for (let i = 1; i < points.length; i++) this.member(points[i - 1], points[i], width, color);
  }
  /** Indexed cloth/stone surfaces retain full curvature on phones too. */
  surface(rows: number, columns: number, point: (u: number, v: number) => Point, color: number, blockWidth = .12): void {
    if (this.minecraft) {
      const nr = Math.min(rows, 5), nc = Math.min(columns, 7);
      for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
        const p = point((c + .5) / nc, (r + .5) / nr);
        const a = point(c / nc, (r + .5) / nr), z = point((c + 1) / nc, (r + .5) / nr);
        const a2 = point((c + .5) / nc, r / nr), z2 = point((c + .5) / nc, (r + 1) / nr);
        this.box(p, [Math.max(blockWidth, Math.abs(z[0] - a[0]), Math.abs(z2[0] - a2[0])),
          Math.max(blockWidth, Math.abs(z[1] - a[1]), Math.abs(z2[1] - a2[1])),
          Math.max(blockWidth, Math.abs(z[2] - a[2]), Math.abs(z2[2] - a2[2]))], color);
      }
      return;
    }
    const start = this.positions.length / 3;
    this.color.setHex(color);
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= columns; c++) {
      this.positions.push(...point(c / columns, r / rows));
      this.colors.push(this.color.r, this.color.g, this.color.b);
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
      const a = start + r * (columns + 1) + c, b = a + columns + 1;
      this.indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  finish(root: Group): void {
    const day = new MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
    const night = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .89 });
    let instances = 0;
    for (const [kind, rows] of this.batches) {
      const geometry = kind === "stone blocks" ? new BoxGeometry(1, 1, 1)
        : kind === "carved forms" ? new SphereGeometry(.5, 12, 9)
          : new CylinderGeometry(.5, .5, 1, kind === "octagonal steps" ? 8 : 8);
      if (kind === "octagonal steps") geometry.rotateY(Math.PI / 8);
      geometry.deleteAttribute("uv");
      const normal = geometry.getAttribute("normal"), colors = new Float32Array(normal.count * 3);
      for (let i = 0; i < normal.count; i++) {
        const shade = .77 + .17 * Math.max(0, normal.getY(i)) + .065 * normal.getX(i) - .045 * normal.getZ(i);
        colors.set([shade, shade, shade], i * 3);
      }
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      const mesh = new InstancedMesh(geometry, day, 0);
      const matrices = new Float32Array(rows.length * 16), tint = new Float32Array(rows.length * 3);
      rows.forEach((row, i) => { matrices.set(row.matrix, i * 16); this.color.setHex(row.color).toArray(tint, i * 3); });
      mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
      mesh.instanceColor = new InstancedBufferAttribute(tint, 3); mesh.count = rows.length;
      mesh.name = `Schillerdenkmal ${this.minecraft ? "native cubes" : kind}`;
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
        keepInMinecraft: this.minecraft, blockNative: this.minecraft };
      mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh); instances += rows.length;
    }
    if (this.positions.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
      geometry.setIndex(this.indices); geometry.computeVertexNormals();
      const normal = geometry.getAttribute("normal");
      for (let i = 0; i < normal.count; i++) {
        const shade = .79 + .15 * Math.max(0, normal.getY(i)) + .06 * normal.getX(i) - .035 * normal.getZ(i);
        for (let c = 0; c < 3; c++) this.colors[i * 3 + c] *= shade;
      }
      geometry.setAttribute("color", new Float32BufferAttribute(this.colors, 3));
      // Curved cloth is a thin sculpted shell. Double sided rendering preserves
      // its folded hems without a duplicate hidden solid or per-person mesh.
      const curvedDay = day.clone(), curvedNight = night.clone();
      curvedDay.side = curvedNight.side = DoubleSide;
      const mesh = new Mesh(geometry, curvedDay); mesh.name = "Schillerdenkmal drapery and open carved basins";
      mesh.userData = { dayMaterial: curvedDay, nightMaterial: curvedNight, textureFree: true };
      root.add(mesh);
    }
    root.userData.instanceCount = instances;
    root.userData.renderableCount = root.children.length;
  }
}

function pose(x: number, y: number, z: number, angle: number): Pose {
  const c = Math.cos(angle), s = Math.sin(angle);
  return (side, up, forward) => [x + c * forward - s * side, y + up, z + s * forward + c * side];
}

/** A mantle runs from gathered shoulders through broad knees to a rippled hem. */
function drape(b: SculptureBuilder, at: Pose, sections: ReadonlyArray<readonly [number, number, number, number]>, phase = 0): void {
  const sample = (u: number, v: number): Point => {
    const row = v * (sections.length - 1), i = Math.min(sections.length - 2, Math.floor(row)), t = row - i;
    const a = sections[i], z = sections[i + 1], y = a[0] + (z[0] - a[0]) * t;
    const half = a[1] + (z[1] - a[1]) * t, forward = a[2] + (z[2] - a[2]) * t;
    const depth = a[3] + (z[3] - a[3]) * t, angle = u * Math.PI * 2;
    const fold = .028 * Math.sin(angle * 8 + phase + v * 1.3) + .015 * Math.cos(angle * 13 - v * 3);
    return at((half + fold) * Math.cos(angle), y, forward + (depth + fold) * Math.sin(angle));
  };
  b.surface(14, 28, sample, WHITE, .12);
}

function head(b: SculptureBuilder, at: Pose, y: number, scale: number, hood = false, laurels = false): void {
  b.round(at(0, y, .015), [scale * .77, scale, scale * .72], LIGHT);
  // Nose, brow, cheek planes and a restrained incised mouth remain stone-coloured.
  b.round(at(0, y + .015, scale * .36), [scale * .14, scale * .26, scale * .2], LIGHT);
  for (const side of [-1, 1]) {
    b.round(at(side * scale * .19, y + scale * .1, scale * .3), [scale * .19, scale * .065, scale * .095], RECESS);
    b.round(at(side * scale * .19, y + scale * .12, scale * .31), [scale * .24, scale * .06, scale * .11], LIGHT);
    b.round(at(side * scale * .33, y - scale * .015, 0), [scale * .12, scale * .23, scale * .2], WHITE);
  }
  b.member(at(-scale * .12, y - scale * .18, scale * .32), at(scale * .12, y - scale * .18, scale * .32), scale * .025, RECESS);
  const n = b.minecraft ? 7 : 15;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * .15 + i / (n - 1) * Math.PI * 1.3;
    const side = Math.cos(a) * scale * .37, up = Math.sin(a) * scale * .38;
    b.round(at(side, y + up + .035, -.055), [scale * .23, scale * .28, scale * .37], WHITE);
  }
  for (const side of [-1, 1]) for (let i = 0; i < (b.minecraft ? 2 : 4); i++) {
    b.round(at(side * scale * (.31 + .04 * i), y - scale * (.2 + .16 * i), -.08 - i * .015),
      [scale * .23, scale * .35, scale * .31], WHITE);
  }
  if (hood) {
    b.surface(8, 16, (u, v) => {
      const a = -.15 + u * Math.PI * 1.1;
      return at(Math.cos(a) * scale * (.48 + .14 * v), y + Math.sin(a) * scale * .61 - v * scale * 1.7,
        -.09 - v * .11 + .025 * Math.sin(u * 22));
    }, WHITE);
  }
  if (laurels) for (let i = 0; i < (b.minecraft ? 8 : 18); i++) {
    const a = i * Math.PI * 2 / (b.minecraft ? 8 : 18);
    b.round(at(Math.cos(a) * scale * .4, y + scale * (.33 + .09 * Math.sin(a)), Math.sin(a) * scale * .33),
      [scale * .16, scale * .09, scale * .13], LIGHT);
  }
}

function standingSchiller(b: SculptureBuilder): void {
  const at = pose(0, P.figureBaseYLocal, 0, 0);
  b.box(at(0, -.04, 0), [1.02, .08, .84], LIGHT);
  // Shoes and separated lower legs show below the long eighteenth-century coat.
  for (const side of [-1, 1]) {
    b.round(at(side * .14, .08, .105 + (side === 1 ? .055 : 0)), [.2, .16, .43], WHITE);
    b.member(at(side * .14, .17, .015), at(side * .16, .84, -.015), .18, WHITE, .2);
    b.round(at(side * .16, .95, -.015), [.25, .52, .28], WHITE);
  }
  drape(b, at, [[.72, .26, -.08, .17], [.95, .29, -.06, .19], [1.2, .34, -.02, .24],
    [1.66, .3, 0, .22], [2.04, .35, -.015, .22], [2.3, .4, -.015, .23], [2.38, .18, -.02, .15]], .4);
  b.round(at(0, 2.18, .07), [.57, .63, .39], LIGHT);
  b.member(at(0, 2.43, 0), at(0, 2.59, .015), .22, LIGHT);
  head(b, at, 2.6862, .44, false, true);
  // The right sleeve comes across his chest; the left hand holds the scroll.
  b.member(at(.33, 2.3, .015), at(.47, 1.98, .13), .235);
  b.member(at(.47, 1.98, .13), at(.08, 2.04, .32), .21);
  b.round(at(.04, 2.06, .34), [.24, .16, .15], LIGHT);
  b.member(at(-.31, 2.3, .025), at(-.42, 2.02, .14), .225);
  b.member(at(-.42, 2.02, .14), at(-.25, 2.29, .29), .18);
  b.round(at(-.25, 2.29, .3), [.2, .18, .13], LIGHT);
  b.member(at(-.2, 2.18, .31), at(-.33, 2.64, .24), .12, LIGHT, .1);
  for (const side of [-1, 1]) b.member(at(side * .06, 2.44, .22), at(side * .17, 2.34, .24), .09, LIGHT);
  for (let i = 0; i < 5; i++) b.round(at(.025, 1.76 + i * .095, .285), [.038, .038, .027], LIGHT);
  // A second asymmetric mantle shell hangs from the left forearm. Its mouth
  // remains open and the long folds sweep down beside the visible shins.
  b.surface(15, 18, (u, v) => {
    const side = -.54 + u * (.62 - .22 * v), y = .08 + v * 2.18;
    const sag = Math.sin(Math.PI * u) * (.13 + .2 * v);
    return at(side + .08 * Math.sin(v * 3), y - sag,
      -.14 + .37 * v + .07 * Math.sin(u * Math.PI * 7 + v * 2));
  }, WHITE);
}

function seatedAllegory(b: SculptureBuilder, name: "Lyrik" | "Drama" | "Philosophie" | "Geschichte", angle: number): void {
  const x = Math.cos(angle) * 1.91, z = Math.sin(angle) * 1.91, at = pose(x, 1.02, z, angle);
  b.box(at(0, .05, .08), [1.15, .1, .94], WHITE, Math.PI / 2 - angle);
  b.round(at(0, .7, -.04), [.77, .74, .73]);
  drape(b, at, [[.08, .53, .28, .37], [.35, .46, .3, .3], [.62, .47, .27, .37],
    [.83, .47, .25, .4], [.97, .34, .08, .24], [1.12, .25, -.075, .21], [1.25, .31, -.12, .2]], angle);
  b.round(at(0, 1.11, -.07), [.55, .56, .41], LIGHT);
  b.member(at(0, 1.28, -.07), at(0, 1.43, -.075), .18, LIGHT);
  head(b, (s, y, f) => at(s, y, f - .06), 1.48, .32, name === "Philosophie");
  for (const side of [-1, 1]) {
    b.round(at(side * .25, .08, .51), [.2, .12, .32], LIGHT);
    // Broad cloth knees preserve seated anatomy instead of a standing stick.
    b.round(at(side * .23, .81 + (name === "Geschichte" && side === 1 ? .12 : 0), .42), [.42, .34, .47]);
  }
  const hand = (s: number, y: number, f: number) => b.round(at(s, y, f), [.14, .17, .095], LIGHT);
  if (name === "Philosophie") {
    b.member(at(-.26, 1.2, -.02), at(-.39, .99, .26), .18, LIGHT);
    b.member(at(-.39, .99, .26), at(-.06, 1.4, .2), .15, LIGHT); hand(-.06, 1.4, .2);
    b.member(at(.27, 1.21, -.06), at(.33, .94, .19), .17, LIGHT);
    b.member(at(.33, .94, .19), at(.3, .86, .44), .13, LIGHT); hand(.3, .86, .44);
    b.member(at(-.25, .86, .47), at(.5, .85, .42), .105, LIGHT);
    b.member(at(-.21, .74, .46), at(.28, .42, .58), .17, LIGHT);
    b.round(at(.34, .42, .61), [.22, .12, .17], LIGHT);
  } else if (name === "Geschichte") {
    b.box(at(.12, 1.0, .51), [.59, .65, .07], WHITE, Math.PI / 2 - angle);
    b.box(at(-.51, .38, .22), [.39, .66, .075], WHITE, Math.PI / 2 - angle);
    b.member(at(-.28, 1.25, -.04), at(-.43, 1.12, .29), .18, LIGHT);
    b.member(at(-.43, 1.12, .29), at(.01, 1.3, .53), .14, LIGHT); hand(.01, 1.3, .53);
    b.member(at(.27, 1.21, -.04), at(.39, .98, .34), .17, LIGHT); hand(.25, .75, .52);
    for (let i = 0; i < 4; i++) b.member(at(-.08, .8 + i * .11, .556), at(.28, .8 + i * .11, .556), .01, RECESS);
  } else {
    for (const side of [-1, 1]) {
      b.member(at(side * .29, 1.2, -.04), at(side * .43, .91, .2), .19, LIGHT);
      b.member(at(side * .43, .91, .2), at(side * .36, .69, .49), .14, LIGHT);
      hand(side * .36, .68, .49);
    }
    if (name === "Lyrik") {
      // Large U-shaped lyre with hooked swan necks and nine visible strings.
      const curve: Point[] = [];
      for (let i = 0; i <= (b.minecraft ? 8 : 20); i++) {
        const a = Math.PI + i / (b.minecraft ? 8 : 20) * Math.PI;
        curve.push(at(.36 * Math.cos(a), .4 + .29 * Math.sin(a), .66));
      }
      b.path(curve, .1, LIGHT);
      for (const side of [-1, 1]) {
        b.member(at(side * .36, .4, .66), at(side * .33, .98, .64), .09, LIGHT);
        b.round(at(side * .3, 1.01, .64), [.13, .15, .1], LIGHT);
      }
      b.member(at(-.31, .9, .65), at(.31, .9, .65), .06, LIGHT);
      for (let i = 0; i < (b.minecraft ? 4 : 9); i++) {
        const s = -.24 + i * .48 / ((b.minecraft ? 4 : 9) - 1);
        b.member(at(s, .17, .665), at(s, .9, .665), b.minecraft ? .035 : .012, RECESS);
      }
    } else {
      b.member(at(.36, .69, .51), at(.36, .26, .56), .055, LIGHT);
      b.member(at(.27, .64, .52), at(.45, .64, .52), .05, LIGHT);
      // The theatrical bearded mask rests at the woman's feet, not on her face.
      const mask = (s: number, y: number, f: number) => at(s + .54, y + .18, f + .25);
      b.round(mask(0, 0, 0), [.28, .33, .19], WHITE);
      for (const side of [-1, 1]) b.round(mask(side * .066, .05, .088), [.075, .06, .035], RECESS);
      b.round(mask(0, -.065, .094), [.11, .055, .034], RECESS);
      for (let i = -2; i <= 2; i++) b.member(mask(i * .04, -.1, .07), mask(i * .035, -.24, .055), .035, WHITE);
    }
  }
}

function baseAndBasins(b: SculptureBuilder): void {
  for (const [i, course] of SCHILLER_STEP_COURSES.entries()) {
    const r = course.radiusM, y = (course.bottomYLocal + course.topYLocal) / 2;
    if (!b.minecraft) b.add("octagonal steps", [0, y, 0], [r * 2, P.stepHeightM, r * 2], STEP + i * 0x020202);
    else {
      // Nine joined surface strips follow the same chamfered octagonal course;
      // no hidden solid voxel fill and no large square projecting over a corner.
      const extent = r * Math.cos(Math.PI / 8), band = extent * 2 / 9;
      for (let row = 0; row < 9; row++) {
        const z = -extent + (row + .5) * band;
        const half = Math.min(extent, r * (Math.cos(Math.PI / 8) + Math.sin(Math.PI / 8)) - Math.abs(z) - band / 2);
        b.box([0, y, z], [half * 2, P.stepHeightM, band], STEP);
      }
    }
  }
  // Sparse pale/dark marble veins run across exposed tread bands. They are
  // synthetic stone shading, never sampled or loaded from a reference photo.
  if (!b.minecraft) for (const [level, course] of SCHILLER_STEP_COURSES.entries()) for (let side = 0; side < 8; side++) {
    const r = course.radiusM, a = Math.PI / 8 + side * Math.PI / 4;
    for (let j = 0; j < 3; j++) {
      const t = .2 + j * .29, q = (rr: number, tt: number): Point => [rr * ((1 - tt) * Math.cos(a) + tt * Math.cos(a + Math.PI / 4)),
        course.topYLocal + .003, rr * ((1 - tt) * Math.sin(a) + tt * Math.sin(a + Math.PI / 4))];
      b.member(q(r - .015, t), q(r - .2, t + .022), .012, level % 2 ? 0xb8bcb7 : 0x777f7c);
    }
  }
  b.box([0, 1.16, 0], [2.22, .28, 2.22], WHITE);
  b.box([0, 1.56, 0], [1.97, .57, 1.97], WHITE);
  b.box([0, 2.43, 0], [1.94, 1.18, 1.94], WHITE);
  for (const [y, width, height] of [[1.88, 2.04, .12], [3.05, 2.04, .12], [3.16, 2.16, .13], [3.3, 2.27, .15], [3.435, 2.36, .07]])
    b.box([0, y, 0], [width, height, width], LIGHT);
  b.box([0, 3.51, 0], [1.13, .08, .94], WHITE);
  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2, at = pose(0, 0, 0, angle);
    b.box(at(0, 1.16, 1.39), [1.45, .2, .68], WHITE, Math.PI / 2 - angle);
    // Open convex bowl: lower belly, outer lip and concave dry stone interior.
    const rings = [[1.37, .58, .38], [1.5, .95, .57], [1.68, 1.045, .66],
      [1.77, 1.035, .65], [1.78, .95, .55], [1.61, .75, .39], [1.58, .03, .02]];
    b.surface(12, 32, (u, v) => {
      const k = v * (rings.length - 1), i = Math.min(rings.length - 2, Math.floor(k)), t = k - i;
      const a = rings[i], z = rings[i + 1], h = a[0] + (z[0] - a[0]) * t;
      const rx = a[1] + (z[1] - a[1]) * t, rz = a[2] + (z[2] - a[2]) * t;
      return at(Math.cos(u * Math.PI * 2) * rx, h, 1.22 + Math.sin(u * Math.PI * 2) * rz);
    }, LIGHT, .15);
    // Lion-mask medallion and open mouth sit directly above each bowl.
    b.round(at(0, 2.06, 1.015), [.46, .46, .13], WHITE);
    for (let i = 0; i < (b.minecraft ? 6 : 12); i++) {
      const a = i * Math.PI * 2 / (b.minecraft ? 6 : 12);
      b.round(at(Math.cos(a) * .17, 2.06 + Math.sin(a) * .17, 1.082), [.095, .15, .08], WHITE);
    }
    b.round(at(0, 2.08, 1.14), [.23, .25, .17], LIGHT);
    b.round(at(0, 2.0, 1.224), [.13, .09, .025], RECESS);
    for (const s of [-1, 1]) b.round(at(s * .07, 2.135, 1.208), [.052, .03, .025], RECESS);
    b.round(at(0, 2.07, 1.255), [.085, .05, .045], WHITE);
    // Slightly recessed rectangular front/back inscriptions and side reliefs.
    b.box(at(0, 2.65, .982), [1.57, .69, .045], RECESS, Math.PI / 2 - angle);
    b.box(at(0, 2.65, 1.006), [1.49, .61, .035], WHITE, Math.PI / 2 - angle);
    if (side % 2) for (let j = 0; j < (b.minecraft ? 4 : 6); j++) {
      const s = -.6 + j * 1.2 / ((b.minecraft ? 4 : 6) - 1), y = 2.55 + .06 * Math.sin(j * 2);
      b.round(at(s, y + .14, 1.042), [.12, .13, .06], LIGHT);
      b.round(at(s, y - .025, 1.04), [.13, .23, .06], LIGHT);
      b.member(at(s - .035, y, 1.055), at(s - .09, y - .18, 1.055), .025, LIGHT);
      b.member(at(s + .035, y + .035, 1.055), at(s + .13, y + .15, 1.055), .025, LIGHT);
    }
  }
  // The name is a small carved cue; no speculative text on the rear tablets.
  const paths = letteringStrokePaths("SCHILLER.", .16);
  for (const path of paths) for (let i = 1; i < path.length; i++)
    b.member([1.03, 2.6 + path[i - 1][1], -path[i - 1][0]],
      [1.03, 2.6 + path[i][1], -path[i][0]], b.minecraft ? .026 : .013, RECESS);
}

function ironFence(b: SculptureBuilder): void {
  const vertices = schillerOctagonPoints(P.fenceRadiusM);
  for (let side = 0; side < 8; side++) {
    const first = vertices[side], last = vertices[(side + 1) % vertices.length];
    const at = (u: number, y: number): Point => [first[0] + (last[0] - first[0]) * u, y * P.fenceHeightM / 1.1, first[1] + (last[1] - first[1]) * u];
    for (const y of [.13, .95]) b.member(at(0, y), at(1, y), .035, IRON);
    b.member(at(0, .05), at(0, 1.02), .06, IRON);
    b.round(at(0, 1.055), [.09, .09, .09], IRON);
    for (let field = 0; field < 4; field++) {
      const u = (field + .5) / 4;
      b.member(at(u, .14), at(u, .95), .028, IRON);
      if (b.minecraft) {
        b.path([at(u - .1, .51), at(u, .82), at(u + .1, .51), at(u, .21), at(u - .1, .51)], .045, IRON);
        continue;
      }
      // Paired inward volutes and quatrefoil centre, rather than spear pickets.
      for (const s of [-1, 1]) for (const vertical of [-1, 1]) {
        const curve: Point[] = [];
        for (let j = 0; j <= 9; j++) {
          const t = j / 9, angle = t * Math.PI * 1.7, radius = .079 * (1 - .7 * t);
          curve.push(at(u + s * (.045 + Math.cos(angle) * radius), .54 + vertical * (.145 + Math.sin(angle) * radius * 2)));
        }
        b.path(curve, .022, IRON);
      }
      for (const s of [-1, 1]) b.path([at(u, .46), at(u + s * .025, .53), at(u, .61)], .025, IRON);
    }
  }
}

export function createSchillerMonument(minecraft = false): Group {
  const root = new Group(); root.name = "Schillerdenkmal — Reinhold Begas";
  root.position.set(...P.worldM); root.rotation.y = P.rotationY;
  root.userData = { textureFree: true, sourceBound: true, schwellenraumGeschuetzt: true,
    keepInMinecraft: minecraft, blockNative: minecraft, osmKey: P.osmKey,
    baseStepCount: P.stepCount, basinCount: 4, lionMaskCount: 4, allegoryCount: 4,
    allegoryNames: ["Lyrik", "Drama", "Philosophie", "Geschichte"],
    figureHeightM: P.figureHeightM, baseDiameterM: P.baseRadiusM * 2, displayHeightM: P.totalHeightM,
    anatomy: "laureled Schiller with scroll in anatomical left hand; clothed seated allegories",
    sculptureGeometry: "bounded procedural recognition; not a surveyed sculpture scan",
    fullAndMobileIdentical: true, photographTextures: false };
  const b = new SculptureBuilder(minecraft);
  baseAndBasins(b); standingSchiller(b);
  seatedAllegory(b, "Lyrik", Math.PI / 4);
  seatedAllegory(b, "Drama", -Math.PI / 4);
  seatedAllegory(b, "Philosophie", Math.PI * 3 / 4);
  seatedAllegory(b, "Geschichte", -Math.PI * 3 / 4);
  ironFence(b); b.finish(root);
  return freezeStaticSceneTransforms(root);
}
