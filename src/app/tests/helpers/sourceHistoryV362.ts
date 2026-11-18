import { assertSourceLayerV363, isSourceAdditionV363, projectSourceBeforeV363, sourceAtBeforeV363 } from "./sourceHistoryV363";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "b1900f3b044f63eeb120af4f2b212cfe7ef104d6";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v362.json", import.meta.url));
if (digest(proof) !== "213cb4fffa8f2ecf0124e8b31abc0546df73643668a684e9146edf8c5588e881") {
  throw new Error("Changed immutable v362 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v362 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV362(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV363(path);
}
export function sourceAtBeforeV362(path: string, bytes: Uint8Array): Uint8Array {
  if (receipt.changes[path]?.before === digest(bytes)) return bytes;
  bytes = sourceAtBeforeV363(path, bytes);
  const entry = receipt.changes[path];
  if (!entry) return bytes;
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v362 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV362(source: string): string {
  source = projectSourceBeforeV363(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV362(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  const atV362: Record<string, string> = { ...before };
  for (const [path, hash] of Object.entries(receipt.additions)) atV362[path] = hash;
  for (const [path, entry] of Object.entries(receipt.changes)) atV362[path] = entry.after;
  assertSourceLayerV363(atV362, files);
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v362 source change: " + path);
    verifyPredecessor(path);
    if (digest(sourceAtBeforeV363(path, readFileSync(resolve(repository, path)))) !== entry.after) throw new Error("Changed v362 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(sourceAtBeforeV363(path, readFileSync(resolve(repository, path)))) !== hash) {
      throw new Error("Changed v362 addition: " + path);
    }
  }
}
