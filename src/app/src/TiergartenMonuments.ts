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
const BRONZE = 0x435247;
const SOVIET_GREEN = 0x49543f;
const DARK_CUBE = 0x3c4043;
const WHITE = 0xf2f2ee;
const GLASS_BLUE = 0x5f9fc4;
const TOWER_GREEN = 0x2c4033;

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

const STATUE_NAMES =
  /Lessing|Grimm|Bruno|Rufer|Lortzing|Wagner|Bismarck|Moore|Reichstagsabgeordneten/i;

// Memorials the verified recognition layer (MemorialLandmarks) already
// models completely — the Holocaust stelae field, the Soviet memorial
// with its T-34s and soldier, Sinti-und-Roma, the Homosexuellen cuboid,
// Goethe and the composers. Drawing them twice doubles the geometry.
export const MONUMENTS_ALREADY_MODELLED =
  /ermordeten Juden Europas|Sowjetisches Ehrenmal|Sowjetischer Soldat|Sinti und Roma|Homosexuellen|Beethoven-Haydn-Mozart|Goethe|Zeugen Jehovas/i;

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

  const merged = mergeGeometries(builder.parts, false);
  if (merged) {
    const mesh = new Mesh(
      merged,
      new MeshStandardMaterial({
        flatShading: true,
        metalness: 0,
        roughness: 0.9,
        vertexColors: true,
      }),
    );
    mesh.name = "monument bodies";
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
