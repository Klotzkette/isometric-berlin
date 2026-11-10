/** Verify the finite public amenities delta before older source-history layers read it. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertSourceLayerV333, projectSourceBeforeV333, sourceAtPublished214V333 } from "./sourceHistoryV333";

export const SOURCE_HISTORY_PROOF_SHA_V332 = "518fc5d386daf6c167527169ec3420adf0d8ee3a8652003faaaafe31fe907df3";
const previousProof = "7cb7e6075a455fb882464ca1d8bb5c1bc87ec95e26bead1b5a05880a8f2cc7e3";
const captureTool = "2d53e428b381a3c5a32f9ab066af318946dfccaf811c0a322f237016b11ef0f3";
const publishedGraphHash = "72b0413c2307ceedb66e6cdd218da6fe019e5790dc01b1c4f0d05b0f7f3289c6";
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
    if (!current || source.split(current).length !== 2) throw Error("Ambiguous exact v332 source inverse");
    source = source.replace(current, () => before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v332 source complement");
  return source;
}

export function assertSourceLayerV332(published213: Readonly<Record<string, string>>) {
  if (checked) return;
  const raw331 = fixture(331), raw332 = fixture(332);
  if (sha(raw331) !== previousProof || sha(raw332) !== SOURCE_HISTORY_PROOF_SHA_V332)
    throw Error("Changed immutable v331/v332 source proof");
  const published = { ...published213 };
  const sorted = Object.fromEntries(Object.keys(published).sort().map(path => [path, published[path]]));
  if (Object.keys(sorted).length !== 2176 || sha(JSON.stringify(sorted)) !== publishedGraphHash)
    throw Error("Incomplete published213 source graph");
  const receipt = JSON.parse(raw332.toString("utf8")) as {
    schemaVersion: number; publishedCommit: string; previousProofSha256: string; captureToolSha256: string;
    additions: Record<string, string>; changes: Record<string, Inverse>;
  };
  if (receipt.schemaVersion !== 1 || receipt.publishedCommit !== "bad399196ffccf13192d06d6daba5c9d4c51a7d3"
      || receipt.previousProofSha256 !== previousProof || receipt.captureToolSha256 !== captureTool)
    throw Error("Unknown immutable v332 source anchors");
  if (Object.keys(receipt.additions).length !== 5 || Object.keys(receipt.changes).length !== 5)
    throw Error("Invalid finite v332 source delta");
  const current = { ...published };
  for (const [path, digest] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(current, path)) throw Error(`Duplicate v332 source addition: ${path}`);
    current[path] = digest;
  }
  for (const [path, inverse] of Object.entries(receipt.changes)) {
    if (!Object.hasOwn(published, path) || published[path] !== inverse.beforeSha256)
      throw Error(`Invalid v332 source inverse: ${path}`);
    current[path] = inverse.currentSha256;
  }
  assertSourceLayerV333(current);
  for (const path of Object.keys(current)) {
    const raw = sourceAtPublished214V333(path, readFileSync(resolve(root, path)));
    if (sha(raw) !== current[path]) throw Error(`Changed complete v332 source graph: ${path}`);
    if (Object.hasOwn(receipt.changes, path)) project(raw.toString("utf8"), receipt.changes[path]);
  }
  checked = { published: Object.freeze(published), current: Object.freeze(current), changes: receipt.changes };
}

export function sourceAtPublished213V332(path: string, raw: Uint8Array): Uint8Array {
  raw = sourceAtPublished214V333(path, raw);
  if (!checked || !Object.hasOwn(checked.published, path) || sha(raw) !== checked.current[path])
    throw Error(`Unknown exact v332 source bytes: ${path}`);
  const inverse = checked.changes[path];
  return inverse ? Buffer.from(project(Buffer.from(raw).toString("utf8"), inverse)) : raw;
}

export function projectSourceBeforeV332(source: string): string {
  if (!checked) throw Error("Unverified v332 source layer");
  source = projectSourceBeforeV333(source);
  const digest = sha(source), records = Object.values(checked.changes).filter(inverse => inverse.currentSha256 === digest);
  if (!records.length) return source;
  if (Object.values(checked.current).filter(value => value === digest).length !== 1)
    throw Error("Ambiguous full v332 source fingerprint");
  return project(source, records[0]);
}
