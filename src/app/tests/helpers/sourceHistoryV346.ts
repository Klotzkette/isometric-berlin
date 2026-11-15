import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertSourceLayerV347, isSourceAdditionV347, projectSourceBeforeV347, sourceAtBeforeV347 } from "./sourceHistoryV347";

const root = resolve(import.meta.dir, "../../../..");
const previousCommit = "daa0c5e372f6c86147dd89962da3fdbd2947e861";
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Receipt = {
  additions: Record<string, string>;
  changes: Record<string, { before: string; after: string }>;
};
const proof = readFileSync(new URL("../fixtures/source-history-v346.json", import.meta.url));
if (digest(proof) !== "16c78e3de1db4b54d9e343eaa21c79d6766e155323fae680fcc91375962abc13") {
  throw Error("Changed immutable v346 source proof");
}
const receipt = JSON.parse(proof.toString("utf8")) as Receipt;
const predecessors = new Map<string, Buffer>();

export function assertSourceLayerV346(previous: Readonly<Record<string, string>>, files: readonly string[]): void {
  const expected = { ...previous };
  for (const [path, { after }] of Object.entries(receipt.changes)) expected[path] = after;
  Object.assign(expected, receipt.additions);
  assertSourceLayerV347(expected, files);
  for (const [path, { before, after }] of Object.entries(receipt.changes)) {
    if (previous[path] !== before || before === after) throw Error(`Unexpected v346 source change: ${path}`);
    const raw = execFileSync("git", ["show", `${previousCommit}:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    if (digest(raw) !== before) throw Error(`Changed v346 source predecessor: ${path}`);
    predecessors.set(path, raw);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(previous, path) || !files.includes(path) || digest(sourceAtBeforeV347(path, readFileSync(resolve(root, path)))) !== hash) {
      throw Error(`Changed v346 source addition: ${path}`);
    }
  }
}

export function isSourceAdditionV346(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV347(path);
}

export function sourceAtBeforeV346(path: string, raw: Uint8Array): Uint8Array {
  raw = sourceAtBeforeV347(path, raw);
  const row = receipt.changes[path];
  if (!row) return raw;
  const hash = digest(raw);
  if (hash === row.before) return raw;
  const previous = predecessors.get(path);
  if (hash !== row.after || !previous) throw Error(`Unknown exact v346 source bytes: ${path}`);
  return previous;
}

export function projectSourceBeforeV346(source: string): string {
  source = projectSourceBeforeV347(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  if (!path) return source;
  const raw = predecessors.get(path);
  if (!raw) throw Error(`Unverified v346 source predecessor: ${path}`);
  return raw.toString("utf8");
}
