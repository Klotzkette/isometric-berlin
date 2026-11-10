import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2 } from "three";
import nativeBodies from "./data/districtCourtsV229Native.json";
import { letteringStrokePaths } from "./drawnLettering";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

const KEY = "charlottenburg";
const OWNER = "DEBE04YY50000NDH";

type Point = readonly [number, number];
type Span = readonly [number, number];
type Rows = readonly (readonly number[])[];

interface SiteSource<Label> {
  readonly key: string;
  readonly owner: string;
  readonly boxes: Rows;
  readonly rods: Rows;
  readonly nativeRows: Rows;
  readonly labels: Label[];
}

// Whole v229 face replays prove these exact index complements. The unchanged
// rows are copied in original order, including the old side-entrance lettering.
const PREVIOUS_DRAWN: readonly Span[] = [[0, 60], [860, 920], [1200, 1240], [1940, 1956], [2276, 2292], [2420, 2436]];
const PREVIOUS_RODS: readonly Span[] = [[0, 27], [387, 414], [540, 558]];
const PREVIOUS_NATIVE: readonly Span[] = [[0, 135], [1935, 2070], [2700, 2790], [4365, 4417], [5195, 5247], [5549, 5591]];
const PREVIOUS_PANES: readonly Span[] = [[0, 15], [215, 230], [300, 310]];

function matchesRows(rows: Rows, count: number, size: number, expected: number): boolean {
  if (rows.length !== count) return false;
  const word = new DataView(new ArrayBuffer(8));
  let hash = 0x811c9dc5;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== size) return false;
    for (const value of row) {
      if (!Number.isFinite(value)) return false;
      word.setFloat64(0, value, true);
      for (let i = 0; i < 8; i++) hash = Math.imul(hash ^ word.getUint8(i), 0x01000193);
    }
  }
  return (hash >>> 0) === expected;
}

function inSpans(index: number, spans: readonly Span[]): boolean {
  return spans.some(([start, end]) => index >= start && index < end);
}

function complement(rows: Rows, spans: readonly Span[]): number[][] {
  return rows.filter((_, index) => !inSpans(index, spans)).map(row => [...row]);
}

/** Exact predecessor pane subset for the separate v293 decorative batch. */
export function charlottenburgCourtV333PreviousPanes(site: {
  readonly key: string;
  readonly sourceOwner: string;
  readonly panes: Rows;
}): ReadonlySet<number> | null {
  if (site.key !== KEY || site.sourceOwner !== OWNER || !matchesRows(site.panes, 485, 8, 3722785859)) return null;
  return new Set(site.panes.flatMap((_, index) => inSpans(index, PREVIOUS_PANES) ? [index] : []));
}

const FACES = [
  { from: [-5230.808, 1290.891], to: [-5217.658, 1298.308], central: false },
  { from: [-5217.128, 1297.144], to: [-5207.470, 1302.560], central: true },
  { from: [-5208.094, 1303.703], to: [-5194.756, 1311.225], central: false },
] as const;

const COLOUR = {
  plaster: 0xe1d3ba,
  stone: 0xc9b28e,
  raised: 0xd7c4a4,
  shade: 0xac9476,
  joint: 0xb59e80,
  granite: 0x807c73,
  glass: 0x334047,
  reflected: 0x526168,
  frame: 0x554b3d,
  oak: 0x583923,
  oakPanel: 0x704c30,
  iron: 0x312d29,
  relief: 0xb69e7d,
} as const;

type Feature =
  | { kind: "rectangle"; left: number; right: number; bottom: number; top: number; depth: number; out: number; color: number }
  | { kind: "shape"; points: Point[]; out: number; color: number };

