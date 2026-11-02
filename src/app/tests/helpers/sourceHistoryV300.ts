/** Test-only strict current → published v193 source layer, before frozen v299. */
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
export const NATIVE_HISTORY_PUBLISHED_V193="ac0e16fb2f0ed8fdb63e62d52e7d00c4340d8a37";
export const NATIVE_HISTORY_PREVIOUS_PROOF_V299="d31c70dc72db806999785e02991eb468ee7ee5404333b488ecabe98eaf7d8b4e";
export type NativeSourceInverseV300={beforeSha256:string;currentSha256:string;replacements:{before:string;current:string}[]};
export type NativeSourceLayerV300={schemaVersion:number;publishedCommit:string;previousProofSha256:string;captureToolSha256:string;currentGraph:Record<string,string>;publishedGraph:Record<string,string>;additions:string[];changes:Record<string,NativeSourceInverseV300>};
const sha=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex");
const pathValid=(path:string)=>/^src\/app\/(?:src|public)\/[\w./-]+\.(?:ts|tsx|json)$/.test(path)&&!path.split("/").includes("..");
const digestValid=(digest:unknown)=>typeof digest==="string"&&/^[a-f0-9]{64}$/.test(digest);

export function invertNativeSourceV300(source:string,receipt:NativeSourceInverseV300):string{
  if(sha(source)!==receipt.currentSha256)throw Error("Changed exact v300 source inverse input");
  for(const replacement of receipt.replacements){
    if(!replacement.current||source.split(replacement.current).length!==2)throw Error("Ambiguous exact v300 source inverse");
    source=source.replace(replacement.current,replacement.before);
  }
  if(sha(source)!==receipt.beforeSha256)throw Error("Changed full v300 source complement");
  return source;
}

/** Whole additional graph, including each newly imported module/JSON. Every
 * finite inverse must recover its independently captured published full file. */
export function verifyNativeSourceLayerV300(layer:NativeSourceLayerV300,previousGraph:Record<string,string>,read:(path:string)=>Uint8Array):void{
  if(layer.schemaVersion!==1||layer.publishedCommit!==NATIVE_HISTORY_PUBLISHED_V193||layer.previousProofSha256!==NATIVE_HISTORY_PREVIOUS_PROOF_V299||!digestValid(layer.captureToolSha256))throw Error("Unknown immutable v300 source anchors");
  const current=Object.keys(layer.currentGraph),published=Object.keys(layer.publishedGraph),added=new Set(layer.additions);
  if(!current.length||current.length>10000||added.size!==layer.additions.length||current.some(p=>!pathValid(p)||!digestValid(layer.currentGraph[p]))||published.some(p=>!pathValid(p)||!digestValid(layer.publishedGraph[p])||!Object.hasOwn(layer.currentGraph,p))||[...added].some(p=>!Object.hasOwn(layer.currentGraph,p)||Object.hasOwn(layer.publishedGraph,p)))throw Error("Invalid finite v300 source graph");
  if(current.some(p=>!Object.hasOwn(layer.publishedGraph,p)&&!added.has(p)))throw Error("Unaccounted new v300 production source");
  for(const[path,digest]of Object.entries(previousGraph))if(layer.publishedGraph[path]!==digest)throw Error(`Changed immutable v299 graph pin: ${path}`);
  for(const[path,receipt]of Object.entries(layer.changes)){
    if(!Object.hasOwn(layer.currentGraph,path)||!Object.hasOwn(layer.publishedGraph,path)||receipt.currentSha256!==layer.currentGraph[path]||receipt.beforeSha256!==layer.publishedGraph[path]||receipt.beforeSha256===receipt.currentSha256||!receipt.replacements.length)throw Error(`Invalid bounded v300 inverse: ${path}`);
  }
  for(const path of current){
    const raw=read(path);if(sha(raw)!==layer.currentGraph[path])throw Error(`Changed complete v300 source graph: ${path}`);
    const before=layer.publishedGraph[path];if(!before)continue;
    const changed=before!==layer.currentGraph[path],receipt=layer.changes[path];
    if(changed!==!!receipt)throw Error(`Missing or extra v300 source inverse: ${path}`);
    if(receipt)invertNativeSourceV300(Buffer.from(raw).toString("utf8"),receipt);
  }
}

let checked:NativeSourceLayerV300|undefined;
/** The old fixture is immutable. This extra receipt is captured only after a
 * product freeze and can never re-sign that fixture's original currentGraph. */
export function assertNativeHistorySourcesV300(previousGraph:Record<string,string>):NativeSourceLayerV300{
  if(checked)return checked;
  const previous=readFileSync(new URL("../fixtures/native-history-v299-replay.json",import.meta.url));
  if(sha(previous)!==NATIVE_HISTORY_PREVIOUS_PROOF_V299)throw Error("Changed immutable v299 history fixture");
  const immutableGraph=JSON.parse(previous.toString("utf8")).currentGraph as Record<string,string>;
  if(Object.keys(previousGraph).length!==Object.keys(immutableGraph).length||Object.entries(immutableGraph).some(([path,digest])=>previousGraph[path]!==digest))throw Error("Changed immutable v299 graph pins");
  const layer=JSON.parse(readFileSync(new URL("../fixtures/source-history-v300.json",import.meta.url),"utf8"))as NativeSourceLayerV300;
  if(sha(readFileSync(resolve(import.meta.dir,"../../../../scripts/build_native_history_v300_source.py")))!==layer.captureToolSha256)throw Error("Changed v300 source capture implementation");
  verifyNativeSourceLayerV300(layer,immutableGraph,path=>readFileSync(resolve(import.meta.dir,"../../../..",path)));
  checked=layer;return layer;
}

/** File projection verifies exact bytes, never substitutes by path alone. */
export function nativeSourceAtPublishedV193V300(path:string,raw:Uint8Array,layer:NativeSourceLayerV300):Uint8Array{
  if(!Object.hasOwn(layer.currentGraph,path)||sha(raw)!==layer.currentGraph[path]||!Object.hasOwn(layer.publishedGraph,path))throw Error(`Unknown exact v300 source bytes: ${path}`);
  const receipt=layer.changes[path];return receipt?Buffer.from(invertNativeSourceV300(Buffer.from(raw).toString("utf8"),receipt)):raw;
}

/** String-only historical callers are matched by a complete input fingerprint,
 * then the old v299 pools still prove the complete remaining lineage. */
export function projectNativeSourceBeforeV300(source:string,layer:NativeSourceLayerV300):string{
  const digest=sha(source),records=Object.values(layer.changes).filter(r=>r.currentSha256===digest);
  if(!records.length)return source;
  if(records.some(r=>JSON.stringify(r)!==JSON.stringify(records[0])))throw Error("Ambiguous full v300 source fingerprint");
  return invertNativeSourceV300(source,records[0]);
}
