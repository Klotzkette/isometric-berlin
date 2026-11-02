/** Exact test-only current → published v193 → published 0f → original v281 lineage. */
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import proof from "../fixtures/native-history-v299-replay.json";
import {assertNativeHistorySourcesV300,nativeSourceAtPublishedV193V300,projectNativeSourceBeforeV300} from "./sourceHistoryV300";

type Inverse={beforeSha256:string;currentSha256:string;replacements:{before:string;current:string}[]};
const hash=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex");
let checked=false;
export function assertNativeHistorySourcesV299():void{
  if(checked)return;
  if(proof.commits["0f"]!=="0f6174362de87d785f6e6f5b864d05e5efa973fc"||proof.commits.v281!=="4adfbf744f0c419851387fe874b7363acf449123")throw Error("Unknown immutable native history anchors");
  const layer=assertNativeHistorySourcesV300(proof.currentGraph);
  for(const[path,digest]of Object.entries(proof.currentGraph))if(hash(nativeSourceAtPublishedV193V300(path,readFileSync(resolve(import.meta.dir,"../../../..",path)),layer))!==digest)throw Error(`Changed complete native source graph: ${path}`);
  checked=true;
}
function invert(text:string,receipt:Inverse):string{
  if(hash(text)!==receipt.currentSha256)throw Error("Changed exact native source replay input");
  for(const r of receipt.replacements){if(!r.current||text.split(r.current).length!==2)throw Error("Ambiguous bounded native source inverse");text=text.replace(r.current,r.before);}
  if(hash(text)!==receipt.beforeSha256)throw Error("Changed complete native source complement");return text;
}
/** A historical target hash can only be reached through frozen finite hunks.
 * Unknown source bytes cannot be substituted by a matching filename. */
export function replayNativeSourceV299(source:string,targetSha256:string):string{
  assertNativeHistorySourcesV299();
  if(hash(source)===targetSha256)return source;
  let current=projectNativeSourceBeforeV300(source,assertNativeHistorySourcesV300(proof.currentGraph));
  if(hash(current)===targetSha256)return current;
  const pools=[...proof.sourceStages.map(s=>Object.values(s.changes)),Object.values(proof.fixtureSourceAlignment)] as Inverse[][];
  for(const records of pools){const found=records.find(r=>r.currentSha256===hash(current));if(found)current=invert(current,found);if(hash(current)===targetSha256)return current;}
  throw Error(`No complete source lineage to ${targetSha256}`);
}
export function historicalSourceBytesV299(path:URL,targetSha256:string):Buffer{
  assertNativeHistorySourcesV299();
  const raw=readFileSync(path);if(hash(raw)===targetSha256)return raw;return Buffer.from(replayNativeSourceV299(raw.toString("utf8"),targetSha256));
}
export function nativeSourceAtV281(path:string,source:string):string{
  assertNativeHistorySourcesV299();
  const stage=proof.sourceStages.find(s=>s.before==="v281")!;
  const record=(stage.changes as Record<string,Inverse>)[path];return record?replayNativeSourceV299(source,record.beforeSha256):projectNativeSourceBeforeV300(source,assertNativeHistorySourcesV300(proof.currentGraph));
}
