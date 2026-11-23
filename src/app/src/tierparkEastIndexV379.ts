import shellIndex from "./data/tierparkEastV379ShellIndex.json";
import lowIndex from "./data/tierparkEastV379LowIndex.json";
import landscape from "./data/tierparkEastV379LandscapeIndex.json";
import type { ShellDataV377 } from "./surveyedBuildingShellsV377";

const shellsAt = new Set<string>(shellIndex);
const lowAt = new Set<string>(lowIndex);
export const tierparkEastIdsV379: ReadonlySet<string> = new Set([...shellIndex, ...lowIndex, ...landscape]);

type Shell = ShellDataV377["shells"]["tiles"][string][number];
type Receipt = ShellDataV377["retirements"]["packets"][string];
type LowRoofs = {shell: Shell; cut: Receipt; nav: [string, number][]};

export function loadTierparkEastLowV379(id: string, native: boolean): Promise<LowRoofs> | undefined {
  if (!lowAt.has(id)) return;
  const file = (native ? "minecraft_" : "drawn_") + id;
  return import(`./data/tierparkEastV379LowTiles/${file}.json`).then(module => module.default as LowRoofs);
}

/** Each packet is local to one 512 m square and one geometry family. The small
 * huts retain individual measured collision heights while sharing a mesh. */
export async function loadTierparkEastShellsV379(id: string, native: boolean): Promise<ShellDataV377 | undefined> {
  if (!shellsAt.has(id) && !lowAt.has(id)) return;
  const file = (native ? "minecraft_" : "drawn_") + id;
  const [houses, low] = await Promise.all([
    shellsAt.has(id) ? import(`./data/tierparkEastV379Tiles/${file}.json`).then(m => m.default as ShellDataV377) : undefined,
    loadTierparkEastLowV379(id, native),
  ]);
  if (!low) return houses;
  if (!houses) return {shells: {tiles: {[id]: [low.shell]}}, retirements: {packets: {[id]: low.cut}}};
  const original = houses.retirements.packets[id];
  const combined = new Map(original.records.map(c => [c.mesh, c]));
  for (const cut of low.cut.records) {
    const other = combined.get(cut.mesh);
    if (other && other.fingerprint !== cut.fingerprint) return houses;
    combined.set(cut.mesh, other ? {...cut, triangles: [...other.triangles,...cut.triangles].sort((a,b)=>a-b)} : cut);
  }
  const receipt = {
    ...original,
    records: [...combined.values()],
    owners: [...original.owners, low.shell.id],
    segments: [...original.segments,...low.cut.segments].sort((a,b)=>a-b),
    lineFingerprint: original.lineFingerprint ?? low.cut.lineFingerprint,
  };
  return {shells:{tiles:{[id]:[...houses.shells.tiles[id],low.shell]}},retirements:{packets:{[id]:receipt}}};
}
