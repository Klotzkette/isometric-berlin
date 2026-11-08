/** Test-only finite current207 -> published206 delta, before immutable v325.
 * This module deliberately imports no older history helper: V325 calls it. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const SOURCE_HISTORY_PUBLISHED_V206_V326 = "d9f43e1672dd1aad332ed59549035cf33e6aa91c";
export const SOURCE_HISTORY_PROOF_V325_SHA_V326 = "b3aadd61ba9e0e1cca54c9a874a203b4774e08654e738734182fb4dfc530faec";
export const SOURCE_HISTORY_CAPTURE_SHA_V326 = "562b592b23b3a927cf2ef1216639a1fa8b8ce04e8ff0b7dcdfb763df13a31736";
export const SOURCE_HISTORY_PROOF_SHA_V326 = "5fe4411de0ae9d51eaa9af6b5a4be6a4bc5b4df0c221229204fb3ee4cc9148a6";
type InverseV326 = { beforeSha256: string; currentSha256: string; replacements: { before: string; current: string }[] };
export type SourceReceiptV326 = {
  schemaVersion: number; publishedCommit: string; previousProofSha256: string; captureToolSha256: string;
  additions: Record<string, string>; changes: Record<string, InverseV326>;
};
export type SourceLayerV326 = Readonly<{
  receipt: SourceReceiptV326; publishedGraph: Readonly<Record<string, string>>; currentGraph: Readonly<Record<string, string>>;
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
function inverse(source: string, receipt: InverseV326): string {
  if (sha(source) !== receipt.currentSha256) throw Error("Changed exact v326 inverse input");
  for (const replacement of receipt.replacements) {
    if (!replacement.current || source.split(replacement.current).length !== 2) throw Error("Ambiguous exact v326 source inverse");
    source = source.replace(replacement.current, () => replacement.before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v326 source complement");
  return source;
}

/** Reconstruct all 2,019 published206 paths from the independently frozen
 * v318 full graph and v319-v325 deltas. No historical fixture is rewritten. */
export function published206SourceGraphV326(
  raw318: Uint8Array, raw319: Uint8Array, raw320: Uint8Array, raw321: Uint8Array, raw322: Uint8Array, raw323: Uint8Array, raw324: Uint8Array, raw325: Uint8Array,
): Readonly<Record<string, string>> {
  const pinned = [
    "e2ab235b83a3407dbfa46c26ba8b55f4c205c8e1914a4c98390bf451fd2a5d70",
    "b9065605b7c6154fa5ca1dd85abcc2c7d298cbfeaf465da28aa4f633d57de9a2",
    "0a8080fe791ecafc6f8983c33ca4d2639409aaa0c59c2762b8c36073297c45ed",
    "563e5593007413863f30ebba06484b12a47a3902b7ed5f354a87470a1813970d",
    "05c5e8117ce9f620ab9b926d59beeca9440a851a707071a4ffaa4d6c29f4812d",
    "fd1375a0879acc33696df363d7802b9d46b0e8e2481f23aaff5254f0dcd07bb5",
    "a06b9868dcad2aea02dee8b082640163565a10a1604d84039a3c89cab4620c03",
    SOURCE_HISTORY_PROOF_V325_SHA_V326,
  ];
  const raws = [raw318, raw319, raw320, raw321, raw322, raw323, raw324, raw325];
  if (raws.some((raw, i) => sha(raw) !== pinned[i])) throw Error("Changed immutable v318/v319/v320/v321/v322/v323/v324/v325 source proof");
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
    [raw324, "3d4ac50baa7777ce63b82cfcc482fd5611b50edc", pinned[5], 10, 7],
    [raw325, "696fcf9a6b8517bd5c6208770fea3e7baf997ce3", pinned[6], 13, 12],
  ] as const) {
    const delta = JSON.parse(Buffer.from(raw).toString("utf8"));
    if (delta.schemaVersion !== 1 || delta.publishedCommit !== commit || delta.previousProofSha256 !== previousSha
        || !record(delta.additions) || !record(delta.changes)
        || Object.keys(delta.additions).length !== additions || Object.keys(delta.changes).length !== changes)
      throw Error("Unknown immutable published206 checkpoint");
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
  if (!graphValid(graph) || Object.keys(graph).length !== 2019) throw Error("Incomplete published206 source graph");
  return freeze(graph);
}

/** Verify the finite complete inventory and every supplied current byte before
 * allowing the exact inverse. Added sources never acquire a fake predecessor. */
