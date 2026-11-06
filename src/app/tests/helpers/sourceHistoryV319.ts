/** Test-only finite current -> published198 delta, before immutable v318. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const SOURCE_HISTORY_PUBLISHED_V198_V319 = "a6cfc75df786029533f824837569fa46f7d74ad0";
export const SOURCE_HISTORY_PROOF_V318_SHA_V319 = "e2ab235b83a3407dbfa46c26ba8b55f4c205c8e1914a4c98390bf451fd2a5d70";
export const SOURCE_HISTORY_CAPTURE_SHA_V319 = "69f6dd7f4ff962a1c857bd6938847fcadeac6c88d9c74a09809fbe202e087e45";
type InverseV319 = { beforeSha256: string; currentSha256: string; replacements: { before: string; current: string }[] };
export type SourceReceiptV319 = {
  schemaVersion: number; publishedCommit: string; previousProofSha256: string; captureToolSha256: string;
  additions: Record<string, string>; changes: Record<string, InverseV319>;
};
export type SourceLayerV319 = Readonly<{
  receipt: SourceReceiptV319; publishedGraph: Readonly<Record<string, string>>; currentGraph: Readonly<Record<string, string>>;
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
function inverse(source: string, receipt: InverseV319): string {
  if (sha(source) !== receipt.currentSha256) throw Error("Changed exact v319 inverse input");
  for (const replacement of receipt.replacements) {
    if (!replacement.current || source.split(replacement.current).length !== 2) throw Error("Ambiguous exact v319 source inverse");
    source = source.replace(replacement.current, replacement.before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v319 source complement");
  return source;
}

/** The frozen318 proof already contains the complete published198 graph. This
 * receipt reuses it verbatim rather than storing two further copies of it. */
export function published198SourceGraphV319(raw: Uint8Array): Readonly<Record<string, string>> {
  if (sha(raw) !== SOURCE_HISTORY_PROOF_V318_SHA_V319) throw Error("Changed immutable v318 source proof");
  const proof = JSON.parse(Buffer.from(raw).toString("utf8"));
  if (proof.publishedCommit !== "f287881b27828ff914abbb050c2aa47328099af9" || !graphValid(proof.currentGraph)
      || Object.keys(proof.currentGraph).length !== 1939) throw Error("Unknown immutable v198 checkpoint");
  return freeze(proof.currentGraph);
}

/** Every existing and newly imported code/JSON file is still checked. Only
 * the receipt's storage is smaller; no unknown path or unproved byte is read
 * from a substitute source. The supplied reader always supplies actual bytes. */
export function verifySourceLayerV319(
  receipt: SourceReceiptV319, published: Readonly<Record<string, string>>, inventory: readonly string[], read: (path: string) => Uint8Array,
): SourceLayerV319 {
  if (!record(receipt) || !keys(receipt, ["schemaVersion", "publishedCommit", "previousProofSha256", "captureToolSha256", "additions", "changes"])
      || receipt.schemaVersion !== 1 || receipt.publishedCommit !== SOURCE_HISTORY_PUBLISHED_V198_V319
      || receipt.previousProofSha256 !== SOURCE_HISTORY_PROOF_V318_SHA_V319 || receipt.captureToolSha256 !== SOURCE_HISTORY_CAPTURE_SHA_V319)
    throw Error("Unknown immutable v319 source anchors");
  if (!graphValid(published) || !record(receipt.additions) || !record(receipt.changes)) throw Error("Invalid finite v319 source graph");
  const current: Record<string, string> = { ...published };
  for (const [path, digest] of Object.entries(receipt.additions)) {
    if (!pathValid(path) || !digestValid(digest) || Object.hasOwn(published, path)) throw Error("Invalid or duplicate v319 source addition");
    current[path] = digest;
  }
  for (const [path, value] of Object.entries(receipt.changes)) {
    if (!record(value) || !keys(value, ["beforeSha256", "currentSha256", "replacements"]) || !Object.hasOwn(published, path)
        || value.beforeSha256 !== published[path] || !digestValid(value.currentSha256) || value.beforeSha256 === value.currentSha256
        || !Array.isArray(value.replacements) || !value.replacements.length
        || value.replacements.some(r => !record(r) || !keys(r, ["before", "current"]) || typeof r.before !== "string" || typeof r.current !== "string" || !r.current))
      throw Error(`Invalid bounded v319 source inverse: ${path}`);
    current[path] = value.currentSha256;
  }
  const paths = Object.keys(current);
  if (paths.length > 10000 || new Set(inventory).size !== inventory.length || inventory.length !== paths.length
      || inventory.some(path => !pathValid(path) || !Object.hasOwn(current, path))) throw Error("Changed or unaccounted v319 source inventory");
  for (const path of paths) {
    const raw = read(path);
    if (sha(raw) !== current[path]) throw Error(`Changed complete v319 source graph: ${path}`);
    if (receipt.changes[path]) inverse(Buffer.from(raw).toString("utf8"), receipt.changes[path]);
  }
  const layer = freeze({ receipt, publishedGraph: { ...published }, currentGraph: current });
  admitted.add(layer);
  return layer;
}

let checked: SourceLayerV319 | undefined;
const repoRoot = resolve(import.meta.dir, "../../../..");
export function assertSourceLayerV319(): SourceLayerV319 {
  if (checked) return checked;
  const graph = published198SourceGraphV319(readFileSync(new URL("../fixtures/source-history-v318.json", import.meta.url)));
  const receipt = JSON.parse(readFileSync(new URL("../fixtures/source-history-v319.json", import.meta.url), "utf8")) as SourceReceiptV319;
  const files = readdirSync(resolve(repoRoot, "src/app/src"), { recursive: true }).map(path => `src/app/src/${path}`)
    .filter(path => /\.(?:ts|tsx|json)$/.test(path) && statSync(resolve(repoRoot, path)).isFile());
  checked = verifySourceLayerV319(receipt, graph, [...new Set([...Object.keys(graph), ...files])], path => readFileSync(resolve(repoRoot, path)));
  return checked;
}
export function sourceAtPublished198V319(path: string, raw: Uint8Array, layer = assertSourceLayerV319()): Uint8Array {
  if (!admitted.has(layer) || !Object.hasOwn(layer.currentGraph, path) || sha(raw) !== layer.currentGraph[path]
      || !Object.hasOwn(layer.publishedGraph, path)) throw Error(`Unknown exact v319 source bytes: ${path}`);
  const receipt = layer.receipt.changes[path];
  return receipt ? Buffer.from(inverse(Buffer.from(raw).toString("utf8"), receipt)) : raw;
}
export function projectSourceBeforeV319(source: string, layer = assertSourceLayerV319()): string {
  if (!admitted.has(layer)) throw Error("Unverified v319 source layer");
  const digest = sha(source), records = Object.values(layer.receipt.changes).filter(r => r.currentSha256 === digest);
  if (records.length && Object.values(layer.currentGraph).filter(value => value === digest).length !== 1) throw Error("Ambiguous full v319 source fingerprint");
  return records.length ? inverse(source, records[0]) : source;
}
