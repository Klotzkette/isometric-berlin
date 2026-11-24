import type { PrismPayload } from "./IsometricCityWorld";
import { correctGardenPrismsV358 } from "./LehrterGardenPayloadV358";
import { isBrowserWorldFetch } from "./startupWorldRequests";
import { fetchJsonWithRetry, type JsonFetchOptions } from "./resilientFetch";
import { matchesBerlinHistoricDomOwnersV288 } from "./BerlinHistoricCoreV288Ownership";
import { admitsChancelleryCanopySourceV289 } from "./ChancelleryCanopySourceV289Ownership";
import { admitsMoabitMitteV300Core } from "./MoabitMitteV300Ownership";
import { admitsPotsdamerCorridorCoreV288 } from "./PotsdamerCorridorV288Ownership";
import { admitsWestKiezV302Core } from "./WestKiezV302CoreOwnership";

type PrismSource = { buildings: unknown };

const ownedSources = new WeakSet<object>();

/** Take ownership of the corrected JSON returned by the city fetch. Nested coordinates
 * and all source records become immutable before construction can yield to another task.
 * Generic callers and synthetic payloads keep their original validation behaviour. */
export function ownFetchedPrismsV383<T extends PrismSource>(source: T): T {
  function freezeJson(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const child of value) freezeJson(child);
    } else {
      for (const child of Object.values(value)) freezeJson(child);
    }
    Object.freeze(value);
  }
  freezeJson(source);
  ownedSources.add(source);
  return source;
}

/** Ordinary fetch and the adopted speculative Response both deliver privately parsed JSON. */
export async function fetchCityPrismsV383(url: URL, options: JsonFetchOptions): Promise<PrismPayload> {
  const payload = correctGardenPrismsV358(await fetchJsonWithRetry<PrismPayload>(url, options));
  return isBrowserWorldFetch(options.fetcher) ? ownFetchedPrismsV383(payload) : payload;
}

/** Share the five complete source checks only inside the transaction that read the payload.
 * The actual mode, native-column and legacy-owner decisions stay with each consumer. */
export function checkCorePrismsV383(source: PrismSource, checkNeighbourhoods: boolean) {
  const buildings = source.buildings;
  const results = Object.freeze({
    moabitMitte: checkNeighbourhoods ? admitsMoabitMitteV300Core(source) : undefined,
    westKiez: checkNeighbourhoods ? admitsWestKiezV302Core(source) : undefined,
    historicDom: matchesBerlinHistoricDomOwnersV288(buildings),
    potsdamerCorridor: admitsPotsdamerCorridorCoreV288(source),
    chancelleryCanopy: admitsChancelleryCanopySourceV289(source),
  });
  // A long-lived walking callback must never keep the original city JSON alive.
  const verified = new WeakMap<PrismSource, typeof results>();
  if (ownedSources.has(source)) verified.set(source, results);
  return { results, forSource: (candidate: PrismSource) => verified.get(candidate) };
}
export type CorePrismChecksV383 = ReturnType<typeof checkCorePrismsV383>;
