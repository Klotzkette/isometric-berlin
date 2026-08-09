/**
 * The stele field of the Denkmal für die ermordeten Juden Europas
 * (Peter Eisenman, 2005), laid out from its documented figures.
 *
 * ## What was wrong before
 *
 * The field shipped with three measurable errors, all of which change how
 * the memorial reads:
 *
 *  1. **2710 stelae instead of 2711.** The count is the one number about
 *     this memorial everybody knows.
 *  2. **Alleys 1.50 m wide across the field** — 58 % too wide.
 *  3. **Alleys 0.52 m wide along it** — 45 % too narrow.
 *
 * Eisenman's alleys are 0.95 m in BOTH directions: wide enough for one
 * person, too narrow for two. That single dimension is the whole
 * experience of the place, and getting it wrong in opposite directions on
 * the two axes turned a lattice of equal corridors into rows of widely
 * spaced blocks. Everything here derives from the documented stele size
 * and that one alley width, so the grid cannot drift again.
 *
 * ## Status
 *
 * Stele size, alley width, count and height range are documented figures.
 * The individual height of any one stele, the roll of the ground and each
 * stele's small tilt are NOT published per stele; they are generated
 * deterministically to the documented ranges and are labelled as
 * presentation geometry.
 */

/** Documented dimensions of the memorial, in metres. */
export const HOLOCAUST_FIELD = {
  /** Every stele has the same footprint. */
  steleWidth: 0.95,
  steleLength: 2.38,
  /**
   * The defining dimension: single-file alleys, the same both ways.
   * Everything else in the layout is derived from it.
   */
  alley: 0.95,
  /** Documented total. */
  steleCount: 2711,
  /** Documented height range across the field. */
  minHeight: 0.2,
  maxHeight: 4.7,
  /** The stelae lean, but barely — up to two degrees. */
  maxTiltDegrees: 2,
  /** Site extent the lattice is trimmed to. */
  siteWidth: 200,
  siteDepth: 95,
} as const;

/** Centre-to-centre spacing across the stele's short side. */
export const PITCH_ACROSS =
  HOLOCAUST_FIELD.steleWidth + HOLOCAUST_FIELD.alley;
/** Centre-to-centre spacing along the stele's long side. */
export const PITCH_ALONG =
  HOLOCAUST_FIELD.steleLength + HOLOCAUST_FIELD.alley;

export const HOLOCAUST_GEOMETRY_STATUS =
  "Documented stele footprint (0.95 x 2.38 m), documented 0.95 m single-file alleys in both directions, documented count of 2711 and the 0.2-4.7 m height range. Per-stele height, tilt and the roll of the ground are not published and are generated deterministically within those ranges as presentation geometry.";

export type StelePlacement = {
  /** Height of this stele, in metres. */
  height: number;
  /** Ground level under it, relative to the field's mean. */
  ground: number;
  /** Small lean, in radians, about x and z. */
  tiltX: number;
  tiltZ: number;
  x: number;
  z: number;
};

/**
 * Deterministic hash in [0, 1). Used for the per-stele variation that is
 * not published, so the field is identical on every machine and every
 * reload — a memorial that reshuffles itself between visits would be
 * both wrong and disrespectful.
 */
