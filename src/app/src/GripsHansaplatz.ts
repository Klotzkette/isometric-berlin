import {
  BoxGeometry,
  Color,
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
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  appendVoxelEnvelope,
  sourceMesh,
  type SourceEnvelopeBlock,
} from "./BebelplatzBuildingShells";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  bebelplatzPartContains,
  type BebelplatzSourcePart,
} from "./bebelplatzBuildingProfile";
import {
  GRIPS_HANSAPLATZ_PARTS as PARTS,
  GRIPS_HANSAPLATZ_SOURCE as source,
  GRIPS_ARCADE_POSTS,
  GRIPS_ENTRANCE,
  GRIPS_THEATRE_SOUTH,
  GRIPS_THEATRE_WEST,
  GRIPS_U9_WEST,
  gripsAxisLength,
  gripsAxisPoint,
  gripsHansaplatzRoofAt,
  gripsPartAxes,
  type GripsAxis,
} from "./gripsHansaplatzProfile";

type Point = [number, number, number];
const WHITE = 0xdedfd4,
  GREY = 0xbfc3bb,
  BLUE = 0x47777d,
  DARK = 0x303b3d;
const RED = 0xc73329,
  GLASS = 0x6c898d,
  BRICK = 0xd3cebc,
  JOINT = 0x969e96;
const UP = new Vector3(0, 1, 0);

