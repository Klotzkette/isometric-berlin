import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import type { SteelRailSpanV369 } from "./SteelRailBridgesV369";
import type { SurroundingCityChunk, SurroundingChunkGeometry } from "./SurroundingCityGeometry";

type GeometryFamily = "drawn" | "minecraft";
type Tile = Record<GeometryFamily, SteelRailSpanV369[]> & {
  sha?: Partial<Record<GeometryFamily, string | null>>;
  positionSha?: Partial<Record<GeometryFamily, string | null>>;
};

/** Pages may repack the same source packet losslessly. In that case check
 * its actual position stream before attaching members fitted to that host. */
async function matchesRailHost(
  tile: Tile, family: GeometryFamily, packet: SurroundingCityChunk | undefined, wireHash?: string,
): Promise<boolean> {
  if (!packet) return !tile.sha && !tile.positionSha;
  if (wireHash && wireHash === tile.sha?.[family]) return true;
  const positions = packet.meshes[0]?.positions;
  const digest = tile.positionSha?.[family];
  if (!positions || !digest) return false;
  if (!globalThis.crypto?.subtle) return false;
  const bytes = new TextEncoder().encode(positions);
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("") === digest;
}

export async function attachRailSteelV369(
  entry: SurroundingChunkGeometry, id: string, native: boolean, signal: AbortSignal,
  citywide: boolean, skalitzer: boolean, packet?: SurroundingCityChunk, wireHash?: string,
): Promise<void> {
  signal.throwIfAborted();
  const family = native ? "minecraft" : "drawn";
  if (citywide) {
    const [{ default: data }, { createSteelRailBridgesV369 }] = await Promise.all([
      import("./data/steelRailSpansV369.json"), import("./SteelRailBridgesV369"),
    ]);
    // Generated tuples and material classes are checked by the catalogue tests.
    const tile = (data.tiles as unknown as Record<string, Tile>)[id];
    if (tile && tile[family]?.length && await matchesRailHost(tile, family, packet, wireHash)) {
      signal.throwIfAborted();
      const members = createSteelRailBridgesV369(tile[family], native);
      if (members) {
        attachWorldSpaceDetail(entry, members);
        if (packet && tile[family].some(span => span.deck)) {
          const { restoreRailUnderpassFloorV369 } = await import("./RailUnderpassFloorsV369");
          signal.throwIfAborted();
          restoreRailUnderpassFloorV369(entry, id, native);
        }
      }
    }
  }
  if (skalitzer) {
    const { createSkalitzerSteelV369 } = await import("./SkalitzerSteelV369");
    signal.throwIfAborted();
    const members = createSkalitzerSteelV369(id, native);
    if (members) attachWorldSpaceDetail(entry, members);
  }
}
