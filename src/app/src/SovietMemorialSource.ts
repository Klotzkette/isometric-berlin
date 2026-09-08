/** Exact committed OSM and Berlin LoD2 anchors; local sections are display estimates. */
export const SOVIET_MEMORIAL_SOURCE = {
  name: "Sowjetisches Ehrenmal Tiergarten",
  osmKey: "way/41368167",
  soldierOsmKey: "node/278740616",
  catalogWorldM: [26.57719945925055, 8, 245.32870413176715] as const,
  soldierWorldM: [27.4392347924, 4.79, 253.760733404] as const,
  // Angle of the exact pair of source tank nodes, also confirmed by DOP2025.
  rotationY: 0.08223736774175701,
  groundY: 4.79,
  tanks: [
    {
      side: "west",
      number: "200",
      osmKey: "node/489762789",
      worldXZ: [-7.91679659905, 307.389059542] as const,
      yaw: Math.PI / 2,
    },
    {
      side: "east",
      number: "300",
      osmKey: "node/489764929",
      worldXZ: [69.8889564662, 300.97605561] as const,
      yaw: -Math.PI / 2,
    },
  ] as const,
  guns: [
    {
      side: "west",
      osmKey: "node/489765078",
      worldXZ: [7.79502157704, 287.390836736] as const,
    },
    {
      side: "east",
      osmKey: "node/489766052",
      worldXZ: [50.8411016825, 282.575250762] as const,
    },
  ] as const,
  // Six piers and beam curvature bounded by the retained WJ00005g/h plans.
  // The soldier stands at local z=-3 so old sculptural coordinates stay intact.
  piers: [
    [-18.2, 1.4],
    [-11.8, -1.25],
    [-5.7, -2.65],
    [5.7, -2.65],
    [11.8, -1.25],
    [18.2, 1.4],
  ] as const,
  tankPlinthM: [8.1, 1.35, 4.8] as const,
  gunPlinthM: [10.5, 1.15, 8.5] as const,
  sources: [
    "https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/friedhoefe-und-begraebnisstaetten/sowjetische-ehrenmale/tiergarten/",
    "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
    "https://www.openstreetmap.org/way/41368167",
  ],
} as const;

export const SOVIET_MEMORIAL_REPLACEMENT_RINGS: Readonly<
  Record<string, readonly (readonly [number, number])[]>
> = {
  K0002Kle: [
    [29.1, 248.6],
    [29.5, 254.1],
    [28.7, 254.1],
    [28.9, 256.0],
    [25.1, 256.3],
    [24.9, 254.4],
    [24.1, 254.5],
    [23.7, 249.1],
  ],
  FubIvyI4: [
    [-9.4, 304.4],
    [-16.3, 220.7],
    [63.2, 214.7],
    [70.0, 297.7],
  ],
  WJ00005h: [
    [39.8, 255.9],
    [34.7, 254.6],
    [29.5, 254.1],
    [29.2, 250.4],
    [33.2, 250.7],
    [37.1, 251.3],
    [40.9, 252.4],
    [46.3, 254.9],
    [44.5, 258.1],
  ],
  WJ00005g: [
    [19.1, 255.8],
    [14.3, 257.9],
    [10.0, 260.8],
    [7.7, 257.9],
    [11.0, 255.7],
    [14.4, 253.8],
    [18.1, 252.3],
    [23.9, 250.9],
    [24.1, 254.5],
  ],
};
export const SOVIET_MEMORIAL_PRISM_IDS: ReadonlySet<string> = new Set(
  Object.keys(SOVIET_MEMORIAL_REPLACEMENT_RINGS),
);

/** World source coordinates to unrotated architectural coordinates. */
export function sovietMemorialLocalXZ(x: number, z: number): [number, number] {
  const dx = x - SOVIET_MEMORIAL_SOURCE.soldierWorldM[0];
  const dz = z - SOVIET_MEMORIAL_SOURCE.soldierWorldM[2];
  const c = Math.cos(SOVIET_MEMORIAL_SOURCE.rotationY);
  const s = Math.sin(SOVIET_MEMORIAL_SOURCE.rotationY);
  return [c * dx - s * dz, s * dx + c * dz - 3];
}

export function sovietMemorialWorldXZ(x: number, z: number): [number, number] {
  const c = Math.cos(SOVIET_MEMORIAL_SOURCE.rotationY);
  const s = Math.sin(SOVIET_MEMORIAL_SOURCE.rotationY);
  return [
    SOVIET_MEMORIAL_SOURCE.soldierWorldM[0] + c * x + s * (z + 3),
    SOVIET_MEMORIAL_SOURCE.soldierWorldM[2] - s * x + c * (z + 3),
  ];
}

