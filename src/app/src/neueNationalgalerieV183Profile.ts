import source from "./data/neueNationalgalerieV183Source.json";

export const NATIONALGALERIE_V183_IDS = new Set(source.parts.map(p => p.id));
export const NATIONALGALERIE_V183 = {
  center: source.centerXZ, yaw: -19.58 * Math.PI / 180,
  roofWidth: 64.8, glassWidth: 50.4, grid: 3.6, columns: 8,
  floorY: 9.82, columnHeight: 8.4, roofThickness: 1.8,
  verticalStatus: "Source terrace top and museum-published 8.4 m hall; member sections are display fits",
} as const;
export function nationalgalerieV183Column(x: number, z: number): boolean {
  return source.parts.some(p => {
    const ring = p.ring; let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] / 10 > z) !== (b[1] / 10 > z) &&
          x < (b[0] - a[0]) * (z - a[1] / 10) / (b[1] - a[1]) + a[0] / 10) inside = !inside;
    }
    return inside;
  });
}
