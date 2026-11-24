import { assertSourceLayerV383, isSourceAdditionV383, projectSourceBeforeV383, sourceAtBeforeV383 } from "./sourceHistoryV383";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "1b335c8456ac2e48616298739799e5e31ea8f751";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v382.json", import.meta.url));
if (digest(proof) !== "cf2590594a04375e09e52dcc68d8b62320c5a9e75abb994495e2ef4c38d03a12") {
  throw new Error("Changed immutable v382 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v382 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV382(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV383(path);
}
export function sourceAtBeforeV382(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return sourceAtBeforeV383(path, bytes);
  if (entry.before === digest(bytes)) return bytes;
  bytes = sourceAtBeforeV383(path, bytes);
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v382 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV382(source: string): string {
  source = projectSourceBeforeV383(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV382(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  const atV382: Record<string, string> = { ...before };
  for (const [path, hash] of Object.entries(receipt.additions)) atV382[path] = hash;
  for (const [path, entry] of Object.entries(receipt.changes)) atV382[path] = entry.after;
  assertSourceLayerV383(atV382, files);
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v382 source change: " + path);
    verifyPredecessor(path);
    if (digest(sourceAtBeforeV383(path, readFileSync(resolve(repository, path)))) !== entry.after) throw new Error("Changed v382 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(sourceAtBeforeV383(path, readFileSync(resolve(repository, path)))) !== hash) {
      throw new Error("Changed v382 addition: " + path);
    }
  }
}
