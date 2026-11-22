import { assertSourceLayerV374, isSourceAdditionV374, projectSourceBeforeV374, sourceAtBeforeV374 } from "./sourceHistoryV374";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "ee8bd16766221484ba69fee35dcaaa9d99a37a71";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v373.json", import.meta.url));
if (digest(proof) !== "267f291ea3ba3c928a63cd8f7bea4d0993168b0b7fbc1fafc382e4f03fdfbd01") {
  throw new Error("Changed immutable v373 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v373 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV373(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV374(path);
}
export function sourceAtBeforeV373(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return sourceAtBeforeV374(path, bytes);
  if (entry.before === digest(bytes)) return bytes;
  bytes = sourceAtBeforeV374(path, bytes);
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v373 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV373(source: string): string {
  source = projectSourceBeforeV374(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV373(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  const atV373: Record<string, string> = { ...before };
  for (const [path, hash] of Object.entries(receipt.additions)) atV373[path] = hash;
  for (const [path, entry] of Object.entries(receipt.changes)) atV373[path] = entry.after;
  assertSourceLayerV374(atV373, files);
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v373 source change: " + path);
    verifyPredecessor(path);
    if (digest(sourceAtBeforeV374(path, readFileSync(resolve(repository, path)))) !== entry.after) throw new Error("Changed v373 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(sourceAtBeforeV374(path, readFileSync(resolve(repository, path)))) !== hash) {
      throw new Error("Changed v373 addition: " + path);
    }
  }
}
