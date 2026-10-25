import bank0 from "./data/primaryColoursV273_00.json";
import bank1 from "./data/primaryColoursV273_01.json";
import bank2 from "./data/primaryColoursV273_02.json";
import bank3 from "./data/primaryColoursV273_03.json";
import bank4 from "./data/primaryColoursV273_04.json";
import bank5 from "./data/primaryColoursV273_05.json";
import bank6 from "./data/primaryColoursV273_06.json";
import bank7 from "./data/primaryColoursV273_07.json";
import bank8 from "./data/primaryColoursV273_08.json";
import bank9 from "./data/primaryColoursV273_09.json";
import bank10 from "./data/primaryColoursV273_10.json";
import bank11 from "./data/primaryColoursV273_11.json";
import bank12 from "./data/primaryColoursV273_12.json";
import bank13 from "./data/primaryColoursV273_13.json";
import bank14 from "./data/primaryColoursV273_14.json";
import bank15 from "./data/primaryColoursV273_15.json";
import bank16 from "./data/primaryColoursV273_16.json";
import bank17 from "./data/primaryColoursV273_17.json";
import bank18 from "./data/primaryColoursV273_18.json";
import bank19 from "./data/primaryColoursV273_19.json";
import bank20 from "./data/primaryColoursV273_20.json";
import bank21 from "./data/primaryColoursV273_21.json";
import bank22 from "./data/primaryColoursV273_22.json";
import bank23 from "./data/primaryColoursV273_23.json";
import bank24 from "./data/primaryColoursV273_24.json";
import bank25 from "./data/primaryColoursV273_25.json";
import bank26 from "./data/primaryColoursV273_26.json";
import bank27 from "./data/primaryColoursV273_27.json";
import bank28 from "./data/primaryColoursV273_28.json";
import bank29 from "./data/primaryColoursV273_29.json";
import bank30 from "./data/primaryColoursV273_30.json";
import bank31 from "./data/primaryColoursV273_31.json";
import index from "./data/primaryColoursV273Index.json";
import { applyGreyClusterColoursV263, type GreyClusterColourSourceV263 } from "./greyClusterColoursV263";
import { primaryHousePaletteV273 } from "./primaryHousePaletteV273";
import type { SurroundingCityChunk } from "./SurroundingCityGeometry";
const banks = [bank0,bank1,bank2,bank3,bank4,bank5,bank6,bank7,bank8,bank9,bank10,bank11,bank12,bank13,bank14,bank15,bank16,bank17,bank18,bank19,bank20,bank21,bank22,bank23,bank24,bank25,bank26,bank27,bank28,bank29,bank30,bank31] as GreyClusterColourSourceV263[];
const locations: Readonly<Record<string, number>> = index;

/** Each weak shard is read only for its exact current construction packet.
 * The existing guarded decoder validates the whole recipe before any write. */
export function* applyPrimaryColoursV273(
  chunk: SurroundingCityChunk, id: string, native: boolean, mesh: number,
  vertices: Uint16Array, offset: number, count: number,
): Generator<void, number> {
  if (chunk.meshes[mesh]?.kind !== "city") return 0;
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if (!Object.prototype.hasOwnProperty.call(locations, key)) return 0;
  return yield* applyGreyClusterColoursV263(chunk, id, native, mesh, vertices, offset, count,
    banks[locations[key]], primaryHousePaletteV273);
}
