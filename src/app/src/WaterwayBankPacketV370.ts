import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { createWaterwayBanksV370 } from "./WaterwayBanksV370";
import hostIndex from "./data/waterwayBankHostsV370.json";

type Bank = Parameters<typeof createWaterwayBanksV370>[0][number];
type Survey = Bank & {
  modes?: readonly string[];
  nativePoints?: Bank["points"];
  nativeTopY?: readonly number[];
  nativeWaterY?: number;
  nativeFaceOffset?: number;
  nativeWaterSide?: 1 | -1;
};
const sources = {
  Central: () => import("./data/waterwayBanksV370Central.json"),
  North: () => import("./data/waterwayBanksV370North.json"),
  Spree: () => import("./data/waterwayBanksV370Spree.json"),
};
const sections: Record<string, Partial<Record<keyof typeof sources, readonly number[]>>> = hostIndex.sections;

/** Keep surveyed raster steps and their separate crest heights paired on mode changes. */
export async function attachWaterwayBanksV370(entry: SurroundingChunkGeometry, host: string, native: boolean, signal: AbortSignal) {
  const family = native ? "minecraft" : "drawn";
  const selected: Bank[] = [];
  for (const [key, indices] of Object.entries(sections[host] ?? {})) {
    signal.throwIfAborted();
    const { default: source } = await sources[key as keyof typeof sources]();
    const rows = source.records as unknown as readonly Survey[];
    for (const index of indices) {
      const bank = rows[index];
      if (bank.modes && !bank.modes.includes(family)) continue;
      selected.push(native ? {
        ...bank, points: bank.nativePoints ?? bank.points,
        topY: bank.nativeTopY ?? (bank.nativePoints ? undefined : bank.topY),
        faceOffset: bank.nativeFaceOffset ?? bank.faceOffset,
        waterY: bank.nativeWaterY ?? bank.waterY,
        waterSide: bank.nativeWaterSide ?? bank.waterSide,
      } : bank);
    }
  }
  signal.throwIfAborted();
  if (selected.length) {
    const banks = createWaterwayBanksV370(selected, -1.15, native);
    attachWorldSpaceDetail(entry, banks);
  }
}