function insideRing(
  x: number,
  z: number,
  ring: readonly (readonly [number, number])[],
  margin = 0,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j],
      [bx, bz] = ring[i];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax)
      inside = !inside;
    const dx = bx - ax,
      dz = bz - az;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)),
    );
    if (margin > 0 && Math.hypot(x - ax - t * dx, z - az - t * dz) <= margin)
      return true;
  }
  return inside;
}

/** Only the four source envelopes resolved by this open memorial are replaced. */
export function isSovietMemorialReplacementPoint(
  x: number,
  z: number,
  margin = 0,
): boolean {
  if (
    x < -18 - margin ||
    x > 71 + margin ||
    z < 214 - margin ||
    z > 306 + margin
  )
    return false;
  return Object.values(SOVIET_MEMORIAL_REPLACEMENT_RINGS).some((ring) =>
    insideRing(x, z, ring, margin),
  );
}

/** Open colonnade and forecourt override the old full-height source boxes. */
export function sovietMemorialWalkableAt(
  x: number,
  y: number,
  z: number,
  sourceId?: string,
): boolean {
  if (sourceId && !SOVIET_MEMORIAL_PRISM_IDS.has(sourceId)) return false;
  return (
    y >= SOVIET_MEMORIAL_SOURCE.groundY - 1 &&
    y <= 34 &&
    isSovietMemorialReplacementPoint(x, z, 0.85)
  );
}

/** Granular static solids shared with the two rendered representations. */
export function sovietMemorialSolidAt(
  x: number,
  y: number,
  z: number,
  radius = 0,
): boolean {
  const [lx, lz] = sovietMemorialLocalXZ(x, z);
  const ly = y - SOVIET_MEMORIAL_SOURCE.groundY;
  if (
    lx < -46 - radius ||
    lx > 46 + radius ||
    lz < -25 - radius ||
    lz > 54 + radius
  )
    return false;
  const box = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    lo: number,
    hi: number,
  ) =>
    ly >= lo &&
    ly <= hi &&
    Math.abs(lx - cx) <= w / 2 + radius &&
    Math.abs(lz - cz) <= d / 2 + radius;
  if (box(0, -3, 7.2, 4.8, 0, 13.3)) return true;
  for (const [px, pz] of SOVIET_MEMORIAL_SOURCE.piers)
    if (box(px, pz, Math.abs(px) > 18 ? 2.7 : 2.35, 2.82, 0, 8.1)) return true;
  for (const tank of SOVIET_MEMORIAL_SOURCE.tanks) {
    const [tx, tz] = sovietMemorialLocalXZ(tank.worldXZ[0], tank.worldXZ[1]);
    if (box(tx, tz, 8.1, 4.8, 0, 1.53) || box(tx, tz, 6.2, 3.2, 1.53, 4.25))
      return true;
  }
  for (const gun of SOVIET_MEMORIAL_SOURCE.guns) {
    const [gx, gz] = sovietMemorialLocalXZ(gun.worldXZ[0], gun.worldXZ[1]);
    if (box(gx, gz, 10.5, 8.5, 0, 1.15) || box(gx, gz, 3.3, 3, 1.15, 3.7))
      return true;
  }
  return [-1, 1].some((side) => box(side * 6.8, 29, 2.4, 3.5, 0, 1.9));
}

/** Tops of the rendered paving, two stair flights and intervening terrace. */
export function sovietMemorialGroundAt(x: number, z: number): number | null {
  const [lx, lz] = sovietMemorialLocalXZ(x, z);
  if (Math.abs(lx) > 39 || lz < -3.8 || lz > 50.5) return null;
  let localY: number | null = Math.abs(lx) <= 39 && lz >= -2.5 ? 0.14 : null;
  const top = (cx: number, cz: number, w: number, d: number, y: number) => {
    if (Math.abs(lx - cx) <= w / 2 && Math.abs(lz - cz) <= d / 2)
      localY = Math.max(localY ?? 0, y);
  };
  top(0, 15.9, 57, 24, 1.47);
  for (let i = 0; i < 8; i += 1)
    top(0, 31.6 - i * 0.475, 29.7, 8.5 - i * 0.95, 0.27 + i * 0.18);
  for (let i = 0; i < 4; i += 1)
    top(0, 1 - i * 0.5, 43 - i * 0.8, 9.5 - i, 1.66 + i * 0.18);
  return localY === null ? null : SOVIET_MEMORIAL_SOURCE.groundY + localY;
}
