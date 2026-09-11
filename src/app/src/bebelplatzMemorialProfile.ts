/** OSM node 262525336; dimensions and fourteen tiers from Bildhauerei in Berlin. */
export const BEBEL_LIBRARY_MEMORIAL = {
  name: "Bebelplatz — Versunkene Bibliothek",
  osmKey: "node/262525336",
  worldM: [1518.9904098202, 299.9489484141] as const,
  roomWidthM: 7.06,
  roomHeightM: 5.29,
  shelfTiers: 14,
  glassWidthM: 1.2,
  // Align the inset with the plaza paving; not a surveyed bearing.
  rotationY: 0.087,
  artist: "Micha Ullman",
  sourceUrls: [
    "https://www.openstreetmap.org/node/262525336",
    "https://bildhauerei-in-berlin.de/bildwerk/mahnmal-buecherverbrennung-5322/",
    "https://www.bpb.de/themen/holocaust/erinnerungsorte/503086/denkmal-buecherverbrennung/",
    "https://taz.de/Bebelplatz-Denkmal-Klaeglich/!1469294/",
  ],
} as const;

// The six source raster cells over the chamber are replaced by a thin paved
// ceiling with a real glass aperture. Neighbouring terrain is untouched.
export const BEBEL_LIBRARY_GROUND_PATCH = { minX: 1512, maxX: 1524, minZ: 296, maxZ: 304 } as const;
export function isBebelLibraryGroundCell(x: number, z: number): boolean {
  const p = BEBEL_LIBRARY_GROUND_PATCH;
  return x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ;
}
