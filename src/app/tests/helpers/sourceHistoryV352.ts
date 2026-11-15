import { assertSourceLayerV353, isSourceAdditionV353, projectSourceBeforeV353, sourceAtBeforeV353 } from "./sourceHistoryV353";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../..");
const previousCommit = "69810478";
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Receipt = {
  additions: Record<string, string>;
  changes: Record<string, { before: string; after: string }>;
};
const proof = readFileSync(new URL("../fixtures/source-history-v352.json", import.meta.url));
if (digest(proof) !== "4bd6c3bd0e35c1228862712a8a8da78b052811b1754411264d714484187d3e52") {
  throw Error("Changed immutable v352 source proof");
}
const receipt = JSON.parse(proof.toString("utf8")) as Receipt;
const predecessors = new Map<string, Buffer>();

export function assertSourceLayerV352(previous: Readonly<Record<string, string>>, files: readonly string[]): void {
  const current = { ...previous };
  for (const [path, row] of Object.entries(receipt.changes)) current[path] = row.after;
  Object.assign(current, receipt.additions);
  assertSourceLayerV353(current, files);
  for (const [path, { before, after }] of Object.entries(receipt.changes)) {
    if (previous[path] !== before || before === after) throw Error(`Unexpected v352 source change: ${path}`);
    const raw = execFileSync("git", ["show", `${previousCommit}:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    if (digest(raw) !== before) throw Error(`Changed v352 source predecessor: ${path}`);
    predecessors.set(path, raw);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(previous, path) || !files.includes(path) || digest(sourceAtBeforeV353(path, readFileSync(resolve(root, path)))) !== hash) {
      throw Error(`Changed v352 source addition: ${path}`);
    }
  }
}

export function isSourceAdditionV352(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV353(path);
}

export function sourceAtBeforeV352(path: string, raw: Uint8Array): Uint8Array {
  raw = sourceAtBeforeV353(path, raw);
  const row = receipt.changes[path];
  if (!row) return raw;
  const hash = digest(raw);
  if (hash === row.before) return raw;
  const previous = predecessors.get(path);
  if (hash !== row.after || !previous) throw Error(`Unknown exact v352 source bytes: ${path}`);
  return previous;
}

export function projectSourceBeforeV352(source: string): string {
  source = projectSourceBeforeV353(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  if (!path) return source;
  const raw = predecessors.get(path);
  if (!raw) throw Error(`Unverified v352 source predecessor: ${path}`);
  return raw.toString("utf8");
}
