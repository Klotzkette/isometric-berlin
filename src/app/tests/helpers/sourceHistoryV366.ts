import { assertSourceLayerV367, isSourceAdditionV367, projectSourceBeforeV367, sourceAtBeforeV367 } from "./sourceHistoryV367";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "ebf93b660faf3c25a05e5824c0db9e9f952d0acb";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v366.json", import.meta.url));
if (digest(proof) !== "d1d48c3fb18be134428a7ec692ac36ff1821e48b95599d7be93cee89ba417fcd") {
  throw new Error("Changed immutable v366 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v366 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV366(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV367(path);
}
export function sourceAtBeforeV366(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return sourceAtBeforeV367(path, bytes);
  if (entry.before === digest(bytes)) return bytes;
  bytes = sourceAtBeforeV367(path, bytes);
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v366 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV366(source: string): string {
  source = projectSourceBeforeV367(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV366(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  const atV366: Record<string, string> = { ...before };
  for (const [path, hash] of Object.entries(receipt.additions)) atV366[path] = hash;
  for (const [path, entry] of Object.entries(receipt.changes)) atV366[path] = entry.after;
  assertSourceLayerV367(atV366, files);
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v366 source change: " + path);
    verifyPredecessor(path);
    if (digest(sourceAtBeforeV367(path, readFileSync(resolve(repository, path)))) !== entry.after) throw new Error("Changed v366 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(sourceAtBeforeV367(path, readFileSync(resolve(repository, path)))) !== hash) {
      throw new Error("Changed v366 addition: " + path);
    }
  }
}
