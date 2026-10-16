/** Retained OSM points; photo-informed orientations and local sculpture geometry. */
export const NATIONALGALERIE_SCULPTURES_V221 = {
  calder: {
    id: "calder-tetes-et-queue", title: "Têtes et Queue", artist: "Alexander Calder", year: 1965,
    osmNode: "1881346242", centerXZ: [-341.5806234625634, 1344.9708629120141],
    baseY: 9.8, yaw: 1.0, heightM: 5.5, widthM: 4.7, depthM: 3.3,
    material: "Black painted steel", heads: 6, feet: 7,
    sourceUrls: [
      "https://calder.org/works/monumental-sculpture/tetes-et-queue-1965-2/",
      "https://www.smb.museum/museen-einrichtungen/neue-nationalgalerie/sammeln-forschen/restaurierung/tetes-et-queue-alexander-calder-1965/",
      "https://bildhauerei-in-berlin.de/bildwerk/koepfe-und-schwanz-tetes-et-queue-4686/",
    ],
  },
  moore: {
    id: "moore-archer", title: "Three Way Piece No. 2: Archer", artist: "Henry Moore", year: 1964,
    osmNode: "1881346251", centerXZ: [-241.7248615444405, 1290.5216721436009],
    baseY: 9.8, yaw: .65, heightM: 3.05, figureHeightM: 2.25, pedestalHeightM: .8,
    pedestalRadiusM: 1.12, widthM: 2.51, depthM: 2.24,
    material: "Bronze on a dark grey hollow steel pedestal",
    sourceUrls: ["https://bildhauerei-in-berlin.de/bildwerk/bogenschuetze-archer-5052/"],
  },
  geometryStatus: "Original procedural reading of owner photos; profiles, thickness, patina and yaw are display estimates, not scans or surveyed installation geometry",
  heightStatus: "Calder: museum-published 5.5 x 4.7 x 3.3 m. Moore: Berlin-specific Bildhauerei inventory 2.25 m figure plus 0.8 m pedestal; other cast dimensions differ",
  source: "Retained OpenStreetMap artwork nodes and owner-supplied October 2026 photographs; photographs are reference-only and never bundled",
  maxGpuBytes: { drawn: 1_048_576, minecraft: 262_144 },
  maxRenderables: 2,
  maxCompleteRenderables: 3,
} as const;

/** Affine fit of the authored plate profiles to the museum's overall envelope. */
export const CALDER_LOCAL_FIT_V221 = {
  centerX: .221817553, centerZ: -.080590963,
  scaleX: 4.7 / 4.343634963, scaleZ: 3.3 / 2.982578039,
} as const;

/** Ground-level contacts only, leaving the open spaces among the steel legs free.
 * Higher leg sections incline inward; these conservative circles are navigation fits. */
export const CALDER_FOOT_CONTACTS_V221 = [
  { x: -1.865, z: .02, radius: .23 }, { x: 1.145, z: .02, radius: .23 },
  { x: -.675, z: 1.355, radius: .23 }, { x: .705, z: -1.355, radius: .23 },
  { x: -.633, z: -1.515, radius: .23 }, { x: .667, z: 1.23, radius: .23 },
  { x: 2.26, z: .055, radius: .23 },
].map(foot => ({
  x: (foot.x - CALDER_LOCAL_FIT_V221.centerX) * CALDER_LOCAL_FIT_V221.scaleX,
  z: (foot.z - CALDER_LOCAL_FIT_V221.centerZ) * CALDER_LOCAL_FIT_V221.scaleZ,
  radius: foot.radius,
}));

/** Navigation contacts, not a bounding box closing Calder's open leg spaces. */
export function nationalgalerieSculptureSolidAtV221(x: number, y: number, z: number, radius = 0): boolean {
  const { calder, moore } = NATIONALGALERIE_SCULPTURES_V221;
  if (y >= moore.baseY - .05 && y < moore.baseY + moore.pedestalHeightM) {
    const distance = Math.hypot(x - moore.centerXZ[0], z - moore.centerXZ[1]);
    if (distance < moore.pedestalRadiusM + radius && distance > .86 - radius) return true;
  }
  if (y < calder.baseY - .05 || y >= calder.baseY + 1.4) return false;
  const dx = x - calder.centerXZ[0], dz = z - calder.centerXZ[1];
  if (Math.abs(dx) > 4 + radius || Math.abs(dz) > 4 + radius) return false;
  const c = Math.cos(calder.yaw), s = Math.sin(calder.yaw);
  const u = c * dx - s * dz, v = s * dx + c * dz;
  return CALDER_FOOT_CONTACTS_V221.some(foot =>
    (u - foot.x) ** 2 + (v - foot.z) ** 2 < (foot.radius + radius) ** 2);
}
