import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import { projectSourceBeforeV342, sourceAtBeforeV342 } from "./helpers/sourceHistoryV342";

const root = new URL("../../..", import.meta.url);
const published = "5566e5db024e4326177aeedd70d758619d1734f0";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("v342 independently reconstructs each exact published v221 source and rejects unreceipted edits",()=>{
  const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v342.json", import.meta.url), "utf8")) as {
    additions: Record<string,string>; changes: Record<string,{before:string;after:string}>;
  };
  assertSourceLayerV326();
  expect(Object.keys(receipt.changes).length).toBeGreaterThan(0);
  expect(Object.keys(receipt.additions).length).toBeGreaterThan(0);
  for(const [path,row] of Object.entries(receipt.changes)){
    const current=readFileSync(new URL(path,root));
    const before=execFileSync("git",["show",`${published}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
    expect(digest(before)).toBe(row.before);expect(digest(current)).toBe(row.after);
    expect(Buffer.from(sourceAtBeforeV342(path,current)).equals(before)).toBe(true);
    expect(projectSourceBeforeV342(current.toString())).toBe(before.toString());
    expect(()=>sourceAtBeforeV342(path,Buffer.concat([current,Buffer.from(" ")]))).toThrow("Unknown exact v342 source bytes");
  }
  for(const [path,hash] of Object.entries(receipt.additions))expect(digest(readFileSync(new URL(path,root)))).toBe(hash);
},60_000);
