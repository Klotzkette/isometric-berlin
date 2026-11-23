import { sourceAtBeforeV355 } from "./helpers/sourceHistoryV355";
import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import { assertSourceLayerV354, projectSourceBeforeV354, sourceAtBeforeV354 } from "./helpers/sourceHistoryV354";

const root = new URL("../../..", import.meta.url);
const published = "4bb88fa3";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("v354 independently reconstructs each exact published v233 source and rejects unreceipted edits",()=>{
  const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v354.json", import.meta.url), "utf8")) as {
    additions: Record<string,string>; changes: Record<string,{before:string;after:string}>;
  };
  assertSourceLayerV326();
  expect(Object.keys(receipt.changes).length).toBeGreaterThan(0);
  expect(Object.keys(receipt.additions).length).toBeGreaterThan(0);
  for(const [path,row] of Object.entries(receipt.changes)){
    const current=sourceAtBeforeV355(path,readFileSync(new URL(path,root)));
    const before=execFileSync("git",["show",`${published}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
    expect(digest(before)).toBe(row.before);expect(digest(current)).toBe(row.after);
    expect(Buffer.from(sourceAtBeforeV354(path,current)).equals(before)).toBe(true);
    expect(projectSourceBeforeV354(Buffer.from(current).toString())).toBe(before.toString());
    expect(()=>sourceAtBeforeV354(path,Buffer.concat([current,Buffer.from(" ")]))).toThrow(/Unknown (?:exact )?v(?:35[4-9]|36[0-9]|37[0-6]) source bytes/);
  }
  for(const [path,hash] of Object.entries(receipt.additions))expect(digest(readFileSync(new URL(path,root)))).toBe(hash);
},120_000);
