import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertSourceLayerV340, isSourceAdditionV340, projectSourceBeforeV340, sourceAtBeforeV340 } from "./sourceHistoryV340";

const root = resolve(import.meta.dir, "../../../..");
const previousCommit = "b2bdc5cb445902d4fb670c9b7e26889c460adee3";
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Receipt = {
  additions: Record<string, string>;
  changes: Record<string, { before: string; after: string }>;
};
const proof = readFileSync(new URL("../fixtures/source-history-v339.json", import.meta.url));
if (digest(proof) !== "64f9e6b7c9ab989cbc7a89f424aee4c559ee586062d9f022bbebe526d538e4c8") {
  throw Error("Changed immutable v339 source proof");
}
const receipt = JSON.parse(proof.toString("utf8")) as Receipt;
const predecessors = new Map<string, Buffer>();

export function assertSourceLayerV339(previous: Readonly<Record<string, string>>, files: readonly string[]): void {
  const expected = { ...previous };
  for (const [path, { after }] of Object.entries(receipt.changes)) expected[path] = after;
  Object.assign(expected, receipt.additions);
  assertSourceLayerV340(expected, files);
  for (const [path, { before, after }] of Object.entries(receipt.changes)) {
    if (previous[path] !== before || before === after) throw Error(`Unexpected v339 source change: ${path}`);
    const raw = execFileSync("git", ["show", `${previousCommit}:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    if (digest(raw) !== before) throw Error(`Changed v339 source predecessor: ${path}`);
    predecessors.set(path, raw);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(previous, path) || !files.includes(path) || digest(sourceAtBeforeV340(path, readFileSync(resolve(root, path)))) !== hash) {
      throw Error(`Changed v339 source addition: ${path}`);
    }
  }
}

export function isSourceAdditionV339(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV340(path);
}

export function sourceAtBeforeV339(path: string, raw: Uint8Array): Uint8Array {
  raw = sourceAtBeforeV340(path, raw);
  const row = receipt.changes[path];
  if (!row) return raw;
  const hash = digest(raw);
  if (hash === row.before) return raw;
  const previous = predecessors.get(path);
  if (hash !== row.after || !previous) throw Error(`Unknown exact v339 source bytes: ${path}`);
  return previous;
}

export function projectSourceBeforeV339(source: string): string {
  source = projectSourceBeforeV340(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  if (!path) return source;
  const raw = predecessors.get(path);
  if (!raw) throw Error(`Unverified v339 source predecessor: ${path}`);
  return raw.toString("utf8");
}
