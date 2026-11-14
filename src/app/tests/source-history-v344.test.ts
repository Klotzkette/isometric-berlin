import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import { projectSourceBeforeV344, sourceAtBeforeV344 } from "./helpers/sourceHistoryV344";

import { sourceAtBeforeV345 } from "./helpers/sourceHistoryV345";

const root = new URL("../../..", import.meta.url);
const published = "d310b10ebed6c3d3fa1b51197cf039093775ef03";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("v344 independently reconstructs each exact published v223 source and rejects unreceipted edits",()=>{
  const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v344.json", import.meta.url), "utf8")) as {
    additions: Record<string,string>; changes: Record<string,{before:string;after:string}>;
  };
  assertSourceLayerV326();
  expect(Object.keys(receipt.changes).length).toBeGreaterThan(0);
  expect(Object.keys(receipt.additions).length).toBeGreaterThan(0);
  for(const [path,row] of Object.entries(receipt.changes)){
    const current=Buffer.from(sourceAtBeforeV345(path,readFileSync(new URL(path,root))));
    const before=execFileSync("git",["show",`${published}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
    expect(digest(before)).toBe(row.before);expect(digest(current)).toBe(row.after);
    expect(Buffer.from(sourceAtBeforeV344(path,readFileSync(new URL(path,root)))).equals(before)).toBe(true);
    expect(projectSourceBeforeV344(current.toString())).toBe(before.toString());
    expect(()=>sourceAtBeforeV344(path,Buffer.concat([current,Buffer.from(" ")]))).toThrow(/Unknown exact v34[45] source bytes/);
  }
  for(const [path,hash] of Object.entries(receipt.additions))expect(digest(sourceAtBeforeV345(path,readFileSync(new URL(path,root))))).toBe(hash);
},60_000);
