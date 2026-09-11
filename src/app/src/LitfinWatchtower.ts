import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

type V3 = readonly [number, number, number];
type Box = {
  p: V3;
  size: V3;
  color: number;
  cue: string;
  fine?: boolean;
  solid?: boolean;
};
export type LitfinOptions = { mobileLike?: boolean };

/** Metric envelope and visual articulation deliberately have separate status. */
export const LITFIN_WATCHTOWER_PROFILE = {
  bodyHeightM: 8.946,
  centerWorldM: [-107.991, 5.2, -1652.087] as const,
  id: "litfin-watchtower",
  lod2BuildingPartId: "1pC0000R",
  lod2BuildingPartFullId: "DEBE01AL1pC0000R",
  name: "Gedenkstätte Günter Litfin im ehemaligen Führungsturm Kieler Eck",
  osmKey: "way/31347999",
  osmWayId: "31347999",
  railingHeightM: 1.05,
  roofFootprintM: [4.15, 4.16] as const,
  rotationY: 0.46,
  shaftFootprintM: [3.65, 3.65] as const,
  smallWindowCount: 8,
  sourceUrl: "https://www.openstreetmap.org/way/31347999",
  sourceUrls: [
    "https://www.openstreetmap.org/way/31347999",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040270",
    "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-berliner-mauer/mauer-denkmale/fuehrungsstelle-kieler-eck-648149.php",
    "https://www.stiftung-berliner-mauer.de/de/gedenkstaette-guenter-litfin",
  ] as const,
  upperPaneCount: 16,
  publishedFootprintConflict: {
    monumentDatabaseM: [3, 3],
    currentLdaAccountM: [4.2, 4.2],
    choice:
      "retain the independent LoD2 plan and 8.946 m height; 3.65 m local shaft is a non-surveyed visual estimate inside the source roof envelope",
  },
  recognitionCues: [
    "continuous square shaft and observation storey",
    "four silver-framed wire-glass panes on each side",
    "two small horizontal openings on each middle-storey face",
    "horizontal precast seams and weathered grey-beige render",
    "thin projecting roof slab, silver two-course guard rail and corner downpipes",
    "memorial plaque on northeast face and doorway on northwest face",
    "raised terrace, ribbed edge, steps and separate information panel",
  ] as const,
  visualReferenceTitles: [
    "File:Gedenkstätte Günter Litfin, Kieler Straße 2, Berlin-Mitte.jpg",
    "File:Gedenkstätte Günter Litfin Berlin.jpg",
    "File:Günter Litfin Memorial.jpg",
    "File:Watchtower - Berlin - Stierch A 01.jpg",
    "File:Watchtower - Berlin - Stierch A 02.jpg",
  ] as const,
} as const;
const P = LITFIN_WATCHTOWER_PROFILE;
const CONCRETE = 0xaaa596;
const EDGE = 0x777a70;
const STEEL = 0xc0c8c5;
const GLASS = 0x536064;
const DARK = 0x424b49;

