/**
 * Source-bound Berlin passenger-vessel envelopes.
 *
 * Reederei Riedel publishes length, beam, draught, build year and type for
 * both vessels. The positions below are deliberately labelled display
 * positions: they lie on the committed OSM waterway centre lines, but are not
 * live AIS observations. No texture, livery artwork or unlicensed photograph
 * is bundled.
 */

export type SpreeVesselProfile = {
  beamM: number;
  buildYear: number;
  displayPositionWorldM: readonly [number, number];
  draughtM: number;
  heading: readonly [number, number];
  name: string;
  sourceUrl: string;
  type: "panorama" | "salon";
  lengthM: number;
  waterwaySource: string;
};

export const REEDEREI_RIEDEL_FLEET_SOURCE =
  "https://reederei-riedel.de/flotte?lang=en";

export const REAL_SPREE_VESSEL_PROFILES: readonly SpreeVesselProfile[] = [
  {
    beamM: 7,
    buildYear: 2002,
    displayPositionWorldM: [56, -691],
    draughtM: 1.29,
    heading: [0.0998, -0.995],
    lengthM: 43.1,
    name: "Spree-Comtess",
    sourceUrl: REEDEREI_RIEDEL_FLEET_SOURCE,
    type: "salon",
    waterwaySource:
      "OSM Humboldthafen way 52189421 / Berlin-Spandauer Schifffahrtskanal centre line",
  },
  {
    beamM: 6.98,
    buildYear: 2006,
    displayPositionWorldM: [-119.3, -404.3],
    draughtM: 1.2,
    heading: [0.9269, -0.3754],
    lengthM: 29.55,
    name: "FMS Spree-Blick III",
    sourceUrl: REEDEREI_RIEDEL_FLEET_SOURCE,
    type: "panorama",
    waterwaySource: "committed OSM Spree centre line off the Bundeskanzleramt",
  },
] as const;

export const SPREE_VESSEL_GEOMETRY_STATUS = {
  envelope:
    "Exact published length, beam and draught; superstructure is a restrained type-level recognition model because no public general arrangement is bundled",
  placement:
    "Static display placement on committed OSM waterway centre lines; not a live vessel observation or AIS track",
  visualReference:
    "Existing credited Wikimedia Humboldthafen reference shows the local white/blue excursion-vessel register; no image is used as a texture",
} as const;
