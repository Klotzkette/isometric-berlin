import { Points, type BufferGeometry } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";
import { isTransportAirportHostV378, transportRouteBankV378 } from "./transportV378Index";
import { createTransportCorridorsV378, type TransportRowV378 } from "./transportV378Corridors";

type Bank = Record<
  string,
  { both?: TransportRowV378[]; drawn?: TransportRowV378[]; minecraft?: TransportRowV378[] }
>;
let loaders: Record<string, () => Promise<unknown>> = {};
try {
  loaders = import.meta.glob("./data/transportV378/*.json.gz", { query: "?url", import: "default" });
} catch {
  /* The standalone decoder can use the same local, immutable packet. */
}
const parsed = new Map<string, WeakRef<Bank>>();
async function loadBank(bank: string, signal: AbortSignal): Promise<Bank> {
  const cached = parsed.get(bank)?.deref();
  if (cached) return cached;
  const path = `./data/transportV378/${bank}.json.gz`,
    loader = loaders[path];
  const url = loader ? ((await loader()) as string) : new URL(path, import.meta.url).href;
  signal.throwIfAborted();
  const response = await fetch(url, { signal });
  if (!response.ok || Number(response.headers.get("content-length")) > 128 * 1024)
    throw Error(`Invalid transport bank ${bank}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  signal.throwIfAborted();
  if (bytes.byteLength < 18 || bytes.byteLength > 128 * 1024)
    throw Error(`Transport bank ${bank} exceeds its transfer bounds`);
  const expected = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    bytes.byteLength - 4,
    true,
  );
  if (expected < 2 || expected > 512 * 1024) throw Error(`Transport bank ${bank} exceeds its decoded bounds`);
  const raw = gunzipSync(bytes, { out: new Uint8Array(expected + 1) });
  if (raw.length !== expected) throw Error(`Invalid transport bank length for ${bank}`);
  const value = JSON.parse(new TextDecoder().decode(raw)) as Bank;
  parsed.set(bank, new WeakRef(value));
  return value;
}

/** Runs inside the existing finite tile admission, after decoding and before publication. */
export async function attachTransportV378(
  entry: SurroundingChunkGeometry,
  id: string,
  native: boolean,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  if (entry.root.userData.transportV378) return;
  if (isTransportAirportHostV378(id)) {
    const { createTransportAirportsV378 } = await import("./transportV378Airports");
    signal.throwIfAborted();
    if (entry.root.userData.transportV378) return;
    const part = createTransportAirportsV378(id, native);
    if (!part) return;
    attachWorldSpaceDetail(entry, part);
    // The common mesh accounting helper intentionally handles meshes; the BER beacon is one optional point.
    part.traverse((child) => {
      if (child instanceof Points) {
        const halo = (child.geometry as BufferGeometry).getAttribute("position");
        if (halo) {
          entry.geometryBytes += halo.array.byteLength;
          entry.bufferCount++;
        }
      }
    });
    if (part.userData.updateTransportAirportsV378)
      entry.root.userData.updateTransportV378 = part.userData.updateTransportAirportsV378;
  } else {
    const bank = transportRouteBankV378(id);
    if (!bank) return;
    const source = await loadBank(bank, signal);
    signal.throwIfAborted();
    if (entry.root.userData.transportV378) return;
    const tile = source[id],
      rows = tile?.both ?? tile?.[native ? "minecraft" : "drawn"];
    if (!rows) return;
    const [ix, iz] = id.slice("transport378-".length).split("_").map(Number);
    const { root, ground, roads } = createTransportCorridorsV378(rows, ix, iz, native);
    if (!root.children.length) return;
    // This new synthetic owner starts empty. Its ground and its mesh use the same metric cell coordinates.
    entry.origin = [ix * 512, 0, iz * 512];
    entry.root.position.set(...entry.origin);
    entry.root.updateMatrix();
    attachWorldSpaceDetail(entry, root);
    entry.nav = { ...entry.nav, groundY: 3.105, ground, roads };
  }
  entry.root.userData.transportV378 = true;
}
