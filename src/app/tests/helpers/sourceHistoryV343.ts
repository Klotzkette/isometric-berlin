import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertSourceLayerV344, isSourceAdditionV344, projectSourceBeforeV344, sourceAtBeforeV344 } from "./sourceHistoryV344";

const root = resolve(import.meta.dir, "../../../..");
const previousCommit = "cceedb466463c5ba2f3eb37a81b01513740544b1";
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Receipt = {
  additions: Record<string, string>;
  changes: Record<string, { before: string; after: string }>;
};
const proof = readFileSync(new URL("../fixtures/source-history-v343.json", import.meta.url));
if (digest(proof) !== "4c3083c66b0ef7afe26a326d955162bf74bf83fa42198d960dd1c7baf5879ddc") {
  throw Error("Changed immutable v343 source proof");
}
const receipt = JSON.parse(proof.toString("utf8")) as Receipt;
const predecessors = new Map<string, Buffer>();

export function assertSourceLayerV343(previous: Readonly<Record<string, string>>, files: readonly string[]): void {
  const expected = { ...previous };
  for (const [path, { after }] of Object.entries(receipt.changes)) expected[path] = after;
  Object.assign(expected, receipt.additions);
  assertSourceLayerV344(expected, files);
  for (const [path, { before, after }] of Object.entries(receipt.changes)) {
    if (previous[path] !== before || before === after) throw Error(`Unexpected v343 source change: ${path}`);
    const raw = execFileSync("git", ["show", `${previousCommit}:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    if (digest(raw) !== before) throw Error(`Changed v343 source predecessor: ${path}`);
    predecessors.set(path, raw);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(previous, path) || !files.includes(path) || digest(sourceAtBeforeV344(path, readFileSync(resolve(root, path)))) !== hash) {
      throw Error(`Changed v343 source addition: ${path}`);
    }
  }
}

export function isSourceAdditionV343(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV344(path);
}

export function sourceAtBeforeV343(path: string, raw: Uint8Array): Uint8Array {
  raw = sourceAtBeforeV344(path, raw);
  const row = receipt.changes[path];
  if (!row) return raw;
  const hash = digest(raw);
  if (hash === row.before) return raw;
  const previous = predecessors.get(path);
  if (hash !== row.after || !previous) throw Error(`Unknown exact v343 source bytes: ${path}`);
  return previous;
}

export function projectSourceBeforeV343(source: string): string {
  source = projectSourceBeforeV344(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  if (!path) return source;
  const raw = predecessors.get(path);
  if (!raw) throw Error(`Unverified v343 source predecessor: ${path}`);
  return raw.toString("utf8");
}
