import { buildingDetailProfile, type BuildingDetailDistrict, type BuildingDetailProfileName } from "./buildingDetailStreaming";

/** Five recently visited districts reuse uploaded detail on turns and reversals. */
export const MOBILE_DETAIL_SPARE_DISTRICTS = 5;
export const MOBILE_DETAIL_CACHE_PART_LIMIT = 4_800;

export function retainedBuildingDetailIds(
  districts: readonly BuildingDetailDistrict[],
  wanted: readonly string[],
  attached: readonly string[],
  lastUsed: ReadonlyMap<string, number>,
  profile: BuildingDetailProfileName = "mobile",
): Set<string> {
  // Desktop already retains 9,000 exact source parts. Replace those districts
  // as the view moves instead of adding an unbounded visited-city cache.
  const spareLimit = profile === "full" ? 0 : MOBILE_DETAIL_SPARE_DISTRICTS;
  const partLimit = profile === "full"
    ? buildingDetailProfile(profile).residentPartLimit : MOBILE_DETAIL_CACHE_PART_LIMIT;
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
    if (spares >= spareLimit || parts + count > partLimit) continue;
    retained.add(id);
    parts += count;
    spares += 1;
  }
  return retained;
}
