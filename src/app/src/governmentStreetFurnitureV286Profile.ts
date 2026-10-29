import type { GovernmentStreetLampAnchorV286 } from "./GovernmentStreetLampsV286";

const westYaw = Math.PI - .02936;
const eastYaw = -.02936;

/** The first ten XZ anchors are retained municipal points. The other ten
 * are explicitly unmeasured photo/kerb-aligned spacing estimates. All 6.8 m
 * heights preserve the earlier display fallback, never a surveyed height.
 * The lamp recipe extends towards local -X; both rows face the carriageway. */
export const GOVERNMENT_STREET_LAMP_ANCHORS_V286 = [
  { id: "231349", x: -31.99, z: -49.36, yawRadians: eastYaw, heightM: 6.8 },
  { id: "231363", x: -46.17, z: -46.44, yawRadians: westYaw, heightM: 6.8 },
  { id: "231319", x: -49.39, z: 102.99, yawRadians: westYaw, heightM: 6.8 },
  // Only the seven photo-evidenced Paul-Löbe crossing points join this
  // family. Head headings are estimates facing the respective carriageway.
  { id: "244884", x: -55.31, z: -71.55, yawRadians: Math.PI / 2, heightM: 6.8 },
  { id: "92930", x: -46.29, z: -71.33, yawRadians: Math.PI / 2, heightM: 6.8 },
  { id: "92928", x: -31.22, z: -68.88, yawRadians: Math.PI / 2, heightM: 6.8 },
  // This eastern corner head serves Heinrich's east verge. Turning it west
  // follows that approach and avoids aiming into nearby 92928's south dish;
  // this orientation is a photo/context estimate, not a measured bearing.
  { id: "92927", x: -31.33, z: -66, yawRadians: eastYaw, heightM: 6.8 },
  { id: "92931", x: -55.45, z: -62.24, yawRadians: -Math.PI / 2, heightM: 6.8 },
  { id: "92925", x: -19.44, z: -63.82, yawRadians: -Math.PI / 2, heightM: 6.8 },
  { id: "92926", x: -18.74, z: -70.76, yawRadians: Math.PI / 2, heightM: 6.8 },
  { id: "photo-west-01", x: -47.852, z: -21.5, yawRadians: westYaw, heightM: 6.8 },
  { id: "photo-west-02", x: -48.584, z: 3.4, yawRadians: westYaw, heightM: 6.8 },
  { id: "photo-west-03", x: -49.315, z: 28.3, yawRadians: westYaw, heightM: 6.8 },
  { id: "photo-west-04", x: -50.046, z: 53.2, yawRadians: westYaw, heightM: 6.8 },
  { id: "photo-west-05", x: -50.778, z: 78.1, yawRadians: westYaw, heightM: 6.8 },
  { id: "photo-east-01", x: -32.818, z: -21.5, yawRadians: eastYaw, heightM: 6.8 },
  { id: "photo-east-02", x: -33.55, z: 3.4, yawRadians: eastYaw, heightM: 6.8 },
  { id: "photo-east-03", x: -34.281, z: 28.3, yawRadians: eastYaw, heightM: 6.8 },
  { id: "photo-east-04", x: -35.012, z: 53.2, yawRadians: eastYaw, heightM: 6.8 },
  { id: "photo-east-05", x: -35.744, z: 78.1, yawRadians: eastYaw, heightM: 6.8 },
] as const satisfies readonly GovernmentStreetLampAnchorV286[];

/** Photos 1 and 4 share the same distinctive sticker sequence. Their west
 * verge/tree/hydrant context identifies this post, rather than the separate
 * eastern guidepost node 5151420229. Bearings follow retained route axes;
 * they are display estimates, not surveyed board orientations. */
export const GOVERNMENT_WAYFINDING_PLACEMENT_V286 = {
  sourceNodeId: "10298343088",
  x: -51.299,
  z: -51.259,
  directions: {
    potsdamerTor: -1.6001567363,
    hauptbahnhofMoabit: 1.5414359173,
    reichstag: -.0198751526,
    schoenebergSiegessaeule: 3.1217175010,
  },
} as const;
