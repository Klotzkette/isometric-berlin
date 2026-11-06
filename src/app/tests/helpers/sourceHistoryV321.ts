/** Test-only finite current -> published200 delta, before immutable v320. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const SOURCE_HISTORY_PUBLISHED_V200_V321 = "4123bd3464d68d26d5119ee451e88db3fe53dcc6";
export const SOURCE_HISTORY_PROOF_V320_SHA_V321 = "0a8080fe791ecafc6f8983c33ca4d2639409aaa0c59c2762b8c36073297c45ed";
export const SOURCE_HISTORY_CAPTURE_SHA_V321 = "1fe797830d5bff3bac4767203cf6e9c35af19faf450edd76e2a5d36f0704bcaf";
type InverseV321 = { beforeSha256: string; currentSha256: string; replacements: { before: string; current: string }[] };
export type SourceReceiptV321 = {
  schemaVersion: number; publishedCommit: string; previousProofSha256: string; captureToolSha256: string;
  additions: Record<string, string>; changes: Record<string, InverseV321>;
};
export type SourceLayerV321 = Readonly<{
  receipt: SourceReceiptV321; publishedGraph: Readonly<Record<string, string>>; currentGraph: Readonly<Record<string, string>>;
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
function inverse(source: string, receipt: InverseV321): string {
  if (sha(source) !== receipt.currentSha256) throw Error("Changed exact v321 inverse input");
  for (const replacement of receipt.replacements) {
    if (!replacement.current || source.split(replacement.current).length !== 2) throw Error("Ambiguous exact v321 source inverse");
    source = source.replace(replacement.current, replacement.before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v321 source complement");
  return source;
}

/** Reconstruct all 1,948 published200 paths from immutable checkpoints.
 * Only finite deltas are stored; every historical source remains independent. */