function unit(index: number, salt: number): number {
  let value = Math.imul(index + salt, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

/**
 * The roll of the ground. Eisenman's floor is not one funnel — it swells
 * and dips in long waves, so an alley rises and falls as you walk it and
 * the tops of the stelae ripple with it.
 */
export function fieldGround(x: number, z: number): number {
  const u = x / (HOLOCAUST_FIELD.siteWidth / 2);
  const v = z / (HOLOCAUST_FIELD.siteDepth / 2);
  return (
    0.62 * Math.sin(u * 2.4 + 0.7) * Math.cos(v * 1.7) +
    0.38 * Math.sin(v * 3.0 + 1.35) -
    2.2 * Math.max(0, 1 - Math.hypot(u, v * 1.15))
  );
}

/**
 * The height profile. Low at the rim where the field meets the pavement,
 * rising toward the middle: that is what makes the memorial look like a
 * flat grid from the street and swallow you once you walk in.
 */
export function steleHeight(x: number, z: number, index: number): number {
  const u = Math.abs(x) / (HOLOCAUST_FIELD.siteWidth / 2);
  const v = Math.abs(z) / (HOLOCAUST_FIELD.siteDepth / 2);
  const toEdge = Math.max(u, v);
  // Smooth rise from the rim inward, then per-stele variation on top so
  // no two neighbours match and the tops never form a dome.
  const base = Math.pow(1 - Math.min(1, toEdge), 1.35);
  const jitter = unit(index, 7919) * 0.34 - 0.17;
  const height =
    HOLOCAUST_FIELD.minHeight +
    (HOLOCAUST_FIELD.maxHeight - HOLOCAUST_FIELD.minHeight) *
      Math.min(1, Math.max(0, base + jitter));
  return Math.min(HOLOCAUST_FIELD.maxHeight, Math.max(HOLOCAUST_FIELD.minHeight, height));
}

/**
 * Every stele, in field-local coordinates with the origin at the centre.
 * The lattice is laid out on the documented pitch and then trimmed to the
 * documented count by dropping the outermost cells first, so the field
 * keeps a full grid in the middle and a ragged edge at the pavement —
 * which is how it actually meets Ebertstraße and Hannah-Arendt-Straße.
 */
export function holocaustStelePlacements(): StelePlacement[] {
  const columns = Math.floor(HOLOCAUST_FIELD.siteWidth / PITCH_ACROSS);
  const rows = Math.floor(HOLOCAUST_FIELD.siteDepth / PITCH_ALONG);
  const cells: Array<{ column: number; rank: number; row: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const u = Math.abs(column - (columns - 1) / 2) / ((columns - 1) / 2);
      const v = Math.abs(row - (rows - 1) / 2) / ((rows - 1) / 2);
      cells.push({ column, rank: Math.max(u, v), row });
    }
  }
  // Innermost first: the trim then bites only at the rim.
  cells.sort(
    (left, right) =>
      left.rank - right.rank ||
      left.row - right.row ||
      left.column - right.column,
  );
  const kept = cells.slice(0, HOLOCAUST_FIELD.steleCount);
  // Back into reading order so the instance list is spatially coherent.
  kept.sort((left, right) => left.row - right.row || left.column - right.column);
  return kept.map((cell, index) => {
    const x = (cell.column - (columns - 1) / 2) * PITCH_ACROSS;
    const z = (cell.row - (rows - 1) / 2) * PITCH_ALONG;
    const maxTilt = (HOLOCAUST_FIELD.maxTiltDegrees * Math.PI) / 180;
    return {
      ground: fieldGround(x, z),
      height: steleHeight(x, z, index),
      tiltX: (unit(index, 104_729) * 2 - 1) * maxTilt,
      tiltZ: (unit(index, 15_485_863) * 2 - 1) * maxTilt,
      x,
      z,
    };
  });
}

export type HolocaustFieldMode = "day" | "night" | "winter";

/**
 * The stelae are dark grey self-compacting concrete with an
 * anti-graffiti coating that gives them a faint sheen. They read cooler
 * and darker than any other paving in the quarter, which is the point:
 * the field is a grey mass, not a plaza.
 */
export const HOLOCAUST_PALETTES: Record<
  HolocaustFieldMode,
  { concrete: number; concreteTop: number; ground: number; ink: number; snow: number }
> = {
  day: {
    concrete: 0x8d9295,
    concreteTop: 0x9ca1a4,
    ground: 0x76797b,
    ink: 0x716c62,
    snow: 0xf2f5f7,
  },
  night: {
    concrete: 0x232a33,
    concreteTop: 0x2c343e,
    ground: 0x171c22,
    ink: 0x8ea3bd,
    snow: 0x9fb0c2,
  },
  winter: {
    concrete: 0x7f868c,
    concreteTop: 0x8c9399,
    ground: 0x6b7175,
    ink: 0x6b727a,
    snow: 0xf6f9fc,
  },
};