function facade(length: number, central: boolean): Feature[] {
  const features: Feature[] = [];
  function rect(left: number, right: number, bottom: number, top: number, color: number, out = 0.11, depth = 0.08) {
    features.push({ kind: "rectangle", left, right, bottom, top, color, out, depth });
  }
  function centered(u: number, width: number, bottom: number, top: number, color: number, out = 0.11, depth = 0.08) {
    rect(u - width / 2, u + width / 2, bottom, top, color, out, depth);
  }
  function shape(points: Point[], color: number, out = 0.2) {
    features.push({ kind: "shape", points, color, out });
  }
  function arch(u: number, width: number, bottom: number, spring: number, rise: number, color: number, out: number) {
    const points: Point[] = [[u - width / 2, bottom], [u + width / 2, bottom]];
    for (let i = 0; i <= 12; i++) {
      const angle = Math.PI * i / 12;
      points.push([u + width / 2 * Math.cos(angle), spring + rise * Math.sin(angle)]);
    }
    shape(points, color, out);
  }
  function pane(u: number, width: number, bottom: number, top: number, arched = false) {
    const rise = arched ? width * .32 : 0;
    if (arched) {
      arch(u, width + .34, bottom - .13, top, rise + .16, COLOUR.raised, .22);
      arch(u, width, bottom, top, rise, COLOUR.glass, .24);
    } else {
      centered(u, width + .34, bottom - .13, top + .18, COLOUR.raised, .21);
      centered(u, width, bottom, top, COLOUR.glass, .26);
    }
    centered(u - width * .22, width * .35, bottom + .09, top - .1, COLOUR.reflected, .30);
    centered(u, .065, bottom, top + rise - .04, COLOUR.frame, .34);
    centered(u, width, bottom + (top - bottom) * .54, bottom + (top - bottom) * .54 + .07, COLOUR.frame, .34);
    centered(u, width + .48, bottom - .18, bottom - .06, COLOUR.stone, .33, .22);
  }
  function triangularHead(u: number, width: number, bottom: number, rise: number) {
    shape([[u - width / 2, bottom], [u + width / 2, bottom], [u, bottom + rise]], COLOUR.shade, .24);
    shape([[u - width / 2 + .19, bottom + .10], [u + width / 2 - .19, bottom + .10], [u, bottom + rise - .13]], COLOUR.raised, .29);
    centered(u, width + .12, bottom - .11, bottom, COLOUR.stone, .31, .16);
  }

  rect(.03, length - .03, 3.02, 4.15, COLOUR.granite, .095);
  rect(.03, length - .03, 4.15, 8.85, COLOUR.stone, .095);
  rect(.03, length - .03, 8.85, 19.6, central ? 0xd5bf9f : COLOUR.plaster, .095);
  for (let y = 4.45; y < 8.77; y += .52) {
    rect(.04, length - .04, y, y + .045, COLOUR.joint, .15);
  }
  for (const [bottom, height, out] of [[4.09, .14, .2], [8.67, .17, .23], [8.91, .15, .25], [14.55, .11, .19], [18.85, .15, .21], [19.24, .23, .32], [19.52, .21, .39]]) {
    rect(.025, length - .025, bottom, bottom + height, COLOUR.raised, out, .15);
  }
  for (let u = .31; !central && u < length - .18; u += .47) {
    centered(u, .21, 19.04, 19.26, COLOUR.raised, .30, .19);
  }

  if (!central) {
    for (const x of [.43, length - .43]) {
      centered(x, .68, 4.2, 18.84, COLOUR.stone, .17);
      for (let y = 4.28; y < 8.56; y += .52) centered(x, .74, y, y + .09, COLOUR.raised, .22);
    }
    for (const axis of [.17, .39, .61, .83]) {
      const u = axis * length;
      centered(u, .87, 3.46, 3.79, COLOUR.glass, .17);
      pane(u, 1.50, 5.03, 7.22, true);
      pane(u, 1.64, 10.04, 13.14);
      triangularHead(u, 2.24, 13.43, .53);
      pane(u, 1.60, 15.23, 17.77);
      centered(u, 2.14, 18.0, 18.12, COLOUR.raised, .25, .15);
    }
    return features;
  }

  const u = length / 2;
  for (const axis of [.17, .83]) {
    const x = axis * length;
    pane(x, 1.44, 5.04, 7.16, true);
    pane(x, 1.51, 10.10, 13.34);
    triangularHead(x, 2.05, 13.53, .43);
    pane(x, 1.48, 15.35, 17.80);
  }
  // Central paired timber door, moulded arch, glazed fanlight and open iron balcony.
  arch(u, 3.12, 3.73, 6.72, 1.43, COLOUR.shade, .27);
  arch(u, 2.81, 3.75, 6.66, 1.36, COLOUR.raised, .33);
  arch(u, 2.34, 3.80, 6.62, 1.13, COLOUR.glass, .39);
  centered(u, 2.34, 3.80, 6.72, COLOUR.oak, .43);
  for (const side of [-1, 1]) {
    const x = u + side * .59;
    centered(x, .92, 4.10, 5.25, COLOUR.oakPanel, .49);
    centered(x, .92, 5.47, 6.40, COLOUR.oakPanel, .49);
    centered(u + side * .52, .065, 6.65, 7.47, COLOUR.iron, .45);
    centered(u + side * 1.69, .24, 8.18, 8.72, COLOUR.shade, .39, .28);
    rect(u + side * .77 - .018, u + side * .77 + .018, 4.98, 5.32, COLOUR.iron, .54);
  }
  centered(u, .085, 3.82, 7.70, COLOUR.iron, .52);
  centered(u, 2.34, 6.60, 6.71, COLOUR.iron, .50);
  centered(u, 3.48, 3.55, 3.73, COLOUR.granite, .37, .42);
  centered(u, 3.83, 8.76, 9.06, COLOUR.raised, .64, .82);
  pane(u, 1.98, 9.52, 12.71, true);
  for (let x = -1.68; x <= 1.7; x += .23) centered(u + x, .054, 9.07, 10.09, COLOUR.iron, 1.01, .075);
  for (const y of [9.21, 10.04]) centered(u, 3.49, y, y + .08, COLOUR.iron, 1.01, .08);
  pane(u, 1.62, 15.30, 17.82);
  for (const x of [.47, length * .335, length * .665, length - .47]) {
    centered(x, .36, 9.27, 18.77, COLOUR.stone, .25, .19);
    centered(x, .22, 9.51, 18.54, COLOUR.raised, .36, .11);
    centered(x, .65, 9.20, 9.51, COLOUR.raised, .39, .23);
    centered(x, .70, 18.53, 18.84, COLOUR.raised, .39, .25);
  }
  centered(u, 9.21, 18.95, 19.21, COLOUR.stone, .30, .17);
  for (const path of letteringStrokePaths("KOENIGLICHES AMTSGERICHT", .275)) {
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1], [bx, by] = path[i];
      const width = Math.hypot(bx - ax, by - ay);
      if (!width) continue;
      const nx = (ay - by) * .024 / width, ny = (bx - ax) * .024 / width;
      // The source edge runs toward the viewer's left along this front.
      shape([[u - ax - nx, 19.11 + ay + ny], [u - bx - nx, 19.11 + by + ny], [u - bx + nx, 19.11 + by - ny], [u - ax + nx, 19.11 + ay - ny]], COLOUR.shade, .41);
    }
  }
  triangularHead(u, length - .17, 19.71, 3.08);
  shape([[u - .47, 21.08], [u + .47, 21.08], [u + .40, 20.45], [u, 20.20], [u - .40, 20.45]], COLOUR.relief, .34);
  for (const side of [-1, 1]) {
    const x = u + side * .79;
    shape([[x - .28, 20.30], [x + .28, 20.42], [x + .19, 20.77], [x - .19, 20.75]], COLOUR.relief, .34);
  }
  return features;
}

