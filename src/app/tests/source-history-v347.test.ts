import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import { sourceAtBeforeV348 } from "./helpers/sourceHistoryV348";
import { projectSourceBeforeV347, sourceAtBeforeV347 } from "./helpers/sourceHistoryV347";

const root = new URL("../../..", import.meta.url);
const published = "84d3c452";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("v347 independently reconstructs each exact published v226 source and rejects unreceipted edits",()=>{
  const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v347.json", import.meta.url), "utf8")) as {
    additions: Record<string,string>; changes: Record<string,{before:string;after:string}>;
  };
  assertSourceLayerV326();
  expect(Object.keys(receipt.changes).length).toBeGreaterThan(0);
  expect(Object.keys(receipt.additions).length).toBeGreaterThan(0);
  for(const [path,row] of Object.entries(receipt.changes)){
    const latest=readFileSync(new URL(path,root));
    const current=Buffer.from(sourceAtBeforeV348(path,latest));
    const before=execFileSync("git",["show",`${published}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
    expect(digest(before)).toBe(row.before);expect(digest(current)).toBe(row.after);
    expect(Buffer.from(sourceAtBeforeV347(path,latest)).equals(before)).toBe(true);
    expect(projectSourceBeforeV347(latest.toString())).toBe(before.toString());
    expect(()=>sourceAtBeforeV347(path,Buffer.concat([latest,Buffer.from(" ")]))).toThrow(/Unknown exact v34[789] source bytes/);
  }
  for(const [path,hash] of Object.entries(receipt.additions))expect(digest(sourceAtBeforeV348(path,readFileSync(new URL(path,root))))).toBe(hash);
},60_000);
