import { assertSourceLayerV368, isSourceAdditionV368, projectSourceBeforeV368, sourceAtBeforeV368 } from "./sourceHistoryV368";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "4b30ee7ceeb5a7283d038031b7e174aee0811b5c";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v367.json", import.meta.url));
if (digest(proof) !== "9a7420ad2c9bfc48530df1a0c0fb1408fdccea1cc66d78bc458f5e84829d4045") {
  throw new Error("Changed immutable v367 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v367 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV367(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV368(path);
}
export function sourceAtBeforeV367(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return sourceAtBeforeV368(path, bytes);
  if (entry.before === digest(bytes)) return bytes;
  bytes = sourceAtBeforeV368(path, bytes);
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v367 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV367(source: string): string {
  source = projectSourceBeforeV368(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV367(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  const atV367: Record<string, string> = { ...before };
  for (const [path, hash] of Object.entries(receipt.additions)) atV367[path] = hash;
  for (const [path, entry] of Object.entries(receipt.changes)) atV367[path] = entry.after;
  assertSourceLayerV368(atV367, files);
  for (const [path, entry] of Object.entries(receipt.changes)) {
    // The original source inventory indexed the church JSON header only.
    // Verify its paired binary independently against the released Git blob.
    const original = path === "src/app/src/data/nikolaikircheV353Packets.json.gz" && before[path] === undefined
      ? digest(verifyPredecessor(path)) : before[path];
    if (original !== entry.before) throw new Error("Unexpected v367 source change: " + path);
    verifyPredecessor(path);
    if (digest(sourceAtBeforeV368(path, readFileSync(resolve(repository, path)))) !== entry.after) throw new Error("Changed v367 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(sourceAtBeforeV368(path, readFileSync(resolve(repository, path)))) !== hash) {
      throw new Error("Changed v367 addition: " + path);
    }
  }
}
