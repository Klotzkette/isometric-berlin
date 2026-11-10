/** Verify the finite Marzahn gardens and ropeway delta before older source-history layers read it. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const SOURCE_HISTORY_PROOF_SHA_V330 = "3e7b695bf04f1feaf3497b1ec6181b41c46f7b9921cb82f4fbfc6484831698d5";
const previousProof = "26c07c8ae2485ee822b5523590316dade92bdcae1595ae937b92d8158281eeee";
const publishedGraphHash = "b96f3b7fb152cda247f920b3c12161af7a88291f526c446b38f2c6e2c9c9267e";
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
    if (!current || source.split(current).length !== 2) throw Error("Ambiguous exact v330 source inverse");
    source = source.replace(current, () => before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v330 source complement");
  return source;
}

export function assertSourceLayerV330(published210: Readonly<Record<string, string>>) {
  if (checked) return;
  const raw329 = fixture(329), raw330 = fixture(330);
  if (sha(raw329) !== previousProof || sha(raw330) !== SOURCE_HISTORY_PROOF_SHA_V330)
    throw Error("Changed immutable v329/v330 source proof");
  const published = { ...published210 };
  const sorted = Object.fromEntries(Object.keys(published).sort().map(path => [path, published[path]]));
  if (Object.keys(sorted).length !== 2173 || sha(JSON.stringify(sorted)) !== publishedGraphHash)
    throw Error("Incomplete published210 source graph");
  const receipt = JSON.parse(raw330.toString("utf8")) as {
    schemaVersion: number; publishedCommit: string; previousProofSha256: string;
    additions: Record<string, string>; changes: Record<string, Inverse>;
  };
  if (receipt.schemaVersion !== 1 || receipt.publishedCommit !== "3778a70d4db2c672c964a839e43d05bf0fe6e053"
      || receipt.previousProofSha256 !== previousProof) throw Error("Unknown immutable v330 source anchors");
  const current = { ...published };
  for (const [path, digest] of Object.entries(receipt.additions)) {
    if (Object.hasOwn(current, path)) throw Error(`Duplicate v330 source addition: ${path}`);
    current[path] = digest;
  }
  for (const [path, inverse] of Object.entries(receipt.changes)) {
    if (!Object.hasOwn(published, path) || published[path] !== inverse.beforeSha256)
      throw Error(`Invalid v330 source inverse: ${path}`);
    current[path] = inverse.currentSha256;
  }
  const files = readdirSync(resolve(root, "src/app/src"), { recursive: true }).map(path => `src/app/src/${path}`)
    .filter(path => /\.(?:ts|tsx|json)$/.test(path) && statSync(resolve(root, path)).isFile());
  const inventory = new Set([...Object.keys(published), ...files]);
  if (inventory.size !== Object.keys(current).length || [...inventory].some(path => !Object.hasOwn(current, path)))
    throw Error("Changed or unaccounted v330 source inventory");
  for (const path of inventory) {
    const raw = readFileSync(resolve(root, path));
    if (sha(raw) !== current[path]) throw Error(`Changed complete v330 source graph: ${path}`);
    if (Object.hasOwn(receipt.changes, path)) project(raw.toString("utf8"), receipt.changes[path]);
  }
  checked = { published: Object.freeze(published), current: Object.freeze(current), changes: receipt.changes };
}

export function sourceAtPublished210V330(path: string, raw: Uint8Array): Uint8Array {
  if (!checked || !Object.hasOwn(checked.published, path) || sha(raw) !== checked.current[path])
    throw Error(`Unknown exact v330 source bytes: ${path}`);
  const inverse = checked.changes[path];
  return inverse ? Buffer.from(project(Buffer.from(raw).toString("utf8"), inverse)) : raw;
}

export function projectSourceBeforeV330(source: string): string {
  if (!checked) throw Error("Unverified v330 source layer");
  const digest = sha(source), records = Object.values(checked.changes).filter(inverse => inverse.currentSha256 === digest);
  if (!records.length) return source;
  if (Object.values(checked.current).filter(value => value === digest).length !== 1)
    throw Error("Ambiguous full v330 source fingerprint");
  return project(source, records[0]);
}
