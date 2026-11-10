/** Verify the finite public viewer routing delta before older source-history layers read it. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const SOURCE_HISTORY_PROOF_SHA_V335 = "fe8566a0f606cc69623bae57f3785f31c5ccb75806363973dcaf5227571cafc1";
const previousProof = "c1c4dde8c03a55b54e83e50d406559e5badbf3f53b5412514fdb61bbe9a2369b";
const captureTool = "3a7cfa15f4aec17ae13ed0ffd49b24aafba9815970696f833c2c6c394be850f2";
const publishedGraphHash = "fbac38c2e3ce6b3ba21baf536da025274d259773a1005b28480edd01b23fe760";
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
    if (!current || source.split(current).length !== 2) throw Error("Ambiguous exact v335 source inverse");
    source = source.replace(current, () => before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v335 source complement");
  return source;
}

export function assertSourceLayerV335(published216: Readonly<Record<string, string>>) {
  if (checked) return;
  const raw334 = fixture(334), raw335 = fixture(335);
  if (sha(raw334) !== previousProof || sha(raw335) !== SOURCE_HISTORY_PROOF_SHA_V335)
    throw Error("Changed immutable v334/v335 source proof");
  const published = { ...published216 };
  const sorted = Object.fromEntries(Object.keys(published).sort().map(path => [path, published[path]]));
  if (Object.keys(sorted).length !== 2193 || sha(JSON.stringify(sorted)) !== publishedGraphHash)
    throw Error("Incomplete published216 source graph");
  const receipt = JSON.parse(raw335.toString("utf8")) as {
    schemaVersion: number; publishedCommit: string; previousProofSha256: string; captureToolSha256: string;
    additions: Record<string, string>; changes: Record<string, Inverse>;
  };
  if (receipt.schemaVersion !== 1 || receipt.publishedCommit !== "4385dbad98de73af1605001f65e452425d34e49c"
      || receipt.previousProofSha256 !== previousProof || receipt.captureToolSha256 !== captureTool)
    throw Error("Unknown immutable v335 source anchors");
  const path = "src/app/src/SurroundingCity.ts";
  if (Object.keys(receipt.additions).length || Object.keys(receipt.changes).length !== 1 || !Object.hasOwn(receipt.changes, path))
    throw Error("Invalid finite v335 source delta");
  const inverse = receipt.changes[path];
  if (published[path] !== inverse.beforeSha256 || inverse.currentSha256 === inverse.beforeSha256 || !inverse.replacements.length)
    throw Error(`Invalid v335 source inverse: ${path}`);
  const current = { ...published, [path]: inverse.currentSha256 };
  const files = readdirSync(resolve(root, "src/app/src"), { recursive: true }).map(path => `src/app/src/${path}`)
    .filter(path => /\.(?:ts|tsx|json)$/.test(path) && statSync(resolve(root, path)).isFile());
  const inventory = new Set([...Object.keys(published), ...files]);
  if (inventory.size !== Object.keys(current).length || [...inventory].some(path => !Object.hasOwn(current, path)))
    throw Error("Changed or unaccounted v335 source inventory");
  for (const path of inventory) {
    const raw = readFileSync(resolve(root, path));
    if (sha(raw) !== current[path]) throw Error(`Changed complete v335 source graph: ${path}`);
    if (Object.hasOwn(receipt.changes, path)) project(raw.toString("utf8"), receipt.changes[path]);
  }
  checked = { published: Object.freeze(published), current: Object.freeze(current), changes: receipt.changes };
}

export function sourceAtPublished216V335(path: string, raw: Uint8Array): Uint8Array {
  if (!checked || !Object.hasOwn(checked.published, path) || sha(raw) !== checked.current[path])
    throw Error(`Unknown exact v335 source bytes: ${path}`);
  const inverse = checked.changes[path];
  return inverse ? Buffer.from(project(Buffer.from(raw).toString("utf8"), inverse)) : raw;
}

export function projectSourceBeforeV335(source: string): string {
  if (!checked) throw Error("Unverified v335 source layer");
  const digest = sha(source), records = Object.values(checked.changes).filter(inverse => inverse.currentSha256 === digest);
  if (!records.length) return source;
  if (Object.values(checked.current).filter(value => value === digest).length !== 1)
    throw Error("Ambiguous full v335 source fingerprint");
  return project(source, records[0]);
}