export function verifySourceLayerV326(
  receipt: SourceReceiptV326, published: Readonly<Record<string, string>>, inventory: readonly string[], read: (path: string) => Uint8Array,
): SourceLayerV326 {
  if (!record(receipt) || !keys(receipt, ["schemaVersion", "publishedCommit", "previousProofSha256", "captureToolSha256", "additions", "changes"])
      || receipt.schemaVersion !== 1 || receipt.publishedCommit !== SOURCE_HISTORY_PUBLISHED_V206_V326
      || receipt.previousProofSha256 !== SOURCE_HISTORY_PROOF_V325_SHA_V326 || receipt.captureToolSha256 !== SOURCE_HISTORY_CAPTURE_SHA_V326)
    throw Error("Unknown immutable v326 source anchors");
  if (!graphValid(published) || !record(receipt.additions) || !record(receipt.changes)) throw Error("Invalid finite v326 source graph");
  const current: Record<string, string> = { ...published };
  for (const [path, digest] of Object.entries(receipt.additions)) {
    if (!pathValid(path) || !digestValid(digest) || Object.hasOwn(published, path)) throw Error("Invalid or duplicate v326 source addition");
    current[path] = digest;
  }
  for (const [path, value] of Object.entries(receipt.changes)) {
    if (!record(value) || !keys(value, ["beforeSha256", "currentSha256", "replacements"]) || !Object.hasOwn(published, path)
        || value.beforeSha256 !== published[path] || !digestValid(value.currentSha256) || value.beforeSha256 === value.currentSha256
        || !Array.isArray(value.replacements) || !value.replacements.length
        || value.replacements.some(r => !record(r) || !keys(r, ["before", "current"]) || typeof r.before !== "string" || typeof r.current !== "string" || !r.current))
      throw Error(`Invalid bounded v326 source inverse: ${path}`);
    current[path] = value.currentSha256;
  }
  const paths = Object.keys(current);
  if (paths.length > 10000 || new Set(inventory).size !== inventory.length || inventory.length !== paths.length
      || inventory.some(path => !pathValid(path) || !Object.hasOwn(current, path))) throw Error("Changed or unaccounted v326 source inventory");
  for (const path of paths) {
    const raw = read(path);
    if (sha(raw) !== current[path]) throw Error(`Changed complete v326 source graph: ${path}`);
    if (receipt.changes[path]) inverse(Buffer.from(raw).toString("utf8"), receipt.changes[path]);
  }
  const layer = freeze({ receipt, publishedGraph: { ...published }, currentGraph: current });
  admitted.add(layer);
  return layer;
}

let checked: SourceLayerV326 | undefined;
const repoRoot = resolve(import.meta.dir, "../../../..");
export function assertSourceLayerV326(): SourceLayerV326 {
  if (checked) return checked;
  if (SOURCE_HISTORY_PROOF_SHA_V326.startsWith("PENDING_")) throw Error("V326 source fixture awaits Root product freeze and capture");
  const raws = [318, 319, 320, 321, 322, 323, 324, 325].map(version => readFileSync(new URL(`../fixtures/source-history-v${version}.json`, import.meta.url)));
  const graph = published206SourceGraphV326(raws[0], raws[1], raws[2], raws[3], raws[4], raws[5], raws[6], raws[7]);
  const raw = readFileSync(new URL("../fixtures/source-history-v326.json", import.meta.url));
  if (sha(raw) !== SOURCE_HISTORY_PROOF_SHA_V326) throw Error("Changed immutable v326 source proof");
  const receipt = JSON.parse(raw.toString("utf8")) as SourceReceiptV326;
  const files = readdirSync(resolve(repoRoot, "src/app/src"), { recursive: true }).map(path => `src/app/src/${path}`)
    .filter(path => /\.(?:ts|tsx|json)$/.test(path) && statSync(resolve(repoRoot, path)).isFile());
  checked = verifySourceLayerV326(receipt, graph, [...new Set([...Object.keys(graph), ...files])], path => readFileSync(resolve(repoRoot, path)));
  return checked;
}
export function sourceAtPublished206V326(path: string, raw: Uint8Array, layer = assertSourceLayerV326()): Uint8Array {
  if (!admitted.has(layer) || !Object.hasOwn(layer.currentGraph, path) || sha(raw) !== layer.currentGraph[path]
      || !Object.hasOwn(layer.publishedGraph, path)) throw Error(`Unknown exact v326 source bytes: ${path}`);
  const receipt = layer.receipt.changes[path];
  return receipt ? Buffer.from(inverse(Buffer.from(raw).toString("utf8"), receipt)) : raw;
}
export function projectSourceBeforeV326(source: string, layer = assertSourceLayerV326()): string {
  if (!admitted.has(layer)) throw Error("Unverified v326 source layer");
  const digest = sha(source), records = Object.values(layer.receipt.changes).filter(r => r.currentSha256 === digest);
  if (records.length && Object.values(layer.currentGraph).filter(value => value === digest).length !== 1) throw Error("Ambiguous full v326 source fingerprint");
  return records.length ? inverse(source, records[0]) : source;
}
