/** Verify the finite viewer stability delta before older source-history layers read it. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertSourceLayerV332, projectSourceBeforeV332, sourceAtPublished213V332 } from "./sourceHistoryV332";

export const SOURCE_HISTORY_PROOF_SHA_V331 = "7cb7e6075a455fb882464ca1d8bb5c1bc87ec95e26bead1b5a05880a8f2cc7e3";
const previousProof = "3e7b695bf04f1feaf3497b1ec6181b41c46f7b9921cb82f4fbfc6484831698d5";
const publishedGraphHash = "31bfbc6eccd8e04feeaaf1ada935ec7299fb5525d3122c9c486420ac6e852a6b";
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
    if (!current || source.split(current).length !== 2) throw Error("Ambiguous exact v331 source inverse");
    source = source.replace(current, () => before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v331 source complement");
  return source;
}

export function assertSourceLayerV331(published212: Readonly<Record<string, string>>) {
  if (checked) return;
  const raw330 = fixture(330), raw331 = fixture(331);
  if (sha(raw330) !== previousProof || sha(raw331) !== SOURCE_HISTORY_PROOF_SHA_V331)
    throw Error("Changed immutable v330/v331 source proof");
  const published = { ...published212 };
  const sorted = Object.fromEntries(Object.keys(published).sort().map(path => [path, published[path]]));
  if (Object.keys(sorted).length !== 2174 || sha(JSON.stringify(sorted)) !== publishedGraphHash)
    throw Error("Incomplete published212 source graph");
  const receipt = JSON.parse(raw331.toString("utf8")) as {
    schemaVersion: number; publishedCommit: string; previousProofSha256: string;
    additions: Record<string, string>; changes: Record<string, Inverse>;
  };
  if (receipt.schemaVersion !== 1 || receipt.publishedCommit !== "ddd54506d3db03d8288505cb2fceab0f19c4c636"
      || receipt.previousProofSha256 !== previousProof) throw Error("Unknown immutable v331 source anchors");
  const current = { ...published };
  for (const [path, digest] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(current, path)) throw Error(`Duplicate v331 source addition: ${path}`);
    current[path] = digest;
  }
  for (const [path, inverse] of Object.entries(receipt.changes)) {
    if (!Object.hasOwn(published, path) || published[path] !== inverse.beforeSha256)
      throw Error(`Invalid v331 source inverse: ${path}`);
    current[path] = inverse.currentSha256;
  }
  assertSourceLayerV332(current);
  for (const path of Object.keys(current)) {
    const raw = sourceAtPublished213V332(path, readFileSync(resolve(root, path)));
    if (sha(raw) !== current[path]) throw Error(`Changed complete v331 source graph: ${path}`);
    if (Object.hasOwn(receipt.changes, path)) project(raw.toString("utf8"), receipt.changes[path]);
  }
  checked = { published: Object.freeze(published), current: Object.freeze(current), changes: receipt.changes };
}

export function sourceAtPublished212V331(path: string, raw: Uint8Array): Uint8Array {
  raw = sourceAtPublished213V332(path, raw);
  if (!checked || !Object.hasOwn(checked.published, path) || sha(raw) !== checked.current[path])
    throw Error(`Unknown exact v331 source bytes: ${path}`);
  const inverse = checked.changes[path];
  return inverse ? Buffer.from(project(Buffer.from(raw).toString("utf8"), inverse)) : raw;
}

export function projectSourceBeforeV331(source: string): string {
  if (!checked) throw Error("Unverified v331 source layer");
  source = projectSourceBeforeV332(source);
  const digest = sha(source), records = Object.values(checked.changes).filter(inverse => inverse.currentSha256 === digest);
  if (!records.length) return source;
  if (Object.values(checked.current).filter(value => value === digest).length !== 1)
    throw Error("Ambiguous full v331 source fingerprint");
  return project(source, records[0]);
}
