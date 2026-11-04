/** Test-only strict current → published v195 source layer, before frozen v303. */
import {createHash} from "node:crypto";
import {readFileSync, readdirSync} from "node:fs";
import {resolve} from "node:path";
export const NATIVE_HISTORY_PUBLISHED_V195="9727870f79db9c6a6e9d6437668e5ac13229522f";
export const NATIVE_HISTORY_PREVIOUS_PROOF_V303="299981a770ce72ec05d507ab60b5e88a3c3da49cc068a9f3a0f831d0526cadb0";
export type NativeSourceInverseV306={beforeSha256:string;currentSha256:string;replacements:{before:string;current:string}[]};
export type NativeSourceLayerV306={schemaVersion:number;publishedCommit:string;previousProofSha256:string;captureToolSha256:string;currentGraph:Record<string,string>;publishedGraph:Record<string,string>;additions:string[];changes:Record<string,NativeSourceInverseV306>};
const sha=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex");
const pathValid=(path:string)=>/^src\/app\/(?:src|public)\/[\w./-]+\.(?:ts|tsx|json)$/.test(path)&&!path.split("/").includes("..");
const digestValid=(digest:unknown)=>typeof digest==="string"&&/^[a-f0-9]{64}$/.test(digest);

export function invertNativeSourceV306(source:string,receipt:NativeSourceInverseV306):string{
  if(sha(source)!==receipt.currentSha256)throw Error("Changed exact v306 source inverse input");
  for(const replacement of receipt.replacements){
    if(!replacement.current||source.split(replacement.current).length!==2)throw Error("Ambiguous exact v306 source inverse");
    source=source.replace(replacement.current,replacement.before);
  }
  if(sha(source)!==receipt.beforeSha256)throw Error("Changed full v306 source complement");
  return source;
}

/** Whole additional graph, including each newly imported module/JSON. Every
 * finite inverse must recover its independently captured published full file. */
export function verifyNativeSourceLayerV306(layer:NativeSourceLayerV306,previousGraph:Record<string,string>,read:(path:string)=>Uint8Array):void{
  if(layer.schemaVersion!==1||layer.publishedCommit!==NATIVE_HISTORY_PUBLISHED_V195||layer.previousProofSha256!==NATIVE_HISTORY_PREVIOUS_PROOF_V303||!digestValid(layer.captureToolSha256))throw Error("Unknown immutable v306 source anchors");
  const current=Object.keys(layer.currentGraph),published=Object.keys(layer.publishedGraph),added=new Set(layer.additions);
  if(!current.length||current.length>10000||added.size!==layer.additions.length||current.some(p=>!pathValid(p)||!digestValid(layer.currentGraph[p]))||published.some(p=>!pathValid(p)||!digestValid(layer.publishedGraph[p])||!Object.hasOwn(layer.currentGraph,p))||[...added].some(p=>!Object.hasOwn(layer.currentGraph,p)||Object.hasOwn(layer.publishedGraph,p)))throw Error("Invalid finite v306 source graph");
  if(current.some(p=>!Object.hasOwn(layer.publishedGraph,p)&&!added.has(p)))throw Error("Unaccounted new v306 production source");
  for(const[path,digest]of Object.entries(previousGraph))if(layer.publishedGraph[path]!==digest)throw Error(`Changed immutable v303 graph pin: ${path}`);
  for(const[path,receipt]of Object.entries(layer.changes)){
    if(!Object.hasOwn(layer.currentGraph,path)||!Object.hasOwn(layer.publishedGraph,path)||receipt.currentSha256!==layer.currentGraph[path]||receipt.beforeSha256!==layer.publishedGraph[path]||receipt.beforeSha256===receipt.currentSha256||!receipt.replacements.length)throw Error(`Invalid bounded v306 inverse: ${path}`);
  }
  for(const path of current){
    const raw=read(path);if(sha(raw)!==layer.currentGraph[path])throw Error(`Changed complete v306 source graph: ${path}`);
    const before=layer.publishedGraph[path];if(!before)continue;
    const changed=before!==layer.currentGraph[path],receipt=layer.changes[path];
    if(changed!==!!receipt)throw Error(`Missing or extra v306 source inverse: ${path}`);
    if(receipt)invertNativeSourceV306(Buffer.from(raw).toString("utf8"),receipt);
  }
}

let checked:NativeSourceLayerV306|undefined;
type PublishedV196Bridge = {
  publishedCommit: string;
  publishedProofSha256: string;
  changes: Record<string, NativeSourceInverseV306>;
  additions: Record<string, string>;
};
const repoRoot = resolve(import.meta.dir, "../../../..");
const publishedV196Proof = "4a2bad690d9465ab3e03f5915ba015b85c160b9a2de358c7eba1e08d5c1b719b";
let publishedV196Bridge: PublishedV196Bridge | undefined;

