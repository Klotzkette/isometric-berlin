import { sourceAtBeforeV353 } from "./helpers/sourceHistoryV353";
import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import { projectSourceBeforeV352, sourceAtBeforeV352 } from "./helpers/sourceHistoryV352";

const root = new URL("../../..", import.meta.url);
const published = "69810478";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("v352 independently reconstructs each exact published v231 source and rejects unreceipted edits",()=>{
  const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v352.json", import.meta.url), "utf8")) as {
    additions: Record<string,string>; changes: Record<string,{before:string;after:string}>;
  };
  assertSourceLayerV326();
  expect(Object.keys(receipt.changes).length).toBeGreaterThan(0);
  expect(Object.keys(receipt.additions).length).toBeGreaterThan(0);
  for(const [path,row] of Object.entries(receipt.changes)){
    const current=readFileSync(new URL(path,root));
    const before=execFileSync("git",["show",`${published}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
    expect(digest(before)).toBe(row.before);expect(digest(sourceAtBeforeV353(path,current))).toBe(row.after);
    expect(Buffer.from(sourceAtBeforeV352(path,current)).equals(before)).toBe(true);
    expect(projectSourceBeforeV352(current.toString())).toBe(before.toString());
    expect(()=>sourceAtBeforeV352(path,Buffer.concat([current,Buffer.from(" ")]))).toThrow(/Unknown exact v35[2-7] source bytes/);
  }
  for(const [path,hash] of Object.entries(receipt.additions))expect(digest(sourceAtBeforeV353(path,readFileSync(new URL(path,root))))).toBe(hash);
},60_000);
