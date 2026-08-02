import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { createLetteringTexture } from "./drawnLettering";
import { WATER_TOP_Y } from "./MinecraftVoxelWorld";
import { MONUMENT_INK } from "./TiergartenMonuments";

/**
 * Two boats on the water — staffage the owner asked for, not survey.
 *
 * OSM maps no vessels, so nothing here is derived from data: a cargo
 * barge lies in the Humboldthafen on course for the Berlin-Spandauer
 * Schifffahrtskanal, and a small old excursion yacht runs the Spree off
 * the Kanzleramt with a deck party aboard. Both positions and headings
 * are taken from the surveyed waterway centre lines so the boats float
 * in the channel rather than through a quay, but the boats themselves
 * are invented and the group says so.
 */

const HULL_DARK = 0x3f4a52;
const HULL_BOOT = 0x2d3238;
const HULL_WHITE = 0xf4f1e8;
const HULL_SHEER = 0x2b2f33;
const CARGO = 0xa8a08c;
const COAMING = 0x6d7681;
const DECK_WOOD = 0xd9c9a6;
const CABIN = 0xefebe0;
const CABIN_ROOF = 0xc9c3b4;
const FUNNEL = 0x33383d;
const RAIL = 0xb6b1a5;
const AWNING = 0xe8e3d4;
const NAMEPLATE = 0x1d2126;
const LAMPION = 0xf3a94b;
const PARTY = [0xd8455f, 0x5b8fb9, 0xe0c04a, 0x7ba05b] as const;

/** Berlin-Spandauer Schifffahrtskanal centre line inside the harbour. */
const BARGE = {
  headingX: 0.0998,
  headingZ: -0.995,
  lengthM: 52,
  widthM: 7.4,
  x: 45,
  z: -650,
};
/** Spree centre line off the Kanzleramt, tangent (0.9269, -0.3754). */
const YACHT = {
  headingX: 0.9269,
  headingZ: -0.3754,
  lengthM: 18.5,
  widthM: 4.4,
  x: -119.3,
  z: -404.3,
};

const STERN_NAME = "HELMUT KOHL";
/** Deliberately tiny: the joke only works if you have to look for it. */
const STERN_NAME_WIDTH_M = 1.9;
const STERN_NAME_HEIGHT_M = 0.34;
const STERN_NAME_CAP_M = 0.16;

type Builder = {
  edges: BufferGeometry[];
  lamps: BufferGeometry[];
  parts: BufferGeometry[];
};

