import regions from "./data/districtFrontsIndexV379.json";

const byTile = new Map<string, string>();
for (const [region, tileIds] of Object.entries(regions)) {
  for (const tileId of tileIds) byTile.set(tileId, region);
}

export function districtFrontRegionV379(tileId: string): string | undefined {
  return byTile.get(tileId);
}

export function hasDistrictFrontsV379(tileId: string): boolean {
  return byTile.has(tileId);
}
