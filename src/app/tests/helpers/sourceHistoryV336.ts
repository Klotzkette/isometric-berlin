/** Verify the public packet transport change before replaying earlier source layers. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertSourceLayerV337,
  projectSourceBeforeV337,
  sourceAtBeforeV337,
  sourceChangedSinceV336,
} from "./sourceHistoryV337";

export const SOURCE_HISTORY_PROOF_SHA_V336 = "c6c9a3c7a4cb32839f0b98170177d2ef5d46ae7980eb0ea9718c154eae9cea1d";
const previousProof = "fe8566a0f606cc69623bae57f3785f31c5ccb75806363973dcaf5227571cafc1";
const captureTool = "d10db301ce6059884ffea81e276c09e07d57e636faa1826459c73f4f1a080845";
const previousGraphHash = "4819835892e7f7a454ca8d49b2cd8ff31cedb8613db4e595fa8148fc7da7ff57";
const previousCommit = "d299176316d230be97f80b7cc24b80a1425110d8";
const changedPath = "src/app/src/SurroundingCity.ts";
const addedPath = "src/app/src/SurroundingPacketDelta.ts";
const root = resolve(import.meta.dir, "../../../..");
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const fixture = (version: number) => readFileSync(new URL(`../fixtures/source-history-v${version}.json`, import.meta.url));

type Inverse = {
  beforeSha256: string;
  currentSha256: string;
  replacements: { before: string; current: string }[];
};

let checked: {
  previous: Readonly<Record<string, string>>;
  inverse: Inverse;
} | undefined;

function project(source: string, inverse: Inverse): string {
  for (const { before, current } of inverse.replacements) {
    if (!current || source.split(current).length !== 2) throw Error("Ambiguous exact v336 source inverse");
    source = source.replace(current, () => before);
  }
  if (sha(source) !== inverse.beforeSha256) throw Error("Changed full v336 source complement");
  return source;
}

export function assertSourceLayerV336(previous: Readonly<Record<string, string>>) {
  if (checked) return;
  const raw = fixture(336);
  if (sha(fixture(335)) !== previousProof || sha(raw) !== SOURCE_HISTORY_PROOF_SHA_V336)
    throw Error("Changed immutable v335/v336 source proof");
  const paths = Object.keys(previous).sort();
  const sorted = Object.fromEntries(paths.map(path => [path, previous[path]]));
  if (paths.length !== 2193 || sha(JSON.stringify(sorted)) !== previousGraphHash)
    throw Error("Incomplete v335 source graph");
  const receipt = JSON.parse(raw.toString("utf8")) as {
    schemaVersion: number; previousCommit: string; previousProofSha256: string; captureToolSha256: string;
    additions: Record<string, string>; changes: Record<string, Inverse>;
  };
  if (receipt.schemaVersion !== 1 || receipt.previousCommit !== previousCommit
      || receipt.previousProofSha256 !== previousProof || receipt.captureToolSha256 !== captureTool)
    throw Error("Unknown immutable v336 source anchors");
  if (Object.keys(receipt.additions).length !== 1 || !Object.hasOwn(receipt.additions, addedPath)
      || Object.keys(receipt.changes).length !== 1 || !Object.hasOwn(receipt.changes, changedPath))
    throw Error("Invalid finite v336 source delta");
  const inverse = receipt.changes[changedPath];
  if (previous[changedPath] !== inverse.beforeSha256 || inverse.currentSha256 === inverse.beforeSha256
      || !inverse.replacements.length || Object.hasOwn(previous, addedPath))
    throw Error("Invalid exact v336 source changes");
  const current = { ...previous, [changedPath]: inverse.currentSha256, [addedPath]: receipt.additions[addedPath] };
  if (Object.values(current).filter(digest => digest === inverse.currentSha256).length !== 1)
    throw Error("Ambiguous full v336 source fingerprint");
  assertSourceLayerV337(current);
  const rawSource = readFileSync(resolve(root, changedPath));
  const source = sourceChangedSinceV336(changedPath) ? sourceAtBeforeV337(changedPath, rawSource) : rawSource;
  project(Buffer.from(source).toString("utf8"), inverse);
  checked = { previous: Object.freeze({ ...previous }), inverse };
}

export function sourceChangedSinceV335(path: string): boolean {
  return path === changedPath || sourceChangedSinceV336(path);
}

export function sourceAtBeforeV336(path: string, raw: Uint8Array): Uint8Array {
  if (!checked || !Object.hasOwn(checked.previous, path))
    throw Error(`Unknown exact v336 source bytes: ${path}`);
  if (sourceChangedSinceV336(path)) {
    try {
      raw = sourceAtBeforeV337(path, raw);
    } catch (cause) {
      throw Error(`Unknown exact v336 source bytes: ${path}`, { cause });
    }
  }
  if (sha(raw) !== (path === changedPath ? checked.inverse.currentSha256 : checked.previous[path]))
    throw Error(`Unknown exact v336 source bytes: ${path}`);
  return path === changedPath ? Buffer.from(project(Buffer.from(raw).toString("utf8"), checked.inverse)) : raw;
}

export function projectSourceBeforeV336(source: string): string {
  if (!checked) throw Error("Unverified v336 source layer");
  source = projectSourceBeforeV337(source);
  return sha(source) === checked.inverse.currentSha256 ? project(source, checked.inverse) : source;
}