function frame(face: typeof FACES[number]) {
  const length = Math.hypot(face.to[0] - face.from[0], face.to[1] - face.from[1]);
  const dx = (face.to[0] - face.from[0]) / length, dz = (face.to[1] - face.from[1]) / length;
  return {
    length, dx,
    point(u: number, out: number): Point {
      return [face.from[0] + dx * u + dz * out, face.from[1] + dz * u - dx * out];
    },
    yaw: -Math.atan2(dz, dx),
  };
}

function shapeMesh(positions: number[], colors: number[]): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .88 });
  const mesh = new Mesh(geometry, day);
  mesh.name = "Charlottenburg plaza rounded heads and carved pediment";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  return mesh;
}

function addDrawn(root: Group) {
  const rows: number[][] = [], positions: number[] = [], colors: number[] = [];
  const color = new Color();
  for (const face of FACES) {
    const basis = frame(face);
    for (const feature of facade(basis.length, face.central)) {
      if (feature.kind === "rectangle") {
        const { left, right, bottom, top, out, depth } = feature;
        const [x, z] = basis.point((left + right) / 2, out);
        rows.push([x, (bottom + top) / 2, z, right - left, top - bottom, depth, basis.yaw, feature.color]);
      } else {
        const points = feature.points.map(([u, y]) => new Vector2(u, y));
        color.setHex(feature.color);
        for (const triangle of ShapeUtils.triangulateShape(points, [])) for (const i of triangle) {
          const [u, y] = feature.points[i], [x, z] = basis.point(u, feature.out);
          positions.push(x, y, z);
          colors.push(color.r, color.g, color.b);
        }
      }
    }
  }
  const batch = justicePalaceV183Boxes(rows);
  batch.name = "Charlottenburg plaza sandstone courses, windows and open iron balcony";
  root.add(batch, shapeMesh(positions, colors));
}

