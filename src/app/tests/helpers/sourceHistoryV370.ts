import { assertSourceLayerV371, isSourceAdditionV371, projectSourceBeforeV371, sourceAtBeforeV371 } from "./sourceHistoryV371";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "2de930a1376ab21e65c1aa01b9708dc0127a9fc3";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v370.json", import.meta.url));
if (digest(proof) !== "20b4dc00e02b14c816075b5485baa99b690069f8d5ea7a9628da0ae94a35a5ef") {
  throw new Error("Changed immutable v370 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v370 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV370(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV371(path);
}
export function sourceAtBeforeV370(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return sourceAtBeforeV371(path, bytes);
  if (entry.before === digest(bytes)) return bytes;
  bytes = sourceAtBeforeV371(path, bytes);
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v370 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV370(source: string): string {
  source = projectSourceBeforeV371(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV370(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  const atV370: Record<string, string> = { ...before };
  for (const [path, hash] of Object.entries(receipt.additions)) atV370[path] = hash;
  for (const [path, entry] of Object.entries(receipt.changes)) atV370[path] = entry.after;
  assertSourceLayerV371(atV370, files);
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v370 source change: " + path);
    verifyPredecessor(path);
    if (digest(sourceAtBeforeV371(path, readFileSync(resolve(repository, path)))) !== entry.after) throw new Error("Changed v370 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(sourceAtBeforeV371(path, readFileSync(resolve(repository, path)))) !== hash) {
      throw new Error("Changed v370 addition: " + path);
    }
  }
}
