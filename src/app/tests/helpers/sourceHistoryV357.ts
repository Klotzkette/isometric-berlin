import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const baseline = "1129adca8b2a0657fd8a383bc27ef1663aed8299";
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const proof = readFileSync(new URL("../fixtures/source-history-v357.json", import.meta.url));
if (digest(proof) !== "fc9950da183bbf4497f8ace704f4bfdd3e56f1f6107a74760b632a5534f3cbc0") {
  throw new Error("Changed immutable v357 source proof");
}
const receipt = JSON.parse(proof.toString()) as {
  additions: Record<string, string>;
  changes: Record<string, { before: string; after: string }>;
};
const previous = new Map<string, Buffer>();
const acceptedEarlier: Record<string, ReadonlySet<string>> = {
  "src/app/src/PublicAmenitiesV332.ts": new Set([
    "aa0f49894d2b2afc2a532c89a2c10d369dbeb1cedfb3e1a76fc4cec3f220c96e",
    "15d59af1d3ab60718f4d09560ede3ad9c1357355881ad89aa04c02ccf0479637",
  ]),
  "src/app/src/ThreeViewer.tsx": new Set([
    "006ee80e35c5a4832a6d077edf91819658bcece616eb43ff416652a01897e30e",
    "597aa602e741a3e7721a81fad4eba49cb562e7e056784603640944d3122aa858",
  ]),
  "src/app/package.json": new Set([
    "e2139ca19a799bf7a55c0c3f27831b7ebe0d8563211babb43f402c46c3d75df3",
    "36ee5a699633410d41d2861ae114c55e2d30a36ed07a9e3ec63d82a212693db1",
    "d94004bc323920ed811a4c869e47ae623284846ce8691603a322cc1f92f0cc2a",
    "c68e960104fd843fee5367e2a140226994cfea7471fdc04fa8f1d030f6735e1c", "8971099aae61c67a7218bb7d45d2d97ae08a72ad172dfdd855960ebd98ce4e02",
  ]),
  "src/app/src/SourceQuarterCatalogueV309.ts": new Set([
    "5ac17efad9e2ff9d2c019dd95a731af7ee91314b63a4c1cbb295dad1fd71776b",
    "9fc701205bfd6206408876c97b0cb49fa28bac6f9bf21bb834b13e5611d4cfd1",
    "b4d471ca0fb48247364bf1a5f0898371bfddb06f2ffe66a569d54d6e08e2b009",
    "fcff7c24b840716def9574264beff3709a0775d1d05b0d17af803105c1c4965e", "a089088812d03b70da3a69ead6a2ef5c900ec19e6da31809b0696f831e15e66b",
  ]),
};
function verifyPredecessor(path: string): Buffer {
  const cached = previous.get(path);
  if (cached) return cached;
  const raw = execFileSync("git", ["show", baseline + ":" + path], { cwd: repository, maxBuffer: 32 * 1024 * 1024 });
  if (digest(raw) !== receipt.changes[path]?.before) throw new Error("Changed v357 predecessor: " + path);
  previous.set(path, raw);
  return raw;
}
export function isSourceAdditionV357(path: string): boolean {
  return Object.hasOwn(receipt.additions, path);
}
export function sourceAtBeforeV357(path: string, bytes: Uint8Array): Uint8Array {
  const entry = receipt.changes[path];
  if (!entry) return bytes;
  const hash = digest(bytes);
  if (hash === entry.before || acceptedEarlier[path]?.has(hash)) return bytes;
  if (hash !== entry.after) throw new Error("Unknown exact v357 source bytes: " + path);
  return verifyPredecessor(path);
}
export function projectSourceBeforeV357(source: string): string {
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  return path ? verifyPredecessor(path).toString() : source;
}
export function assertSourceLayerV357(before: Readonly<Record<string, string>>, files: readonly string[]): void {
  for (const [path, entry] of Object.entries(receipt.changes)) {
    if (before[path] !== entry.before) throw new Error("Unexpected v357 source change: " + path);
    verifyPredecessor(path);
    if (digest(readFileSync(resolve(repository, path))) !== entry.after) throw new Error("Changed v357 result: " + path);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(before, path) || !files.includes(path) || digest(readFileSync(resolve(repository, path))) !== hash) {
      throw new Error("Changed v357 addition: " + path);
    }
  }
}