/** Local boxes are shared by drawn geometry, block surface sampling and collision. */
export function litfinWatchtowerBoxes(mobileLike = false): readonly Box[] {
  const boxes: Box[] = [];
  const add = (
    p: V3,
    size: V3,
    color: number,
    cue: string,
    solid = false,
    fine = false,
  ): void => {
    boxes.push({ p, size, color, cue, solid, fine });
  };
  const half = P.shaftFootprintM[0] / 2;
  const face = (
    side: number,
    u: number,
    y: number,
    depth: number,
    w: number,
    h: number,
    d: number,
    color: number,
    cue: string,
    fine = false,
  ): void => {
    if (side === 0) add([u, y, depth], [w, h, d], color, cue, false, fine);
    if (side === 1) add([depth, y, -u], [d, h, w], color, cue, false, fine);
    if (side === 2) add([-u, y, -depth], [w, h, d], color, cue, false, fine);
    if (side === 3) add([-depth, y, u], [d, h, w], color, cue, false, fine);
  };
  add([0, 3.61, 0], [3.65, 7.22, 3.65], CONCRETE, "shaft", true);
  add([0, 8.445, 0], [3.65, 0.47, 3.65], CONCRETE, "observation-header", true);
  for (const x of [-half + 0.12, half - 0.12]) {
    for (const z of [-half + 0.12, half - 0.12])
      add(
        [x, 7.715, z],
        [0.24, 0.99, 0.24],
        CONCRETE,
        "observation-corner",
        true,
      );
  }
  add(
    [0, P.bodyHeightM - 0.14, 0],
    [4.15, 0.28, 4.16],
    0x96978b,
    "roof-slab",
    true,
  );
  add(
    [0, P.bodyHeightM - 0.025, 0],
    [4.13, 0.05, 4.14],
    0x626c69,
    "roof-cover",
  );
  for (let side = 0; side < 4; side += 1) {
    // Repeated seams and window bands remain structural at ordinary zoom.
    for (const y of [1.18, 2.39, 3.6, 4.81, 6.02, 7.22]) {
      face(
        side,
        0,
        y,
        half + 0.003,
        3.65,
        0.022,
        0.016,
        0x929385,
        "precast-seam",
      );
    }
    face(
      side,
      0,
      7.715,
      half - 0.055,
      3.18,
      1.025,
      0.045,
      DARK,
      "observation-recess",
    );
    for (let pane = 0; pane < 4; pane += 1) {
      const u = -1.155 + pane * 0.77;
      face(
        side,
        u,
        7.715,
        half - 0.017,
        0.713,
        0.9,
        0.033,
        GLASS + ((pane + side) % 3) * 0x030302,
        "upper-pane",
      );
      // Fine wire-glass cues are sparse, never a photographic raster.
      if (!mobileLike)
        for (const yy of [7.49, 7.715, 7.94])
          face(
            side,
            u,
            yy,
            half + 0.003,
            0.71,
            0.009,
            0.01,
            0x84908c,
            "wire-glass",
            true,
          );
    }
    for (let mullion = 0; mullion < 5; mullion += 1)
      face(
        side,
        -1.54 + mullion * 0.77,
        7.715,
        half + 0.006,
        0.054,
        0.98,
        0.065,
        STEEL,
        "upper-frame",
      );
    for (const y of [7.235, 8.195])
      face(side, 0, y, half + 0.006, 3.14, 0.047, 0.065, STEEL, "upper-frame");
    for (const u of [-0.94, 0.94]) {
      face(
        side,
        u,
        3.94,
        half + 0.012,
        0.51,
        0.3,
        0.043,
        0xc6ccc7,
        "small-reveal",
      );
      face(
        side,
        u,
        3.947,
        half + 0.036,
        0.36,
        0.19,
        0.018,
        0x65716f,
        "small-pane",
      );
      face(
        side,
        u,
        3.881,
        half + 0.047,
        0.32,
        0.036,
        0.02,
        0xa6ada5,
        "small-sill",
      );
    }
    // Small irregular plaster repairs are bounded interpretations, not traced photographs.
    for (let i = 0; i < (mobileLike ? 4 : 8); i += 1) {
      const u = -1.35 + ((i * 37 + side * 13) % 25) * 0.11;
      const y = 0.7 + ((i * 17 + side * 3) % 26) * 0.23;
      face(
        side,
        u,
        y,
        half + 0.012,
        0.09 + (i % 3) * 0.1,
        0.04 + (i % 4) * 0.075,
        0.012,
        i % 2 ? 0xb4b2a4 : 0x9b9d8e,
        "weathered-render",
        true,
      );
    }
  }
  // Northeast plaque face (+local X) is separate from northwest entrance (-local Z).
  add([half + 0.045, 2.58, 0], [0.08, 1.02, 0.82], 0xc7ceca, "memorial-plaque");
  add(
    [half + 0.09, 2.86, 0],
    [0.01, 0.075, 0.57],
    0x5f6867,
    "plaque-heading",
    false,
    true,
  );
  for (const y of [2.65, 2.54, 2.43, 2.32])
    add(
      [half + 0.09, y, 0],
      [0.01, 0.012, 0.6],
      0x909d97,
      "unlettered-plaque-lines",
      false,
      true,
    );
  add([half + 0.035, 4.42, 0], [0.055, 0.21, 0.18], 0xdce1d7, "monument-badge");
  add(
    [half + 0.068, 4.42, 0],
    [0.02, 0.14, 0.09],
    0x397390,
    "monument-blue-field",
  );
  for (const z of [-1.0, 1.0])
    add([half + 0.025, 2.59, z], [0.048, 0.16, 0.3], DARK, "lower-vent");
  add([0.18, 1.45, -half - 0.035], [0.93, 2.17, 0.085], 0x889598, "door", true);
  add(
    [0.18, 2.58, -half - 0.045],
    [1.06, 0.075, 0.105],
    0xc7cec8,
    "door-lintel",
  );
  add(
    [0.57, 1.39, -half - 0.092],
    [0.044, 0.17, 0.036],
    STEEL,
    "door-handle",
    false,
    true,
  );
  add(
    [-1.14, 1.68, -half - 0.18],
    [0.67, 2.64, 0.35],
    0x9d9f92,
    "ventilation-annexe",
    true,
  );
  add(
    [-1.14, 2.95, -half - 0.25],
    [0.84, 0.14, 0.5],
    EDGE,
    "ventilation-cap",
    true,
  );
  add(
    [-1.14, 2.32, -half - 0.37],
    [0.47, 0.74, 0.045],
    DARK,
    "ventilation-grille",
  );
  if (!mobileLike)
    for (let i = 0; i < 10; i += 1)
      add(
        [-1.14, 1.99 + i * 0.068, -half - 0.4],
        [0.47, 0.02, 0.018],
        0x949f9a,
        "ventilation-slats",
        false,
        true,
      );

  // Silver roof railing and perimeter gutter; no historical searchlight is invented.
  for (let side = 0; side < 4; side += 1) {
    face(side, 0, 8.915, 2.055, 4.18, 0.12, 0.11, EDGE, "gutter");
    for (const y of [9.47, 9.976])
      face(side, 0, y, 1.975, 3.99, 0.038, 0.038, STEEL, "roof-rail");
    for (const u of [-1.97, -0.66, 0.66, 1.97])
      face(side, u, 9.461, 1.975, 0.042, 1.03, 0.042, STEEL, "roof-post");
  }
  for (const x of [-half - 0.035, half + 0.035]) {
    add([x, 4.3, -half - 0.055], [0.085, 8.5, 0.085], STEEL, "downpipe");
    add([x, 8.63, -half - 0.13], [0.09, 0.19, 0.23], STEEL, "downpipe-elbow");
  }
  // Terraced approach stays outside the small tower footprint and keeps its ends open.
  add([2.38, 0.3, 0.1], [1.1, 0.6, 4.75], 0x93998d, "terrace", true);
  add([2.38, 0.625, 0.1], [1.1, 0.05, 4.75], 0xa6ad9e, "terrace-paving", true);
  for (let step = 0; step < 4; step += 1)
    add(
      [2.38, 0.075 * (step + 1), -3.295 + step * 0.29],
      [1.1, 0.15 * (step + 1), 0.3],
      0x999f92,
      "approach-step",
      true,
    );
  for (let i = 0; i < (mobileLike ? 12 : 20); i += 1)
    add(
      [2.95, 0.3, -2.15 + (i * 4.5) / (mobileLike ? 11 : 19)],
      [0.1, 0.6, 0.075],
      0x818b7e,
      "ribbed-retaining-edge",
    );
  for (const y of [1.14, 1.64])
    add([2.94, y, 0.15], [0.045, 0.042, 4.5], STEEL, "terrace-rail", true);
  for (const z of [-2.1, -0.6, 0.9, 2.4])
    add([2.94, 1.14, z], [0.045, 1.0, 0.045], STEEL, "terrace-post", true);
  add(
    [2.98, 1.24, 1.61],
    [0.075, 0.78, 1.28],
    0xd5dfd8,
    "information-panel",
    true,
  );
  // Caption blocks convey the panel's layout without reproducing text or images.
  for (let i = 0; i < 3; i += 1)
    add(
      [3.025, 1.4, 1.16 + i * 0.43],
      [0.014, 0.19, 0.28],
      0x9ab5b5,
      "information-column",
      false,
      true,
    );
  add(
    [3.025, 1.09, 1.69],
    [0.014, 0.2, 0.66],
    0x587876,
    "information-lower-field",
    false,
    true,
  );
  return boxes;
}

