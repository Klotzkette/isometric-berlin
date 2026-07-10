export type HeroCacheCandidate = {
  lastUsed: number;
  loading: boolean;
  name: string;
};

export function heroDetailEvictions(
  entries: readonly HeroCacheCandidate[],
  activeName: string,
  limit: number,
): string[] {
  const overflow = Math.max(0, entries.length - Math.max(0, Math.floor(limit)));
  return entries
    .filter((entry) => !entry.loading && entry.name !== activeName)
    .sort(
      (left, right) =>
        left.lastUsed - right.lastUsed || left.name.localeCompare(right.name),
    )
    .slice(0, overflow)
    .map((entry) => entry.name);
}
