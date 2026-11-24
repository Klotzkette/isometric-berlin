import type { ShellDataV377 } from "./surveyedBuildingShellsV377";

/** Preserve the already surveyed neighbour and the independent receipts for
 * its predecessor. Both owners occupy the same unmodified primary packet. */
export async function loadMatthiaskircheV383(tile: string, native: boolean, previous?: ShellDataV377): Promise<ShellDataV377> {
  const mode = native ? "minecraft" : "drawn";
  const extra: ShellDataV377 = (await import(`./data/matthiaskircheV383/${mode}_${tile}.json`)).default;
  const prior = previous?.retirements.packets[tile];
  if (!previous || !prior) return extra;
  const next = extra.retirements.packets[tile];
  if (prior.origin.some((value, i) => value !== next.origin[i]) ||
      (prior.segments.length && next.segments.length && prior.lineFingerprint !== next.lineFingerprint)) {
    return previous;
  }
  return {
    shells: {tiles: {[tile]: [...previous.shells.tiles[tile], ...extra.shells.tiles[tile]]}},
    retirements: {packets: {[tile]: {
      origin: next.origin,
      records: [...prior.records, ...next.records],
      owners: [...prior.owners, ...next.owners],
      lineFingerprint: prior.lineFingerprint ?? next.lineFingerprint,
      segments: [...new Set([...prior.segments, ...next.segments])].sort((a, b) => a - b),
    }}},
  };
}
