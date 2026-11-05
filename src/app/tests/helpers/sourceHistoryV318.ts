/** Test-only current -> immutable published v197 layer, before frozen v311. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const SOURCE_HISTORY_PUBLISHED_V197_V318 = "f287881b27828ff914abbb050c2aa47328099af9";
export const SOURCE_HISTORY_BRIDGE_V311_SHA_V318 = "b622ff4a4e972fb658a88add88155e6c6d5f8bcd267bb8c076e8c232601bddc5";
export const SOURCE_HISTORY_PROOF_V306_SHA_V318 = "4a2bad690d9465ab3e03f5915ba015b85c160b9a2de358c7eba1e08d5c1b719b";
export const SOURCE_HISTORY_CAPTURE_SHA_V318 = "245de955a4ef43b04972a202b1044a2b9a2fc54527a47c69bf3e30f3c0d7ee97";

export type SourceInverseV318 = {
  beforeSha256: string; currentSha256: string;
  replacements: { before: string; current: string }[];
};
export type SourceLayerV318 = {
  schemaVersion: number; publishedCommit: string;
  previousBridgeSha256: string; previousProofSha256: string; captureToolSha256: string;
  currentGraph: Record<string, string>; publishedGraph: Record<string, string>;
  additions: Record<string, string>; changes: Record<string, SourceInverseV318>;
};
const sha = (raw: string | Uint8Array) => createHash("sha256").update(raw).digest("hex");
const digestValid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const pathValid = (path: string) => /^src\/app\/(?:src|public)\/[\w./-]+\.(?:ts|tsx|json)$/.test(path) && !path.split("/").includes("..");
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const admitted = new WeakSet<object>();

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

function graphValid(graph: unknown): graph is Record<string, string> {
  return record(graph) && Object.keys(graph).length <= 10000 && Object.entries(graph).every(([path, digest]) => pathValid(path) && digestValid(digest));
}
function keys(value: object, expected: readonly string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}

function inverse(source: string, receipt: SourceInverseV318): string {
  if (sha(source) !== receipt.currentSha256) throw Error("Changed exact v318 inverse input");
  for (const replacement of receipt.replacements) {
    if (!replacement.current || source.split(replacement.current).length !== 2) throw Error("Ambiguous exact v318 source inverse");
    source = source.replace(replacement.current, replacement.before);
  }
  if (sha(source) !== receipt.beforeSha256) throw Error("Changed full v318 source complement");
  return source;
}

/** Reconstruct the entire published197 checkpoint without changing either
 * original receipt. Both input buffers must equal their independent old pins. */
export function published197SourceGraphV318(proofRaw: Uint8Array, bridgeRaw: Uint8Array): Readonly<Record<string, string>> {
  if (sha(proofRaw) !== SOURCE_HISTORY_PROOF_V306_SHA_V318 || sha(bridgeRaw) !== SOURCE_HISTORY_BRIDGE_V311_SHA_V318)
    throw Error("Changed immutable v306/v311 source proof");
  const proof = JSON.parse(Buffer.from(proofRaw).toString("utf8"));
  const bridge = JSON.parse(Buffer.from(bridgeRaw).toString("utf8"));
  if (bridge.publishedCommit !== "a7625d82136b1cb8ea0fde23521a4963c67d67f0" || bridge.publishedProofSha256 !== SOURCE_HISTORY_PROOF_V306_SHA_V318
      || !graphValid(proof.currentGraph) || !record(bridge.changes) || !graphValid(bridge.additions))
    throw Error("Unknown immutable v197 source checkpoint");
  const graph: Record<string, string> = { ...proof.currentGraph };
  for (const [path, value] of Object.entries(bridge.changes)) {
    const receipt = value as SourceInverseV318;
    if (!Object.hasOwn(graph, path) || graph[path] !== receipt.beforeSha256 || !digestValid(receipt.currentSha256))
      throw Error("Changed original v311 bridge relation");
    graph[path] = receipt.currentSha256;
  }
  for (const [path, digest] of Object.entries(bridge.additions)) {
    if (Object.hasOwn(graph, path)) throw Error("Duplicate original v311 addition");
    graph[path] = digest;
  }
  if (Object.keys(graph).length !== 1923) throw Error("Incomplete immutable v197 source checkpoint");
  return freeze(graph);
}

/** A complete inventory is mandatory, including old public graph members and
 * every new production module/JSON. Filename-only or partial projection fails. */
