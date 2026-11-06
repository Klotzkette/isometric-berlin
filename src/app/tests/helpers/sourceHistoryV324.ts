/** Test-only finite current -> published204 delta, before immutable v323.
 * This module deliberately imports no older history helper: V323 calls it. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSourceLayerV325, sourceAtPublished205V325, projectSourceBeforeV325 } from "./sourceHistoryV325";
import { resolve } from "node:path";

export const SOURCE_HISTORY_PUBLISHED_V204_V324 = "3d4ac50baa7777ce63b82cfcc482fd5611b50edc";
export const SOURCE_HISTORY_PROOF_V323_SHA_V324 = "fd1375a0879acc33696df363d7802b9d46b0e8e2481f23aaff5254f0dcd07bb5";
export const SOURCE_HISTORY_CAPTURE_SHA_V324 = "aa6f4b445b03a7dd1253dd5bc133a26e9c87cc178ad50ee8c5a17b7127a8f098";
type InverseV324 = { beforeSha256: string; currentSha256: string; replacements: { before: string; current: string }[] };
export type SourceReceiptV324 = {
  schemaVersion: number; publishedCommit: string; previousProofSha256: string; captureToolSha256: string;
  additions: Record<string, string>; changes: Record<string, InverseV324>;
};
export type SourceLayerV324 = Readonly<{
  receipt: SourceReceiptV324; publishedGraph: Readonly<Record<string, string>>; currentGraph: Readonly<Record<string, string>>;
}>;
const sha = (raw: string | Uint8Array) => createHash("sha256").update(raw).digest("hex");
const pathValid = (path: string) => /^src\/app\/(?:src|public)\/[\w./-]+\.(?:ts|tsx|json)$/.test(path) && !path.split("/").includes("..");
const digestValid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const keys = (value: object, expected: readonly string[]) => Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const graphValid = (value: unknown): value is Record<string, string> => record(value) && Object.keys(value).length > 0 && Object.keys(value).length <= 10000
  && Object.entries(value).every(([path, digest]) => pathValid(path) && digestValid(digest));
const admitted = new WeakSet<object>();
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}
function inverse(source: string, receipt: InverseV324): string {
  if (sha(source) !== receipt.currentSha256) throw Error("Changed exact v324 inverse input");
  for (const replacement of receipt.replacements) {
    if (!replacement.current || source.split(replacement.current).length !== 2) throw Error("Ambiguous exact v324 source inverse");
    source = source.replace(replacement.current, () => replacement.before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v324 source complement");
  return source;
}

/** Reconstruct all 1,996 published204 paths from the independently frozen
 * v318 full graph and v319-v323 deltas. No historical fixture is rewritten. */
export function published204SourceGraphV324(
  raw318: Uint8Array, raw319: Uint8Array, raw320: Uint8Array, raw321: Uint8Array, raw322: Uint8Array, raw323: Uint8Array,
): Readonly<Record<string, string>> {
  const pinned = [
    "e2ab235b83a3407dbfa46c26ba8b55f4c205c8e1914a4c98390bf451fd2a5d70",
    "b9065605b7c6154fa5ca1dd85abcc2c7d298cbfeaf465da28aa4f633d57de9a2",
    "0a8080fe791ecafc6f8983c33ca4d2639409aaa0c59c2762b8c36073297c45ed",
    "563e5593007413863f30ebba06484b12a47a3902b7ed5f354a87470a1813970d",
    "05c5e8117ce9f620ab9b926d59beeca9440a851a707071a4ffaa4d6c29f4812d",
    SOURCE_HISTORY_PROOF_V323_SHA_V324,
  ];
  const raws = [raw318, raw319, raw320, raw321, raw322, raw323];
  if (raws.some((raw, i) => sha(raw) !== pinned[i])) throw Error("Changed immutable v318/v319/v320/v321/v322/v323 source proof");
  const proof = JSON.parse(Buffer.from(raw318).toString("utf8"));
  if (proof.publishedCommit !== "f287881b27828ff914abbb050c2aa47328099af9" || !graphValid(proof.currentGraph)
      || Object.keys(proof.currentGraph).length !== 1939) throw Error("Unknown immutable v318 checkpoint");
  const graph: Record<string, string> = { ...proof.currentGraph };
  for (const [raw, commit, previousSha, additions, changes] of [
    [raw319, "a6cfc75df786029533f824837569fa46f7d74ad0", pinned[0], 7, 3],
    [raw320, "e594dfff933c7a0114d3f58ac7c2d28872e612a2", pinned[1], 2, 3],
    [raw321, "4123bd3464d68d26d5119ee451e88db3fe53dcc6", pinned[2], 20, 18],
    [raw322, "c3f8ca120908d264ab5921f1fe090b4bf2db3767", pinned[3], 22, 10],
    [raw323, "264fa95b6f73ad6759edfe28134ab043a510407c", pinned[4], 6, 5],
  ] as const) {
    const delta = JSON.parse(Buffer.from(raw).toString("utf8"));
    if (delta.schemaVersion !== 1 || delta.publishedCommit !== commit || delta.previousProofSha256 !== previousSha
        || !record(delta.additions) || !record(delta.changes)
        || Object.keys(delta.additions).length !== additions || Object.keys(delta.changes).length !== changes)
      throw Error("Unknown immutable published204 checkpoint");
    for (const [path, digest] of Object.entries(delta.additions)) {
      if (!pathValid(path) || !digestValid(digest) || Object.hasOwn(graph, path)) throw Error("Invalid frozen source addition");
      graph[path] = digest;
    }
    for (const [path, value] of Object.entries(delta.changes)) {
      if (!record(value) || !Object.hasOwn(graph, path) || value.beforeSha256 !== graph[path]
          || !digestValid(value.currentSha256)) throw Error("Invalid frozen source inverse");
      graph[path] = value.currentSha256;
    }
  }
  if (!graphValid(graph) || Object.keys(graph).length !== 1996) throw Error("Incomplete published204 source graph");
  return freeze(graph);
}

