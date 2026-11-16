import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "df60c8de0f00d3dcf9a451e4c9fa6995ad754c47";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v355.json", import.meta.url));
if (digest(proof) !== "1897d7b384557cd378d5ecce38e09fbd43564b3bd911c5c9c7de1889a0c7ea8e") {
  throw new Error("Changed immutable v355 source proof");
}
const receipt = JSON.parse(proof.toString()) as {
  additions: Record<string, string>;
  changes: Record<string, { before: string; after: string }>;
};
const previous = new Map<string, Buffer>();
const acceptedEarlier: Record<string, ReadonlySet<string>> = {
  "src/app/package.json": new Set([
    "36ee5a699633410d41d2861ae114c55e2d30a36ed07a9e3ec63d82a212693db1",
    "c68e960104fd843fee5367e2a140226994cfea7471fdc04fa8f1d030f6735e1c", "8971099aae61c67a7218bb7d45d2d97ae08a72ad172dfdd855960ebd98ce4e02",
  ]),
  "src/app/src/SourceQuarterCatalogueV309.ts": new Set([
    "9fc701205bfd6206408876c97b0cb49fa28bac6f9bf21bb834b13e5611d4cfd1",
    "fcff7c24b840716def9574264beff3709a0775d1d05b0d17af803105c1c4965e", "a089088812d03b70da3a69ead6a2ef5c900ec19e6da31809b0696f831e15e66b",
  ]),
};
function verifyPredecessor(path: string): Buffer {
  const cached = previous.get(path);
  if (cached) return cached;
  const raw = execFileSync("git", ["show", baseline + ":" + path], { cwd: repository, maxBuffer: 32 * 1024 * 1024 });
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v355 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV355(path: string): boolean {
  return Object.hasOwn(receipt.additions, path);
}
export function sourceAtBeforeV355(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return bytes;
  const hash = digest(bytes);
  if (hash === entry.before || acceptedEarlier[path]?.has(hash)) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v355 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV355(source: string): string {
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV355(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v355 source change: " + path);
    verifyPredecessor(path);
    if (digest(readFileSync(resolve(repository, path))) !== entry.after) throw new Error("Changed v355 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || !files.includes(path) || digest(readFileSync(resolve(repository, path))) !== hash) {
      throw new Error("Changed v355 addition: " + path);
    }
  }
}
