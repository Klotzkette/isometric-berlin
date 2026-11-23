import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "a6a0f5816cba38c909e310473fb71a7e9cc1ce88";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v376.json", import.meta.url));
if (digest(proof) !== "87441516e8cfcf38e48c6ea46631ffc498e2e46025f90aebc8d9c5d3ced34ed2") {
  throw new Error("Changed immutable v376 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v376 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV376(path: string): boolean {
  return Object.hasOwn(receipt.additions, path);
}
export function sourceAtBeforeV376(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return bytes;
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v376 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV376(source: string): string {
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV376(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v376 source change: " + path);
    verifyPredecessor(path);
    if (digest(readFileSync(resolve(repository, path))) !== entry.after) throw new Error("Changed v376 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(readFileSync(resolve(repository, path))) !== hash) {
      throw new Error("Changed v376 addition: " + path);
    }
  }
}
