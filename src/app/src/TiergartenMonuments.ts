import {
  BoxGeometry,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";
import type { StreetDetailsPayload } from "./TrafficSignals";

/**
 * "Alle Denkmäler im Tiergarten supergenau isometrisch": every OSM
 * monument/memorial inside the bounds gets a drawn model in the
 * ligne-claire city. The seven landmarks the verified recognition
 * layer already models in full (Holocaust stelae field, Soviet War
 * Memorial with its T-34s, Sinti-und-Roma, Homosexuellen-Denkmal,
 * Goethe, the composers, Zeugen Jehovas) are skipped here; this layer
 * adds everything else — the Potsdamer Platz Verkehrsturm replica,
 * the Euthanasie memorial's blue glass wall, the ML-20 howitzers, the
 * Weiße Kreuze, the Fahne der Einheit, the Grundgesetz-49 glass
 * panels, statues on plinths for Lessing/Grimm/Bruno/Der Rufer, and
 * small stones for the quiet markers. Positions and footprints are
 * OSM (ODbL); the drawing is ours.
 */

export const MONUMENT_INK = 0x716c62;

const STONE = 0x8f8a80;
const STONE_LIGHT = 0xb9b6ac;
const BRONZE = 0x5d7264;
const SOVIET_GREEN = 0x6b7a5c;
const DARK_CUBE = 0x8f9497;
const WHITE = 0xf2f2ee;
const GLASS_BLUE = 0x5f9fc4;
const TOWER_GREEN = 0x4a6b52;
const MARBLE = 0xe8e5dc;
const GRANITE_RED = 0x9d7a6e;
const CANOPY_ROOF = 0xa8543f;
const CANOPY_POST = 0x7d7a72;

type Builder = {
  edges: BufferGeometry[];
  parts: BufferGeometry[];
};

function box(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  rotationY = 0,
): void {
  const geometry = new BoxGeometry(sx, sy, sz);
  if (rotationY !== 0) {
    geometry.rotateY(rotationY);
  }
  geometry.translate(cx, cy, cz);
  geometry.deleteAttribute("uv");
  const paint = new Color(color);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    colors[index * 3] = paint.r;
    colors[index * 3 + 1] = paint.g;
    colors[index * 3 + 2] = paint.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  builder.parts.push(geometry);
  builder.edges.push(new EdgesGeometry(geometry, 24));
}

/** Small stone marker for plaques and quiet memorials. */
function buildStone(builder: Builder, x: number, y: number, z: number): void {
  box(builder, STONE, x, y + 0.35, z, 0.9, 0.7, 0.6);
}

/** Statue on a plinth: the poets, philosophers and callers. */
function buildStatue(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  const scale = 1;
  box(builder, STONE, x, y + 0.4 * scale, z, 3 * scale, 0.8 * scale, 3 * scale);
  box(
    builder, STONE_LIGHT,
    x, y + (0.8 + 0.9) * scale, z,
    1.6 * scale, 1.8 * scale, 1.6 * scale,
  );
  box(
    builder, BRONZE,
    x, y + (2.6 + 1.1) * scale, z,
    1 * scale, 2.2 * scale, 1 * scale,
  );
}

function buildCannon(builder: Builder, x: number, y: number, z: number): void {
  box(builder, STONE, x, y + 0.5, z, 5.6, 1, 3);
  box(builder, SOVIET_GREEN, x, y + 1.5, z, 3.4, 1, 1.4);
  box(builder, SOVIET_GREEN, x + 2.2, y + 2.1, z, 4.4, 0.32, 0.32);
}

/** The 1924 Verkehrsturm replica: the Potsdamer Platz light tower. */
function buildVerkehrsturm(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  box(builder, TOWER_GREEN, x, y + 2.8, z, 0.55, 5.6, 0.55);
  box(builder, TOWER_GREEN, x, y + 6.9, z, 2.5, 2.6, 2.5, Math.PI / 5);
  box(builder, WHITE, x, y + 7.55, z, 2.62, 0.55, 2.62, Math.PI / 5);
  const lampTones = [0xff453a, 0xffb63b, 0x30d158];
  lampTones.forEach((tone, index) => {
    box(builder, tone, x, y + 7 - index * 0.62, z + 1.32, 0.34, 0.34, 0.12);
    box(builder, tone, x, y + 7 - index * 0.62, z - 1.32, 0.34, 0.34, 0.12);
  });
  box(builder, TOWER_GREEN, x, y + 8.5, z, 1.4, 0.8, 1.4, Math.PI / 5);
}

/** The Euthanasie (T4) memorial's long blue glass wall. */
function buildBlueWall(builder: Builder, x: number, y: number, z: number): void {
  box(builder, DARK_CUBE, x, y + 0.15, z, 26, 0.3, 3.2);
  box(builder, GLASS_BLUE, x, y + 1.6, z, 24, 2.6, 0.35);
}

function buildWhiteCrosses(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  for (let index = -3; index <= 3; index += 1) {
    const px = x + index * 1.4;
    box(builder, WHITE, px, y + 1.05, z, 0.14, 1.8, 0.14);
    box(builder, WHITE, px, y + 1.45, z, 0.7, 0.14, 0.14);
  }
}

function buildUnityFlag(builder: Builder, x: number, y: number, z: number): void {
  box(builder, STONE, x, y + 0.3, z, 2.2, 0.6, 2.2);
  box(builder, 0x8e9a9e, x, y + 7.1, z, 0.18, 13, 0.18);
  box(builder, 0x1c1c1c, x + 1.3, y + 12.5, z, 2.4, 0.55, 0.1);
  box(builder, 0xb03434, x + 1.3, y + 11.95, z, 2.4, 0.55, 0.1);
  box(builder, 0xd9a92e, x + 1.3, y + 11.4, z, 2.4, 0.55, 0.1);
}

/** Grundgesetz 49: the row of glass panels along the Spree. */
function buildGlassPanels(builder: Builder, x: number, y: number, z: number): void {
  for (let index = -2; index <= 2; index += 1) {
    box(builder, GLASS_BLUE, x + index * 5.4, y + 1.5, z, 4.6, 2.6, 0.3);
  }
}

/**
 * Eberlein's 1903 Carrara marble group under the flat reddish roof that
 * was put over it to keep the weather off the marble. The roof is the
 * thing you recognise the monument by from any distance, so it is drawn
 * as its own element: four slim posts and a low overhanging canopy.
 */
function buildWagnerMemorial(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  box(builder, STONE_LIGHT, x, y + 0.35, z, 8, 0.7, 6.4);
  box(builder, MARBLE, x, y + 1.5, z, 4.6, 1.6, 3.4);
  // Wagner sits; the allegorical figures crouch around the base.
  box(builder, MARBLE, x, y + 3.1, z - 0.3, 1.7, 1.8, 1.5);
  box(builder, MARBLE, x, y + 4.3, z - 0.3, 1.1, 0.7, 1.1);
  for (const [dx, dz] of [
    [-1.7, 1.2],
    [1.7, 1.2],
  ]) {
    box(builder, MARBLE, x + dx, y + 2.9, z + dz, 1, 1.2, 1);
  }
  for (const dx of [-3.6, 3.6]) {
    for (const dz of [-2.8, 2.8]) {
      box(builder, CANOPY_POST, x + dx, y + 3.4, z + dz, 0.24, 6.1, 0.24);
    }
  }
  // The real 1987/88 Schutzdach (Marianne Wagner, architect) is a steel
  // barrel vault under plexiglass, not a flat gable -- five stepped
  // slabs of shrinking width approximate the half-round cross-section
  // running east-west over the monument, per
  // https://bildhauerei-in-berlin.de/bildwerk/wagnerdenkmal-5372/ and
  // https://de.wikipedia.org/wiki/Richard-Wagner-Denkmal_(Berlin) .
  box(builder, CANOPY_ROOF, x, y + 6.55, z, 9.6, 0.4, 7.8);
  const vaultSteps = [
    { dy: 6.95, sx: 8.6, sy: 0.42, sz: 6.9 },
    { dy: 7.35, sx: 7.2, sy: 0.42, sz: 5.7 },
    { dy: 7.72, sx: 5.6, sy: 0.4, sz: 4.4 },
    { dy: 8.06, sx: 3.8, sy: 0.36, sz: 2.9 },
  ];
  for (const step of vaultSteps) {
    box(builder, CANOPY_ROOF, x, y + step.dy, z, step.sx, step.sy, step.sz);
  }
  box(builder, CANOPY_ROOF, x, y + 8.32, z, 1.6, 0.3, 1.2); // vault ridge cap
}

/**
 * The Luiseninsel figures — Encke's Königin Luise (1880, cylindrical
 * pedestal with a Befreiungskriege relief band, downcast standing
 * queen), Drake's Friedrich Wilhelm III (1849, tall square pedestal,
 * mantled king), and Brütt's Jung-Wilhelm (1904, low pedestal with a
 * tree-stump prop, young Garde-Füsilier officer with sabre and
 * gloves). They used to share one 5-box stack per the v0.57 marble
 * blob; each now gets a shape that matches its real composition, with
 * a head/torso/arm silhouette instead of a single body box, per
 * https://de.wikipedia.org/wiki/Luiseninsel and
 * https://bildhauerei-in-berlin.de/bildwerk/koenigin-luise-denkmal-6298/
 * and https://bildhauerei-in-berlin.de/bildwerk/jung-wilhelm-4679/ .
 * Presentation geometry approximating the documented composition —
 * not a survey model (Vertrag 5).
 */
function buildMarbleFigure(
  builder: Builder,
  x: number,
  y: number,
  z: number,
  variant: "luise" | "friedrich-wilhelm" | "wilhelm" = "luise",
): void {
  if (variant === "friedrich-wilhelm") {
    // Drake's 1849 king: tall square granite-look pedestal, mantled
    // standing figure with a crown-height head — the tallest of the
    // three so he reads across the water from the queen's island.
    box(builder, STONE_LIGHT, x, y + 0.3, z, 4.4, 0.6, 4.4);
    box(builder, MARBLE, x, y + 1.5, z, 3, 2.4, 3);
    box(builder, MARBLE, x, y + 2.85, z, 3.4, 0.3, 3.4);
    box(builder, MARBLE, x, y + 4.55, z, 1.7, 3.1, 1.4); // mantled torso
    box(builder, MARBLE, x, y + 6.35, z, 0.55, 0.55, 0.55); // head
    for (const side of [-1, 1]) {
      box(builder, MARBLE, x + side * 0.95, y + 4.9, z, 0.42, 2.2, 0.42);
    }
    return;
  }
  if (variant === "wilhelm") {
    // Brütt's 1904 Jung-Wilhelm: low two-step pedestal, a tree-stump
    // prop behind the figure, young officer in a peaked Garde cap with
    // a sabre held to his side.
    box(builder, STONE_LIGHT, x, y + 0.22, z, 2.6, 0.44, 2.2);
    box(builder, STONE_LIGHT, x, y + 0.58, z, 2.2, 0.28, 1.9);
    box(builder, MARBLE, x, y + 1.95, z, 1.5, 2.5, 1.3); // pedestal block
    box(builder, MARBLE, x - 0.55, y + 3.8, z - 0.35, 0.42, 2.7, 0.42); // stump
    box(builder, MARBLE, x, y + 4.15, z, 0.85, 2.3, 0.7); // torso
    box(builder, MARBLE, x, y + 5.9, z, 0.42, 0.42, 0.42); // head
    box(builder, MARBLE, x, y + 6.2, z, 0.5, 0.16, 0.5); // peaked cap
    box(builder, MARBLE, x + 0.55, y + 3.9, z + 0.1, 0.2, 1.9, 0.2); // sabre arm
    return;
  }
  // Encke's 1880 Königin Luise: cylindrical relief pedestal (the
  // Befreiungskriege frieze), downcast standing figure in a long gown.
  box(builder, STONE_LIGHT, x, y + 0.25, z, 3.4, 0.5, 3.4);
  box(builder, MARBLE, x, y + 1.25, z, 2.6, 1.6, 2.6); // relief drum
  box(builder, MARBLE, x, y + 2.15, z, 2.9, 0.24, 2.9); // drum cap
  box(builder, MARBLE, x, y + 3.85, z, 1.5, 3.2, 1.1); // gown/torso, tapers up
  box(builder, MARBLE, x, y + 5.6, z, 0.95, 0.6, 0.75); // shoulders
  box(builder, MARBLE, x, y + 6.22, z, 0.44, 0.44, 0.44); // downcast head
  for (const side of [-1, 1]) {
    box(builder, MARBLE, x + side * 0.55, y + 4.25, z + 0.15, 0.28, 1.7, 0.28);
  }
}

/** Moltke and Roon: a bronze general on a tall granite pedestal. */
function buildGeneralColumn(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  box(builder, STONE_LIGHT, x, y + 0.35, z, 6, 0.7, 6);
  box(builder, GRANITE_RED, x, y + 1.4, z, 3.6, 1.4, 3.6);
  box(builder, GRANITE_RED, x, y + 4.6, z, 2.6, 5, 2.6);
  box(builder, GRANITE_RED, x, y + 7.4, z, 3.2, 0.55, 3.2);
  box(builder, BRONZE, x, y + 9.6, z, 1.5, 3.9, 1.5);
  box(builder, BRONZE, x, y + 11.8, z, 0.8, 0.7, 0.8);
}

/** The white marble on the Luiseninsel's formal garden. */
const LUISENINSEL_NAMES = /Königin Luise|Wilhelm( I+\.)? von Preußen/i;

const STATUE_NAMES =
  /Lessing|Grimm|Bruno|Rufer|Lortzing|Moore|Reichstagsabgeordneten/i;

// Memorials the verified recognition layer (MemorialLandmarks) already
// models completely — the Holocaust stelae field, the Soviet memorial
// with its T-34s and soldier, Sinti-und-Roma, the Homosexuellen cuboid,
// Goethe and the composers. Drawing them twice doubles the geometry.
// Bismarck is here too: createSiegessaeule() in IsometricCityWorld.ts
// already draws the Bismarck-Nationaldenkmal as part of its verified
// Großer Stern recognition model (fixed offset from the Siegessäule,
// matching the real 1938/39 relocation next to the column) — v0.58.0
// found this OSM "Otto von Bismarck" artwork point was drawing a
// *second*, independently-positioned Bismarck about 58 m away from
// the recognition model's placement, i.e. two chancellors at the same
// intersection. Skipping it here removes the duplicate; the detailed
// figure now lives solely in createSiegessaeule().
export const MONUMENTS_ALREADY_MODELLED =
  /ermordeten Juden Europas|Sowjetisches Ehrenmal|Sowjetischer Soldat|Sinti und Roma|Homosexuellen|Beethoven-Haydn-Mozart|Goethe|Zeugen Jehovas|^Otto von Bismarck$/i;

export function createTiergartenMonuments(
  street: StreetDetailsPayload,
  ground: VoxelPayload,
): Group | null {
  if (!street.monuments || street.monuments.length === 0) {
    return null;
  }
  const sample = worldGroundSampler(ground);
  const builder: Builder = { edges: [], parts: [] };
  for (const entry of street.monuments) {
    const x = entry.x_dm / 10;
    const z = entry.z_dm / 10;
    const y = sample(x, z);
    if (y === null) {
      continue;
    }
    const name = entry.name;
    if (MONUMENTS_ALREADY_MODELLED.test(name) || entry.kind === "tank") {
      // The verified recognition layer carries these (incl. both T-34s).
    } else if (entry.kind === "cannon") {
      buildCannon(builder, x, y, z);
    } else if (/Verkehrsturm/i.test(name)) {
      buildVerkehrsturm(builder, x, y, z);
    } else if (/Euthanasie|Aktion T4/i.test(name)) {
      buildBlueWall(builder, x, y, z);
    } else if (/Weiße Kreuze/i.test(name)) {
      buildWhiteCrosses(builder, x, y, z);
    } else if (/Fahne der Einheit/i.test(name)) {
      buildUnityFlag(builder, x, y, z);
    } else if (/Grundgesetz/i.test(name)) {
      buildGlassPanels(builder, x, y, z);
    } else if (/Richard Wagner|Wagner-Denkmal/i.test(name)) {
      buildWagnerMemorial(builder, x, y, z);
    } else if (/Moltke|Roon/i.test(name)) {
      buildGeneralColumn(builder, x, y, z);
    } else if (LUISENINSEL_NAMES.test(name)) {
      const variant = /Friedrich Wilhelm/i.test(name)
        ? "friedrich-wilhelm"
        : /Königin Luise/i.test(name)
          ? "luise"
          : "wilhelm";
      buildMarbleFigure(builder, x, y, z, variant);
    } else if (STATUE_NAMES.test(name)) {
      buildStatue(builder, x, y, z);
    } else {
      buildStone(builder, x, y, z);
    }
  }
  if (builder.parts.length === 0) {
    return null;
  }
  const group = new Group();
  group.name = "OSM Tiergarten monuments";
  // Vertrag 5: every figure in this file is referenced-based presentation
  // geometry built from OSM point positions plus Wikipedia/Wikimedia
  // photographs and Landesdenkmalamt/bildhauerei-in-berlin.de
  // descriptions, not a survey or photogrammetry model. Individual
  // monuments merge into one mesh for draw-call economy, so the label
  // lives on the whole group rather than per-figure.
  group.userData.geometryStatus =
    "Reference-based presentation geometry from OSM point positions and " +
    "Wikipedia/Wikimedia/Denkmaldatenbank descriptions - not a survey model";

  const merged = mergeGeometries(builder.parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.name = "monument bodies";
    mesh.userData.nightMaterial = nightMaterial;
    mesh.userData.dayMaterial = dayMaterial;
    group.add(mesh);
    for (const part of builder.parts) {
      part.dispose();
    }
  }
  const inkGeometry = mergeGeometries(builder.edges, false);
  if (inkGeometry) {
    const ink = new LineSegments(
      inkGeometry,
      new LineBasicMaterial({ color: MONUMENT_INK }),
    );
    ink.name = "monument ink lines";
    ink.renderOrder = 2;
    group.add(ink);
    for (const edge of builder.edges) {
      edge.dispose();
    }
  }

  return group;
}
