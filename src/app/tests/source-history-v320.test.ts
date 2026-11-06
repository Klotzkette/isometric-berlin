import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  verifySourceLayerV320, published199SourceGraphV320, sourceAtPublished199V320, projectSourceBeforeV320,
  SOURCE_HISTORY_PUBLISHED_V199_V320, SOURCE_HISTORY_PROOF_V319_SHA_V320, SOURCE_HISTORY_CAPTURE_SHA_V320,
  type SourceReceiptV320,
} from "./helpers/sourceHistoryV320";
import {
  verifySourceLayerV319, sourceAtPublished198V319, projectSourceBeforeV319,
  SOURCE_HISTORY_PUBLISHED_V198_V319, SOURCE_HISTORY_PROOF_V318_SHA_V319, SOURCE_HISTORY_CAPTURE_SHA_V319,
  type SourceReceiptV319,
} from "./helpers/sourceHistoryV319";

const sha = (raw: string | Uint8Array) => createHash("sha256").update(raw).digest("hex");
const inverse = (before: string, current: string) => ({ beforeSha256: sha(before), currentSha256: sha(current), replacements: [{ before, current }] });
function fixture() {
  const path = "src/app/src/Packet.ts", retained = "src/app/public/mesh/source.json", addition = "src/app/src/FacadeV320.ts";
  const before = "export const version = 199;\n// complete measured source complement\n";
  const current = "export const version = 200;\n// complete measured source complement\n";
  const oldPublic = '{"allOriginalSheets":true}\n', added = "export const completeFourOwnerFronts = true;\n";
  const published = { [path]: sha(before), [retained]: sha(oldPublic) };
  const files: Record<string, string> = { [path]: current, [retained]: oldPublic, [addition]: added };
  const receipt: SourceReceiptV320 = { schemaVersion: 1, publishedCommit: SOURCE_HISTORY_PUBLISHED_V199_V320,
    previousProofSha256: SOURCE_HISTORY_PROOF_V319_SHA_V320, captureToolSha256: SOURCE_HISTORY_CAPTURE_SHA_V320,
    additions: { [addition]: sha(added) }, changes: { [path]: inverse(before, current) } };
  return { path, retained, addition, before, current, oldPublic, added, published, files, receipt,
    inventory: Object.keys(files), read: (p: string) => Buffer.from(files[p]) };
}

test("finite320 inverses compose current200 to published199 and immutable319 to198 without graph duplication", () => {
  const f = fixture(), layer = verifySourceLayerV320(f.receipt, f.published, f.inventory, f.read);
  expect(Object.keys(f.receipt)).not.toContain("currentGraph");
  expect(Object.keys(f.receipt)).not.toContain("publishedGraph");
  expect(layer.publishedGraph).toEqual(f.published);
  expect(Object.keys(layer.currentGraph).sort()).toEqual(f.inventory.sort());
  const raw199 = sourceAtPublished199V320(f.path, f.read(f.path), layer);
  expect(Buffer.from(raw199).toString()).toBe(f.before);
  expect(sourceAtPublished199V320(f.retained, f.read(f.retained), layer)).toEqual(f.read(f.retained));
  expect(projectSourceBeforeV320(f.current, layer)).toBe(f.before);
  const before198 = f.before.replace("199", "198");
  const old: SourceReceiptV319 = { schemaVersion: 1, publishedCommit: SOURCE_HISTORY_PUBLISHED_V198_V319,
    previousProofSha256: SOURCE_HISTORY_PROOF_V318_SHA_V319, captureToolSha256: SOURCE_HISTORY_CAPTURE_SHA_V319,
    additions: {}, changes: { [f.path]: inverse(before198, f.before) } };
  const oldLayer = verifySourceLayerV319(old, { ...f.published, [f.path]: sha(before198) }, Object.keys(f.published),
    path => sourceAtPublished199V320(path, f.read(path), layer));
  expect(Buffer.from(sourceAtPublished198V319(f.path, raw199, oldLayer)).toString()).toBe(before198);
  expect(projectSourceBeforeV319(projectSourceBeforeV320(f.current, layer), oldLayer)).toBe(before198);
  expect(Object.isFrozen(layer)).toBeTrue();
  expect(Object.isFrozen(layer.currentGraph)).toBeTrue();
  expect(Object.isFrozen(f.receipt.changes[f.path].replacements[0])).toBeTrue();
});

test("every retained and added source and the complete inverse complement is required", () => {
  for (const key of ["path", "retained", "addition"] as const) {
    const f = fixture(); f.files[f[key]] += " ";
    expect(() => verifySourceLayerV320(f.receipt, f.published, f.inventory, f.read)).toThrow("Changed complete v320 source graph");
  }
  const outside = fixture(); outside.receipt.changes[outside.path].replacements[0].before = "export const version = 199;\n";
  expect(() => verifySourceLayerV320(outside.receipt, outside.published, outside.inventory, outside.read)).toThrow("Changed full v320 source complement");
  const missing = fixture(); delete missing.receipt.changes[missing.path];
  expect(() => verifySourceLayerV320(missing.receipt, missing.published, missing.inventory, missing.read)).toThrow("Changed complete");
  const old = fixture(); old.receipt.changes[old.path].beforeSha256 = sha("different old source");
  expect(() => verifySourceLayerV320(old.receipt, old.published, old.inventory, old.read)).toThrow("Invalid bounded");
});

