import {expect,test} from "bun:test";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {NATIVE_HISTORY_PUBLISHED_V193,NATIVE_HISTORY_PREVIOUS_PROOF_V299,verifyNativeSourceLayerV300,nativeSourceAtPublishedV193V300,projectNativeSourceBeforeV300,type NativeSourceLayerV300}from"./helpers/sourceHistoryV300";
const sha=(s:string|Uint8Array)=>createHash("sha256").update(s).digest("hex");
function fixture(){
 const path="src/app/src/control.ts",newPath="src/app/src/data/new-control.json";
 const before="export const control = 1;\nexport const retained = true;\n",after="export const control = 1;\nexport const retained = true;\nexport const addedDefaultOff = false;\n",added='{"completeNewOwner":true}\n';
 const files:Record<string,string>={[path]:after,[newPath]:added};
 const layer:NativeSourceLayerV300={schemaVersion:1,publishedCommit:NATIVE_HISTORY_PUBLISHED_V193,previousProofSha256:NATIVE_HISTORY_PREVIOUS_PROOF_V299,captureToolSha256:sha("capture implementation control"),currentGraph:{[path]:sha(after),[newPath]:sha(added)},publishedGraph:{[path]:sha(before)},additions:[newPath],changes:{[path]:{beforeSha256:sha(before),currentSha256:sha(after),replacements:[{before:"export const retained = true;\n",current:"export const retained = true;\nexport const addedDefaultOff = false;\n"}]}}};
 return {path,newPath,before,after,files,layer,previous:{[path]:sha(before)},read:(p:string)=>Buffer.from(files[p])};
}
test("new complete source layer reaches published v193 without changing any immutable v299 pin",()=>{
 const f=fixture();verifyNativeSourceLayerV300(f.layer,f.previous,f.read);
 expect(Buffer.from(nativeSourceAtPublishedV193V300(f.path,Buffer.from(f.after),f.layer)).toString()).toBe(f.before);
 expect(projectNativeSourceBeforeV300(f.after,f.layer)).toBe(f.before);
 expect(projectNativeSourceBeforeV300(f.before,f.layer)).toBe(f.before);
 expect(sha(readFileSync(new URL("./fixtures/native-history-v299-replay.json",import.meta.url)))).toBe(NATIVE_HISTORY_PREVIOUS_PROOF_V299);
});
test("all newly imported JSON and modules remain fully pinned, including default-off sources",()=>{
 const f=fixture();f.files[f.newPath]+=" ";expect(()=>verifyNativeSourceLayerV300(f.layer,f.previous,f.read)).toThrow("Changed complete v300 source graph");
 const missing=fixture();missing.layer.additions=[];expect(()=>verifyNativeSourceLayerV300(missing.layer,missing.previous,missing.read)).toThrow("Unaccounted new v300 production source");
 const old=fixture();old.layer.publishedGraph[old.path]=sha("rewritten Golden");expect(()=>verifyNativeSourceLayerV300(old.layer,old.previous,old.read)).toThrow("Changed immutable v299 graph pin");
});
test("an exact filename cannot substitute mutated bytes or an incomplete complement",()=>{
 const f=fixture();expect(()=>nativeSourceAtPublishedV193V300(f.path,Buffer.from(f.after+"// mutation\n"),f.layer)).toThrow("Unknown exact v300 source bytes");
 expect(()=>nativeSourceAtPublishedV193V300(f.newPath,Buffer.from(f.files[f.newPath]),f.layer)).toThrow("Unknown exact v300 source bytes");
 expect(projectNativeSourceBeforeV300(f.after+"// mutation\n",f.layer)).toBe(f.after+"// mutation\n");
 f.layer.changes[f.path].replacements[0].before="";expect(()=>verifyNativeSourceLayerV300(f.layer,f.previous,f.read)).toThrow("Changed full v300 source complement");
});
test("ambiguous hunks, missing exact inverses and another anchor are rejected",()=>{
 const ambiguous=fixture();ambiguous.layer.changes[ambiguous.path].replacements[0].current="e";expect(()=>verifyNativeSourceLayerV300(ambiguous.layer,ambiguous.previous,ambiguous.read)).toThrow("Ambiguous exact v300 source inverse");
 const missing=fixture();delete missing.layer.changes[missing.path];expect(()=>verifyNativeSourceLayerV300(missing.layer,missing.previous,missing.read)).toThrow("Missing or extra v300 source inverse");
 const foreign=fixture();foreign.layer.publishedCommit="unknown";expect(()=>verifyNativeSourceLayerV300(foreign.layer,foreign.previous,foreign.read)).toThrow("Unknown immutable v300 source anchors");
});
