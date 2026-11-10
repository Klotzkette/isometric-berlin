/** Verify the finite Berlin ground-detail delta before older source-history layers read it. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertSourceLayerV330, projectSourceBeforeV330, sourceAtPublished210V330 } from "./sourceHistoryV330";

export const SOURCE_HISTORY_PROOF_SHA_V329 = "26c07c8ae2485ee822b5523590316dade92bdcae1595ae937b92d8158281eeee";
const previousProof = "e2edbf63d5d3f5e9ec4de0f0d20680e39b29143936fc5f4ae8004cef4fa71293";
const publishedGraphHash = "ba0c075727a66f23cf9e4d4e14eb0a6f860bdfc996d89bb635b1cb2143d60b68";
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
    if (!current || source.split(current).length !== 2) throw Error("Ambiguous exact v329 source inverse");
    source = source.replace(current, () => before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v329 source complement");
  return source;
}

export function assertSourceLayerV329(published209: Readonly<Record<string, string>>) {
  if (checked) return;
  const raw328 = fixture(328), raw329 = fixture(329);
  if (sha(raw328) !== previousProof || sha(raw329) !== SOURCE_HISTORY_PROOF_SHA_V329)
    throw Error("Changed immutable v328/v329 source proof");
  const published = { ...published209 };
  const sorted = Object.fromEntries(Object.keys(published).sort().map(path => [path, published[path]]));
  if (Object.keys(sorted).length !== 2104 || sha(JSON.stringify(sorted)) !== publishedGraphHash)
    throw Error("Incomplete published209 source graph");
  const receipt = JSON.parse(raw329.toString("utf8")) as {
    schemaVersion: number; publishedCommit: string; previousProofSha256: string;
    additions: Record<string, string>; changes: Record<string, Inverse>;
  };
  if (receipt.schemaVersion !== 1 || receipt.publishedCommit !== "d79f97dacf5aa5ad00f310af57fa181c3a8a284c"
      || receipt.previousProofSha256 !== previousProof) throw Error("Unknown immutable v329 source anchors");
  const current = { ...published };
  for (const [path, digest] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(current, path)) throw Error(`Duplicate v329 source addition: ${path}`);
    current[path] = digest;
  }
  for (const [path, inverse] of Object.entries(receipt.changes)) {
    if (!Object.hasOwn(published, path) || published[path] !== inverse.beforeSha256)
      throw Error(`Invalid v329 source inverse: ${path}`);
    current[path] = inverse.currentSha256;
  }
  assertSourceLayerV330(current);
  for (const path of Object.keys(current)) {
    const raw = sourceAtPublished210V330(path, readFileSync(resolve(root, path)));
    if (sha(raw) !== current[path]) throw Error(`Changed complete v329 source graph: ${path}`);
    if (Object.hasOwn(receipt.changes, path)) project(Buffer.from(raw).toString("utf8"), receipt.changes[path]);
  }
  checked = { published: Object.freeze(published), current: Object.freeze(current), changes: receipt.changes };
}

export function sourceAtPublished209V329(path: string, raw: Uint8Array): Uint8Array {
  raw = sourceAtPublished210V330(path, raw);
  if (!checked || !Object.hasOwn(checked.published, path) || sha(raw) !== checked.current[path])
    throw Error(`Unknown exact v329 source bytes: ${path}`);
  const inverse = checked.changes[path];
  return inverse ? Buffer.from(project(Buffer.from(raw).toString("utf8"), inverse)) : raw;
}

export function projectSourceBeforeV329(source: string): string {
  if (!checked) throw Error("Unverified v329 source layer");
  source = projectSourceBeforeV330(source);
  const digest = sha(source), records = Object.values(checked.changes).filter(inverse => inverse.currentSha256 === digest);
  if (!records.length) return source;
  if (Object.values(checked.current).filter(value => value === digest).length !== 1)
    throw Error("Ambiguous full v329 source fingerprint");
  return project(source, records[0]);
}
