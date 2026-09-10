import type { BuildingDetailDistrict } from "./buildingDetailStreaming";

/** Five recently visited districts reuse uploaded detail on turns and reversals. */
export const MOBILE_DETAIL_SPARE_DISTRICTS = 5;
export const MOBILE_DETAIL_CACHE_PART_LIMIT = 4_800;

export function retainedBuildingDetailIds(
  districts: readonly BuildingDetailDistrict[],
  wanted: readonly string[],
  attached: readonly string[],
  lastUsed: ReadonlyMap<string, number>,
): Set<string> {
  const counts = new Map(districts.map((district) => [district.id, district.count]));
  // Reserve capacity for wanted districts still being built, not just those
  // attached already. This keeps the eventual resident total bounded too.
  let parts = wanted.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
  const wantedIds = new Set(wanted);
  const retained = new Set(attached.filter((id) => wantedIds.has(id)));
  const candidates = attached.map((id, index) => ({ id, index }))
    .filter(({ id }) => !wantedIds.has(id) && counts.has(id))
    .sort((a, b) => (lastUsed.get(b.id) ?? 0) - (lastUsed.get(a.id) ?? 0) || b.index - a.index);
  let spares = 0;
  for (const { id } of candidates) {
    const count = counts.get(id)!;
    if (spares >= MOBILE_DETAIL_SPARE_DISTRICTS || parts + count > MOBILE_DETAIL_CACHE_PART_LIMIT) continue;
    retained.add(id);
    parts += count;
    spares += 1;
  }
  return retained;
}
