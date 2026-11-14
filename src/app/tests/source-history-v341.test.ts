import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import { projectSourceBeforeV341, sourceAtBeforeV341 } from "./helpers/sourceHistoryV341";
import { sourceAtBeforeV342 } from "./helpers/sourceHistoryV342";

const root = new URL("../../..", import.meta.url);
const published = "3134ff0e982d39d6e7d97a098c468729dd62bdaa";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("v341 independently reconstructs each exact published v220 source and rejects unreceipted edits",()=>{
  const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v341.json", import.meta.url), "utf8")) as {
    additions: Record<string,string>; changes: Record<string,{before:string;after:string}>;
  };
  assertSourceLayerV326();
  expect(Object.keys(receipt.changes).length).toBeGreaterThan(5);
  expect(Object.keys(receipt.additions).length).toBeGreaterThan(5);
  for(const [path,row] of Object.entries(receipt.changes)){
    const current=Buffer.from(sourceAtBeforeV342(path,readFileSync(new URL(path,root))));
    const before=execFileSync("git",["show",`${published}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
    expect(digest(before)).toBe(row.before);expect(digest(current)).toBe(row.after);
    expect(Buffer.from(sourceAtBeforeV341(path,current)).equals(before)).toBe(true);
    expect(projectSourceBeforeV341(current.toString())).toBe(before.toString());
    expect(()=>sourceAtBeforeV341(path,Buffer.concat([current,Buffer.from(" ")]))).toThrow(/Unknown exact v34[12] source bytes/);
  }
  for(const [path,hash] of Object.entries(receipt.additions))expect(digest(sourceAtBeforeV342(path,readFileSync(new URL(path,root))))).toBe(hash);
},60_000);
