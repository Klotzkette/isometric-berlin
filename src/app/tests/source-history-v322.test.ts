import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  verifySourceLayerV322, published201SourceGraphV322, sourceAtPublished201V322, projectSourceBeforeV322,
  SOURCE_HISTORY_PUBLISHED_V201_V322, SOURCE_HISTORY_PROOF_V321_SHA_V322, SOURCE_HISTORY_CAPTURE_SHA_V322,
  type SourceReceiptV322,
} from "./helpers/sourceHistoryV322";
import {
  verifySourceLayerV321, sourceAtPublished200V321, projectSourceBeforeV321,
  SOURCE_HISTORY_PUBLISHED_V200_V321, SOURCE_HISTORY_PROOF_V320_SHA_V321, SOURCE_HISTORY_CAPTURE_SHA_V321,
  type SourceReceiptV321,
} from "./helpers/sourceHistoryV321";

const sha = (raw: string | Uint8Array) => createHash("sha256").update(raw).digest("hex");
const inverse = (before: string, current: string) => ({ beforeSha256: sha(before), currentSha256: sha(current), replacements: [{ before, current }] });
function fixture() {
  const path = "src/app/src/Packet.ts", retained = "src/app/public/mesh/source.json", addition = "src/app/src/FacadeV322.ts";
  const before = "export const version = 201;\n// complete measured source complement\n";
  const current = "export const version = 202;\n// complete measured source complement\n";
  const oldPublic = '{"allOriginalSheets":true}\n', added = "export const completeFourOwnerFronts = true;\n";
  const published = { [path]: sha(before), [retained]: sha(oldPublic) };
  const files: Record<string, string> = { [path]: current, [retained]: oldPublic, [addition]: added };
  const receipt: SourceReceiptV322 = { schemaVersion: 1, publishedCommit: SOURCE_HISTORY_PUBLISHED_V201_V322,
    previousProofSha256: SOURCE_HISTORY_PROOF_V321_SHA_V322, captureToolSha256: SOURCE_HISTORY_CAPTURE_SHA_V322,
    additions: { [addition]: sha(added) }, changes: { [path]: inverse(before, current) } };
  return { path, retained, addition, before, current, oldPublic, added, published, files, receipt,
    inventory: Object.keys(files), read: (p: string) => Buffer.from(files[p]) };
}

test("finite322 inverses compose current202 to published201 and immutable321 to200 without graph duplication", () => {
  const f = fixture(), layer = verifySourceLayerV322(f.receipt, f.published, f.inventory, f.read);
  expect(Object.keys(f.receipt)).not.toContain("currentGraph");
  expect(Object.keys(f.receipt)).not.toContain("publishedGraph");
  expect(layer.publishedGraph).toEqual(f.published);
  expect(Object.keys(layer.currentGraph).sort()).toEqual(f.inventory.sort());
  const raw200 = sourceAtPublished201V322(f.path, f.read(f.path), layer);
  expect(Buffer.from(raw200).toString()).toBe(f.before);
  expect(sourceAtPublished201V322(f.retained, f.read(f.retained), layer)).toEqual(f.read(f.retained));
  expect(projectSourceBeforeV322(f.current, layer)).toBe(f.before);
  const before199 = f.before.replace("201", "200");
  const old: SourceReceiptV321 = { schemaVersion: 1, publishedCommit: SOURCE_HISTORY_PUBLISHED_V200_V321,
    previousProofSha256: SOURCE_HISTORY_PROOF_V320_SHA_V321, captureToolSha256: SOURCE_HISTORY_CAPTURE_SHA_V321,
    additions: {}, changes: { [f.path]: inverse(before199, f.before) } };
  const oldLayer = verifySourceLayerV321(old, { ...f.published, [f.path]: sha(before199) }, Object.keys(f.published),
    path => sourceAtPublished201V322(path, f.read(path), layer));
  expect(Buffer.from(sourceAtPublished200V321(f.path, raw200, oldLayer)).toString()).toBe(before199);
  expect(projectSourceBeforeV321(projectSourceBeforeV322(f.current, layer), oldLayer)).toBe(before199);
  expect(Object.isFrozen(layer)).toBeTrue();
  expect(Object.isFrozen(layer.currentGraph)).toBeTrue();
  expect(Object.isFrozen(f.receipt.changes[f.path].replacements[0])).toBeTrue();
});

test("every retained and added source and the complete inverse complement is required", () => {
  for (const key of ["path", "retained", "addition"] as const) {
    const f = fixture(); f.files[f[key]] += " ";
    expect(() => verifySourceLayerV322(f.receipt, f.published, f.inventory, f.read)).toThrow("Changed complete v322 source graph");
  }
  const outside = fixture(); outside.receipt.changes[outside.path].replacements[0].before = "export const version = 201;\n";
  expect(() => verifySourceLayerV322(outside.receipt, outside.published, outside.inventory, outside.read)).toThrow("Changed full v322 source complement");
  const missing = fixture(); delete missing.receipt.changes[missing.path];
  expect(() => verifySourceLayerV322(missing.receipt, missing.published, missing.inventory, missing.read)).toThrow("Changed complete");
  const old = fixture(); old.receipt.changes[old.path].beforeSha256 = sha("different old source");
  expect(() => verifySourceLayerV322(old.receipt, old.published, old.inventory, old.read)).toThrow("Invalid bounded");
});

