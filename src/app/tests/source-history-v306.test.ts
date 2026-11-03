import {expect,test} from "bun:test";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {NATIVE_HISTORY_PUBLISHED_V195,NATIVE_HISTORY_PREVIOUS_PROOF_V303,verifyNativeSourceLayerV306,nativeSourceAtPublishedV195V306,projectNativeSourceBeforeV306,type NativeSourceLayerV306}from"./helpers/sourceHistoryV306";
const sha=(s:string|Uint8Array)=>createHash("sha256").update(s).digest("hex");
function fixture(){
 const path="src/app/src/control.ts",newPath="src/app/src/data/new-control.json";
 const before="export const control = 1;\nexport const retained = true;\n",after="export const control = 1;\nexport const retained = true;\nexport const addedDefaultOff = false;\n",added='{"completeNewOwner":true}\n';
 const files:Record<string,string>={[path]:after,[newPath]:added};
 const layer:NativeSourceLayerV306={schemaVersion:1,publishedCommit:NATIVE_HISTORY_PUBLISHED_V195,previousProofSha256:NATIVE_HISTORY_PREVIOUS_PROOF_V303,captureToolSha256:sha("capture implementation control"),currentGraph:{[path]:sha(after),[newPath]:sha(added)},publishedGraph:{[path]:sha(before)},additions:[newPath],changes:{[path]:{beforeSha256:sha(before),currentSha256:sha(after),replacements:[{before:"export const retained = true;\n",current:"export const retained = true;\nexport const addedDefaultOff = false;\n"}]}}};
 return {path,newPath,before,after,files,layer,previous:{[path]:sha(before)},read:(p:string)=>Buffer.from(files[p])};
}
test("new complete source layer reaches published v195 without changing any immutable v303 pin",()=>{
 const f=fixture();verifyNativeSourceLayerV306(f.layer,f.previous,f.read);
 expect(Buffer.from(nativeSourceAtPublishedV195V306(f.path,Buffer.from(f.after),f.layer)).toString()).toBe(f.before);
 expect(projectNativeSourceBeforeV306(f.after,f.layer)).toBe(f.before);
 expect(projectNativeSourceBeforeV306(f.before,f.layer)).toBe(f.before);
 expect(sha(readFileSync(new URL("./fixtures/source-history-v303.json",import.meta.url)))).toBe(NATIVE_HISTORY_PREVIOUS_PROOF_V303);
});
test("all newly imported JSON and modules remain fully pinned, including default-off sources",()=>{
 const f=fixture();f.files[f.newPath]+=" ";expect(()=>verifyNativeSourceLayerV306(f.layer,f.previous,f.read)).toThrow("Changed complete v306 source graph");
 const missing=fixture();missing.layer.additions=[];expect(()=>verifyNativeSourceLayerV306(missing.layer,missing.previous,missing.read)).toThrow("Unaccounted new v306 production source");
 const old=fixture();old.layer.publishedGraph[old.path]=sha("rewritten Golden");expect(()=>verifyNativeSourceLayerV306(old.layer,old.previous,old.read)).toThrow("Changed immutable v303 graph pin");
});
test("an exact filename cannot substitute mutated bytes or an incomplete complement",()=>{
 const f=fixture();expect(()=>nativeSourceAtPublishedV195V306(f.path,Buffer.from(f.after+"// mutation\n"),f.layer)).toThrow("Unknown exact v306 source bytes");
 expect(()=>nativeSourceAtPublishedV195V306(f.newPath,Buffer.from(f.files[f.newPath]),f.layer)).toThrow("Unknown exact v306 source bytes");
 expect(projectNativeSourceBeforeV306(f.after+"// mutation\n",f.layer)).toBe(f.after+"// mutation\n");
 f.layer.changes[f.path].replacements[0].before="";expect(()=>verifyNativeSourceLayerV306(f.layer,f.previous,f.read)).toThrow("Changed full v306 source complement");
});
test("ambiguous hunks, missing exact inverses and another anchor are rejected",()=>{
 const ambiguous=fixture();ambiguous.layer.changes[ambiguous.path].replacements[0].current="e";expect(()=>verifyNativeSourceLayerV306(ambiguous.layer,ambiguous.previous,ambiguous.read)).toThrow("Ambiguous exact v306 source inverse");
 const missing=fixture();delete missing.layer.changes[missing.path];expect(()=>verifyNativeSourceLayerV306(missing.layer,missing.previous,missing.read)).toThrow("Missing or extra v306 source inverse");
 const foreign=fixture();foreign.layer.publishedCommit="unknown";expect(()=>verifyNativeSourceLayerV306(foreign.layer,foreign.previous,foreign.read)).toThrow("Unknown immutable v306 source anchors");
});

test("cached real layer still rejects changed immutable graph arguments and freezes exact cached controls",async()=>{
 const {assertNativeHistorySourcesV306}=await import("./helpers/sourceHistoryV306");
 const previous=JSON.parse(readFileSync(new URL("./fixtures/source-history-v303.json",import.meta.url),"utf8"));
 const layer=assertNativeHistorySourcesV306(previous.currentGraph);
 expect(Object.isFrozen(previous.currentGraph)).toBeTrue();expect(Object.isFrozen(layer)).toBeTrue();expect(Object.isFrozen(layer.currentGraph)).toBeTrue();
 expect(assertNativeHistorySourcesV306(previous.currentGraph)).toBe(layer);
 const changed={...previous.currentGraph};changed[Object.keys(changed)[0]]="0".repeat(64);
 expect(()=>assertNativeHistorySourcesV306(changed)).toThrow("Changed immutable v303 graph pins");
 expect(()=>assertNativeHistorySourcesV306({...previous.currentGraph,"src/app/src/unknown-golden.ts":"0".repeat(64)})).toThrow("Changed immutable v303 graph pins");
 expect(()=>assertNativeHistorySourcesV306({})).toThrow("Changed immutable v303 graph pins");
});
