import { assertSourceLayerV352, isSourceAdditionV352, projectSourceBeforeV352, sourceAtBeforeV352 } from "./sourceHistoryV352";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../..");
const previousCommit = "33941dd9";
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Receipt = {
  additions: Record<string, string>;
  changes: Record<string, { before: string; after: string }>;
};
const proof = readFileSync(new URL("../fixtures/source-history-v351.json", import.meta.url));
if (digest(proof) !== "45eeb46ae45a1f4bd05eaada60950d864b8d3580e3824903f67b76ac11a45eb7") {
  throw Error("Changed immutable v351 source proof");
}
const receipt = JSON.parse(proof.toString("utf8")) as Receipt;
const predecessors = new Map<string, Buffer>();
const publishedAtV351 = new Map<string, Buffer>();

export function assertSourceLayerV351(previous: Readonly<Record<string, string>>, files: readonly string[]): void {
  const current = { ...previous };
  for (const [path, row] of Object.entries(receipt.changes)) current[path] = row.after;
  Object.assign(current, receipt.additions);
  assertSourceLayerV352(current, files);
  for (const [path, { before, after }] of Object.entries(receipt.changes)) {
    if (previous[path] !== before || before === after) throw Error(`Unexpected v351 source change: ${path}`);
    const raw = execFileSync("git", ["show", `${previousCommit}:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    if (digest(raw) !== before) throw Error(`Changed v351 source predecessor: ${path}`);
    predecessors.set(path, raw);
    const published = execFileSync("git", ["show", `69810478315fb30ab5ded23f8bde39c51cb1ca20:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    if (digest(published) !== after) throw Error(`Changed published v351 result: ${path}`);
    publishedAtV351.set(path, published);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(previous, path) || !files.includes(path) || digest(sourceAtBeforeV352(path, readFileSync(resolve(root, path)))) !== hash) {
      throw Error(`Changed v351 source addition: ${path}`);
    }
  }
}

export function isSourceAdditionV351(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV352(path);
}

export function sourceAtBeforeV351(path: string, raw: Uint8Array): Uint8Array {
  // A caller can supply the original published v351 bytes after already
  // reversing later releases. Compare them with the independent Git object.
  if (!publishedAtV351.get(path)?.equals(raw)) raw = sourceAtBeforeV352(path, raw);
  const row = receipt.changes[path];
  if (!row) return raw;
  const hash = digest(raw);
  if (hash === row.before) return raw;
  const previous = predecessors.get(path);
  if (hash !== row.after || !previous) throw Error(`Unknown exact v351 source bytes: ${path}`);
  return previous;
}

export function projectSourceBeforeV351(source: string): string {
  source = projectSourceBeforeV352(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  if (!path) return source;
  const raw = predecessors.get(path);
  if (!raw) throw Error(`Unverified v351 source predecessor: ${path}`);
  return raw.toString("utf8");
}
