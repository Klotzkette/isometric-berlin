import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "03761c23e3303d8847b2e9df05f3de93afa68eb9";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v363.json", import.meta.url));
if (digest(proof) !== "bbe72f6073a522a1d16f0887d0c0a445f09bc10717e84857621da141081b86fd") {
  throw new Error("Changed immutable v363 source proof");
}
const receipt = JSON.parse(proof.toString()) as {
  additions: Record<string, string>;
  changes: Record<string, { before: string; after: string }>;
};
const previous = new Map<string, Buffer>();
function verifyPredecessor(path: string): Buffer {
  const cached = previous.get(path);
  if (cached) return cached;
  const raw = execFileSync("git", ["show", baseline + ":" + path], { cwd: repository, maxBuffer: 32 * 1024 * 1024 });
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v363 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV363(path: string): boolean {
  return Object.hasOwn(receipt.additions, path);
}
export function sourceAtBeforeV363(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return bytes;
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v363 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV363(source: string): string {
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV363(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v363 source change: " + path);
    verifyPredecessor(path);
    if (digest(readFileSync(resolve(repository, path))) !== entry.after) throw new Error("Changed v363 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(readFileSync(resolve(repository, path))) !== hash) {
      throw new Error("Changed v363 addition: " + path);
    }
  }
}
