/**
 * Source-bound public envelope of Hotel Adlon Kempinski.
 *
 * Berlin LoD2 remains the authoritative building anchor. Its committed
 * `K00006ot` prism is unusually low and has no usable roof code, so the
 * recognition model may supplement the public facade and roof without
 * replacing or suppressing that source body. OpenStreetMap relation 4582978
 * supplies the current outer ring, three courtyards and semantic height cues.
 */
export const HOTEL_ADLON_PROFILE = {
  lod2BuildingId: "K00006ot",
  osm: {
    courtyardRingsWorldM: [
      [
        [579.61, 338.85],
        [610.08, 335.89],
        [614.42, 349.11],
        [602.97, 352.38],
        [581.03, 354.42],
      ],
      [
        [585.16, 366.0],
        [596.24, 365.45],
        [596.88, 366.97],
        [597.53, 367.65],
        [598.12, 367.74],
        [599.54, 380.89],
        [598.85, 381.32],
        [598.07, 382.11],
        [597.82, 383.34],
        [586.55, 384.18],
      ],
      [
        [588.94, 406.88],
        [599.76, 405.82],
        [600.07, 406.81],
        [600.7, 407.51],
        [601.92, 407.98],
        [602.7, 420.03],
        [602.08, 420.63],
        [601.45, 421.35],
        [601.26, 422.8],
        [589.91, 423.6],
      ],
    ] as const,
    courtyardWayIds: [420445400, 420449359, 420449360] as const,
    outerRingWorldM: [
      [569.31, 405.48],
      [567.65, 405.6],
      [567.41, 402.22],
      [569.01, 402.12],
      [568.2, 392.95],
      [566.64, 393.12],
      [566.27, 389.67],
      [567.89, 389.49],
      [565.99, 368.12],
      [560.98, 368.61],
      [559.49, 350.26],
      [556.88, 319.79],
      [579.68, 317.7],
      [579.62, 316.76],
      [581.97, 316.59],
      [583.41, 316.48],
      [584.85, 316.36],
      [587.19, 316.19],
      [587.26, 317.02],
      [625.39, 313.71],
      [634.82, 347.22],
      [598.15, 357.47],
      [601.92, 403.03],
      [603.21, 416.15],
      [603.8, 422.1],
      [605.09, 440.93],
      [586.43, 446.57],
      [568.24, 451.53],
      [566.51, 432.73],
      [571.68, 432.18],
    ] as const,
    outerWayId: 26041943,
    relationId: 4582978,
  },
  front: {
    axisWorld: [0.9961, -0.0884] as const,
    bearingDegreesXZ: -5.07,
    centerWorldM: [591.135, 316.75] as const,
    eastWorldM: [625.39, 313.71] as const,
    lengthM: 68.78,
    outwardNormalWorld: [-0.0884, -0.9961] as const,
    // Three.js maps local +x to (cos(y), -sin(y)) in the world x/z plane.
    rotationY: (5.07 * Math.PI) / 180,
    westWorldM: [556.88, 319.79] as const,
  },
  returns: {
    east: {
      bearingDegreesXZ: 74.28294498586578,
      endWorldM: [634.82, 347.22] as const,
      lengthM: 34.81156417054546,
      outerRingZeroBasedIndices: [19, 20] as const,
      sourceEdge:
        "contiguous east-front return of OpenStreetMap outer way 26041943",
      startWorldM: [625.39, 313.71] as const,
    },
    west: {
      bearingDegreesXZ: 85.10410759346918,
      endWorldM: [559.49, 350.26] as const,
      lengthM: 30.58157942291402,
      outerRingZeroBasedIndices: [11, 10] as const,
      sourceEdge:
        "contiguous west-front return of OpenStreetMap outer way 26041943, traversed toward the rear",
      startWorldM: [556.88, 319.79] as const,
    },
  },
  heights: {
    eavesEvidence:
      "inferred from OSM six wall levels plus the two CC BY-SA facade views; not treated as a surveyed LoD2 height",
    eavesWorldY: 27.2,
    groundWorldY: 4.8,
    groundEvidence: "measured from committed Berlin LoD2 payload K00006ot",
    lod2MeasuredHeightM: 11.5,
    osmHeightTagM: 22,
    ridgeEvidence:
      "inferred from OSM one roof level and the CC BY-SA mansard silhouette; not treated as a surveyed LoD2 height",
    ridgeWorldY: 34,
    status:
      "ground and low source shell are LoD2-measured; six wall levels and one roof level are OSM-tagged; eaves and ridge supplement the faulty low shell from freely licensed facade views",
  },
  publicFacade: {
    archBayCount: 5,
    eastDormerCount: 3,
    eastDormerPedimentCount: 3,
    eastUpperWindowAxisCount: 4,
    frontDormerCount: 8,
    frontDormerPedimentCount: 8,
    frontHeadDepthM: 22,
    frontHorizontalCourseCount: 6,
    frontWindowMuntinCount: 47,
    frontWindowAxesM: [-28.2, -21.1, -14.0, -7.0, 0, 7.0, 14.0, 21.1, 28.2] as const,
    germanFlagStripeCount: 3,
    roofLetteringGroupCount: 2,
    roofFlagpoleCount: 3,
  },
  sources: {
    kempinskiHistory:
      "https://www.kempinski.com/en/hotel-adlon/overview/hotel-information/the-adlon-history",
    lod2:
      "Geoportal Berlin 3D building models LoD2, dl-de/zero-2-0; payload K00006ot",
    osm:
      "OpenStreetMap relation 4582978 and ways 26041943/420445400/420449359/420449360, ODbL 1.0",
    ownerVisualReference: {
      bundled: false,
      runtimeTexture: false,
      role: "current front-facade, mansard, flag and forecourt appearance QA only",
      view: "Hotel Adlon seen from the Starbucks side of Pariser Platz, supplied 2026-09-04",
    },
    visualReferences: [
      "https://commons.wikimedia.org/wiki/File:Hotel_Adlon_Berlin-Mitte.jpg (Lukas Beck, CC BY-SA 4.0)",
      "https://commons.wikimedia.org/wiki/File:Hotel_Adlon_Kempinski,_2024_(02).jpg (Bahnfrend, CC BY-SA 4.0)",
    ] as const,
  },
} as const;

export type HotelAdlonProfile = typeof HOTEL_ADLON_PROFILE;
