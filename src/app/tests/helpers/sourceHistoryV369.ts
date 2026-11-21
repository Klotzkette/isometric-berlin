import { assertSourceLayerV370, isSourceAdditionV370, projectSourceBeforeV370, sourceAtBeforeV370 } from "./sourceHistoryV370";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "cc02feb6473631cb36e4095784226dfd7689bef7";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v369.json", import.meta.url));
if (digest(proof) !== "7fd1770f5639fcad1d5354096805323bb0da7508f5c553d17ee632e8befb6b3f") {
  throw new Error("Changed immutable v369 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v369 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV369(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV370(path);
}
export function sourceAtBeforeV369(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return sourceAtBeforeV370(path, bytes);
  if (entry.before === digest(bytes)) return bytes;
  bytes = sourceAtBeforeV370(path, bytes);
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v369 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV369(source: string): string {
  source = projectSourceBeforeV370(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV369(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  const atV369: Record<string, string> = { ...before };
  for (const [path, hash] of Object.entries(receipt.additions)) atV369[path] = hash;
  for (const [path, entry] of Object.entries(receipt.changes)) atV369[path] = entry.after;
  assertSourceLayerV370(atV369, files);
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v369 source change: " + path);
    verifyPredecessor(path);
    if (digest(sourceAtBeforeV370(path, readFileSync(resolve(repository, path)))) !== entry.after) throw new Error("Changed v369 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(sourceAtBeforeV370(path, readFileSync(resolve(repository, path)))) !== hash) {
      throw new Error("Changed v369 addition: " + path);
    }
  }
}
