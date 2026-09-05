/**
 * Owner-supplied visual references seen from the Akademie der Kuenste are
 * used only to verify the public-space reading and the north-west sightlines.
 * Metric placement remains bound to the committed LoD2/OSM scene anchors.
 */
export const PARISER_PLATZ_ACADEMY_VIEW_PROFILE = {
  geometryStatus:
    "committed LoD2/OSM anchors with an owner-photo-bounded Akademie sightline",
  observation: {
    label: "Akademie der Kuenste, Pariser Platz 4",
    facadeAnchorWorldM: [541.352, 4.75, 351.599] as const,
    osmWayId: 237816189,
    lod2ParentId: "DEBE01YYK00007H6",
  },
  isometricCamera: {
    // Target-to-observer plan bearing. The former 88 degree preset looked
    // almost due east and could not reproduce the diagonal Academy view. At
    // this range and inclination the camera's plan position lands on the
    // Akademie roof edge while the wider lens retains the metric Reichstag
    // background instead of moving it artificially closer.
    azimuth_degrees: 37.02,
    distance_m: 80,
    fov_degrees: 58,
    polar_degrees: 78,
    target_height_m: 7,
  },
  targetWorldM: [497.0499028667109, 8, 292.8503072652966] as const,
  sightlines: {
    brandenburgGate: {
      planDistanceFromAcademyM: 133.629,
      worldM: [417.8984721060842, 8, 300.45274467766285] as const,
    },
    reichstag: {
      planDistanceFromAcademyM: 385.256,
      worldM: [315.0260471937945, 8, 39.83149326406419] as const,
    },
    carillon: {
      planDistanceFromAcademyM: 879.849,
      // Exact official-mesh tower centre used by CulturalLandmarks.
      worldM: [-307.06, 4.51, 118.51] as const,
    },
  },
  publicSpaceCues: {
    bicycleRackGroupCount: 8,
    bicycleSilhouetteCount: 48,
    circulationBoundaryCount: 2,
  },
  ownerVisualReferences: {
    bundled: false,
    count: 6,
    runtimeTexture: false,
    suppliedOn: "2026-09-04",
    view:
      "Pariser Platz from the Akademie der Kuenste, including the Gate, Reichstag and distant Carillon axes",
  },
  performance: {
    minecraftAdditionalDrawCalls: 0,
    smoothAdditionalDrawCalls: 0,
  },
} as const;

export type PariserPlatzAcademyViewProfile =
  typeof PARISER_PLATZ_ACADEMY_VIEW_PROFILE;
