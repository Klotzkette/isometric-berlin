import { platzModelGroupV383 } from "./platzModelGroupV383";

export async function prepareArbeitsministeriumQuartierV383(native: boolean) {
  const packet = native
    ? await import("./data/arbeitsministeriumQuartierV383/native.json")
    : await import("./data/arbeitsministeriumQuartierV383/drawn.json");
  return () => platzModelGroupV383("Hofbeamtenhaus und Zietenplatz", native, [packet.default]);
}

export async function createArbeitsministeriumQuartierV383(native: boolean) {
  return (await prepareArbeitsministeriumQuartierV383(native))();
}
