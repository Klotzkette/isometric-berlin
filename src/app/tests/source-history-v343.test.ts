import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import { projectSourceBeforeV343, sourceAtBeforeV343 } from "./helpers/sourceHistoryV343";

import { sourceAtBeforeV344 } from "./helpers/sourceHistoryV344";

const root = new URL("../../..", import.meta.url);
const published = "cceedb466463c5ba2f3eb37a81b01513740544b1";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("v343 independently reconstructs each exact published v222 source and rejects unreceipted edits",()=>{
  const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v343.json", import.meta.url), "utf8")) as {
    additions: Record<string,string>; changes: Record<string,{before:string;after:string}>;
  };
  assertSourceLayerV326();
  expect(Object.keys(receipt.changes).length).toBeGreaterThan(0);
  expect(Object.keys(receipt.additions).length).toBeGreaterThan(0);
  for(const [path,row] of Object.entries(receipt.changes)){
    const latest=readFileSync(new URL(path,root));
    const current=Buffer.from(sourceAtBeforeV344(path,latest));
    const before=execFileSync("git",["show",`${published}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
    expect(digest(before)).toBe(row.before);expect(digest(current)).toBe(row.after);
    expect(Buffer.from(sourceAtBeforeV343(path,latest)).equals(before)).toBe(true);
    expect(projectSourceBeforeV343(latest.toString())).toBe(before.toString());
    expect(()=>sourceAtBeforeV343(path,Buffer.concat([latest,Buffer.from(" ")]))).toThrow(/Unknown exact v(?:34[3-9]|35[01]) source bytes/);
  }
  for(const [path,hash] of Object.entries(receipt.additions))expect(digest(sourceAtBeforeV344(path,readFileSync(new URL(path,root))))).toBe(hash);
},60_000);