test("unknown, missing and duplicate inventory, unsafe paths and unproved additions fail closed", () => {
  const unknown = fixture(); unknown.inventory.push("src/app/src/Unknown.ts");
  expect(() => verifySourceLayerV320(unknown.receipt, unknown.published, unknown.inventory, unknown.read)).toThrow("source inventory");
  const missing = fixture(); missing.inventory = missing.inventory.filter(p => p !== missing.retained);
  expect(() => verifySourceLayerV320(missing.receipt, missing.published, missing.inventory, missing.read)).toThrow("source inventory");
  const duplicate = fixture(); duplicate.inventory.push(duplicate.path);
  expect(() => verifySourceLayerV320(duplicate.receipt, duplicate.published, duplicate.inventory, duplicate.read)).toThrow("source inventory");
  const undeclared = fixture(); undeclared.receipt.additions = {};
  expect(() => verifySourceLayerV320(undeclared.receipt, undeclared.published, undeclared.inventory, undeclared.read)).toThrow("source inventory");
  const old = fixture(); old.receipt.additions[old.path] = sha(old.current);
  expect(() => verifySourceLayerV320(old.receipt, old.published, old.inventory, old.read)).toThrow("duplicate v320 source addition");
  const escaped = fixture(); escaped.receipt.additions["src/app/src/../Escape.ts"] = sha("foreign");
  expect(() => verifySourceLayerV320(escaped.receipt, escaped.published, escaped.inventory, escaped.read)).toThrow("Invalid or duplicate");
});

test("only exact privately verified layers project supplied bytes; clones and ambiguous inverses cannot", () => {
  const f = fixture(), layer = verifySourceLayerV320(f.receipt, f.published, f.inventory, f.read), copied = structuredClone(layer);
  for (const p of [f.addition, "src/app/src/Foreign.ts"]) expect(() => sourceAtPublished199V320(p, f.read(f.path), layer)).toThrow("Unknown exact");
  for (const text of [f.before, f.current + " "]) expect(() => sourceAtPublished199V320(f.path, Buffer.from(text), layer)).toThrow("Unknown exact");
  expect(() => sourceAtPublished199V320(f.path, f.read(f.path), copied)).toThrow("Unknown exact");
  expect(() => projectSourceBeforeV320(f.current, copied)).toThrow("Unverified");
  expect(projectSourceBeforeV320(f.current + " ", layer)).toBe(f.current + " ");
  const ambiguous = fixture(); ambiguous.receipt.changes[ambiguous.path].replacements[0].current = "e";
  expect(() => verifySourceLayerV320(ambiguous.receipt, ambiguous.published, ambiguous.inventory, ambiguous.read)).toThrow("Ambiguous exact");
  const empty = fixture(); empty.receipt.changes[empty.path].replacements = [];
  expect(() => verifySourceLayerV320(empty.receipt, empty.published, empty.inventory, empty.read)).toThrow("Invalid bounded");
  const extra = fixture(); (extra.receipt.changes[extra.path].replacements[0] as unknown as Record<string, unknown>).hidden = {};
  expect(() => verifySourceLayerV320(extra.receipt, extra.published, extra.inventory, extra.read)).toThrow("Invalid bounded");
  for (const duplicate of ["addition", "retained"] as const) {
    const d = fixture(); d.files[d[duplicate]] = d.current;
    if (duplicate === "addition") d.receipt.additions[d.addition] = sha(d.current);
    else d.published[d.retained] = sha(d.current);
    const admitted = verifySourceLayerV320(d.receipt, d.published, d.inventory, d.read);
    expect(() => projectSourceBeforeV320(d.current, admitted)).toThrow("Ambiguous full");
  }
});

test("all four immutable checkpoints and the exact1946-path published199 graph remain frozen", () => {
  for (const key of ["publishedCommit", "previousProofSha256", "captureToolSha256"] as const) {
    const f = fixture(); f.receipt[key] = "0".repeat(64);
    expect(() => verifySourceLayerV320(f.receipt, f.published, f.inventory, f.read)).toThrow("Unknown immutable");
  }
  const raw318 = readFileSync(new URL("./fixtures/source-history-v318.json", import.meta.url));
  const raw319 = readFileSync(new URL("./fixtures/source-history-v319.json", import.meta.url));
  expect(sha(raw319)).toBe(SOURCE_HISTORY_PROOF_V319_SHA_V320);
  const graph = published199SourceGraphV320(raw318, raw319), delta = JSON.parse(raw319.toString());
  expect(Object.keys(graph)).toHaveLength(1946);
  expect(Object.isFrozen(graph)).toBeTrue();
  for (const [path, digest] of Object.entries(delta.additions)) expect(graph[path]).toBe(digest);
  for (const [path, value] of Object.entries(delta.changes) as [string, { currentSha256: string }][]) expect(graph[path]).toBe(value.currentSha256);
  for (const [rawA, rawB] of [[Buffer.concat([raw318, Buffer.from(" ")]), raw319], [raw318, Buffer.concat([raw319, Buffer.from(" ")])]])
    expect(() => published199SourceGraphV320(rawA, rawB)).toThrow("Changed immutable");
  expect(sha(readFileSync(new URL("./fixtures/source-history-v306.json", import.meta.url)))).toBe("4a2bad690d9465ab3e03f5915ba015b85c160b9a2de358c7eba1e08d5c1b719b");
  expect(sha(readFileSync(new URL("./fixtures/source-history-v311.json", import.meta.url)))).toBe("b622ff4a4e972fb658a88add88155e6c6d5f8bcd267bb8c076e8c232601bddc5");
});
