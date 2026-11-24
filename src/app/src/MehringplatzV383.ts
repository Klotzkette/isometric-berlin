import { platzModelGroupV383 } from "./platzModelGroupV383";

/** Import only the selected style. Defer Three.js allocation until the core world adopts it. */
export async function prepareMehringplatzV383(native: boolean) {
  const packet = native
    ? await import("./data/mehringplatzV383/native.json")
    : await import("./data/mehringplatzV383/drawn.json");
  return () => platzModelGroupV383("Wohnringe am Mehringplatz und Hochbahnhof Hallesches Tor", native, packet.default);
}

export async function createMehringplatzV383(native: boolean) {
  return (await prepareMehringplatzV383(native))();
}