/** Source-bound low buildings, open arcades, glass foyer and elevated link. */
export function createGripsHansaplatz(minecraft = false): Group {
  const root = new Group();
  root.name = minecraft
    ? "Block-native GRIPS and Hansaplatz court"
    : "GRIPS and Hansaplatz source architecture";
  root.userData = {
    textureFree: true,
    blockNative: minecraft,
    keepInMinecraft: minecraft,
    hiddenSolidInfill: false,
    sourceParents: source.buildings.map((b) => b.parent_id),
    courtyardAreas: source.courts.map((c) => c.area_m2),
  };
  const matrices: number[] = [],
    colours: number[] = [],
    matrix = new Matrix4(),
    paint = new Color(),
    q = new Quaternion();
  const box = (
    p: Point,
    s: Point,
    tone: number,
    rotation: Quaternion | number = 0,
  ) => {
    matrix.compose(
      new Vector3(...p),
      typeof rotation === "number"
        ? q.setFromAxisAngle(UP, rotation)
        : rotation,
      new Vector3(...s),
    );
    matrix.toArray(matrices, matrices.length);
    paint.setHex(tone).toArray(colours, colours.length);
  };
  const face = (
    a: GripsAxis,
    u: number,
    y: number,
    w: number,
    h: number,
    d: number,
    tone: number,
    out = 0.08,
  ) =>
    box(
      gripsAxisPoint(a, u, y, out),
      [w, h, d],
      tone,
      -Math.atan2(a.b[1] - a.a[1], a.b[0] - a.a[0]),
    );
  const beam = (a: Point, b: Point, w: number, tone: number) => {
    const direction = new Vector3(...b).sub(new Vector3(...a)),
      l = direction.length();
    if (l < 0.001) return;
    box(
      a.map((v, i) => (v + b[i]) / 2) as Point,
      [w, l, w],
      tone,
      new Quaternion().setFromUnitVectors(UP, direction.multiplyScalar(1 / l)),
    );
  };
  const label = (
    a: GripsAxis,
    u: number,
    y: number,
    text: string,
    h: number,
    tone: number,
    out: number,
    stroke = 0.08,
  ) => {
    for (const path of letteringStrokePaths(text, h))
      for (let i = 1; i < path.length; i++)
        beam(
          gripsAxisPoint(
            a,
            u - a.side * path[i - 1][0],
            y + path[i - 1][1],
            out,
          ),
          gripsAxisPoint(a, u - a.side * path[i][0], y + path[i][1], out),
          stroke,
          tone,
        );
  };
  const pane = (
    a: GripsAxis,
    u: number,
    y: number,
    w: number,
    h: number,
    out = minecraft ? 1.25 : 0.12,
  ) => {
    face(a, u, y, w, h, 0.09, GLASS, out);
    for (const sign of [-1, 1])
      face(a, u + (sign * w) / 2, y, 0.075, h + 0.08, 0.12, WHITE, out + 0.08);
    for (const yy of [y - h / 2, y + h / 2])
      face(a, u, yy, w + 0.08, 0.075, 0.12, WHITE, out + 0.08);
  };
  const shells: Mesh[] = [],
    blocks: SourceEnvelopeBlock[] = [];
  for (const part of PARTS) {
    const tone = {
      name: part.id,
      wall:
        part.role === "theatre" ? GREY : part.role === "bridge" ? DARK : BRICK,
      roof: 0x626c67,
    };
    if (minecraft) appendVoxelEnvelope(part, tone, blocks);
    else shells.push(sourceMesh([part], tone));
    // Keep the low roof's blue fascia and covered-gallery underside visible.
    if (part.openBelow && part.role !== "bridge")
      for (const a of gripsPartAxes(part)) {
        const l = gripsAxisLength(a);
        if (l < 0.2) continue;
        const segments = Math.ceil(l / 1.5);
        for (let i = 0; i < segments; i++) {
          const u = ((i + 0.5) * l) / segments,
            [x, , z] = gripsAxisPoint(a, u, 0, -0.02);
          const top =
            gripsHansaplatzRoofAt(part, x, z) ?? part.ground_y_m + 0.26;
          face(a, u, top - 0.12, l / segments, 0.25, 0.14, BLUE, 0);
        }
      }
    if (
      part.role === "shop" ||
      part.role === "service" ||
      part.role === "bridge"
    ) {
      for (const a of gripsPartAxes(part)) {
        const l = gripsAxisLength(a);
        if (l < 5.5) continue;
        const levels =
          part.role === "bridge"
            ? 1
            : part.height_m > 5.5 && part.height_m < 10
              ? 2
              : 1;
        const n = Math.floor(l / (part.role === "bridge" ? 3.3 : 3.6));
        for (let i = 0; i < n; i++) {
          const u = ((i + 0.5) * l) / n,
            [x, , z] = gripsAxisPoint(a, u, 0, 0.5);
          // Internal party walls never gain invented public storefronts.
          if (
            PARTS.some(
              (other) =>
                other !== part &&
                !other.openBelow &&
                bebelplatzPartContains(other, x, z),
            )
          )
            continue;
          for (let level = 0; level < levels; level++) {
            const y =
              part.role === "bridge"
                ? part.ground_y_m + 1.48
                : 6.75 + level * 2.75;
            const h = part.role === "bridge" ? 2.4 : level === 0 ? 2.65 : 1.65;
            if (y + h / 2 > part.top_y_m - 0.16) continue;
            pane(a, u, y, l / n - 0.2, h);
            if (part.role === "bridge") {
              const out = minecraft ? 1.45 : 0.34;
              for (const side of [-1, 1])
                beam(
                  gripsAxisPoint(
                    a,
                    u - (side * (l / n - 0.28)) / 2,
                    y - 1.16,
                    out,
                  ),
                  gripsAxisPoint(
                    a,
                    u + (side * (l / n - 0.28)) / 2,
                    y + 1.16,
                    out,
                  ),
                  0.06,
                  RED,
                );
              face(a, u, y - 1.4, l / n, 0.14, 0.3, BLUE, out);
            }
          }
        }
        if (part.role !== "bridge") {
          face(a, l / 2, 5.46, l, 0.3, 0.16, 0x858b83, minecraft ? 1.2 : 0.1);
          face(
            a,
            l / 2,
            Math.min(8.08, part.top_y_m - 0.4),
            l,
            0.16,
            0.24,
            WHITE,
            minecraft ? 1.25 : 0.18,
          );
        }
      }
    }
  }
  // Two measured little courts, and the paving directly under source canopies.
  // Never fill the whole complex with one plaza rectangle.
  const pavingRings = [
    ...source.courts.map((c) => c.ring),
    ...PARTS.filter(
      (p) => p.openBelow && p.role !== "bridge" && p.role !== "station",
    ).map((p) => p.ring),
  ];
  for (const ring of pavingRings) {
    const part: BebelplatzSourcePart = {
      id: "Hansaplatz source court",
      ring,
      holes: [],
      ground_y_m: 5.19,
      top_y_m: 5.23,
      height_m: 0.04,
      surfaces: [
        { kind: "RoofSurface", rings: [ring.map(([x, z]) => [x, 5.23, z])] },
      ],
    };
    if (minecraft)
      appendVoxelEnvelope(
        part,
        { name: part.id, wall: 0x979c94, roof: 0x979c94 },
        blocks,
      );
    else
      shells.push(
        sourceMesh([part], { name: part.id, wall: 0x979c94, roof: 0x979c94 }),
      );
    const minX = Math.min(...ring.map((p) => p[0])),
      maxX = Math.max(...ring.map((p) => p[0]));
    const minZ = Math.min(...ring.map((p) => p[1])),
      maxZ = Math.max(...ring.map((p) => p[1]));
    for (let x = Math.ceil(minX / 1.5) * 1.5; x < maxX; x += 1.5)
      for (let z = Math.ceil(minZ / 1.5) * 1.5; z < maxZ; z += 1.5)
        if (
          bebelplatzPartContains(part, x, z) &&
          bebelplatzPartContains(part, x + 0.67, z) &&
          bebelplatzPartContains(part, x - 0.67, z)
        )
          box([x, 5.238, z], [1.35, 0.016, 0.026], 0x7b827c);
  }
  for (const [x, z, top] of GRIPS_ARCADE_POSTS)
    box([x, (top + 5.2) / 2, z], [0.18, top - 5.2, 0.18], BLUE);

  // GRIPS' glazed east foyer: two paired doors, transoms, tiled end piers.
  const entry = GRIPS_ENTRANCE,
    entryL = gripsAxisLength(entry),
    entryOut = minecraft ? 1.27 : 0.17;
  for (let i = 0; i < 8; i++)
    pane(
      entry,
      ((i + 0.5) * entryL) / 8,
      6.81,
      entryL / 8 - 0.09,
      2.95,
      entryOut,
    );
  face(entry, entryL / 2, 7.72, entryL, 0.09, 0.11, WHITE, entryOut + 0.14);
  for (const u of [entryL * 0.3, entryL * 0.72]) {
    face(entry, u, 6.55, 2.08, 2.45, 0.12, DARK, entryOut + 0.21);
    for (const side of [-1, 1]) {
      pane(entry, u + side * 0.5, 6.56, 0.94, 2.37, entryOut + 0.31);
      face(
        entry,
        u + side * 0.12,
        6.4,
        0.045,
        0.36,
        0.1,
        WHITE,
        entryOut + 0.45,
      );
    }
  }
  face(entry, entryL * 0.62, 8.16, 6.5, 0.48, 0.18, RED, entryOut + 0.3);
  label(
    entry,
    entryL * 0.62,
    7.98,
    "GRIPS THEATER",
    0.33,
    WHITE,
    entryOut + 0.42,
    0.05,
  );
  label(entry, entryL - 0.5, 7.35, "22", 0.42, DARK, entryOut + 0.42, 0.055);

  // Street-side metal panels, bold red identity and the real external spiral stair.
  const west = GRIPS_THEATRE_WEST,
    wl = gripsAxisLength(west),
    wo = minecraft ? 1.3 : 0.13;
  for (let i = 0; i <= 12; i++)
    face(west, (i * wl) / 12, 9.32, 0.035, 8.25, 0.09, JOINT, wo);
  face(west, wl / 2, 8.25, wl, 0.14, 0.12, RED, wo + 0.08);
  face(west, wl / 2, 13.38, wl, 0.14, 0.12, RED, wo + 0.08);
  label(west, wl * 0.59, 11.3, "GRIPS", 1.6, RED, wo + 0.2, 0.22);
  label(west, wl * 0.56, 9.05, "THEATER", 1.34, RED, wo + 0.2, 0.21);
  // Restrained colour fields identify the mural zone without copying posters.
  const south = GRIPS_THEATRE_SOUTH,
    sl = gripsAxisLength(south),
    so = minecraft ? 1.3 : 0.12;
  face(south, sl / 2, 11.08, sl, 4.23, 0.1, 0xbd7a69, so);
  for (let i = 0; i < 22; i++) {
    const u = ((i + 0.5) * sl) / 22,
      h = 1.55 + (i % 3) * 0.22;
    face(
      south,
      u,
      10.25,
      0.58,
      h,
      0.1,
      i % 3 === 0 ? 0x697674 : 0xd3cebc,
      so + 0.08,
    );
    face(south, u, 10.25 + h / 2, 0.65, 0.55, 0.12, 0xb2b8ad, so + 0.1);
  }
  label(south, sl * 0.73, 12, "GRIPS", 0.73, DARK, so + 0.2, 0.095);
  const [sx, , sz] = gripsAxisPoint(west, 1.85, 0, wo + 1.4),
    steps = 28;
  box([sx, 7.3, sz], [0.16, 4.2, 0.16], BLUE);
  let previous: Point | null = null;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2.4,
      y = 5.28 + i * 0.145;
    box(
      [sx + Math.cos(a) * 0.64, y, sz + Math.sin(a) * 0.64],
      [1.25, 0.09, 0.32],
      RED,
      -a,
    );
    const edge: Point = [
      sx + Math.cos(a) * 1.2,
      y + 1.0,
      sz + Math.sin(a) * 1.2,
    ];
    beam([edge[0], y, edge[2]], edge, 0.04, BLUE);
    if (previous) beam(previous, edge, 0.045, BLUE);
    previous = edge;
  }
  face(west, 1.85, 10.3, 1.55, 2.4, 0.2, DARK, wo + 0.2);

  // U9's long western glass-block wall and roof-mounted red theatre letters.
  const station = GRIPS_U9_WEST,
    l = gripsAxisLength(station);
  face(station, l / 2, 6.78, l, 3.15, 0.24, WHITE, 0);
  face(station, l * 0.52, 6.79, l * 0.62, 2.98, 0.04, 0xa2b7ad, 0.14);
  for (let u = l * 0.21; u < l * 0.83; u += 0.29)
    face(station, u, 6.79, 0.026, 2.98, 0.04, WHITE, 0.18);
  for (let y = 5.31; y < 8.32; y += 0.29)
    face(station, l * 0.52, y, l * 0.62, 0.026, 0.04, WHITE, 0.18);
  for (let y = 5.25; y < 8.45; y += 0.19) {
    face(station, l * 0.09, y, l * 0.18, 0.022, 0.04, JOINT, 0.145);
    face(station, l * 0.93, y, l * 0.14, 0.022, 0.04, JOINT, 0.145);
  }
  label(station, l * 0.51, 8.77, "GRIPS THEATER", 0.78, RED, 0.12, 0.13);
  const u9: GripsAxis = { a: [-2007.351, 9.45], b: [-1997.673, 8.4], side: -1 };
  face(u9, 6.7, 8.98, 3.7, 0.48, 0.16, 0x28648a, 0);
  label(u9, 6.7, 8.82, "U HANSAPLATZ", 0.26, WHITE, 0.12, 0.035);
  for (let i = 0; i < 5; i++) {
    const a = gripsAxisPoint(station, 3 + i * 1.4, 5.24, 1.4),
      b = gripsAxisPoint(station, 3 + i * 1.4, 5.95, 1.4);
    beam(a, b, 0.05, 0x7f8987);
    beam(b, gripsAxisPoint(station, 3 + i * 1.4, 5.95, 2.1), 0.05, 0x7f8987);
    beam(
      gripsAxisPoint(station, 3 + i * 1.4, 5.95, 2.1),
      gripsAxisPoint(station, 3 + i * 1.4, 5.24, 2.1),
      0.05,
      0x7f8987,
    );
  }
  for (const b of blocks) box(b.position, b.size, b.color);
  if (shells.length) {
    const geometry = mergeGeometries(shells.map((s) => s.geometry));
    if (!geometry) throw new Error("GRIPS source sheets could not be merged");
    const first = shells[0],
      mesh = new Mesh(geometry, first.material);
    mesh.userData = {
      ...first.userData,
      sourcePartIds: PARTS.map((part) => part.id),
      sourceGeometryUnchanged: false, // Explicit street translation and open lower walls.
    };
    mesh.name = "GRIPS original envelopes and open public-space roofs";
    root.add(mesh);
    shells.forEach((s, i) => {
      s.geometry.dispose();
      if (i) {
        s.userData.dayMaterial.dispose();
        s.userData.nightMaterial.dispose();
      }
    });
  }
  const geometry = new BoxGeometry();
  geometry.deleteAttribute("uv");
  const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
  const nightMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    flatShading: true,
  });
  const mesh = new InstancedMesh(geometry, dayMaterial, 0);
  mesh.count = matrices.length / 16;
  mesh.instanceMatrix = new InstancedBufferAttribute(
    new Float32Array(matrices),
    16,
  );
  mesh.instanceColor = new InstancedBufferAttribute(
    new Float32Array(colours),
    3,
  );
  mesh.name = "GRIPS glazing, signs, posts and Hansaplatz facade details";
  mesh.userData = {
    dayMaterial,
    nightMaterial,
    textureFree: true,
    blockNative: minecraft,
  };
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