export function verifySourceLayerV318(
  layer: SourceLayerV318, published: Readonly<Record<string, string>>,
  inventory: readonly string[], read: (path: string) => Uint8Array,
): SourceLayerV318 {
  if (!record(layer) || !keys(layer, ["schemaVersion", "publishedCommit", "previousBridgeSha256", "previousProofSha256", "captureToolSha256", "currentGraph", "publishedGraph", "additions", "changes"])
      || layer.schemaVersion !== 1 || layer.publishedCommit !== SOURCE_HISTORY_PUBLISHED_V197_V318
      || layer.previousBridgeSha256 !== SOURCE_HISTORY_BRIDGE_V311_SHA_V318 || layer.previousProofSha256 !== SOURCE_HISTORY_PROOF_V306_SHA_V318
      || layer.captureToolSha256 !== SOURCE_HISTORY_CAPTURE_SHA_V318) throw Error("Unknown immutable v318 source anchors");
  if (!graphValid(layer.currentGraph) || !graphValid(layer.publishedGraph) || !graphValid(layer.additions) || !record(layer.changes)
      || !graphValid(published)) throw Error("Invalid finite v318 source graph");
  const paths = Object.keys(layer.currentGraph), previous = Object.keys(layer.publishedGraph);
  if (!paths.length || new Set(inventory).size !== inventory.length || inventory.length !== paths.length
      || inventory.some(path => !pathValid(path) || !Object.hasOwn(layer.currentGraph, path))) throw Error("Changed or unaccounted v318 source inventory");
  if (previous.length !== Object.keys(published).length || previous.some(path => layer.publishedGraph[path] !== published[path])
      || previous.some(path => !Object.hasOwn(layer.currentGraph, path))) throw Error("Changed immutable v197 graph pins");
  const added = paths.filter(path => !Object.hasOwn(published, path));
  if (added.length !== Object.keys(layer.additions).length || added.some(path => layer.additions[path] !== layer.currentGraph[path])
      || Object.keys(layer.additions).some(path => Object.hasOwn(published, path))) throw Error("Unaccounted new v318 production source");
  for (const [path, value] of Object.entries(layer.changes)) {
    const receipt = value as SourceInverseV318;
    if (!record(receipt) || !keys(receipt, ["beforeSha256", "currentSha256", "replacements"]) || !Object.hasOwn(published, path) || !Object.hasOwn(layer.currentGraph, path)
        || receipt.beforeSha256 !== published[path] || receipt.currentSha256 !== layer.currentGraph[path]
        || receipt.beforeSha256 === receipt.currentSha256 || !Array.isArray(receipt.replacements) || !receipt.replacements.length
        || receipt.replacements.some(r => !record(r) || !keys(r, ["before", "current"]) || typeof r.before !== "string" || typeof r.current !== "string" || !r.current))
      throw Error(`Invalid bounded v318 source inverse: ${path}`);
  }
  for (const path of paths) {
    const raw = read(path);
    if (sha(raw) !== layer.currentGraph[path]) throw Error(`Changed complete v318 source graph: ${path}`);
    if (!Object.hasOwn(published, path)) continue;
    const receipt = layer.changes[path];
    if ((published[path] !== layer.currentGraph[path]) !== !!receipt) throw Error(`Missing or extra v318 source inverse: ${path}`);
    if (receipt) inverse(Buffer.from(raw).toString("utf8"), receipt);
  }
  freeze(layer); admitted.add(layer);
  return layer;
}

let checked: SourceLayerV318 | undefined;
const repoRoot = resolve(import.meta.dir, "../../../..");

export function assertSourceLayerV318(): SourceLayerV318 {
  if (checked) return checked;
  const graph = published197SourceGraphV318(
    readFileSync(new URL("../fixtures/source-history-v306.json", import.meta.url)),
    readFileSync(new URL("../fixtures/source-history-v311.json", import.meta.url)),
  );
  const layer = JSON.parse(readFileSync(new URL("../fixtures/source-history-v318.json", import.meta.url), "utf8")) as SourceLayerV318;
  const currentPaths = readdirSync(resolve(repoRoot, "src/app/src"), { recursive: true })
    .map(path => `src/app/src/${path}`)
    .filter(path => /\.(?:ts|tsx|json)$/.test(path) && statSync(resolve(repoRoot, path)).isFile());
  const inventory = [...new Set([...Object.keys(graph), ...currentPaths])];
  checked = verifySourceLayerV318(layer, graph, inventory, path => readFileSync(resolve(repoRoot, path)));
  return checked;
}

export function sourceAtPublished197V318(path: string, raw: Uint8Array, layer = assertSourceLayerV318()): Uint8Array {
  if (!admitted.has(layer) || !Object.hasOwn(layer.currentGraph, path) || sha(raw) !== layer.currentGraph[path]
      || !Object.hasOwn(layer.publishedGraph, path)) throw Error(`Unknown exact v318 source bytes: ${path}`);
  const receipt = layer.changes[path];
  return receipt ? Buffer.from(inverse(Buffer.from(raw).toString("utf8"), receipt)) : raw;
}

/** Unmatched strings stay unmatched for the original downstream source guards.
 * A matched string must have one unambiguous full-file inverse. */
export function projectSourceBeforeV318(source: string, layer = assertSourceLayerV318()): string {
  if (!admitted.has(layer)) throw Error("Unverified v318 source layer");
  const digest = sha(source), records = Object.values(layer.changes).filter(r => r.currentSha256 === digest);
  if (records.length && Object.values(layer.currentGraph).filter(value => value === digest).length !== 1) throw Error("Ambiguous full v318 source fingerprint");
  return records.length ? inverse(source, records[0]) : source;
}
