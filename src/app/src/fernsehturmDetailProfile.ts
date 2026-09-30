import { FERNSEHTURM_PROFILE } from "./schlossEastProfile";

export const FERNSEHTURM_DETAIL_GROUP_NAME =
  "Fernsehturm stainless sphere, public levels and sunlight reflection";
export const MINECRAFT_FERNSEHTURM_DETAIL_GROUP_NAME =
  "Minecraft Fernsehturm detailed surface blocks";
/** Published dimensions remain distinct from procedural member subdivisions. */
export const FERNSEHTURM_DETAIL_PROFILE = {
  ...FERNSEHTURM_PROFILE,
  circumferentialPanels: 64,
  shellRows: 24,
  panelRelief: 0.15,
  observationLevel: 203,
  restaurantLevel: 207,
  windowBands: [
    [201.25, 204.05],
    [205.25, 208.05],
  ],
  serviceBottom: 228,
  serviceTop: 250,
  serviceRadius: 6.55,
  nativeCell: 1.5,
  reflection: { narrow: 0.04, broad: 0.31, strength: 1.7 },
  referenceUrls: [
    ...FERNSEHTURM_PROFILE.referenceUrls,
    "https://www.stasi-mediathek.de/medien/fototechnik-auf-dem-berliner-fernsehturm/blatt/11/",
    "https://www.wzv-rostfrei.de/presse/detail/edelstahl-rostfrei-gibt-wahrzeichen-ein-gesicht",
    "https://commons.wikimedia.org/wiki/File:Berliner_Fernsehturm_-_Kugel.jpg",
    "https://commons.wikimedia.org/wiki/File:The_Pope%27s_Revenge.jpg",
  ],
} as const;

/** CPU equivalent of the steel shader, for independent optical regression checks. */
export function fernsehturmSunReflection(
  normal: readonly number[],
  view: readonly number[],
  sun: readonly number[],
  daylight: number,
): number {
  const unit = (a: readonly number[]) => {
    const l = Math.hypot(...a);
    return l > 1e-9 ? a.map((v) => v / l) : [0, 0, 0];
  };
  const dot = (a: readonly number[], b: readonly number[]) =>
    a.reduce((s, v, i) => s + v * b[i], 0);
  const n = unit(normal),
    v = unit(view),
    s = unit(sun);
  if (daylight <= 0 || s[1] <= 0 || dot(n, s) <= 0 || dot(n, v) <= 0) return 0;
  const h = unit(v.map((x, i) => x + s[i]));
  if (Math.hypot(h[0], h[2]) < 1e-5) return 0;
  const tangent = unit([h[2], 0, -h[0]]);
  const up = [
    h[1] * tangent[2] - h[2] * tangent[1],
    h[2] * tangent[0] - h[0] * tangent[2],
    h[0] * tangent[1] - h[1] * tangent[0],
  ];
  // cross(h,tangent) points down; its sign is immaterial to symmetric lobes.
  const x = dot(n, tangent),
    y = dot(n, up);
  const { narrow, broad, strength } = FERNSEHTURM_DETAIL_PROFILE.reflection;
  const vertical = Math.exp(-((x / narrow) ** 2 + (y / broad) ** 2));
  const horizontal = Math.exp(-((x / broad) ** 2 + (y / narrow) ** 2));
  const front = Math.max(0, dot(n, h));
  return (
    Math.max(vertical, horizontal) *
    front ** 12 *
    Math.max(0, dot(n, s)) *
    Math.max(0, dot(n, v)) *
    Math.min(1, daylight) *
    strength
  );
}