function makeBatch(boxes: readonly Box[], name: string): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const mesh = new InstancedMesh(
    geometry,
    new MeshStandardMaterial({ roughness: 0.88, metalness: 0.08 }),
    boxes.length,
  );
  mesh.name = name;
  const matrix = new Matrix4();
  const q = new Quaternion();
  const color = new Color();
  for (let i = 0; i < boxes.length; i += 1) {
    const b = boxes[i];
    matrix.compose(new Vector3(...b.p), q, new Vector3(...b.size));
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, color.setHex(b.color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor!.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.cueCounts = Object.fromEntries(
    [...new Set(boxes.map((b) => b.cue))].map((cue) => [
      cue,
      boxes.filter((b) => b.cue === cue).length,
    ]),
  );
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}
function makeRoot(blockNative: boolean): Group {
  const root = new Group();
  root.name = blockNative
    ? "Minecraft Günter Litfin source-bound watchtower"
    : "Günter Litfin watchtower exact Day protected";
  root.position.set(...P.centerWorldM);
  root.rotation.y = P.rotationY;
  root.userData = {
    blockNative,
    schwellenraumGeschuetzt: true,
    memorialProtected: true,
    memorialProtection: true,
    exactDayAppearance: true,
    sourceKeys: [P.osmKey, `LoD2/${P.lod2BuildingPartFullId}`],
    motionPolicy: "static in every mode",
    texturePolicy:
      "procedural geometry and colors only; no reference image loaded",
    geometryStatus:
      "source envelope retained; current facade and terrace dimensions are visual estimates",
  };
  return root;
}
export function createLitfinWatchtower(options: LitfinOptions = {}): Group {
  const root = makeRoot(false);
  const boxes = litfinWatchtowerBoxes(false);
  root.add(
    makeBatch(
      boxes.filter((b) => !b.fine),
      "Günter Litfin structural concrete glazing terrace and silver rails",
    ),
  );
  const fine = new Group();
  fine.name = "Günter Litfin watchtower fine detail";
  fine.userData.detailFadeM = [65, 150];
  fine.add(
    makeBatch(
      boxes.filter((b) => b.fine),
      "Günter Litfin wire glass surface repairs and unlettered panels",
    ),
  );
  root.add(fine);
  return root;
}

/** Surface-only cubes avoid the old 0.75 m filled tower and broken dotted roof rail. */
export function createMinecraftLitfinWatchtower(
  options: LitfinOptions = {},
): Group {
  const root = makeRoot(true);
  const step = options.mobileLike ? 0.24 : 0.18;
  const cubes = new Map<string, Box>();
  // Small openings must win their coarse cells over sub-cell reveal/sill cues.
  const source = [...litfinWatchtowerBoxes(options.mobileLike)].sort(
    (a, b) => Number(a.cue === "small-pane") - Number(b.cue === "small-pane"),
  );
  for (const b of source) {
    if (b.fine) continue;
    const n = b.size.map((v) => Math.max(1, Math.ceil(v / step)));
    // Keeping only a box's surface allows concrete backing and each reading layer to share a grid.
    for (let x = 0; x < n[0]; x += 1)
      for (let y = 0; y < n[1]; y += 1)
        for (let z = 0; z < n[2]; z += 1) {
          if (
            x > 0 &&
            x < n[0] - 1 &&
            y > 0 &&
            y < n[1] - 1 &&
            z > 0 &&
            z < n[2] - 1
          )
            continue;
          const p = [x, y, z].map(
            (i, axis) =>
              Math.round(
                (b.p[axis] -
                  b.size[axis] / 2 +
                  ((i + 0.5) * b.size[axis]) / n[axis]) /
                  step,
              ) * step,
          ) as [number, number, number];
          cubes.set(p.map((v) => Math.round(v / step)).join(","), {
            p,
            size: [step, step, step],
            color: b.color,
            cue: b.cue,
          });
        }
  }
  const batch = makeBatch(
    [...cubes.values()],
    "Minecraft Günter Litfin continuous block surfaces",
  );
  batch.userData.blockNative = true;
  batch.userData.blockPalette = "litfin";
  root.add(batch);
  root.userData.instanceCount = cubes.size;
  root.userData.drawCallCount = 1;
  return root;
}
const SOLIDS = litfinWatchtowerBoxes().filter(
  (b) =>
    b.solid ||
    ["upper-pane", "observation-recess", "roof-rail", "roof-post"].includes(
      b.cue,
    ),
);
export function litfinWatchtowerSolidAt(
  x: number,
  y: number,
  z: number,
  bodyRadius = 0,
): boolean {
  const dx = x - P.centerWorldM[0];
  const dz = z - P.centerWorldM[2];
  const lx = Math.cos(P.rotationY) * dx - Math.sin(P.rotationY) * dz;
  const lz = Math.sin(P.rotationY) * dx + Math.cos(P.rotationY) * dz;
  const ly = y - P.centerWorldM[1];
  return SOLIDS.some(
    (b) =>
      Math.abs(lx - b.p[0]) <= b.size[0] / 2 + bodyRadius &&
      Math.abs(ly - b.p[1]) <= b.size[1] / 2 + bodyRadius &&
      Math.abs(lz - b.p[2]) <= b.size[2] / 2 + bodyRadius,
  );
}
