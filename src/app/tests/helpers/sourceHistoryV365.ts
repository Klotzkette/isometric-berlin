import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "fe52de7527ead2fe5d692c64853ae140cd3d3200";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v365.json", import.meta.url));
if (digest(proof) !== "f5fc348f39be55e0390d2133d528508eb4a52c81618f2a136fd0512be9e921b4") {
  throw new Error("Changed immutable v365 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v365 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV365(path: string): boolean {
  return Object.hasOwn(receipt.additions, path);
}
export function sourceAtBeforeV365(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return bytes;
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v365 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV365(source: string): string {
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV365(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v365 source change: " + path);
    verifyPredecessor(path);
    if (digest(readFileSync(resolve(repository, path))) !== entry.after) throw new Error("Changed v365 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(readFileSync(resolve(repository, path))) !== hash) {
      throw new Error("Changed v365 addition: " + path);
    }
  }
}
