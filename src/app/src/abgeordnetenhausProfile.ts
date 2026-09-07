import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const ABGEORDNETENHAUS_GROUP_NAME = "Abgeordnetenhaus source-plan architecture";
export const ABGEORDNETENHAUS_MINECRAFT_GROUP_NAME = "Abgeordnetenhaus block-native architecture";
export const ABGEORDNETENHAUS_FINE_LAYER_NAME = "Abgeordnetenhaus carved facade detail";

/** Official plan; faulty source height is preserved as evidence, never called a survey. */
export const ABGEORDNETENHAUS_PROFILE = {
  mainPrismId: "eaCxS2u2",
  mainGmlId: "DEBE3DEXeaCxS2u2",
  parentGmlId: "DEBE01YYK00003f4",
  sourceUrl: "https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5818.zip",
  sourceCreated: "2026-03-02",
  sourceRetrieved: "2026-09-07",
  sourceSha256: "42af73193652b7506736cf1f833db00ebbc0a882d285fae264b7881d04a208b3",
  sourceZipBytes: 4339514,
  sourceHeightM: 3,
  sourceGroundY: 2.346,
  sourceTopY: 5.598,
  groundY: 4.8,
  displayWallHeightM: 25,
  displayCentralHeightM: 28,
  displayParapetHeightM: 1.26,
  displayRoofRiseM: 3.2,
  wallTopY: 29.8,
  centralCorniceTopY: 32.8,
  roofTopY: 34.06,
  facadeOriginWorldXZ: [658.3, 1287.65] as const,
  facadeYaw: Math.atan2(3.3, 47.4),
  centralWidthM: Math.hypot(47.4, 3.3),
  centralUpperArchCount: 7,
  colossalColumnCount: 6,
  portalCount: 3,
  sideWingBays: 4,
  rearStoreys: 6,
  footprintWorldM: [[634.3,1284.4],[611.5,1286.1],[610.9,1278.2],[610.2,1278.2],[609.0,1262.3],[609.7,1262.2],[609.1,1254.2],[609.9,1254.2],[606.7,1211.8],[606.3,1206.9],[605.6,1207.0],[605.3,1203.9],[604.8,1203.9],[604.6,1200.8],[605.1,1200.8],[604.9,1197.7],[616.9,1196.8],[617.0,1197.8],[636.9,1196.3],[636.9,1195.7],[649.3,1194.8],[649.1,1192.4],[649.7,1192.4],[654.4,1192.1],[654.5,1194.4],[665.8,1193.5],[665.8,1194.1],[685.8,1192.6],[685.7,1191.6],[697.8,1190.7],[698.0,1193.8],[698.5,1193.8],[698.7,1196.9],[698.2,1196.9],[698.5,1200.0],[697.7,1200.1],[700.2,1233.9],[701.2,1247.3],[702.0,1247.3],[702.6,1255.2],[703.3,1255.2],[704.5,1271.1],[703.8,1271.2],[704.4,1279.2],[681.7,1280.9],[682.0,1286.0],[666.2,1287.1],[666.3,1288.2],[650.5,1289.3],[650.4,1288.2],[634.6,1289.3]] as const,
  courtyardHolesWorldM: [[[675.3,1206.0],[676.6,1223.4],[688.1,1222.5],[686.8,1205.1]],[[678.5,1249.8],[690.1,1248.9],[688.8,1231.5],[677.2,1232.4]],[[668.0,1243.3],[662.5,1243.7],[663.0,1249.2],[668.4,1248.8]],[[642.1,1245.2],[642.5,1250.7],[648.0,1250.3],[647.6,1244.8]],[[629.4,1209.4],[617.8,1210.3],[619.1,1227.7],[630.7,1226.8]],[[631.4,1235.8],[619.8,1236.7],[621.1,1254.1],[632.7,1253.3]]] as const,
  evidenceUrls: [
    "https://www.parlament-berlin.de/das-haus/architektur",
    "https://www.parlament-berlin.de/media/download/541",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096004",
    "https://www.parlament-berlin.de/aktuelles-presse/pressebilder-zum-download",
  ],
  geometryStatus: "Official LoD2 footprint and six court holes; faulty 3 m source height replaced by explicitly non-surveyed 25/28 m facade-height estimates proportioned to the current official facade view. Rear annexes remain authoritative source prisms. Cornices, roof planes, bay locations and carved forms are bounded display reconstruction.",
} as const;

export function abgeordnetenhausLocalPoint(x: number, z: number): [number, number] {
  const [cx, cz] = ABGEORDNETENHAUS_PROFILE.facadeOriginWorldXZ;
  const yaw = ABGEORDNETENHAUS_PROFILE.facadeYaw;
  return [(x-cx)*Math.cos(yaw)-(z-cz)*Math.sin(yaw), (x-cx)*Math.sin(yaw)+(z-cz)*Math.cos(yaw)];
}

export function abgeordnetenhausWorldPoint(x: number, y: number, z: number): [number, number, number] {
  const [cx, cz] = ABGEORDNETENHAUS_PROFILE.facadeOriginWorldXZ;
  const yaw = ABGEORDNETENHAUS_PROFILE.facadeYaw;
  return [cx+x*Math.cos(yaw)+z*Math.sin(yaw), y, cz-x*Math.sin(yaw)+z*Math.cos(yaw)];
}

export function abgeordnetenhausMainContains(x: number, z: number): boolean {
  return pointInWorldRing(x, z, ABGEORDNETENHAUS_PROFILE.footprintWorldM as WorldRing)
    && !ABGEORDNETENHAUS_PROFILE.courtyardHolesWorldM.some((ring) => pointInWorldRing(x, z, ring as WorldRing));
}

/** Display reconstruction only; never extends collision across a source courtyard. */
export function abgeordnetenhausDisplayTopAt(x: number, z: number): number | null {
  if (!abgeordnetenhausMainContains(x, z)) return null;
  const [u, v] = abgeordnetenhausLocalPoint(x, z);
  if (Math.abs(u) < 23.7 && v > -14.2) return ABGEORDNETENHAUS_PROFILE.roofTopY;
  const roof = Math.max(Math.abs(u) / 12, Math.max(0, Math.abs(v + 59) - 5) / 8);
  return ABGEORDNETENHAUS_PROFILE.wallTopY + (roof < 1 ? 3.2 * (1-roof) : 0);
}
