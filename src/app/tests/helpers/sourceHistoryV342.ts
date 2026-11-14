import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../..");
const previousCommit = "5566e5db024e4326177aeedd70d758619d1734f0";
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Receipt = {
  additions: Record<string, string>;
  changes: Record<string, { before: string; after: string }>;
};
const proof = readFileSync(new URL("../fixtures/source-history-v342.json", import.meta.url));
if (digest(proof) !== "948015a1c2c9714f13218c7203bdee10074aef1f87336d8ed3cefccbb6df1adf") {
  throw Error("Changed immutable v342 source proof");
}
const receipt = JSON.parse(proof.toString("utf8")) as Receipt;
const predecessors = new Map<string, Buffer>();

export function assertSourceLayerV342(previous: Readonly<Record<string, string>>, files: readonly string[]): void {
  for (const [path, { before, after }] of Object.entries(receipt.changes)) {
    if (previous[path] !== before || before === after) throw Error(`Unexpected v342 source change: ${path}`);
    const raw = execFileSync("git", ["show", `${previousCommit}:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    if (digest(raw) !== before) throw Error(`Changed v342 source predecessor: ${path}`);
    predecessors.set(path, raw);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(previous, path) || !files.includes(path) || digest(readFileSync(resolve(root, path))) !== hash) {
      throw Error(`Changed v342 source addition: ${path}`);
    }
  }
}

export function isSourceAdditionV342(path: string): boolean {
  return Object.hasOwn(receipt.additions, path);
}

export function sourceAtBeforeV342(path: string, raw: Uint8Array): Uint8Array {
  const row = receipt.changes[path];
  if (!row) return raw;
  const hash = digest(raw);
  if (hash === row.before) return raw;
  const previous = predecessors.get(path);
  if (hash !== row.after || !previous) throw Error(`Unknown exact v342 source bytes: ${path}`);
  return previous;
}

export function projectSourceBeforeV342(source: string): string {
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  if (!path) return source;
  const raw = predecessors.get(path);
  if (!raw) throw Error(`Unverified v342 source predecessor: ${path}`);
  return raw.toString("utf8");
}
