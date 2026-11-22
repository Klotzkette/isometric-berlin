import { assertSourceLayerV375, isSourceAdditionV375, projectSourceBeforeV375, sourceAtBeforeV375 } from "./sourceHistoryV375";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "8f8eeed706cad21addb88c1b87683ef41a292f1c";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v374.json", import.meta.url));
if (digest(proof) !== "a4d00a0086e7fa303750744c319c8c5ceaa3a5c971eb200b759fab9868eda3c6") {
  throw new Error("Changed immutable v374 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v374 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV374(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV375(path);
}
export function sourceAtBeforeV374(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return sourceAtBeforeV375(path, bytes);
  if (entry.before === digest(bytes)) return bytes;
  bytes = sourceAtBeforeV375(path, bytes);
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v374 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV374(source: string): string {
  source = projectSourceBeforeV375(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV374(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  const atV374: Record<string, string> = { ...before };
  for (const [path, hash] of Object.entries(receipt.additions)) atV374[path] = hash;
  for (const [path, entry] of Object.entries(receipt.changes)) atV374[path] = entry.after;
  assertSourceLayerV375(atV374, files);
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v374 source change: " + path);
    verifyPredecessor(path);
    if (digest(sourceAtBeforeV375(path, readFileSync(resolve(repository, path)))) !== entry.after) throw new Error("Changed v374 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(sourceAtBeforeV375(path, readFileSync(resolve(repository, path)))) !== hash) {
      throw new Error("Changed v374 addition: " + path);
    }
  }
}