test("unknown, missing and duplicate inventory, unsafe paths and unproved additions fail closed", () => {
  const unknown = fixture(); unknown.inventory.push("src/app/src/Unknown.ts");
  expect(() => verifySourceLayerV322(unknown.receipt, unknown.published, unknown.inventory, unknown.read)).toThrow("source inventory");
  const missing = fixture(); missing.inventory = missing.inventory.filter(p => p !== missing.retained);
  expect(() => verifySourceLayerV322(missing.receipt, missing.published, missing.inventory, missing.read)).toThrow("source inventory");
  const duplicate = fixture(); duplicate.inventory.push(duplicate.path);
  expect(() => verifySourceLayerV322(duplicate.receipt, duplicate.published, duplicate.inventory, duplicate.read)).toThrow("source inventory");
  const undeclared = fixture(); undeclared.receipt.additions = {};
  expect(() => verifySourceLayerV322(undeclared.receipt, undeclared.published, undeclared.inventory, undeclared.read)).toThrow("source inventory");
  const old = fixture(); old.receipt.additions[old.path] = sha(old.current);
  expect(() => verifySourceLayerV322(old.receipt, old.published, old.inventory, old.read)).toThrow("duplicate v322 source addition");
  const escaped = fixture(); escaped.receipt.additions["src/app/src/../Escape.ts"] = sha("foreign");
  expect(() => verifySourceLayerV322(escaped.receipt, escaped.published, escaped.inventory, escaped.read)).toThrow("Invalid or duplicate");
});

test("only exact privately verified layers project supplied bytes; clones and ambiguous inverses cannot", () => {
  const f = fixture(), layer = verifySourceLayerV322(f.receipt, f.published, f.inventory, f.read), copied = structuredClone(layer);
  for (const p of [f.addition, "src/app/src/Foreign.ts"]) expect(() => sourceAtPublished201V322(p, f.read(f.path), layer)).toThrow("Unknown exact");
  for (const text of [f.before, f.current + " "]) expect(() => sourceAtPublished201V322(f.path, Buffer.from(text), layer)).toThrow("Unknown exact");
  expect(() => sourceAtPublished201V322(f.path, f.read(f.path), copied)).toThrow("Unknown exact");
  expect(() => projectSourceBeforeV322(f.current, copied)).toThrow("Unverified");
  expect(projectSourceBeforeV322(f.current + " ", layer)).toBe(f.current + " ");
  const ambiguous = fixture(); ambiguous.receipt.changes[ambiguous.path].replacements[0].current = "e";
  expect(() => verifySourceLayerV322(ambiguous.receipt, ambiguous.published, ambiguous.inventory, ambiguous.read)).toThrow("Ambiguous exact");
  const empty = fixture(); empty.receipt.changes[empty.path].replacements = [];
  expect(() => verifySourceLayerV322(empty.receipt, empty.published, empty.inventory, empty.read)).toThrow("Invalid bounded");
  const extra = fixture(); (extra.receipt.changes[extra.path].replacements[0] as unknown as Record<string, unknown>).hidden = {};
  expect(() => verifySourceLayerV322(extra.receipt, extra.published, extra.inventory, extra.read)).toThrow("Invalid bounded");
  for (const duplicate of ["addition", "retained"] as const) {
    const d = fixture(); d.files[d[duplicate]] = d.current;
    if (duplicate === "addition") d.receipt.additions[d.addition] = sha(d.current);
    else d.published[d.retained] = sha(d.current);
    const admitted = verifySourceLayerV322(d.receipt, d.published, d.inventory, d.read);
    expect(() => projectSourceBeforeV322(d.current, admitted)).toThrow("Ambiguous full");
  }
});

test("immutable318/319/320/321 checkpoints reconstruct all 1968 published201 paths", () => {
  for (const key of ["publishedCommit", "previousProofSha256", "captureToolSha256"] as const) {
    const f = fixture(); f.receipt[key] = "0".repeat(64);
    expect(() => verifySourceLayerV322(f.receipt, f.published, f.inventory, f.read)).toThrow("Unknown immutable");
  }
  const raws = [318, 319, 320, 321].map(version => readFileSync(new URL(`./fixtures/source-history-v${version}.json`, import.meta.url)));
  expect(sha(raws[3])).toBe(SOURCE_HISTORY_PROOF_V321_SHA_V322);
  const graph = published201SourceGraphV322(raws[0], raws[1], raws[2], raws[3]), delta = JSON.parse(raws[3].toString());
  expect(Object.keys(graph)).toHaveLength(1968);
  expect(Object.isFrozen(graph)).toBeTrue();
  for (const [path, digest] of Object.entries(delta.additions)) expect(graph[path]).toBe(digest);
  for (const [path, value] of Object.entries(delta.changes) as [string, { currentSha256: string }][]) expect(graph[path]).toBe(value.currentSha256);
  for (let i = 0; i < raws.length; i++) {
    const changed = [...raws]; changed[i] = Buffer.concat([changed[i], Buffer.from(" ")]);
    expect(() => published201SourceGraphV322(changed[0], changed[1], changed[2], changed[3])).toThrow("Changed immutable");
  }
  expect(sha(readFileSync(new URL("./fixtures/source-history-v306.json", import.meta.url)))).toBe("4a2bad690d9465ab3e03f5915ba015b85c160b9a2de358c7eba1e08d5c1b719b");
  expect(sha(readFileSync(new URL("./fixtures/source-history-v311.json", import.meta.url)))).toBe("b622ff4a4e972fb658a88add88155e6c6d5f8bcd267bb8c076e8c232601bddc5");
});
