type XZ = readonly [number, number];
type WallExhibit = {
  key: string;
  tile: string;
  ground: number;
  centres: readonly XZ[];
  displayBoards: boolean;
};

function pairOnMappedLine(start: XZ, end: XZ): XZ[] {
  const dx = end[0] - start[0], dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  return [-0.605, 0.605].map(offset => [
    (start[0] + end[0]) / 2 + dx / length * offset,
    (start[1] + end[1]) / 2 + dz / length * offset,
  ]);
}

// World metres in EPSG:25833. The six station footing positions were read
// individually from the 2026 TrueDOP. The other two mapped lines each carry
// one exhibited pair of original panels. See docs/potsdamer-platz-v385.md.
export const potsdamerWallExhibitsV385: readonly WallExhibit[] = [
  { key: "node/4844728421", tile: "0_1", ground: 5.3, displayBoards: true,
    centres: [[308.20, 1001.02], [307.78, 1003.77], [307.37, 1006.52],
      [307.03, 1009.27], [306.62, 1011.93], [306.20, 1014.60]] },
  { key: "way/393884518", tile: "0_1", ground: 5.1, displayBoards: false,
    centres: pairOnMappedLine([472.515, 981.172], [471.128, 984.546]) },
  { key: "way/393884517", tile: "0_2", ground: 5.3, displayBoards: false,
    centres: pairOnMappedLine([432.585, 1099.352], [431.887, 1102.052]) },
];

type Box = [colour: number, x: number, y: number, z: number, width: number, height: number, length: number, yaw: number];

/** The Landesdenkmalamt gives the original L profile as 1.20 × 3.60 m.
 * Feet, concrete colours and the intervening interpretation panels are fitted
 * to photographs of the exhibition; there is no invented inscription. */
export function potsdamerWallBoxesV385(site: WallExhibit): Box[] {
  const groundY = site.ground;
  const points = site.centres;
  const first = points[0], last = points[points.length - 1];
  const yaw = Math.atan2(last[0] - first[0], last[1] - first[1]);
  const nx = Math.cos(yaw), nz = -Math.sin(yaw);
  const result: Box[] = [];
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    result.push([0x98968d, x + nx * 0.72, groundY + 0.105, z + nz * 0.72, 1.65, 0.21, 1.20, yaw]);
    result.push([i % 2 === 0 ? 0xb7b5aa : 0xb2afa5, x, groundY + 1.8, z, 0.18, 3.60, 1.20, yaw]);
    if (site.displayBoards && i > 0) {
      const [ax, az] = points[i - 1];
      const gap = Math.hypot(x - ax, z - az) - 1.2;
      const cx = (x + ax) / 2, cz = (z + az) / 2;
      result.push([0x696b67, cx, groundY + 1.75, cz, 0.095, 3.15, gap, yaw]);
      result.push([0xd1d0c9, cx - nx * 0.056, groundY + 1.85, cz - nz * 0.056, 0.025, 2.5, gap - 0.09, yaw]);
    }
  }
  return result;
}
