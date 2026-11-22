import { assertSourceLayerV372, isSourceAdditionV372, projectSourceBeforeV372, sourceAtBeforeV372 } from "./sourceHistoryV372";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "af0a12d4e691c2a4e267f4460a430343a586c869";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v371.json", import.meta.url));
if (digest(proof) !== "6113f8faac7b34c66e575798c6058dcfecdecb64b7ef015d7136f0a875d5b16c") {
  throw new Error("Changed immutable v371 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v371 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV371(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV372(path);
}
export function sourceAtBeforeV371(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return sourceAtBeforeV372(path, bytes);
  if (entry.before === digest(bytes)) return bytes;
  bytes = sourceAtBeforeV372(path, bytes);
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v371 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV371(source: string): string {
  source = projectSourceBeforeV372(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV371(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  const atV371: Record<string, string> = { ...before };
  for (const [path, hash] of Object.entries(receipt.additions)) atV371[path] = hash;
  for (const [path, entry] of Object.entries(receipt.changes)) atV371[path] = entry.after;
  assertSourceLayerV372(atV371, files);
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v371 source change: " + path);
    verifyPredecessor(path);
    if (digest(sourceAtBeforeV372(path, readFileSync(resolve(repository, path)))) !== entry.after) throw new Error("Changed v371 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(sourceAtBeforeV372(path, readFileSync(resolve(repository, path)))) !== hash) {
      throw new Error("Changed v371 addition: " + path);
    }
  }
}
