import {expect,test} from "bun:test";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {NATIVE_HISTORY_PUBLISHED_V194,NATIVE_HISTORY_PREVIOUS_PROOF_V300,verifyNativeSourceLayerV303,nativeSourceAtPublishedV194V303,projectNativeSourceBeforeV303,type NativeSourceLayerV303}from"./helpers/sourceHistoryV303";
const sha=(s:string|Uint8Array)=>createHash("sha256").update(s).digest("hex");
function fixture(){
 const path="src/app/src/control.ts",newPath="src/app/src/data/new-control.json";
 const before="export const control = 1;\nexport const retained = true;\n",after="export const control = 1;\nexport const retained = true;\nexport const addedDefaultOff = false;\n",added='{"completeNewOwner":true}\n';
 const files:Record<string,string>={[path]:after,[newPath]:added};
 const layer:NativeSourceLayerV303={schemaVersion:1,publishedCommit:NATIVE_HISTORY_PUBLISHED_V194,previousProofSha256:NATIVE_HISTORY_PREVIOUS_PROOF_V300,captureToolSha256:sha("capture implementation control"),currentGraph:{[path]:sha(after),[newPath]:sha(added)},publishedGraph:{[path]:sha(before)},additions:[newPath],changes:{[path]:{beforeSha256:sha(before),currentSha256:sha(after),replacements:[{before:"export const retained = true;\n",current:"export const retained = true;\nexport const addedDefaultOff = false;\n"}]}}};
 return {path,newPath,before,after,files,layer,previous:{[path]:sha(before)},read:(p:string)=>Buffer.from(files[p])};
}
test("new complete source layer reaches published v194 without changing any immutable v300 pin",()=>{
 const f=fixture();verifyNativeSourceLayerV303(f.layer,f.previous,f.read);
 expect(Buffer.from(nativeSourceAtPublishedV194V303(f.path,Buffer.from(f.after),f.layer)).toString()).toBe(f.before);
 expect(projectNativeSourceBeforeV303(f.after,f.layer)).toBe(f.before);
 expect(projectNativeSourceBeforeV303(f.before,f.layer)).toBe(f.before);
 expect(sha(readFileSync(new URL("./fixtures/source-history-v300.json",import.meta.url)))).toBe(NATIVE_HISTORY_PREVIOUS_PROOF_V300);
});
test("all newly imported JSON and modules remain fully pinned, including default-off sources",()=>{
 const f=fixture();f.files[f.newPath]+=" ";expect(()=>verifyNativeSourceLayerV303(f.layer,f.previous,f.read)).toThrow("Changed complete v303 source graph");
 const missing=fixture();missing.layer.additions=[];expect(()=>verifyNativeSourceLayerV303(missing.layer,missing.previous,missing.read)).toThrow("Unaccounted new v303 production source");
 const old=fixture();old.layer.publishedGraph[old.path]=sha("rewritten Golden");expect(()=>verifyNativeSourceLayerV303(old.layer,old.previous,old.read)).toThrow("Changed immutable v300 graph pin");
});
test("an exact filename cannot substitute mutated bytes or an incomplete complement",()=>{
 const f=fixture();expect(()=>nativeSourceAtPublishedV194V303(f.path,Buffer.from(f.after+"// mutation\n"),f.layer)).toThrow("Unknown exact v303 source bytes");
 expect(()=>nativeSourceAtPublishedV194V303(f.newPath,Buffer.from(f.files[f.newPath]),f.layer)).toThrow("Unknown exact v303 source bytes");
 expect(projectNativeSourceBeforeV303(f.after+"// mutation\n",f.layer)).toBe(f.after+"// mutation\n");
 f.layer.changes[f.path].replacements[0].before="";expect(()=>verifyNativeSourceLayerV303(f.layer,f.previous,f.read)).toThrow("Changed full v303 source complement");
});
test("ambiguous hunks, missing exact inverses and another anchor are rejected",()=>{
 const ambiguous=fixture();ambiguous.layer.changes[ambiguous.path].replacements[0].current="e";expect(()=>verifyNativeSourceLayerV303(ambiguous.layer,ambiguous.previous,ambiguous.read)).toThrow("Ambiguous exact v303 source inverse");
 const missing=fixture();delete missing.layer.changes[missing.path];expect(()=>verifyNativeSourceLayerV303(missing.layer,missing.previous,missing.read)).toThrow("Missing or extra v303 source inverse");
 const foreign=fixture();foreign.layer.publishedCommit="unknown";expect(()=>verifyNativeSourceLayerV303(foreign.layer,foreign.previous,foreign.read)).toThrow("Unknown immutable v303 source anchors");
});

test("cached real layer still rejects changed immutable graph arguments and freezes exact cached controls",async()=>{
 const {assertNativeHistorySourcesV303}=await import("./helpers/sourceHistoryV303");
 const previous=JSON.parse(readFileSync(new URL("./fixtures/source-history-v300.json",import.meta.url),"utf8"));
 const layer=assertNativeHistorySourcesV303(previous.currentGraph);
 expect(Object.isFrozen(previous.currentGraph)).toBeTrue();expect(Object.isFrozen(layer)).toBeTrue();expect(Object.isFrozen(layer.currentGraph)).toBeTrue();
 expect(assertNativeHistorySourcesV303(previous.currentGraph)).toBe(layer);
 const changed={...previous.currentGraph};changed[Object.keys(changed)[0]]="0".repeat(64);
 expect(()=>assertNativeHistorySourcesV303(changed)).toThrow("Changed immutable v300 graph pins");
 expect(()=>assertNativeHistorySourcesV303({...previous.currentGraph,"src/app/src/unknown-golden.ts":"0".repeat(64)})).toThrow("Changed immutable v300 graph pins");
 expect(()=>assertNativeHistorySourcesV303({})).toThrow("Changed immutable v300 graph pins");
});
