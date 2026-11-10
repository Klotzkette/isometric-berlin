/** Verify the finite district court delta before older source-history layers read it. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const SOURCE_HISTORY_PROOF_SHA_V333 = "7e89d36d18c35d59a43acc237a09a22da832b1abc7b526160a63d00a8e4fef98";
const previousProof = "518fc5d386daf6c167527169ec3420adf0d8ee3a8652003faaaafe31fe907df3";
const captureTool = "4cb0a7a074d281f20c460d7a3779411f7baa0b33b84fe9ed8e8f9915623a0cf0";
const publishedGraphHash = "00796ab841436be2c6d4e75ceeedcfe1d68874e7b335d073aec35ceb2345d387";
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
    if (!current || source.split(current).length !== 2) throw Error("Ambiguous exact v333 source inverse");
    source = source.replace(current, () => before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v333 source complement");
  return source;
}

export function assertSourceLayerV333(published214: Readonly<Record<string, string>>) {
  if (checked) return;
  const raw332 = fixture(332), raw333 = fixture(333);
  if (sha(raw332) !== previousProof || sha(raw333) !== SOURCE_HISTORY_PROOF_SHA_V333)
    throw Error("Changed immutable v332/v333 source proof");
  const published = { ...published214 };
  const sorted = Object.fromEntries(Object.keys(published).sort().map(path => [path, published[path]]));
  if (Object.keys(sorted).length !== 2181 || sha(JSON.stringify(sorted)) !== publishedGraphHash)
    throw Error("Incomplete published214 source graph");
  const receipt = JSON.parse(raw333.toString("utf8")) as {
    schemaVersion: number; publishedCommit: string; previousProofSha256: string; captureToolSha256: string;
    additions: Record<string, string>; changes: Record<string, Inverse>;
  };
  if (receipt.schemaVersion !== 1 || receipt.publishedCommit !== "4ba7d79fe50303b4cbbea752efdca751ffa59e49"
      || receipt.previousProofSha256 !== previousProof || receipt.captureToolSha256 !== captureTool)
    throw Error("Unknown immutable v333 source anchors");
  if (Object.keys(receipt.additions).length !== 2 || Object.keys(receipt.changes).length !== 8)
    throw Error("Invalid finite v333 source delta");
  const current = { ...published };
  for (const [path, digest] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(current, path)) throw Error(`Duplicate v333 source addition: ${path}`);
    current[path] = digest;
  }
  for (const [path, inverse] of Object.entries(receipt.changes)) {
    if (!Object.hasOwn(published, path) || published[path] !== inverse.beforeSha256)
      throw Error(`Invalid v333 source inverse: ${path}`);
    current[path] = inverse.currentSha256;
  }
  const files = readdirSync(resolve(root, "src/app/src"), { recursive: true }).map(path => `src/app/src/${path}`)
    .filter(path => /\.(?:ts|tsx|json)$/.test(path) && statSync(resolve(root, path)).isFile());
  const inventory = new Set([...Object.keys(published), ...files]);
  if (inventory.size !== Object.keys(current).length || [...inventory].some(path => !Object.hasOwn(current, path)))
    throw Error("Changed or unaccounted v333 source inventory");
  for (const path of inventory) {
    const raw = readFileSync(resolve(root, path));
    if (sha(raw) !== current[path]) throw Error(`Changed complete v333 source graph: ${path}`);
    if (Object.hasOwn(receipt.changes, path)) project(raw.toString("utf8"), receipt.changes[path]);
  }
  checked = { published: Object.freeze(published), current: Object.freeze(current), changes: receipt.changes };
}

export function sourceAtPublished214V333(path: string, raw: Uint8Array): Uint8Array {
  if (!checked || !Object.hasOwn(checked.published, path) || sha(raw) !== checked.current[path])
    throw Error(`Unknown exact v333 source bytes: ${path}`);
  const inverse = checked.changes[path];
  return inverse ? Buffer.from(project(Buffer.from(raw).toString("utf8"), inverse)) : raw;
}

export function projectSourceBeforeV333(source: string): string {
  if (!checked) throw Error("Unverified v333 source layer");
  const digest = sha(source), records = Object.values(checked.changes).filter(inverse => inverse.currentSha256 === digest);
  if (!records.length) return source;
  if (Object.values(checked.current).filter(value => value === digest).length !== 1)
    throw Error("Ambiguous full v333 source fingerprint");
  return project(source, records[0]);
}
