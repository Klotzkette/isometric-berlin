import { assertSourceLayerV350, isSourceAdditionV350, projectSourceBeforeV350, sourceAtBeforeV350 } from "./sourceHistoryV350";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../..");
const previousCommit = "8fd768d2";
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Receipt = {
  additions: Record<string, string>;
  changes: Record<string, { before: string; after: string }>;
};
const proof = readFileSync(new URL("../fixtures/source-history-v349.json", import.meta.url));
if (digest(proof) !== "e99a0e8e7cc17c5d26c3989d0f33cd2bf75f996aabcb3e9021146ad482e63766") {
  throw Error("Changed immutable v349 source proof");
}
const receipt = JSON.parse(proof.toString("utf8")) as Receipt;
const predecessors = new Map<string, Buffer>();

export function assertSourceLayerV349(previous: Readonly<Record<string, string>>, files: readonly string[]): void {
  const current = { ...previous };
  for (const [path, row] of Object.entries(receipt.changes)) current[path] = row.after;
  Object.assign(current, receipt.additions);
  assertSourceLayerV350(current, files);
  for (const [path, { before, after }] of Object.entries(receipt.changes)) {
    if (previous[path] !== before || before === after) throw Error(`Unexpected v349 source change: ${path}`);
    const raw = execFileSync("git", ["show", `${previousCommit}:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    if (digest(raw) !== before) throw Error(`Changed v349 source predecessor: ${path}`);
    predecessors.set(path, raw);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(previous, path) || !files.includes(path) || digest(sourceAtBeforeV350(path, readFileSync(resolve(root, path)))) !== hash) {
      throw Error(`Changed v349 source addition: ${path}`);
    }
  }
}

export function isSourceAdditionV349(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV350(path);
}

export function sourceAtBeforeV349(path: string, raw: Uint8Array): Uint8Array {
  raw = sourceAtBeforeV350(path, raw);
  const row = receipt.changes[path];
  if (!row) return raw;
  const hash = digest(raw);
  if (hash === row.before) return raw;
  const previous = predecessors.get(path);
  if (hash !== row.after || !previous) throw Error(`Unknown exact v349 source bytes: ${path}`);
  return previous;
}

export function projectSourceBeforeV349(source: string): string {
  source = projectSourceBeforeV350(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  if (!path) return source;
  const raw = predecessors.get(path);
  if (!raw) throw Error(`Unverified v349 source predecessor: ${path}`);
  return raw.toString("utf8");
}
