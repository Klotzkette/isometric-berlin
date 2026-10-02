import { buildingTerrainOffset } from "./weinbergTerrainV176";

export const ZIONSKIRCHE_V174_TERRAIN_OFFSET = buildingTerrainOffset("DEBE01YYK0000014", 2231.897, -1706.217, 3);

/** Original authoring datum stays explicit. Geometry arrays live in the lazy model module. */
export const ZIONSKIRCHE_V174_PROFILE = Object.freeze({
  name: "Zionskirche",
  osmWayId: "27685450",
  parentId: "DEBE01YYK0000014",
  monumentId: "09011312",
  sourcePartIds: ["DEBE3DMTn7l5hBAe", "DEBE3DbSb0cJwbVg", "DEBE3DwWmZ1lKvwB", "DEBE3Dj5UEZckkkC"],
  sourceBounds: [2213.382, -1730.738, 2248.243, -1675.879],
  groundY: 3,
  terrainOffsetY: ZIONSKIRCHE_V174_TERRAIN_OFFSET,
  displayGroundY: 3 + ZIONSKIRCHE_V174_TERRAIN_OFFSET,
  sourceGroundNHN: 53.332,
  sourceTowerHeightM: 48.126,
  sourceTowerTopY: 51.126,
  publishedOverallHeightM: 67,
  topY: 70,
  sourceEnvelopeOwner: "Alt-Mitte v169",
  sourceShellDuplicated: false,
  sourcePacketsChanged: false,
  sourceStatus: "Measured Alt-Mitte walls and roofs remain. Thin facade detail and the missing masonry spire are additive visual estimates; 67 m overall is published primary evidence.",
});

export const ZIONSKIRCHE_V174_TOWER_RING: readonly (readonly number[])[] = [
  [2236.328, -1677.956], [2233.350, -1679.833],
  [2232.571, -1683.267], [2234.449, -1686.245],
  [2237.883, -1687.024], [2240.861, -1685.146],
  [2241.639, -1681.712], [2239.762, -1678.734],
];
export const ZIONSKIRCHE_V174_TOWER_CENTER = [2237.105375, -1682.489625] as const;
const layers: readonly (readonly number[])[] = [
  [50.88, 1.04], [51.55, 1.04], [51.75, .985],
  [67.90, .055], [68.20, .055], [68.32, .10], [68.52, .10],
];
let nativeRoofs: Map<string, number> | undefined;

/** Register only the constructed upper native solids, never at cold start. */
export function registerZionskircheV174NativeRoof(blocks: readonly number[][]): void {
  const roofs = new Map<string, number>();
  for (const [x, y, z, , width, role, height, depth] of blocks) {
    if (role < 9) continue;
    for (let ix = Math.floor((x - width / 2) * 4); ix < Math.ceil((x + width / 2) * 4); ix++) {
      for (let iz = Math.floor((z - depth / 2) * 4); iz < Math.ceil((z + depth / 2) * 4); iz++) {
        const key = `${ix},${iz}`;
        roofs.set(key, Math.max(roofs.get(key) ?? -Infinity, y + height / 2 + ZIONSKIRCHE_V174_TERRAIN_OFFSET));
      }
    }
  }
  nativeRoofs = roofs;
}

/** Only new upper roof geometry. Existing LoD2 navigation remains authoritative. */
export function zionskircheV174RoofAt(x: number, z: number, minecraft = false): number | null {
  const [cx, cz] = ZIONSKIRCHE_V174_TOWER_CENTER;
  if (Math.abs(x - cx) > 5.5 || Math.abs(z - cz) > 5.5) return null;
  if (minecraft) return nativeRoofs?.get(`${Math.floor(x * 4)},${Math.floor(z * 4)}`) ?? null;
  let scale = 0;
  for (let i = 0; i < 8; i++) {
    const a = ZIONSKIRCHE_V174_TOWER_RING[i], b = ZIONSKIRCHE_V174_TOWER_RING[(i + 1) % 8];
    let nx = -(b[1] - a[1]), nz = b[0] - a[0];
    if (nx * (a[0] - cx) + nz * (a[1] - cz) < 0) { nx *= -1; nz *= -1; }
    scale = Math.max(scale, (nx * (x - cx) + nz * (z - cz)) / (nx * (a[0] - cx) + nz * (a[1] - cz)));
  }
  if (scale > 1.04) return null;
  if (Math.abs(x - cx) <= .08 && Math.abs(z - cz) <= .08) return 70 + ZIONSKIRCHE_V174_TERRAIN_OFFSET;
  if (Math.abs(x - cx) <= .60 && Math.abs(z - cz) <= .08) return 69.6 + ZIONSKIRCHE_V174_TERRAIN_OFFSET;
  let roof: number | null = null;
  for (let i = 1; i < layers.length; i++) {
    const [ya, ra] = layers[i - 1], [yb, rb] = layers[i];
    if (scale <= Math.max(ra, rb)) {
      const y = scale <= Math.min(ra, rb) || ra === rb ? yb : ya + (yb - ya) * (scale - ra) / (rb - ra);
      roof = Math.max(roof ?? -Infinity, y);
    }
  }
  return roof === null ? null : roof + ZIONSKIRCHE_V174_TERRAIN_OFFSET;
}
