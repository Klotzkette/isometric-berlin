import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import { projectSourceBeforeV346, sourceAtBeforeV346 } from "./helpers/sourceHistoryV346";

import { sourceAtBeforeV347 } from "./helpers/sourceHistoryV347";

const root = new URL("../../..", import.meta.url);
const published = "daa0c5e372f6c86147dd89962da3fdbd2947e861";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("v346 independently reconstructs each exact published v225 source and rejects unreceipted edits",()=>{
  const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v346.json", import.meta.url), "utf8")) as {
    additions: Record<string,string>; changes: Record<string,{before:string;after:string}>;
  };
  assertSourceLayerV326();
  expect(Object.keys(receipt.changes).length).toBeGreaterThan(0);
  expect(Object.keys(receipt.additions).length).toBeGreaterThan(0);
  for(const [path,row] of Object.entries(receipt.changes)){
    const latest=readFileSync(new URL(path,root));
    const current=sourceAtBeforeV347(path,latest);
    const before=execFileSync("git",["show",`${published}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
    expect(digest(before)).toBe(row.before);expect(digest(current)).toBe(row.after);
    expect(Buffer.from(sourceAtBeforeV346(path,latest)).equals(before)).toBe(true);
    expect(projectSourceBeforeV346(latest.toString())).toBe(before.toString());
    expect(()=>sourceAtBeforeV346(path,Buffer.concat([latest,Buffer.from(" ")]))).toThrow(/Unknown exact v(?:34[6-9]|350) source bytes/);
  }
  for(const [path,hash] of Object.entries(receipt.additions))expect(digest(sourceAtBeforeV347(path,readFileSync(new URL(path,root))))).toBe(hash);
},60_000);
