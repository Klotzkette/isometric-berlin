import profile from "./data/arenaStationV225Profile.json";

export const STATION_V225 = profile.station;
export function transferredWarschauerRoofAccentV225(roof: { id: string; y: number; rings: number[][][] }): boolean {
  return roof.id === "way/297153147" && roof.y === 6 && JSON.stringify(roof.rings) === JSON.stringify(STATION_V225.rings);
}
export type SiteBoxV225 = [number, number, number, number, number, number, number, number];
export function stationPointV225(u: number, v: number): [number, number] {
  const f = STATION_V225.frame;
  return [f.x + f.dx * u - f.dz * v, f.z + f.dz * u + f.dx * v];
}
export function insideRingV225(ring: readonly number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
/** Exactly two source-described rows of fourteen columns; unobstructed tracks
 * between them. Local member sizes and floor split are presentation estimates. */
export function stationStructureV225(): SiteBoxV225[] {
  const rows: SiteBoxV225[] = [], f = STATION_V225.frame;
  const yaw = -Math.atan2(f.dz, f.dx);
  for (const v of [-10, 10]) for (let i = 0; i < 14; i++) {
    const [x, z] = stationPointV225(-25 + 50 * i / 13, v);
    rows.push([x, 6.96, z, .7, 6, .7, yaw, 0xb3b5ad]);
  }
  for (const v of [-10, 10]) {
    const [x, z] = stationPointV225(0, v);
    rows.push([x, 9.76, z, 55, .45, .8, yaw, 0xb3b5ad]);
  }
  return rows;
}