function paint(geometry: BufferGeometry, color: number): void {
  geometry.deleteAttribute("uv");
  const shade = new Color(color);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    colors[index * 3] = shade.r;
    colors[index * 3 + 1] = shade.g;
    colors[index * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
}

/** Frame of one boat: `along` runs bow-positive, `across` to starboard. */
type Frame = {
  at: (along: number, across: number) => [number, number];
  rotation: number;
};

function frame(x: number, z: number, hx: number, hz: number): Frame {
  const rotation = Math.atan2(hz, hx);
  return {
    at: (along, across) => [
      x + hx * along - hz * across,
      z + hz * along + hx * across,
    ],
    rotation,
  };
}

function box(
  builder: Builder,
  color: number,
  f: Frame,
  along: number,
  y: number,
  across: number,
  sx: number,
  sy: number,
  sz: number,
  inked = true,
): void {
  const geometry = new BoxGeometry(sx, sy, sz);
  geometry.rotateY(f.rotation);
  const [cx, cz] = f.at(along, across);
  geometry.translate(cx, y, cz);
  paint(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(new EdgesGeometry(geometry, 24));
  }
}

/** A warm lampion: emissive only after dark, plain paper by day. */
function lampion(
  builder: Builder,
  f: Frame,
  along: number,
  y: number,
  across: number,
  radius: number,
): void {
  const geometry = new CylinderGeometry(radius, radius, radius * 1.5, 6);
  const [cx, cz] = f.at(along, across);
  geometry.translate(cx, y, cz);
  paint(geometry, LAMPION);
  builder.lamps.push(geometry);
}

/**
 * A hull that tapers to a bow: five box sections, the forward ones
 * narrowing. Cheaper than a lofted shape and it keeps the flat-tone,
 * ink-outline register of everything else drawn in the scene.
 */
function hull(
  builder: Builder,
  f: Frame,
  color: number,
  length: number,
  width: number,
  baseY: number,
  depth: number,
): void {
  const sections = 5;
  for (let index = 0; index < sections; index += 1) {
    const t = (index + 0.5) / sections;
    const sectionLength = length / sections;
    // Only the forward fifth narrows; a barge is a box for most of its run.
    const taper = t < 0.8 ? 1 : 1 - (t - 0.8) * 3.2;
    box(
      builder, color, f,
      -length / 2 + (index + 0.5) * sectionLength,
      baseY + depth / 2,
      0,
      sectionLength,
      depth,
      Math.max(width * 0.28, width * taper),
    );
  }
}

function buildBarge(builder: Builder, water: number): void {
  const f = frame(BARGE.x, BARGE.z, BARGE.headingX, BARGE.headingZ);
  const { lengthM: length, widthM: width } = BARGE;
  // Loaded, so she sits low: only about a metre of freeboard shows.
  hull(builder, f, HULL_DARK, length, width, water - 0.35, 1.5);
  box(
    builder, HULL_BOOT, f,
    0, water - 0.28, 0,
    length * 0.94, 0.34, width + 0.16,
    false,
  );
  // Open hold with a coaming and a heaped cargo of sand.
  box(builder, COAMING, f, -2, water + 1.35, 0, length * 0.62, 0.5, width - 0.5);
  box(builder, CARGO, f, -2, water + 1.5, 0, length * 0.58, 0.5, width - 1.4);
  // Wheelhouse and accommodation aft.
  box(builder, CABIN, f, -length / 2 + 4.2, water + 2.6, 0, 5.4, 2.6, width - 1.6);
  box(
    builder, CABIN_ROOF, f,
    -length / 2 + 4.2, water + 4.0, 0,
    5.8, 0.24, width - 1.2,
  );
  box(builder, FUNNEL, f, -length / 2 + 2.2, water + 4.8, 1.4, 0.7, 1.8, 0.7);
  // Foredeck winch and a mast on the bow, both stubby.
  box(builder, COAMING, f, length / 2 - 3.4, water + 1.5, 0, 1.5, 0.8, 1.6);
  box(builder, RAIL, f, length / 2 - 4.6, water + 3.1, 0, 0.24, 3.0, 0.24);
}

function buildYacht(builder: Builder, water: number): Frame {
  const f = frame(YACHT.x, YACHT.z, YACHT.headingX, YACHT.headingZ);
  const { lengthM: length, widthM: width } = YACHT;
  hull(builder, f, HULL_WHITE, length, width, water - 0.55, 1.5);
  // The black sheer stripe that makes an old motor yacht read as old.
  box(
    builder, HULL_SHEER, f,
    0, water + 0.72, 0,
    length * 0.9, 0.22, width + 0.1,
    false,
  );
  box(builder, DECK_WOOD, f, 0, water + 0.95, 0, length * 0.92, 0.16, width - 0.3);
  // Deckhouse with a raised bridge, both a little lopsided — she is old.
  box(builder, CABIN, f, -1.2, water + 1.95, 0, 7.4, 1.9, width - 1.0);
  box(builder, CABIN_ROOF, f, -1.2, water + 2.98, 0, 7.8, 0.22, width - 0.6);
  box(builder, CABIN, f, 2.6, water + 2.5, 0, 3.0, 3.0, width - 1.4);
  box(builder, CABIN_ROOF, f, 2.6, water + 4.08, 0, 3.4, 0.22, width - 1.0);
  box(builder, FUNNEL, f, -3.6, water + 3.7, 0, 0.6, 1.5, 0.6);
  // Aft awning over the party deck, on four thin posts.
  for (const along of [-6.6, -3.2]) {
    for (const across of [-1.5, 1.5]) {
      box(builder, RAIL, f, along, water + 1.9, across, 0.1, 1.8, 0.1, false);
    }
  }
  box(builder, AWNING, f, -4.9, water + 2.86, 0, 4.2, 0.14, width - 0.8);
  // Guests: a scatter of coloured blocks, no two the same height.
  const guests: Array<[number, number, number]> = [
    [-6.2, -1.2, 1.72],
    [-5.4, 0.9, 1.66],
    [-4.3, -0.6, 1.78],
    [-3.6, 1.3, 1.62],
    [-6.6, 0.4, 1.7],
    [4.4, -0.8, 1.74],
  ];
  guests.forEach(([along, across, height], index) => {
    box(
      builder, PARTY[index % PARTY.length], f,
      along, water + 1.03 + height / 2, across,
      0.42, height, 0.42,
    );
  });
  // Deck rail: a low line of stanchions round the open stern.
  for (let index = 0; index < 7; index += 1) {
    const along = -length / 2 + 0.8 + index * 1.15;
    for (const across of [-(width / 2 - 0.35), width / 2 - 0.35]) {
      box(builder, RAIL, f, along, water + 1.4, across, 0.08, 0.8, 0.08, false);
    }
  }
  // Lampions: a string along the awning edge and two inside the deckhouse.
  for (let index = 0; index < 6; index += 1) {
    const along = -7.0 + index * 0.86;
    for (const across of [-(width / 2 - 0.45), width / 2 - 0.45]) {
      lampion(builder, f, along, water + 2.66, across, 0.17);
    }
  }
  lampion(builder, f, -1.2, water + 2.5, 0, 0.2);
  lampion(builder, f, 2.6, water + 3.5, 0, 0.18);
  return f;
}

/** The transom nameplate. Separate mesh: it is the only textured face. */
function sternNamePlate(f: Frame, water: number): Mesh | null {
  const texture = createLetteringTexture({
    bandHeightM: STERN_NAME_HEIGHT_M,
    bandWidthM: STERN_NAME_WIDTH_M,
    capHeightM: STERN_NAME_CAP_M,
    fieldColor: "#1d2126",
    letterColor: "#f4f1e8",
    text: STERN_NAME,
    texelsPerMetre: 320,
  });
  if (!texture) {
    return null;
  }
  const geometry = new PlaneGeometry(STERN_NAME_WIDTH_M, STERN_NAME_HEIGHT_M);
  // The transom faces astern, so the plate looks down the negative heading.
  geometry.rotateY(f.rotation + Math.PI / 2);
  const [px, pz] = f.at(-YACHT.lengthM / 2 - 0.06, 0);
  geometry.translate(px, water + 0.42, pz);
  const material = new MeshBasicMaterial({ color: 0xffffff, map: texture });
  const plate = new Mesh(geometry, material);
  plate.name = "yacht stern name";
  plate.renderOrder = 3;
  return plate;
}

export function createVessels(waterTopY: number = WATER_TOP_Y): Group {
  const builder: Builder = { edges: [], lamps: [], parts: [] };
  buildBarge(builder, waterTopY);
  const yacht = buildYacht(builder, waterTopY);

  const group = new Group();
  group.name = "drawn vessels";
  // Owner-requested staffage: OSM maps no boats at all.
  group.userData.extrapolated = true;

  const merged = mergeGeometries(builder.parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.85,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.name = "vessel bodies";
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    group.add(mesh);
    for (const part of builder.parts) {
      part.dispose();
    }
  }
  const lampGeometry = mergeGeometries(builder.lamps, false);
  if (lampGeometry) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.6,
      vertexColors: true,
    });
    nightMaterial.userData.nightEmissive = 0xffb457;
    nightMaterial.userData.nightEmissiveIntensity = 1.15;
    const lamps = new Mesh(lampGeometry, dayMaterial);
    lamps.name = "vessel lampions";
    lamps.userData.dayMaterial = dayMaterial;
    lamps.userData.nightMaterial = nightMaterial;
    group.add(lamps);
    for (const lamp of builder.lamps) {
      lamp.dispose();
    }
  }
  const inkGeometry = mergeGeometries(builder.edges, false);
  if (inkGeometry) {
    const ink = new LineSegments(
      inkGeometry,
      new LineBasicMaterial({ color: MONUMENT_INK }),
    );
    ink.name = "vessel ink lines";
    ink.renderOrder = 2;
    group.add(ink);
    for (const edge of builder.edges) {
      edge.dispose();
    }
  }
  const plate = sternNamePlate(yacht, waterTopY);
  if (plate) {
    group.add(plate);
  }
  return group;
}