export function published200SourceGraphV321(raw318: Uint8Array, raw319: Uint8Array, raw320: Uint8Array): Readonly<Record<string, string>> {
  if (sha(raw318) !== "e2ab235b83a3407dbfa46c26ba8b55f4c205c8e1914a4c98390bf451fd2a5d70"
      || sha(raw319) !== "b9065605b7c6154fa5ca1dd85abcc2c7d298cbfeaf465da28aa4f633d57de9a2"
      || sha(raw320) !== SOURCE_HISTORY_PROOF_V320_SHA_V321) throw Error("Changed immutable v318/v319/v320 source proof");
  const proof = JSON.parse(Buffer.from(raw318).toString("utf8"));
  if (proof.publishedCommit !== "f287881b27828ff914abbb050c2aa47328099af9" || !graphValid(proof.currentGraph)
      || Object.keys(proof.currentGraph).length !== 1939) throw Error("Unknown immutable v318 checkpoint");
  const graph: Record<string, string> = { ...proof.currentGraph };
  for (const [raw, commit, previousSha, additions, changes] of [
    [raw319, "a6cfc75df786029533f824837569fa46f7d74ad0", sha(raw318), 7, 3],
    [raw320, "e594dfff933c7a0114d3f58ac7c2d28872e612a2", sha(raw319), 2, 3],
  ] as const) {
    const delta = JSON.parse(Buffer.from(raw).toString("utf8"));
    if (delta.schemaVersion !== 1 || delta.publishedCommit !== commit || delta.previousProofSha256 !== previousSha
        || !record(delta.additions) || !record(delta.changes)
        || Object.keys(delta.additions).length !== additions || Object.keys(delta.changes).length !== changes)
      throw Error("Unknown immutable published200 checkpoint");
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
  if (!graphValid(graph) || Object.keys(graph).length !== 1948) throw Error("Incomplete published200 source graph");
  return freeze(graph);
}

/** Every existing and newly imported code/JSON file is still checked. Only
 * the receipt's storage is smaller; no unknown path or unproved byte is read
 * from a substitute source. The supplied reader always supplies actual bytes. */
export function verifySourceLayerV321(
  receipt: SourceReceiptV321, published: Readonly<Record<string, string>>, inventory: readonly string[], read: (path: string) => Uint8Array,
): SourceLayerV321 {
  if (!record(receipt) || !keys(receipt, ["schemaVersion", "publishedCommit", "previousProofSha256", "captureToolSha256", "additions", "changes"])
      || receipt.schemaVersion !== 1 || receipt.publishedCommit !== SOURCE_HISTORY_PUBLISHED_V200_V321
      || receipt.previousProofSha256 !== SOURCE_HISTORY_PROOF_V320_SHA_V321 || receipt.captureToolSha256 !== SOURCE_HISTORY_CAPTURE_SHA_V321)
    throw Error("Unknown immutable v321 source anchors");
  if (!graphValid(published) || !record(receipt.additions) || !record(receipt.changes)) throw Error("Invalid finite v321 source graph");
  const current: Record<string, string> = { ...published };
  for (const [path, digest] of Object.entries(receipt.additions)) {
    if (!pathValid(path) || !digestValid(digest) || Object.hasOwn(published, path)) throw Error("Invalid or duplicate v321 source addition");
    current[path] = digest;
  }
  for (const [path, value] of Object.entries(receipt.changes)) {
    if (!record(value) || !keys(value, ["beforeSha256", "currentSha256", "replacements"]) || !Object.hasOwn(published, path)
        || value.beforeSha256 !== published[path] || !digestValid(value.currentSha256) || value.beforeSha256 === value.currentSha256
        || !Array.isArray(value.replacements) || !value.replacements.length
        || value.replacements.some(r => !record(r) || !keys(r, ["before", "current"]) || typeof r.before !== "string" || typeof r.current !== "string" || !r.current))
      throw Error(`Invalid bounded v321 source inverse: ${path}`);
    current[path] = value.currentSha256;
  }
  const paths = Object.keys(current);
  if (paths.length > 10000 || new Set(inventory).size !== inventory.length || inventory.length !== paths.length
      || inventory.some(path => !pathValid(path) || !Object.hasOwn(current, path))) throw Error("Changed or unaccounted v321 source inventory");
  for (const path of paths) {
    const raw = read(path);
    if (sha(raw) !== current[path]) throw Error(`Changed complete v321 source graph: ${path}`);
    if (receipt.changes[path]) inverse(Buffer.from(raw).toString("utf8"), receipt.changes[path]);
  }
  const layer = freeze({ receipt, publishedGraph: { ...published }, currentGraph: current });
  admitted.add(layer);
  return layer;
}

let checked: SourceLayerV321 | undefined;
const repoRoot = resolve(import.meta.dir, "../../../..");
export function assertSourceLayerV321(): SourceLayerV321 {
  if (checked) return checked;
  const graph = published200SourceGraphV321(readFileSync(new URL("../fixtures/source-history-v318.json", import.meta.url)),
    readFileSync(new URL("../fixtures/source-history-v319.json", import.meta.url)),
    readFileSync(new URL("../fixtures/source-history-v320.json", import.meta.url)));
  const receipt = JSON.parse(readFileSync(new URL("../fixtures/source-history-v321.json", import.meta.url), "utf8")) as SourceReceiptV321;
  const files = readdirSync(resolve(repoRoot, "src/app/src"), { recursive: true }).map(path => `src/app/src/${path}`)
    .filter(path => /\.(?:ts|tsx|json)$/.test(path) && statSync(resolve(repoRoot, path)).isFile());
  checked = verifySourceLayerV321(receipt, graph, [...new Set([...Object.keys(graph), ...files])], path => readFileSync(resolve(repoRoot, path)));
  return checked;
}
export function sourceAtPublished200V321(path: string, raw: Uint8Array, layer = assertSourceLayerV321()): Uint8Array {
  if (!admitted.has(layer) || !Object.hasOwn(layer.currentGraph, path) || sha(raw) !== layer.currentGraph[path]
      || !Object.hasOwn(layer.publishedGraph, path)) throw Error(`Unknown exact v321 source bytes: ${path}`);
  const receipt = layer.receipt.changes[path];
  return receipt ? Buffer.from(inverse(Buffer.from(raw).toString("utf8"), receipt)) : raw;
}
export function projectSourceBeforeV321(source: string, layer = assertSourceLayerV321()): string {
  if (!admitted.has(layer)) throw Error("Unverified v321 source layer");
  const digest = sha(source), records = Object.values(layer.receipt.changes).filter(r => r.currentSha256 === digest);
  if (records.length && Object.values(layer.currentGraph).filter(value => value === digest).length !== 1) throw Error("Ambiguous full v321 source fingerprint");
  return records.length ? inverse(source, records[0]) : source;
}
