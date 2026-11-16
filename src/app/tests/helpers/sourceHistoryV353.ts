import { assertSourceLayerV354, isSourceAdditionV354, projectSourceBeforeV354, sourceAtBeforeV354 } from "./sourceHistoryV354";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../..");
const previousCommit = "68aafb0a";
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Receipt = {
  additions: Record<string, string>;
  changes: Record<string, { before: string; after: string }>;
};
const proof = readFileSync(new URL("../fixtures/source-history-v353.json", import.meta.url));
if (digest(proof) !== "3778ff7d0da25dbcf8ed329dd0bdb654fd388b89398aeb508f9c23be27e57dc3") {
  throw Error("Changed immutable v353 source proof");
}
const receipt = JSON.parse(proof.toString("utf8")) as Receipt;
const predecessors = new Map<string, Buffer>();
// V351 callers can already have normalized these two files to published v231
// before entering V351 -> V352 -> V353 a second time. Admit only these exact
// immutable ancestor bytes, not arbitrary inputs or arbitrary older revisions.
const normalizedV231 = Object.freeze({
  "src/app/package.json": "36ee5a699633410d41d2861ae114c55e2d30a36ed07a9e3ec63d82a212693db1",
  "src/app/src/SourceQuarterCatalogueV309.ts": "9fc701205bfd6206408876c97b0cb49fa28bac6f9bf21bb834b13e5611d4cfd1",
});
const verifiedV231 = new Map<string, Buffer>();

function verifyNormalizedV231(): void {
  if (verifiedV231.size === 2) return;
  const olderProof = readFileSync(new URL("../fixtures/source-history-v352.json", import.meta.url));
  if (digest(olderProof) !== "4bd6c3bd0e35c1228862712a8a8da78b052811b1754411264d714484187d3e52") {
    throw Error("Changed immutable v352 ancestor proof");
  }
  const older = JSON.parse(olderProof.toString("utf8")) as Receipt;
  for (const [path, expected] of Object.entries(normalizedV231)) {
    if (older.changes[path]?.before !== expected || older.changes[path]?.after !== receipt.changes[path]?.before) {
      throw Error(`Unlinked exact v353 ancestor: ${path}`);
    }
    const raw = execFileSync("git", ["show", `69810478315fb30ab5ded23f8bde39c51cb1ca20:${path}`], {
      cwd: root, maxBuffer: 32 * 1024 * 1024,
    });
    if (digest(raw) !== expected) throw Error(`Changed exact v231 ancestor: ${path}`);
    verifiedV231.set(path, raw);
  }
}

export function assertSourceLayerV353(previous: Readonly<Record<string, string>>, files: readonly string[]): void {
  const current = {...previous};
  for(const [path,row] of Object.entries(receipt.changes)) current[path]=row.after;
  Object.assign(current,receipt.additions);
  assertSourceLayerV354(current,files);
  for (const [path, { before, after }] of Object.entries(receipt.changes)) {
    if (previous[path] !== before || before === after) throw Error(`Unexpected v353 source change: ${path}`);
    const raw = execFileSync("git", ["show", `${previousCommit}:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    if (digest(raw) !== before) throw Error(`Changed v353 source predecessor: ${path}`);
    predecessors.set(path, raw);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(previous, path) || !files.includes(path) || digest(sourceAtBeforeV354(path,readFileSync(resolve(root, path)))) !== hash) {
      throw Error(`Changed v353 source addition: ${path}`);
    }
  }
  verifyNormalizedV231();
}

export function isSourceAdditionV353(path: string): boolean {
  return Object.hasOwn(receipt.additions, path) || isSourceAdditionV354(path);
}

export function sourceAtBeforeV353(path: string, raw: Uint8Array): Uint8Array {
  raw = sourceAtBeforeV354(path, raw);
  const row = receipt.changes[path];
  if (!row) return raw;
  const hash = digest(raw);
  if (hash === row.before) return raw;
  const normalized = verifiedV231.get(path);
  if (normalized && normalized.equals(raw)) return raw;
  const previous = predecessors.get(path);
  if (hash !== row.after || !previous) throw Error(`Unknown exact v353 source bytes: ${path}`);
  return previous;
}

export function projectSourceBeforeV353(source: string): string {
  source = projectSourceBeforeV354(source);
  const hash = digest(source);
  const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
  if (!path) return source;
  const raw = predecessors.get(path);
  if (!raw) throw Error(`Unverified v353 source predecessor: ${path}`);
  return raw.toString("utf8");
}
