/**
 * Source-bound street furniture opposite Hotel Adlon.
 *
 * OpenStreetMap supplies the two point anchors. The owner's 2026 street-level
 * photograph is used only to bound proportions, colours and visible parts;
 * it is never copied into the viewer or used as a runtime texture.
 */
export const ADLON_FORECOURT_PROFILE = {
  geometryStatus:
    "exact OSM point anchors with bounded code-native proportions from one owner-supplied street-level reference",
  sourceCheckedOn: "2026-09-04",
  kiosk: {
    displayDimensionsM: {
      canopyDepth: 6.2,
      canopyWidth: 11.2,
      depth: 5.4,
      wallHeight: 2.5,
      width: 10.2,
    },
    name: "Curry Wolf",
    osmNodeId: 10885617184,
    osmWorldM: [602.459568, 4.84, 291.132611] as const,
    recognitionCues: [
      "low oval dark-metal body",
      "wine-red fascia with pale sign fields",
      "three north-facing service windows and counter",
      "two red parasols",
      "adjacent dark waste bin and pale utility cabinets",
    ] as const,
    sourceUrl: "https://www.openstreetmap.org/node/10885617184",
  },
  elevator: {
    displayDimensionsM: {
      depth: 3.6,
      height: 5.2,
      roofDepth: 4.2,
      roofWidth: 5.6,
      width: 4.8,
    },
    levels: "-3;-1;0",
    osmNodeId: 2451641811,
    osmWorldM: [593.845696, 4.84, 277.485931] as const,
    recognitionCues: [
      "dark steel corner frame",
      "full-height divided glazing",
      "visible central cabin and landing doors",
      "flat projecting canopy",
    ] as const,
    sourceUrl: "https://www.openstreetmap.org/node/2451641811",
  },
  ownerVisualReference: {
    bundled: false,
    runtimeTexture: false,
    role: "proportion, material and present-day appearance QA only",
    view: "Hotel Adlon and forecourt seen from the Starbucks side of Pariser Platz",
  },
  performance: {
    minecraftAdditionalDrawCalls: 0,
    minecraftProfile: "block-native surface shell in the existing Pariser-Platz instance batch",
    smoothAdditionalDrawCalls: 0,
    smoothProfile: "static geometry merged into the existing Pariser-Platz fine-detail batches",
  },
} as const;

export type AdlonForecourtProfile = typeof ADLON_FORECOURT_PROFILE;
