/** Test-only strict current → published v194 source layer, before frozen v300. */
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
export const NATIVE_HISTORY_PUBLISHED_V194="8ab885c894768234d2198b56366fc1ba638c6f84";
export const NATIVE_HISTORY_PREVIOUS_PROOF_V300="a8cf059389bff3dd94a788d9cc8d4d82ec8ce4c4253abcbb150f53d929d8b6d7";
export type NativeSourceInverseV303={beforeSha256:string;currentSha256:string;replacements:{before:string;current:string}[]};
export type NativeSourceLayerV303={schemaVersion:number;publishedCommit:string;previousProofSha256:string;captureToolSha256:string;currentGraph:Record<string,string>;publishedGraph:Record<string,string>;additions:string[];changes:Record<string,NativeSourceInverseV303>};
const sha=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex");
const pathValid=(path:string)=>/^src\/app\/(?:src|public)\/[\w./-]+\.(?:ts|tsx|json)$/.test(path)&&!path.split("/").includes("..");
const digestValid=(digest:unknown)=>typeof digest==="string"&&/^[a-f0-9]{64}$/.test(digest);

export function invertNativeSourceV303(source:string,receipt:NativeSourceInverseV303):string{
  if(sha(source)!==receipt.currentSha256)throw Error("Changed exact v303 source inverse input");
  for(const replacement of receipt.replacements){
    if(!replacement.current||source.split(replacement.current).length!==2)throw Error("Ambiguous exact v303 source inverse");
    source=source.replace(replacement.current,replacement.before);
  }
  if(sha(source)!==receipt.beforeSha256)throw Error("Changed full v303 source complement");
  return source;
}

/** Whole additional graph, including each newly imported module/JSON. Every
 * finite inverse must recover its independently captured published full file. */
export function verifyNativeSourceLayerV303(layer:NativeSourceLayerV303,previousGraph:Record<string,string>,read:(path:string)=>Uint8Array):void{
  if(layer.schemaVersion!==1||layer.publishedCommit!==NATIVE_HISTORY_PUBLISHED_V194||layer.previousProofSha256!==NATIVE_HISTORY_PREVIOUS_PROOF_V300||!digestValid(layer.captureToolSha256))throw Error("Unknown immutable v303 source anchors");
  const current=Object.keys(layer.currentGraph),published=Object.keys(layer.publishedGraph),added=new Set(layer.additions);
  if(!current.length||current.length>10000||added.size!==layer.additions.length||current.some(p=>!pathValid(p)||!digestValid(layer.currentGraph[p]))||published.some(p=>!pathValid(p)||!digestValid(layer.publishedGraph[p])||!Object.hasOwn(layer.currentGraph,p))||[...added].some(p=>!Object.hasOwn(layer.currentGraph,p)||Object.hasOwn(layer.publishedGraph,p)))throw Error("Invalid finite v303 source graph");
  if(current.some(p=>!Object.hasOwn(layer.publishedGraph,p)&&!added.has(p)))throw Error("Unaccounted new v303 production source");
  for(const[path,digest]of Object.entries(previousGraph))if(layer.publishedGraph[path]!==digest)throw Error(`Changed immutable v300 graph pin: ${path}`);
  for(const[path,receipt]of Object.entries(layer.changes)){
    if(!Object.hasOwn(layer.currentGraph,path)||!Object.hasOwn(layer.publishedGraph,path)||receipt.currentSha256!==layer.currentGraph[path]||receipt.beforeSha256!==layer.publishedGraph[path]||receipt.beforeSha256===receipt.currentSha256||!receipt.replacements.length)throw Error(`Invalid bounded v303 inverse: ${path}`);
  }
  for(const path of current){
    const raw=read(path);if(sha(raw)!==layer.currentGraph[path])throw Error(`Changed complete v303 source graph: ${path}`);
    const before=layer.publishedGraph[path];if(!before)continue;
    const changed=before!==layer.currentGraph[path],receipt=layer.changes[path];
    if(changed!==!!receipt)throw Error(`Missing or extra v303 source inverse: ${path}`);
    if(receipt)invertNativeSourceV303(Buffer.from(raw).toString("utf8"),receipt);
  }
}

