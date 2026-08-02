import {
  BoxGeometry,
  EdgesGeometry,
  type Group,
  SphereGeometry,
} from "three";

import {
  addBox,
  addCone,
  type Builder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";
import type { StreetDetailsPayload } from "./TrafficSignals";

/**
 * The two kinds of open-air drinking place on the Spreebogen bank.
 *
 * `amenity=biergarten` is one of the few things OSM maps as a true area,
 * so the Zollpackhof's benches, hedges and chestnuts are laid out inside
 * its surveyed ring. Capital Beach on the Ludwig-Erhard-Ufer is the
 * opposite case: a single `amenity=pub` node with no outline and — checked
 * against the extract — no sand and no `leisure=beach_resort` either, just
 * `landuse=grass`. What *is* surveyed there is the row of benches along the
 * quay, so the deck chairs sit on those instead of on an invented grid.
 */

const CHAIR_FRAME = 0xe7e3d8;
const CHAIR_CANVAS = 0xd8455f;
const CHAIR_CANVAS_ALT = 0xe0728a;
const HUT_BODY = 0xc0367e;
const HUT_ROOF = 0xf1eee5;
const HUT_COUNTER = 0xe9e5da;
const PARASOL_CANOPY = 0xf3efe4;
const PARASOL_POST = 0xb6b2a7;
const TABLE_TOP = 0xe9e4d6;
const TABLE_LEG = 0xbfb9a9;
const BENCH_SEAT = 0xdfd8c6;
const HEDGE = 0x9fb083;
const TRUNK = 0x9a8b76;
const CROWN = 0x8fa877;
const TAP_HOUSE = 0xefe8d6;
const TAP_ROOF = 0xb4604a;

const CHAIR_SPACING_M = 2.2;
const CHAIR_ROWS = 2;
const BENCH_ROW_SPACING_M = 3.4;
const TABLE_SPACING_M = 2.6;
/** A German beer-garden table is a 2 m plank with a bench either side. */
const TABLE_LENGTH_M = 2.0;
const GARDEN_MARGIN_M = 3.0;

/** One deck chair: a slanted canvas between two low frame rails. */
function deckChair(
  builder: Builder,
  cx: number,
  ground: number,
  cz: number,
  rotation: number,
  alternate: boolean,
): void {
  const canvas = alternate ? CHAIR_CANVAS_ALT : CHAIR_CANVAS;
  addBox(builder, CHAIR_FRAME, cx, ground + 0.18, cz, 1.5, 0.1, 0.62, rotation);
  // The reclining back, tipped away from the water like the real rows.
  const back = new BoxGeometry(0.06, 0.86, 0.6);
  back.rotateZ(0.38);
  back.rotateY(rotation);
  back.translate(cx - Math.cos(rotation) * 0.5, ground + 0.6, cz - Math.sin(rotation) * 0.5);
  paintGeometry(back, CHAIR_FRAME);
  builder.parts.push(back);
  builder.edges.push(new EdgesGeometry(back, 24));
  const seat = new BoxGeometry(1.0, 0.08, 0.56);
  seat.rotateZ(-0.16);
  seat.rotateY(rotation);
  seat.translate(cx, ground + 0.36, cz);
  paintGeometry(seat, canvas);
  builder.parts.push(seat);
  builder.edges.push(new EdgesGeometry(seat, 24));
}

/** A magenta bar container with a pale flat roof and a serving counter. */
function barHut(
  builder: Builder,
  cx: number,
  ground: number,
  cz: number,
  rotation: number,
  length: number,
): void {
  addBox(builder, HUT_BODY, cx, ground + 1.35, cz, length, 2.7, 2.6, rotation);
  addBox(builder, HUT_ROOF, cx, ground + 2.85, cz, length + 0.5, 0.3, 3.1, rotation);
  addBox(
    builder, HUT_COUNTER,
    cx + Math.sin(rotation) * 1.6, ground + 1.1, cz + Math.cos(rotation) * 1.6,
    length - 0.6, 0.16, 0.7,
    rotation,
  );
}

function parasol(
  builder: Builder,
  cx: number,
  ground: number,
  cz: number,
): void {
  addBox(builder, PARASOL_POST, cx, ground + 1.1, cz, 0.12, 2.2, 0.12, 0);
  addCone(builder, PARASOL_CANOPY, cx, ground + 2.5, cz, 1.7, 0.7, 8);
}

/** Table with its two benches, the unit a beer garden is measured in. */
function beerTable(
  builder: Builder,
  cx: number,
  ground: number,
  cz: number,
  rotation: number,
): void {
  addBox(builder, TABLE_TOP, cx, ground + 0.74, cz, TABLE_LENGTH_M, 0.08, 0.7, rotation);
  for (const end of [-1, 1]) {
    addBox(
      builder, TABLE_LEG,
      cx + Math.cos(rotation) * end * 0.8, ground + 0.37, cz + Math.sin(rotation) * end * 0.8,
      0.08, 0.74, 0.62,
      rotation,
      false,
    );
    addBox(
      builder, BENCH_SEAT,
      cx - Math.sin(rotation) * end * 0.78, ground + 0.46, cz + Math.cos(rotation) * end * 0.78,
      TABLE_LENGTH_M, 0.07, 0.28,
      rotation,
    );
  }
}

function chestnut(
  builder: Builder,
  cx: number,
  ground: number,
  cz: number,
  height: number,
): void {
  addBox(builder, TRUNK, cx, ground + height * 0.3, cz, 0.7, height * 0.6, 0.7, 0);
  // A coarse sphere, so the natural monument reads as the biggest tree on
  // the bank rather than as a green box. Few enough segments that it stays
  // faceted in the drawn register, and indexed like the rest of the kit —
  // mergeGeometries refuses a mix of indexed and non-indexed parts.
  const crown = new SphereGeometry(1, 7, 5);
  crown.scale(height * 0.32, height * 0.24, height * 0.32);
  crown.translate(cx, ground + height * 0.74, cz);
  paintGeometry(crown, CROWN);
  builder.parts.push(crown);
}

/**
 * Point-in-polygon on the surveyed ring, so nothing lands on the pavement.
 */
function insideRing(ring: Array<[number, number]>, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function buildBeerGarden(
  builder: Builder,
  garden: NonNullable<StreetDetailsPayload["beer_gardens"]>[number],
  ground: number,
): void {
  const ring = garden.ring_dm.map(
    ([x, z]) => [x / 10, z / 10] as [number, number],
  );
  const cx = garden.x_dm / 10;
  const cz = garden.z_dm / 10;
  const [ax, az] = garden.axis;
  const rotation = Math.atan2(az, ax);
  const halfLength = garden.w_dm / 20 - GARDEN_MARGIN_M;
  const halfDepth = garden.d_dm / 20 - GARDEN_MARGIN_M;
  if (halfLength <= 0 || halfDepth <= 0) {
    return;
  }
  const at = (along: number, across: number): [number, number] => [
    cx + ax * along - az * across,
    cz + az * along + ax * across,
  ];

  // Table rows run along the long axis, the way the Zollpackhof lays out
  // its benches under the plane trees.
  const rows = Math.max(1, Math.floor((halfDepth * 2) / BENCH_ROW_SPACING_M));
  const perRow = Math.max(1, Math.floor((halfLength * 2) / TABLE_SPACING_M));
  for (let row = 0; row < rows; row += 1) {
    const across = -halfDepth + (row + 0.5) * ((halfDepth * 2) / rows);
    for (let slot = 0; slot < perRow; slot += 1) {
      const along = -halfLength + (slot + 0.5) * ((halfLength * 2) / perRow);
      const [tx, tz] = at(along, across);
      if (!insideRing(ring, tx, tz)) {
        continue;
      }
      beerTable(builder, tx, ground, tz, rotation);
    }
  }

  // A clipped hedge along the ring, which is what separates a Berlin beer
  // garden from the footpath beside it.
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, z0] = ring[index];
    const [x1, z1] = ring[index + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    if (length < 4) {
      continue;
    }
    addBox(
      builder, HEDGE,
      (x0 + x1) / 2, ground + 0.55, (z0 + z1) / 2,
      length, 1.1, 0.8,
      Math.atan2(dz, dx),
    );
  }
}

function buildRiversideBar(
  builder: Builder,
  bar: NonNullable<StreetDetailsPayload["riverside_bars"]>[number],
  sample: (x: number, z: number) => number | null,
  ground: number,
): void {
  const [ax, az] = bar.axis;
  const rotation = Math.atan2(az, ax);

  // Deck-chair rows sit on the surveyed benches: each mapped bench line
  // becomes a short row facing the water, each mapped bench node a pair.
  for (const seat of bar.seats) {
    const sx = seat.x_dm / 10;
    const sz = seat.z_dm / 10;
    const seatGround = sample(sx, sz);
    if (seatGround === null) {
      continue;
    }
    const [sax, saz] = seat.axis;
    const seatRotation = Math.atan2(saz, sax);
    const length = seat.len_dm / 10;
    const count = Math.max(1, Math.round(length / CHAIR_SPACING_M));
    for (let index = 0; index < count; index += 1) {
      const along = length === 0 ? 0 : -length / 2 + (index + 0.5) * (length / count);
      for (let row = 0; row < CHAIR_ROWS; row += 1) {
        const across = (row - (CHAIR_ROWS - 1) / 2) * 1.5;
        deckChair(
          builder,
          sx + sax * along + saz * across,
          seatGround,
          sz + saz * along - sax * across,
          seatRotation,
          (index + row) % 2 === 1,
        );
      }
    }
  }

  // The bar itself: two containers end to end on the paved terrace, with
  // parasols in front. Sizes are a standard beach-bar kit, not surveyed.
  const cx = bar.x_dm / 10;
  const cz = bar.z_dm / 10;
  for (const side of [-1, 1]) {
    const hx = cx + ax * side * 4.0;
    const hz = cz + az * side * 4.0;
    const hutGround = sample(hx, hz);
    if (hutGround === null) {
      continue;
    }
    barHut(builder, hx, hutGround, hz, rotation, 6.0);
  }
  for (const offset of [-11, -5.5, 5.5, 11]) {
    const px = cx + ax * offset - az * 6.5;
    const pz = cz + az * offset + ax * 6.5;
    const parasolGround = sample(px, pz);
    if (parasolGround === null) {
      continue;
    }
    parasol(builder, px, parasolGround, pz);
  }
}

/** The Zollpackhof's Schankhaus and its 1555 chestnut natural monument. */
const ZOLLPACKHOF_TAP = { x: -276.2, z: -284.6 };
const ZOLLPACKHOF_CHESTNUT = { height: 20, x: -293.2, z: -255.0 };

export function createRiversideVenues(
  street: StreetDetailsPayload,
  ground: VoxelPayload,
): Group | null {
  const gardens = street.beer_gardens ?? [];
  const bars = street.riverside_bars ?? [];
  if (gardens.length === 0 && bars.length === 0) {
    return null;
  }
  const sample = worldGroundSampler(ground);
  const builder: Builder = createBuilder();
  for (const garden of gardens) {
    const y = sample(garden.x_dm / 10, garden.z_dm / 10);
    if (y === null) {
      continue;
    }
    buildBeerGarden(builder, garden, y);
    if (garden.name === "Zollpackhof") {
      const tapY = sample(ZOLLPACKHOF_TAP.x, ZOLLPACKHOF_TAP.z);
      if (tapY !== null) {
        addBox(
          builder, TAP_HOUSE,
          ZOLLPACKHOF_TAP.x, tapY + 1.6, ZOLLPACKHOF_TAP.z,
          9.0, 3.2, 7.0,
          0,
        );
        addBox(
          builder, TAP_ROOF,
          ZOLLPACKHOF_TAP.x, tapY + 3.6, ZOLLPACKHOF_TAP.z,
          9.6, 0.8, 7.6,
          0,
        );
      }
      // `natural_monument`, planted 1555, height 20 m — all from OSM.
      const treeY = sample(ZOLLPACKHOF_CHESTNUT.x, ZOLLPACKHOF_CHESTNUT.z);
      if (treeY !== null) {
        chestnut(
          builder,
          ZOLLPACKHOF_CHESTNUT.x,
          treeY,
          ZOLLPACKHOF_CHESTNUT.z,
          ZOLLPACKHOF_CHESTNUT.height,
        );
      }
    }
  }
  for (const bar of bars) {
    const y = sample(bar.x_dm / 10, bar.z_dm / 10);
    if (y === null) {
      continue;
    }
    buildRiversideBar(builder, bar, sample, y);
  }
  if (builder.parts.length === 0) {
    return null;
  }
  const group = finishDrawnGroup(builder, { name: "riverside venue" });
  if (group) {
    // Outlines, benches and the chestnut are surveyed; the furniture is not.
    group.userData.extrapolated = true;
  }
  return group;
}