/** Native features mount against the retained occupied 1 m cardinal columns. */
function frontColumns(blocks: Rows): Map<number, number> {
  const columns = new Map<number, number>();
  for (const [x, y, z, w, h, d] of blocks) {
    if (y - h / 2 > 3 || y + h / 2 < 22.6) continue;
    const front = z - d / 2;
    for (let column = Math.max(-5231, x - w / 2); column < Math.min(-5195, x + w / 2); column++) {
      columns.set(column, Math.min(columns.get(column) ?? Infinity, front));
    }
  }
  return columns;
}

function boundsAt(points: readonly Point[], u: number): [number, number] | undefined {
  const crossings: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
    if ((u < x1) === (u < x2)) continue;
    crossings.push(y1 + (y2 - y1) * (u - x1) / (x2 - x1));
  }
  if (crossings.length < 2) return;
  return [Math.min(...crossings), Math.max(...crossings)];
}

function addNative(root: Group, blocks: Rows): boolean {
  const columns = frontColumns(blocks);
  if (columns.size !== 36) return false;
  const rows: number[][] = [];
  // Use a single owner for the narrow X-overlap of the projecting central bay and
  // the two setback wings. Every native fitting lies against an actual column.
  const areas: readonly Span[] = [[-5231, -5217], [-5217, -5207], [-5207, -5195]];
  FACES.forEach((face, faceIndex) => {
    const basis = frame(face), [areaLeft, areaRight] = areas[faceIndex];
    for (const feature of facade(basis.length, face.central)) {
      const xAt = (u: number) => face.from[0] + u * basis.dx;
      const left = Math.max(areaLeft, xAt(feature.kind === "rectangle" ? feature.left : Math.min(...feature.points.map(p => p[0]))));
      const right = Math.min(areaRight, xAt(feature.kind === "rectangle" ? feature.right : Math.max(...feature.points.map(p => p[0]))));
      for (let col = Math.floor(left); col < right; col++) {
        const x1 = Math.max(left, col), x2 = Math.min(right, col + 1), width = x2 - x1;
        if (width < .012) continue;
        const z = columns.get(col);
        if (z === undefined) continue;
        const center = (x1 + x2) / 2;
        if (feature.kind === "rectangle") {
          const { bottom, top, out, depth } = feature;
          rows.push([center, (top + bottom) / 2, z - out, width, top - bottom, depth, feature.color]);
        } else {
          // Two orthogonal samples per occupied metre retain the rounded head.
          const samples = width > .51 ? 2 : 1;
          for (let i = 0; i < samples; i++) {
            const x = x1 + width * (i + .5) / samples, u = (x - face.from[0]) / basis.dx;
            const vertical = boundsAt(feature.points, u);
            if (!vertical) continue;
            const [bottom, top] = vertical;
            if (top - bottom > .018) rows.push([x, (top + bottom) / 2, z - feature.out, width / samples, top - bottom, .026, feature.color]);
          }
        }
      }
    }
  });
  const batch = justicePalaceV183Boxes(rows, true);
  batch.name = "Charlottenburg plaza independent cardinal columns, portal and pediment";
  root.add(batch);
  return true;
}

/** Replace the old three plaza-facing fitting sets atomically. The LoD2 shell,
 * courtyard holes, roof and navigation are outside this companion's scope. */
export function createCharlottenburgCourtV333<Label>(site: SiteSource<Label>, native: boolean) {
  if (site.key !== KEY || site.owner !== OWNER) return null;
  const blocks = nativeBodies.sites.find(s => s.key === KEY && s.owners.length === 1 && s.owners[0] === OWNER)?.blocks;
  if (native
    ? !blocks || !matchesRows(blocks, 586, 7, 3532150945) || !matchesRows(site.nativeRows, 6331, 7, 4131734518)
    : !matchesRows(site.boxes, 2715, 8, 996002816) || !matchesRows(site.rods, 900, 8, 2177698203)) return null;

  const root = new Group();
  root.name = "Amtsgericht Charlottenburg – Platzfassade und Hauptportal";
  root.userData = {
    charlottenburgCourtV333: true, sourceOwner: OWNER, sourceFaces: [29, 41, 0],
    textureFree: true, sourceGeometryRetained: true, fullStaticDetailOnTouch: true,
    blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
  };
  if (native) {
    if (!blocks || !addNative(root, blocks)) return null;
  } else addDrawn(root);
  return {
    root: freezeStaticSceneTransforms(root),
    rows: native ? complement(site.nativeRows, PREVIOUS_NATIVE) : complement(site.boxes, PREVIOUS_DRAWN),
    rods: native ? [] : complement(site.rods, PREVIOUS_RODS),
    labels: site.labels,
  };
}
