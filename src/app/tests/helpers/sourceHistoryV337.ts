/** Verify a finite source revision and recover its exact Git predecessor. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../..");
const previousBytes = new Map<string, Buffer>();
const proofDigest = "4cdf6535f7b17d4f6f7c34075b5a0b2769e004cb61b1b1f7a80d0db014442d5b";
const previousCommit = "3d621f17f7f1eaf5fff27ad8ef3872e00c25bfbd";
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Receipt = {
  additions: Record<string, string>;
  changes: Record<string, { before: string; after: string }>;
};
let receipt: Receipt | undefined;

function previous(path: string): Buffer {
  let raw = previousBytes.get(path);
  if (!raw) {
    raw = execFileSync("git", ["show", `${previousCommit}:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    previousBytes.set(path, raw);
  }
  return raw;
}

export function assertSourceLayerV337(before: Readonly<Record<string, string>>): void {
  if (receipt) return;
  const proof = readFileSync(new URL("../fixtures/source-history-v337.json", import.meta.url));
  if (digest(proof) !== proofDigest) throw Error("Changed immutable v337 source proof");
  const candidate = JSON.parse(proof.toString("utf8")) as Receipt;
  const files = readdirSync(resolve(root, "src/app/src"), { recursive: true })
    .map(path => `src/app/src/${path}`)
    .filter(path => /\.(?:ts|tsx|json)$/.test(path) && statSync(resolve(root, path)).isFile());
  const expected = { ...before, ...candidate.additions };
  for (const [path, record] of Object.entries(candidate.changes)) {
    if (record.before !== before[path] || record.after === record.before || digest(previous(path)) !== record.before) {
      throw Error(`Unknown exact v337 source predecessor: ${path}`);
    }
    expected[path] = record.after;
  }
  if (Object.keys(candidate.additions).some(path => Object.hasOwn(before, path)) ||
      new Set([...files, ...Object.keys(before)]).size !== Object.keys(expected).length ||
      files.some(path => !Object.hasOwn(expected, path))) throw Error("Changed v337 source inventory");
  for (const [path, hash] of Object.entries(expected)) {
    if (digest(readFileSync(resolve(root, path))) !== hash) throw Error(`Changed complete v337 source graph: ${path}`);
  }
  receipt = candidate;
}

export function sourceAtBeforeV337(path: string, raw: Uint8Array): Uint8Array {
  if (!receipt || Object.hasOwn(receipt.additions, path)) throw Error(`Unknown exact v337 source bytes: ${path}`);
  const changed = receipt.changes[path];
  if (!changed) return raw;
  if (digest(raw) === changed.before) return raw;
  if (digest(raw) !== changed.after) throw Error(`Unknown exact v337 source bytes: ${path}`);
  return previous(path);
}

export function projectSourceBeforeV337(source: string): string {
  if (!receipt) throw Error("Unverified v337 source layer");
  const hash = digest(source);
  const rows = Object.entries(receipt.changes).filter(([, record]) => record.after === hash);
  if (!rows.length) return source;
  if (rows.length !== 1) throw Error("Ambiguous exact v337 source inverse");
  return previous(rows[0][0]).toString("utf8");
}
