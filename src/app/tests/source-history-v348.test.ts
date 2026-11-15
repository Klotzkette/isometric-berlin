import { sourceAtBeforeV349 } from "./helpers/sourceHistoryV349";
import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import { projectSourceBeforeV348, sourceAtBeforeV348 } from "./helpers/sourceHistoryV348";

const root = new URL("../../..", import.meta.url);
const published = "00cc1ce0";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("v348 independently reconstructs each exact published v227 source and rejects unreceipted edits",()=>{
  const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v348.json", import.meta.url), "utf8")) as {
    additions: Record<string,string>; changes: Record<string,{before:string;after:string}>;
  };
  assertSourceLayerV326();
  expect(Object.keys(receipt.changes).length).toBeGreaterThan(0);
  expect(Object.keys(receipt.additions).length).toBeGreaterThan(0);
  for(const [path,row] of Object.entries(receipt.changes)){
    const latest=readFileSync(new URL(path,root));
    const current=Buffer.from(sourceAtBeforeV349(path,latest));
    const before=execFileSync("git",["show",`${published}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
    expect(digest(before)).toBe(row.before);expect(digest(current)).toBe(row.after);
    expect(Buffer.from(sourceAtBeforeV348(path,latest)).equals(before)).toBe(true);
    expect(projectSourceBeforeV348(latest.toString())).toBe(before.toString());
    expect(()=>sourceAtBeforeV348(path,Buffer.concat([latest,Buffer.from(" ")]))).toThrow(/Unknown exact v(?:34[89]|350) source bytes/);
  }
  for(const [path,hash] of Object.entries(receipt.additions))expect(digest(sourceAtBeforeV349(path,readFileSync(new URL(path,root))))).toBe(hash);
},60_000);
