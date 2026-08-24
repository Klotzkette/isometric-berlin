/**
 * Source and presentation contract for the lower registers of the
 * Siegessaeule.  The authoritative records distinguish two works which are
 * easy to collapse at isometric scale:
 *
 * - four bronze reliefs are inset into the faces of the lower, square red-
 *   granite base;
 * - Anton von Werner's polychrome glass mosaic is one storey higher, on the
 *   inner shaft of the circular colonnaded hall.
 *
 * The viewer packages licensed QA thumbnails in the canonical Wikimedia
 * source pack, but never uses either photograph as a runtime texture or
 * reproduces the historical scenes.  It only uses small, deterministic
 * colour fields and silhouettes to make those registers legible.
 */
export const SIEGESSAEULE_PROFILE = {
  base: {
    heightMApprox: 6.6,
    material: "polished red granite",
    widthM: 25.3,
  },
  colonnade: {
    columnCount: 16,
    columnHeightM: 4.7,
    diameterM: 15.7,
  },
  geometryStatus:
    "metric base width and colonnade diameter follow the public monument inventories; relief thickness, mosaic colour fields and figure silhouettes are restrained texture-free display approximations",
  heightM: 67,
  mosaic: {
    architecturalLevel:
      "outer face of the inner shaft, inside the circular colonnaded hall above the square base",
    artist: "Anton von Werner",
    colourFieldCount: 32,
    execution: "Antonio Salviati, Venice/Murano",
    figureCueCount: 24,
    material: "polychrome glass mosaic",
    year: "1873-1876",
  },
  name: "Siegessaeule",
  reliefs: {
    architecturalLevel:
      "four side faces of the lower square red-granite base",
    count: 4,
    heightMApprox: 2.1,
    material: "bronze",
    widthMApprox: 11.8,
  },
  sourceUrls: [
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050419",
    "https://www.berlin.de/sehenswuerdigkeiten/3560160-3558930-siegessaeule.html",
    "https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-1084_geschichte-der-siegessaeule.pdf",
    "https://bildhauerei-in-berlin.de/bildwerk/siegessaeule-4706/",
  ],
  viktoria: {
    castPartCount: 17,
    facing: "west towards Ernst-Reuter-Platz",
    gilding: "gold leaf on oil ground",
    heightM: 8.32,
    recognitionCues: [
      "raised laurel wreath in the right hand",
      "field standard with Iron Cross in the left hand",
      "Prussian eagle helmet",
      "two layered feathered wings",
      "wind-filled draped robe",
    ],
    shoeLengthM: 0.92,
    weightT: 35,
  },
  visualReferences: [
    {
      artist: "BugWarp",
      geometryStatus:
        "reference-only QA thumbnail; not used as a runtime texture",
      license: "CC0",
      licenseUrl:
        "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File%3ABerlin_Victory_Column_-_BugWarp_01.jpg",
      role: "2024 full-height view: square base, upper colonnade and shaft hierarchy",
      title: "Berlin Victory Column - BugWarp 01.jpg",
    },
    {
      artist: "OguzKurt28",
      geometryStatus:
        "reference-only QA thumbnail; not used as a runtime texture",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File%3AMosaik_in_der_Berliner_Siegess%C3%A4ule.jpg",
      role: "interior view: restrained gold, blue, red, ivory and green glass colour cues",
      title: "Mosaik in der Berliner Siegessäule.jpg",
    },
  ],
} as const;

/** Texture-free, deliberately muted glass palette for the distant cue. */
export const SIEGESSAEULE_MOSAIC_TONES = [
  0xb58a3d, // gold ground
  0x466b7c, // blue glass
  0x7d4438, // red glass
  0xd2c59d, // ivory glass
  0x4f7062, // green glass
  0x8a6a4b, // amber/brown glass
] as const;

export const SIEGESSAEULE_BRONZE_TONES = {
  field: 0x52665a,
  highlight: 0x708073,
} as const;
