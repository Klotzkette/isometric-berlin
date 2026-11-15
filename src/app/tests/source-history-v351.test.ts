import { sourceAtBeforeV352 } from "./helpers/sourceHistoryV352";
import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import { projectSourceBeforeV351, sourceAtBeforeV351 } from "./helpers/sourceHistoryV351";

const root = new URL("../../..", import.meta.url);
const published = "33941dd9";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("v351 independently reconstructs each exact published v230 source and rejects unreceipted edits",()=>{
  const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v351.json", import.meta.url), "utf8")) as {
    additions: Record<string,string>; changes: Record<string,{before:string;after:string}>;
  };
  assertSourceLayerV326();
  expect(Object.keys(receipt.changes).length).toBeGreaterThan(0);
  expect(Object.keys(receipt.additions).length).toBeGreaterThan(0);
  for(const [path,row] of Object.entries(receipt.changes)){
    const current=Buffer.from(sourceAtBeforeV352(path,readFileSync(new URL(path,root))));
    const before=execFileSync("git",["show",`${published}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
    expect(digest(before)).toBe(row.before);expect(digest(current)).toBe(row.after);
    expect(Buffer.from(sourceAtBeforeV351(path,current)).equals(before)).toBe(true);
    expect(projectSourceBeforeV351(current.toString())).toBe(before.toString());
    expect(()=>sourceAtBeforeV351(path,Buffer.concat([current,Buffer.from(" ")]))).toThrow(/Unknown exact v35[123] source bytes/);
  }
  for(const [path,hash] of Object.entries(receipt.additions))expect(digest(sourceAtBeforeV352(path,readFileSync(new URL(path,root))))).toBe(hash);
},60_000);
