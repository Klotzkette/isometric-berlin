import { sourceAtBeforeV354 } from "./helpers/sourceHistoryV354";
import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import { assertSourceLayerV353, projectSourceBeforeV353, sourceAtBeforeV353 } from "./helpers/sourceHistoryV353";

const root = new URL("../../..", import.meta.url);
const published = "68aafb0a";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("v353 independently reconstructs each exact published v232 source and rejects unreceipted edits",()=>{
  const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v353.json", import.meta.url), "utf8")) as {
    additions: Record<string,string>; changes: Record<string,{before:string;after:string}>;
  };
  assertSourceLayerV326();
  expect(Object.keys(receipt.changes).length).toBeGreaterThan(0);
  expect(Object.keys(receipt.additions).length).toBeGreaterThan(0);
  for(const [path,row] of Object.entries(receipt.changes)){
    const current=sourceAtBeforeV354(path,readFileSync(new URL(path,root)));
    const before=execFileSync("git",["show",`${published}:${path}`],{cwd:root,maxBuffer:32*1024*1024});
    expect(digest(before)).toBe(row.before);expect(digest(current)).toBe(row.after);
    expect(Buffer.from(sourceAtBeforeV353(path,current)).equals(before)).toBe(true);
    expect(projectSourceBeforeV353(current.toString())).toBe(before.toString());
    expect(()=>sourceAtBeforeV353(path,Buffer.concat([current,Buffer.from(" ")]))).toThrow(/Unknown exact v(35[3-9]|36[0-4]) source bytes/);
  }
  for(const [path,hash] of Object.entries(receipt.additions))expect(digest(readFileSync(new URL(path,root)))).toBe(hash);
},60_000);

test("v353 repeated normalization admits only the two independently verified v231 ancestors",()=>{
  const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v353.json", import.meta.url), "utf8")) as {
    additions: Record<string,string>; changes: Record<string,{before:string;after:string}>;
  };
  const beforeGraph = Object.fromEntries(Object.entries(receipt.changes).map(([path,row])=>[path,row.before]));
  assertSourceLayerV326();
  const paths = ["src/app/package.json","src/app/src/SourceQuarterCatalogueV309.ts"];
  const ancestors = paths.map(path=>execFileSync("git",["show",`69810478315fb30ab5ded23f8bde39c51cb1ca20:${path}`],{cwd:root,maxBuffer:32*1024*1024}));
  for(let i=0;i<paths.length;i++) {
    const path=paths[i],raw=ancestors[i];
    expect(sourceAtBeforeV353(path,raw)).toBe(raw);
    expect(sourceAtBeforeV353(path,sourceAtBeforeV353(path,raw))).toBe(raw);
    expect(()=>sourceAtBeforeV353(path,Buffer.concat([raw,Buffer.from(" ")]))).toThrow(/Unknown exact v(35[3-9]|36[0-4]) source bytes/);
    expect(()=>sourceAtBeforeV353(path,ancestors[1-i])).toThrow(/Unknown exact v(35[3-9]|36[0-4]) source bytes/);
  }
  const unlisted = execFileSync("git",["show","33941dd9:src/app/package.json"],{cwd:root});
  expect(()=>sourceAtBeforeV353(paths[0],unlisted)).toThrow(/Unknown exact v(35[3-9]|36[0-4]) source bytes/);
});
