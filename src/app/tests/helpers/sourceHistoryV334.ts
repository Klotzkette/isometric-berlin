/** Verify the finite public transport delta before older source-history layers read it. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const SOURCE_HISTORY_PROOF_SHA_V334 = "c1c4dde8c03a55b54e83e50d406559e5badbf3f53b5412514fdb61bbe9a2369b";
const previousProof = "7e89d36d18c35d59a43acc237a09a22da832b1abc7b526160a63d00a8e4fef98";
const captureTool = "c0d7b7742517a14713380663a35204bb242e291d21eec931013e960da67d532d";
const publishedGraphHash = "54339657fb6fea1c90348a1e98dcc7fd8b9be5ef2f707a47214c4b3afb8c73a9";
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
    if (!current || source.split(current).length !== 2) throw Error("Ambiguous exact v334 source inverse");
    source = source.replace(current, () => before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v334 source complement");
  return source;
}

export function assertSourceLayerV334(published215: Readonly<Record<string, string>>) {
  if (checked) return;
  const raw333 = fixture(333), raw334 = fixture(334);
  if (sha(raw333) !== previousProof || sha(raw334) !== SOURCE_HISTORY_PROOF_SHA_V334)
    throw Error("Changed immutable v333/v334 source proof");
  const published = { ...published215, ...{"src/app/losslessBase85SourcesV263.ts":"bc5cf0b5a801c0f853e4c8ab46547aed5092aeba237ea112128fa07b93de668a","src/app/losslessJsonData.ts":"205a51179f4e011f9da9b97191a15df9eb238816dacc6e07e765e65dcdfe8f16","src/app/package.json":"9680c1b7218bbe30c39a6e7336084271d09097e72fc4f5cd11ff7c50f1d5557e"} };
  const sorted = Object.fromEntries(Object.keys(published).sort().map(path => [path, published[path]]));
  if (Object.keys(sorted).length !== 2186 || sha(JSON.stringify(sorted)) !== publishedGraphHash)
    throw Error("Incomplete published215 source graph");
  const receipt = JSON.parse(raw334.toString("utf8")) as {
    schemaVersion: number; publishedCommit: string; previousProofSha256: string; captureToolSha256: string;
    additions: Record<string, string>; changes: Record<string, Inverse>;
  };
  if (receipt.schemaVersion !== 1 || receipt.publishedCommit !== "cb3446e69768ca1aad0f9eaeeb42a84dda2ea6e1"
      || receipt.previousProofSha256 !== previousProof || receipt.captureToolSha256 !== captureTool)
    throw Error("Unknown immutable v334 source anchors");
  if (Object.keys(receipt.additions).length !== 7 || Object.keys(receipt.changes).length !== 9)
    throw Error("Invalid finite v334 source delta");
  const current = { ...published };
  for (const [path, digest] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(current, path)) throw Error(`Duplicate v334 source addition: ${path}`);
    current[path] = digest;
  }
  for (const [path, inverse] of Object.entries(receipt.changes)) {
    if (!Object.hasOwn(published, path) || published[path] !== inverse.beforeSha256)
      throw Error(`Invalid v334 source inverse: ${path}`);
    current[path] = inverse.currentSha256;
  }
  const files = readdirSync(resolve(root, "src/app/src"), { recursive: true }).map(path => `src/app/src/${path}`)
    .filter(path => /\.(?:ts|tsx|json)$/.test(path) && statSync(resolve(root, path)).isFile());
  const addedPublic = Object.keys(receipt.additions).filter(path => path.startsWith("src/app/public/"));
  const inventory = new Set([...Object.keys(published), ...files, ...addedPublic]);
  if (inventory.size !== Object.keys(current).length || [...inventory].some(path => !Object.hasOwn(current, path)))
    throw Error("Changed or unaccounted v334 source inventory");
  for (const path of inventory) {
    const raw = readFileSync(resolve(root, path));
    if (sha(raw) !== current[path]) throw Error(`Changed complete v334 source graph: ${path}`);
    if (Object.hasOwn(receipt.changes, path)) project(raw.toString("utf8"), receipt.changes[path]);
  }
  checked = { published: Object.freeze(published), current: Object.freeze(current), changes: receipt.changes };
}

export function sourceAtPublished215V334(path: string, raw: Uint8Array): Uint8Array {
  if (!checked || !Object.hasOwn(checked.published, path) || sha(raw) !== checked.current[path])
    throw Error(`Unknown exact v334 source bytes: ${path}`);
  const inverse = checked.changes[path];
  return inverse ? Buffer.from(project(Buffer.from(raw).toString("utf8"), inverse)) : raw;
}

export function projectSourceBeforeV334(source: string): string {
  if (!checked) throw Error("Unverified v334 source layer");
  const digest = sha(source), records = Object.values(checked.changes).filter(inverse => inverse.currentSha256 === digest);
  if (!records.length) return source;
  if (Object.values(checked.current).filter(value => value === digest).length !== 1)
    throw Error("Ambiguous full v334 source fingerprint");
  return project(source, records[0]);
}