let checked:NativeSourceLayerV303|undefined;
let immutablePreviousGraphV303:Record<string,string>|undefined;
const admittedPreviousGraphsV303=new WeakSet<object>();
function matchImmutablePreviousGraphV303(supplied:Record<string,string>,expected:Record<string,string>):void{
  // A cached exact input is frozen before admission, so another call cannot
  // mutate old pins after acquiring the cheap identity fast path.
  if(admittedPreviousGraphsV303.has(supplied)&&Object.isFrozen(supplied))return;
  if(Object.keys(supplied).length!==Object.keys(expected).length||Object.entries(expected).some(([path,digest])=>supplied[path]!==digest))throw Error("Changed immutable v300 graph pins");
  Object.freeze(supplied);admittedPreviousGraphsV303.add(supplied);
}
function freezeSourceLayerV303<T>(value:T):T{
  if(value&&typeof value==="object"&&!Object.isFrozen(value)){for(const child of Object.values(value))freezeSourceLayerV303(child);Object.freeze(value);}return value;
}

/** The old fixture is immutable. This extra receipt is captured only after a
 * product freeze and can never re-sign that fixture's original currentGraph. */
export function assertNativeHistorySourcesV303(previousGraph:Record<string,string>):NativeSourceLayerV303{
  if(checked){matchImmutablePreviousGraphV303(previousGraph,immutablePreviousGraphV303!);return checked;}
  const previous=readFileSync(new URL("../fixtures/source-history-v300.json",import.meta.url));
  if(sha(previous)!==NATIVE_HISTORY_PREVIOUS_PROOF_V300)throw Error("Changed immutable v300 history fixture");
  const immutableGraph=JSON.parse(previous.toString("utf8")).currentGraph as Record<string,string>;
  matchImmutablePreviousGraphV303(previousGraph,immutableGraph);
  const layer=JSON.parse(readFileSync(new URL("../fixtures/source-history-v303.json",import.meta.url),"utf8"))as NativeSourceLayerV303;
  if(sha(readFileSync(resolve(import.meta.dir,"../../../../scripts/build_native_history_v303_source.py")))!==layer.captureToolSha256)throw Error("Changed v303 source capture implementation");
  verifyNativeSourceLayerV303(layer,immutableGraph,path=>readFileSync(resolve(import.meta.dir,"../../../..",path)));
  immutablePreviousGraphV303=Object.freeze(immutableGraph);
  checked=freezeSourceLayerV303(layer);return checked;
}

/** File projection verifies exact bytes, never substitutes by path alone. */
export function nativeSourceAtPublishedV194V303(path:string,raw:Uint8Array,layer:NativeSourceLayerV303):Uint8Array{
  if(!Object.hasOwn(layer.currentGraph,path)||sha(raw)!==layer.currentGraph[path]||!Object.hasOwn(layer.publishedGraph,path))throw Error(`Unknown exact v303 source bytes: ${path}`);
  const receipt=layer.changes[path];return receipt?Buffer.from(invertNativeSourceV303(Buffer.from(raw).toString("utf8"),receipt)):raw;
}

/** String-only historical callers are matched by a complete input fingerprint,
 * then the old v300 pools still prove the complete remaining lineage. */
export function projectNativeSourceBeforeV303(source:string,layer:NativeSourceLayerV303):string{
  const digest=sha(source),records=Object.values(layer.changes).filter(r=>r.currentSha256===digest);
  if(!records.length)return source;
  if(records.some(r=>JSON.stringify(r)!==JSON.stringify(records[0])))throw Error("Ambiguous full v303 source fingerprint");
  return invertNativeSourceV303(source,records[0]);
}
