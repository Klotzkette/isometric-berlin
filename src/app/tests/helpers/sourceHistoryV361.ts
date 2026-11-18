import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "2ca955fa0ba7d6dac6ef4a951bc8c1d4e5d4070e";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v361.json", import.meta.url));
if (digest(proof) !== "f668928be7b1c56f7b50eed9b11fa5b72f31754f8c0cc1e3b3afb6ff1ef3486c") {
  throw new Error("Changed immutable v361 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v361 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV361(path: string): boolean {
  return Object.hasOwn(receipt.additions, path);
}
export function sourceAtBeforeV361(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return bytes;
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v361 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV361(source: string): string {
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV361(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v361 source change: " + path);
    verifyPredecessor(path);
    if (digest(readFileSync(resolve(repository, path))) !== entry.after) throw new Error("Changed v361 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(readFileSync(resolve(repository, path))) !== hash) {
      throw new Error("Changed v361 addition: " + path);
    }
  }
}
