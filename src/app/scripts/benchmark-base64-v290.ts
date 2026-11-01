import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { decodeBase64Bytes } from "../src/decodeBase64Bytes";

// Microbenchmark of the same immutable constructor inputs, excluding the
// unchanged geometry construction, gzip inflation, network and GPU upload.
const streams: string[] = [];
function visit(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(visit); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, field] of Object.entries(value)) {
    if (["positions", "colors", "indices"].includes(key) && typeof field === "string") streams.push(field);
    else visit(field);
  }
}
for (const name of ["moabitLandmarksV269", "tachelesFrontsV270", "golgathaV270", "auguststrasseMuralV270", "potsdamerCorridorCoreV288"]) {
  visit(JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), "utf8")));
}
const previousDecode = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const samples = { previousMs: [] as number[], currentMs: [] as number[], fallbackMs: [] as number[] };
function run(decode: (text: string) => Uint8Array<ArrayBuffer>) {
  const receipt = createHash("sha256");
  let bytes = 0;
  const start = performance.now();
  for (const text of streams) {
    const decoded = decode(text); receipt.update(decoded); bytes += decoded.byteLength;
  }
  return { milliseconds: performance.now() - start, bytes, sha256: receipt.digest("hex") };
}
run(previousDecode); run(decodeBase64Bytes);
let exact: ReturnType<typeof run> | undefined;
for (let i = 0; i < 9; i++) {
  const old = run(previousDecode), current = run(decodeBase64Bytes);
  if (old.sha256 !== current.sha256 || old.bytes !== current.bytes) throw new Error("Decoded source bytes changed");
  samples.previousMs.push(old.milliseconds); samples.currentMs.push(current.milliseconds); exact = current;
}
const nativeDescriptor = Object.getOwnPropertyDescriptor(Uint8Array, "fromBase64");
Object.defineProperty(Uint8Array, "fromBase64", { value: undefined, writable: true, configurable: true });
try {
  run(decodeBase64Bytes);
  for (let i = 0; i < 9; i++) {
    const fallback = run(decodeBase64Bytes);
    if (fallback.sha256 !== exact!.sha256 || fallback.bytes !== exact!.bytes) throw new Error("Fallback bytes changed");
    samples.fallbackMs.push(fallback.milliseconds);
  }
} finally {
  if (nativeDescriptor) Object.defineProperty(Uint8Array, "fromBase64", nativeDescriptor);
  else delete (Uint8Array as { fromBase64?: unknown }).fromBase64;
}
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
console.log(JSON.stringify({ streams: streams.length, decodedBytes: exact!.bytes, sha256: exact!.sha256,
  nativeDecoderAvailable: typeof (Uint8Array as { fromBase64?: unknown }).fromBase64 === "function",
  previousMedianMs: median(samples.previousMs), currentMedianMs: median(samples.currentMs),
  fallbackMedianMs: median(samples.fallbackMs), samples }, null, 2));