/** Verify the finite complete inventory and every supplied current byte before
 * allowing the exact inverse. Added sources never acquire a fake predecessor. */
export function verifySourceLayerV324(
  receipt: SourceReceiptV324, published: Readonly<Record<string, string>>, inventory: readonly string[], read: (path: string) => Uint8Array,
): SourceLayerV324 {
  if (!record(receipt) || !keys(receipt, ["schemaVersion", "publishedCommit", "previousProofSha256", "captureToolSha256", "additions", "changes"])
      || receipt.schemaVersion !== 1 || receipt.publishedCommit !== SOURCE_HISTORY_PUBLISHED_V204_V324
      || receipt.previousProofSha256 !== SOURCE_HISTORY_PROOF_V323_SHA_V324 || receipt.captureToolSha256 !== SOURCE_HISTORY_CAPTURE_SHA_V324)
    throw Error("Unknown immutable v324 source anchors");
  if (!graphValid(published) || !record(receipt.additions) || !record(receipt.changes)) throw Error("Invalid finite v324 source graph");
  const current: Record<string, string> = { ...published };
  for (const [path, digest] of Object.entries(receipt.additions)) {
    if (!pathValid(path) || !digestValid(digest) || Object.hasOwn(published, path)) throw Error("Invalid or duplicate v324 source addition");
    current[path] = digest;
  }
  for (const [path, value] of Object.entries(receipt.changes)) {
    if (!record(value) || !keys(value, ["beforeSha256", "currentSha256", "replacements"]) || !Object.hasOwn(published, path)
        || value.beforeSha256 !== published[path] || !digestValid(value.currentSha256) || value.beforeSha256 === value.currentSha256
        || !Array.isArray(value.replacements) || !value.replacements.length
        || value.replacements.some(r => !record(r) || !keys(r, ["before", "current"]) || typeof r.before !== "string" || typeof r.current !== "string" || !r.current))
      throw Error(`Invalid bounded v324 source inverse: ${path}`);
    current[path] = value.currentSha256;
  }
  const paths = Object.keys(current);
  if (paths.length > 10000 || new Set(inventory).size !== inventory.length || inventory.length !== paths.length
      || inventory.some(path => !pathValid(path) || !Object.hasOwn(current, path))) throw Error("Changed or unaccounted v324 source inventory");
  for (const path of paths) {
    const raw = read(path);
    if (sha(raw) !== current[path]) throw Error(`Changed complete v324 source graph: ${path}`);
    if (receipt.changes[path]) inverse(Buffer.from(raw).toString("utf8"), receipt.changes[path]);
  }
  const layer = freeze({ receipt, publishedGraph: { ...published }, currentGraph: current });
  admitted.add(layer);
  return layer;
}

let checked: SourceLayerV324 | undefined;
const repoRoot = resolve(import.meta.dir, "../../../..");
export function assertSourceLayerV324(): SourceLayerV324 {
  if (checked) return checked;
  const newest = assertSourceLayerV325();
  const raws = [318, 319, 320, 321, 322, 323].map(version => readFileSync(new URL(`../fixtures/source-history-v${version}.json`, import.meta.url)));
  const graph = published204SourceGraphV324(raws[0], raws[1], raws[2], raws[3], raws[4], raws[5]);
  const receipt = JSON.parse(readFileSync(new URL("../fixtures/source-history-v324.json", import.meta.url), "utf8")) as SourceReceiptV324;
  checked = verifySourceLayerV324(receipt, graph, Object.keys(newest.publishedGraph),
    path => sourceAtPublished205V325(path, readFileSync(resolve(repoRoot, path)), newest));
  return checked;
}
export function sourceAtPublished204V324(path: string, raw: Uint8Array, layer = assertSourceLayerV324()): Uint8Array {
  if (layer === checked) raw = sourceAtPublished205V325(path, raw);
  if (!admitted.has(layer) || !Object.hasOwn(layer.currentGraph, path) || sha(raw) !== layer.currentGraph[path]
      || !Object.hasOwn(layer.publishedGraph, path)) throw Error(`Unknown exact v324 source bytes: ${path}`);
  const receipt = layer.receipt.changes[path];
  return receipt ? Buffer.from(inverse(Buffer.from(raw).toString("utf8"), receipt)) : raw;
}
export function projectSourceBeforeV324(source: string, layer = assertSourceLayerV324()): string {
  if (layer === checked) source = projectSourceBeforeV325(source);
  if (!admitted.has(layer)) throw Error("Unverified v324 source layer");
  const digest = sha(source), records = Object.values(layer.receipt.changes).filter(r => r.currentSha256 === digest);
  if (records.length && Object.values(layer.currentGraph).filter(value => value === digest).length !== 1) throw Error("Ambiguous full v324 source fingerprint");
  return records.length ? inverse(source, records[0]) : source;
}
