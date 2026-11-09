/** Verify the finite Steglitz street and post-office delta before older source-history layers read it. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const SOURCE_HISTORY_PROOF_SHA_V328 = "e2edbf63d5d3f5e9ec4de0f0d20680e39b29143936fc5f4ae8004cef4fa71293";
const previousProof = "72df433ac35d95f9374b95878a11f748c598f9f8ffbc55229877b73ee3530c62";
const publishedGraphHash = "fc2a900efd90bc5f2d9dd10fe2b98f9c5607058360524294d5f53de4c33176bb";
const root = resolve(import.meta.dir, "../../../..");
type Inverse = {
  beforeSha256: string;
  currentSha256: string;
  replacements: { before: string; current: string }[];
};
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const fixture = (version: number) => readFileSync(new URL(`../fixtures/source-history-v${version}.json`, import.meta.url));
let checked: {
  published: Readonly<Record<string, string>>;
  current: Readonly<Record<string, string>>;
  changes: Record<string, Inverse>;
} | undefined;

function project(source: string, receipt: Inverse) {
  for (const { before, current } of receipt.replacements) {
    if (!current || source.split(current).length !== 2) throw Error("Ambiguous exact v328 source inverse");
    source = source.replace(current, () => before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v328 source complement");
  return source;
}

export function assertSourceLayerV328(published208: Readonly<Record<string, string>>) {
  if (checked) return;
  const raw327 = fixture(327), raw328 = fixture(328);
  if (sha(raw327) !== previousProof || sha(raw328) !== SOURCE_HISTORY_PROOF_SHA_V328)
    throw Error("Changed immutable v327/v328 source proof");
  const published = { ...published208 };
  const sorted = Object.fromEntries(Object.keys(published).sort().map(path => [path, published[path]]));
  if (Object.keys(sorted).length !== 2098 || sha(JSON.stringify(sorted)) !== publishedGraphHash)
    throw Error("Incomplete published208 source graph");
  const receipt = JSON.parse(raw328.toString("utf8")) as {
    schemaVersion: number; publishedCommit: string; previousProofSha256: string;
    additions: Record<string, string>; changes: Record<string, Inverse>;
  };
  if (receipt.schemaVersion !== 1 || receipt.publishedCommit !== "fb47763d223f4fda3afcd8913c8e8adbbb5dfd59"
      || receipt.previousProofSha256 !== previousProof) throw Error("Unknown immutable v328 source anchors");
  const current = { ...published };
  for (const [path, digest] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(current, path)) throw Error(`Duplicate v328 source addition: ${path}`);
    current[path] = digest;
  }
  for (const [path, inverse] of Object.entries(receipt.changes)) {
    if (!Object.hasOwn(published, path) || published[path] !== inverse.beforeSha256)
      throw Error(`Invalid v328 source inverse: ${path}`);
    current[path] = inverse.currentSha256;
  }
  const files = readdirSync(resolve(root, "src/app/src"), { recursive: true }).map(path => `src/app/src/${path}`)
    .filter(path => /\.(?:ts|tsx|json)$/.test(path) && statSync(resolve(root, path)).isFile());
  const inventory = new Set([...Object.keys(published), ...files]);
  if (inventory.size !== Object.keys(current).length || [...inventory].some(path => !Object.hasOwn(current, path)))
    throw Error("Changed or unaccounted v328 source inventory");
  for (const path of inventory) {
    const raw = readFileSync(resolve(root, path));
    if (sha(raw) !== current[path]) throw Error(`Changed complete v328 source graph: ${path}`);
    if (Object.hasOwn(receipt.changes, path)) project(raw.toString("utf8"), receipt.changes[path]);
  }
  checked = { published: Object.freeze(published), current: Object.freeze(current), changes: receipt.changes };
}

export function sourceAtPublished208V328(path: string, raw: Uint8Array): Uint8Array {
  if (!checked || !Object.hasOwn(checked.published, path) || sha(raw) !== checked.current[path])
    throw Error(`Unknown exact v328 source bytes: ${path}`);
  const inverse = checked.changes[path];
  return inverse ? Buffer.from(project(Buffer.from(raw).toString("utf8"), inverse)) : raw;
}

export function projectSourceBeforeV328(source: string): string {
  if (!checked) throw Error("Unverified v328 source layer");
  const digest = sha(source), records = Object.values(checked.changes).filter(inverse => inverse.currentSha256 === digest);
  if (!records.length) return source;
  if (Object.values(checked.current).filter(value => value === digest).length !== 1)
    throw Error("Ambiguous full v328 source fingerprint");
  return project(source, records[0]);
}
