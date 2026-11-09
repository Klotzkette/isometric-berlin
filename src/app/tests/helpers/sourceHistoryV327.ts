/** Verify the finite Steglitz delta before older source-history layers read it. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertSourceLayerV328, projectSourceBeforeV328, sourceAtPublished208V328 } from "./sourceHistoryV328";

export const SOURCE_HISTORY_PROOF_SHA_V327 = "72df433ac35d95f9374b95878a11f748c598f9f8ffbc55229877b73ee3530c62";
const previousProof = "5fe4411de0ae9d51eaa9af6b5a4be6a4bc5b4df0c221229204fb3ee4cc9148a6";
const publishedGraphHash = "d78fe4fa327c3fe9a09c4dba7bf97aa4158abd1a322e0dd6e0d8c945be0f317a";
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
    if (!current || source.split(current).length !== 2) throw Error("Ambiguous exact v327 source inverse");
    source = source.replace(current, () => before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v327 source complement");
  return source;
}

export function assertSourceLayerV327(published206: Readonly<Record<string, string>>) {
  if (checked) return;
  const raw326 = fixture(326), raw327 = fixture(327);
  if (sha(raw326) !== previousProof || sha(raw327) !== SOURCE_HISTORY_PROOF_SHA_V327)
    throw Error("Changed immutable v326/v327 source proof");
  const previous = JSON.parse(raw326.toString("utf8"));
  const published = { ...published206, ...previous.additions } as Record<string, string>;
  for (const [path, inverse] of Object.entries(previous.changes) as [string, Inverse][]) {
    if (published[path] !== inverse.beforeSha256) throw Error(`Invalid v326 source inverse: ${path}`);
    published[path] = inverse.currentSha256;
  }
  const sorted = Object.fromEntries(Object.keys(published).sort().map(path => [path, published[path]]));
  if (Object.keys(sorted).length !== 2093 || sha(JSON.stringify(sorted)) !== publishedGraphHash)
    throw Error("Incomplete published207 source graph");
  const receipt = JSON.parse(raw327.toString("utf8")) as {
    schemaVersion: number; publishedCommit: string; previousProofSha256: string;
    additions: Record<string, string>; changes: Record<string, Inverse>;
  };
  if (receipt.schemaVersion !== 1 || receipt.publishedCommit !== "4130e01486bdd56aa31a01be055c2e2ce7c4ab82"
      || receipt.previousProofSha256 !== previousProof) throw Error("Unknown immutable v327 source anchors");
  const current = { ...published };
  for (const [path, digest] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(current, path)) throw Error(`Duplicate v327 source addition: ${path}`);
    current[path] = digest;
  }
  for (const [path, inverse] of Object.entries(receipt.changes)) {
    if (!Object.hasOwn(published, path) || published[path] !== inverse.beforeSha256)
      throw Error(`Invalid v327 source inverse: ${path}`);
    current[path] = inverse.currentSha256;
  }
  assertSourceLayerV328(current);
  for (const path of Object.keys(current)) {
    const raw = sourceAtPublished208V328(path, readFileSync(resolve(root, path)));
    if (sha(raw) !== current[path]) throw Error(`Changed complete v327 source graph: ${path}`);
    if (Object.hasOwn(receipt.changes, path)) project(Buffer.from(raw).toString("utf8"), receipt.changes[path]);
  }
  checked = { published: Object.freeze(published), current: Object.freeze(current), changes: receipt.changes };
}

export function sourceAtPublished207V327(path: string, raw: Uint8Array): Uint8Array {
  raw = sourceAtPublished208V328(path, raw);
  if (!checked || !Object.hasOwn(checked.published, path) || sha(raw) !== checked.current[path])
    throw Error(`Unknown exact v327 source bytes: ${path}`);
  const inverse = checked.changes[path];
  return inverse ? Buffer.from(project(Buffer.from(raw).toString("utf8"), inverse)) : raw;
}

export function projectSourceBeforeV327(source: string): string {
  if (!checked) throw Error("Unverified v327 source layer");
  source = projectSourceBeforeV328(source);
  const digest = sha(source), records = Object.values(checked.changes).filter(inverse => inverse.currentSha256 === digest);
  if (!records.length) return source;
  if (Object.values(checked.current).filter(value => value === digest).length !== 1)
    throw Error("Ambiguous full v327 source fingerprint");
  return project(source, records[0]);
}
