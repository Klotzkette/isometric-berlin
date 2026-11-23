import { assertSourceLayerV379, isSourceAdditionV379, projectSourceBeforeV379, sourceAtBeforeV379 } from "./sourceHistoryV379";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "a8b8e169414683d1dae4a85cd0d9beca3bd49063";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v378.json", import.meta.url));
if (digest(proof) !== "34f968b654aa8d28c8654b4fbaf5e28f6784c44dd946bce0820a1ee648d2fd71") {
  throw new Error("Changed immutable v378 source proof");
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
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v378 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV378(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV379(path);
}
export function sourceAtBeforeV378(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return sourceAtBeforeV379(path, bytes);
  if (entry.before === digest(bytes)) return bytes;
  bytes = sourceAtBeforeV379(path, bytes);
  const hash = digest(bytes);
  if (hash === entry.before) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v378 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV378(source: string): string {
  source = projectSourceBeforeV379(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV378(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  const atV378: Record<string, string> = { ...before };
  for (const [path, hash] of Object.entries(receipt.additions)) atV378[path] = hash;
  for (const [path, entry] of Object.entries(receipt.changes)) atV378[path] = entry.after;
  assertSourceLayerV379(atV378, files);
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v378 source change: " + path);
    verifyPredecessor(path);
    if (digest(sourceAtBeforeV379(path, readFileSync(resolve(repository, path)))) !== entry.after) throw new Error("Changed v378 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || (!path.endsWith(".json.gz") && !files.includes(path)) || digest(sourceAtBeforeV379(path, readFileSync(resolve(repository, path)))) !== hash) {
      throw new Error("Changed v378 addition: " + path);
    }
  }
}
