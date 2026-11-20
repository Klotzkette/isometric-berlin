import { assertSourceLayerV369, isSourceAdditionV369, projectSourceBeforeV369, sourceAtBeforeV369 } from "./sourceHistoryV369";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "5a3503f55f34d63f81815c07e457ac3ac62bb9ce";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v368.json", import.meta.url));
if (digest(proof) !== "6f551b65ba8dd09938cc0f3aa767d7a503cfdbaa2deef918eda8ae32fd77f587") {
  throw new Error("Changed immutable v368 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v368 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV368(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV369(path);
}
export function sourceAtBeforeV368(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return sourceAtBeforeV369(path, bytes);
  if (entry.before === digest(bytes)) return bytes;
  bytes = sourceAtBeforeV369(path, bytes);
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v368 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV368(source: string): string {
  source = projectSourceBeforeV369(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV368(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  const atV368: Record<string, string> = { ...before };
  for (const [path, hash] of Object.entries(receipt.additions)) atV368[path] = hash;
  for (const [path, entry] of Object.entries(receipt.changes)) atV368[path] = entry.after;
  assertSourceLayerV369(atV368, files);
  for (const [path, entry] of Object.entries(receipt.changes)) {
    // The original source inventory indexed the church JSON header only.
    // Verify its paired binary independently against the released Git blob.
    const original = path === "src/app/src/data/nikolaikircheV353Packets.json.gz" && before[path] === undefined
      ? digest(verifyPredecessor(path)) : before[path];
    if (original !== entry.before) throw new Error("Unexpected v368 source change: " + path);
    verifyPredecessor(path);
    if (digest(sourceAtBeforeV369(path, readFileSync(resolve(repository, path)))) !== entry.after) throw new Error("Changed v368 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(sourceAtBeforeV369(path, readFileSync(resolve(repository, path)))) !== hash) {
      throw new Error("Changed v368 addition: " + path);
    }
  }
}