function readV196Bridge(graph: Record<string, string>): PublishedV196Bridge {
  const bridge = JSON.parse(readFileSync(new URL("../fixtures/source-history-v311.json", import.meta.url), "utf8")) as PublishedV196Bridge;
  if (bridge.publishedCommit !== "a7625d82136b1cb8ea0fde23521a4963c67d67f0" ||
      bridge.publishedProofSha256 !== publishedV196Proof) throw Error("Unknown v196 source anchor");
  for (const [path, receipt] of Object.entries(bridge.changes)) {
    if (!Object.hasOwn(graph, path) || receipt.beforeSha256 !== graph[path] ||
        !digestValid(receipt.currentSha256) || receipt.currentSha256 === receipt.beforeSha256 ||
        !receipt.replacements.length) throw Error(`Invalid v196 source bridge: ${path}`);
  }
  const newSources = readdirSync(resolve(repoRoot, "src/app/src"), { recursive: true })
    .map(path => `src/app/src/${path}`)
    .filter(path => pathValid(path) && !Object.hasOwn(graph, path));
  if (newSources.length !== Object.keys(bridge.additions).length || newSources.some(path =>
    !Object.hasOwn(bridge.additions, path) || sha(readFileSync(resolve(repoRoot, path))) !== bridge.additions[path]
  )) throw Error("Changed or unaccounted new source after v196");
  return bridge;
}

function sourceAtV196(path: string, raw: Uint8Array, bridge: PublishedV196Bridge): Uint8Array {
  const receipt = bridge.changes[path];
  return receipt ? Buffer.from(invertNativeSourceV306(Buffer.from(raw).toString("utf8"), receipt)) : raw;
}
let immutablePreviousGraphV306:Record<string,string>|undefined;
const admittedPreviousGraphsV306=new WeakSet<object>();
function matchImmutablePreviousGraphV306(supplied:Record<string,string>,expected:Record<string,string>):void{
  // A cached exact input is frozen before admission, so another call cannot
  // mutate old pins after acquiring the cheap identity fast path.
  if(admittedPreviousGraphsV306.has(supplied)&&Object.isFrozen(supplied))return;
  if(Object.keys(supplied).length!==Object.keys(expected).length||Object.entries(expected).some(([path,digest])=>supplied[path]!==digest))throw Error("Changed immutable v303 graph pins");
  Object.freeze(supplied);admittedPreviousGraphsV306.add(supplied);
}
function freezeSourceLayerV306<T>(value:T):T{
  if(value&&typeof value==="object"&&!Object.isFrozen(value)){for(const child of Object.values(value))freezeSourceLayerV306(child);Object.freeze(value);}return value;
}

/** The old fixture is immutable. This extra receipt is captured only after a
 * product freeze and can never re-sign that fixture's original currentGraph. */
export function assertNativeHistorySourcesV306(previousGraph:Record<string,string>):NativeSourceLayerV306{
  if(checked){matchImmutablePreviousGraphV306(previousGraph,immutablePreviousGraphV306!);return checked;}
  const previous=readFileSync(new URL("../fixtures/source-history-v303.json",import.meta.url));
  if(sha(previous)!==NATIVE_HISTORY_PREVIOUS_PROOF_V303)throw Error("Changed immutable v303 history fixture");
  const immutableGraph=JSON.parse(previous.toString("utf8")).currentGraph as Record<string,string>;
  matchImmutablePreviousGraphV306(previousGraph,immutableGraph);
  const publishedProof = readFileSync(new URL("../fixtures/source-history-v306.json", import.meta.url));
  if (sha(publishedProof) !== publishedV196Proof) throw Error("Changed immutable v306 source fixture");
  const layer = JSON.parse(publishedProof.toString("utf8")) as NativeSourceLayerV306;
  if(sha(readFileSync(resolve(import.meta.dir,"../../../../scripts/build_native_history_v306_source.py")))!==layer.captureToolSha256)throw Error("Changed v306 source capture implementation");
  const bridge = readV196Bridge(layer.currentGraph);
  verifyNativeSourceLayerV306(layer, immutableGraph, path => sourceAtV196(path, readFileSync(resolve(repoRoot, path)), bridge));
  publishedV196Bridge = freezeSourceLayerV306(bridge);
  immutablePreviousGraphV306=Object.freeze(immutableGraph);
  checked=freezeSourceLayerV306(layer);return checked;
}

/** File projection verifies exact bytes, never substitutes by path alone. */
export function nativeSourceAtPublishedV195V306(path:string,raw:Uint8Array,layer:NativeSourceLayerV306):Uint8Array{
  if (layer === checked && publishedV196Bridge) raw = sourceAtV196(path, raw, publishedV196Bridge);
  if(!Object.hasOwn(layer.currentGraph,path)||sha(raw)!==layer.currentGraph[path]||!Object.hasOwn(layer.publishedGraph,path))throw Error(`Unknown exact v306 source bytes: ${path}`);
  const receipt=layer.changes[path];return receipt?Buffer.from(invertNativeSourceV306(Buffer.from(raw).toString("utf8"),receipt)):raw;
}

/** String-only historical callers are matched by a complete input fingerprint,
 * then the old v303 pools still prove the complete remaining lineage. */
export function projectNativeSourceBeforeV306(source:string,layer:NativeSourceLayerV306):string{
  if (layer === checked && publishedV196Bridge) {
    const digest = sha(source);
    const records = Object.values(publishedV196Bridge.changes).filter(receipt => receipt.currentSha256 === digest);
    if (records.length > 1) throw Error("Ambiguous v196 source bridge fingerprint");
    if (records.length === 1) source = invertNativeSourceV306(source, records[0]);
  }
  const digest=sha(source),records=Object.values(layer.changes).filter(r=>r.currentSha256===digest);
  if(!records.length)return source;
  if(records.some(r=>JSON.stringify(r)!==JSON.stringify(records[0])))throw Error("Ambiguous full v306 source fingerprint");
  return invertNativeSourceV306(source,records[0]);
}
