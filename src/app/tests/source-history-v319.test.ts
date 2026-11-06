import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  verifySourceLayerV319, published198SourceGraphV319, sourceAtPublished198V319, projectSourceBeforeV319,
  SOURCE_HISTORY_PUBLISHED_V198_V319, SOURCE_HISTORY_PROOF_V318_SHA_V319, SOURCE_HISTORY_CAPTURE_SHA_V319,
  type SourceReceiptV319,
} from "./helpers/sourceHistoryV319";
import {
  verifySourceLayerV318, sourceAtPublished197V318, projectSourceBeforeV318,
  SOURCE_HISTORY_PUBLISHED_V197_V318, SOURCE_HISTORY_PROOF_V306_SHA_V318,
  SOURCE_HISTORY_BRIDGE_V311_SHA_V318, SOURCE_HISTORY_CAPTURE_SHA_V318, type SourceLayerV318,
} from "./helpers/sourceHistoryV318";
const sha = (raw: string | Uint8Array) => createHash("sha256").update(raw).digest("hex");
function inverse(before: string, current: string) {
  return { beforeSha256: sha(before), currentSha256: sha(current), replacements: [{ before, current }] };
}
function fixture() {
  const path = "src/app/src/Section.ts", retained = "src/app/public/mesh/source.json", addition = "src/app/src/OfficeV319.ts";
  const before = "export const version = 198;\n// complete retained complement\n";
  const current = "export const version = 199;\n// complete retained complement\n";
  const oldPublic = '{"completeOriginalSheets":true}\n', added = "export const estimatedPublicOffice = true;\n";
  const published = { [path]: sha(before), [retained]: sha(oldPublic) };
  const files: Record<string, string> = { [path]: current, [retained]: oldPublic, [addition]: added };
  const receipt: SourceReceiptV319 = { schemaVersion: 1, publishedCommit: SOURCE_HISTORY_PUBLISHED_V198_V319,
    previousProofSha256: SOURCE_HISTORY_PROOF_V318_SHA_V319, captureToolSha256: SOURCE_HISTORY_CAPTURE_SHA_V319,
    additions: { [addition]: sha(added) }, changes: { [path]: inverse(before, current) } };
  const inventory = Object.keys(files), read = (p: string) => Buffer.from(files[p]);
  return { path, retained, addition, before, current, oldPublic, added, published, files, receipt, inventory, read };
}

test("small finite319 receipt reconstructs the complete graph and projects199->198->197 before older layers", () => {
  const f = fixture(), layer = verifySourceLayerV319(f.receipt, f.published, f.inventory, f.read);
  expect(Object.keys(f.receipt)).not.toContain("currentGraph");
  expect(Object.keys(f.receipt)).not.toContain("publishedGraph");
  expect(layer.publishedGraph).toEqual(f.published);
  expect(Object.keys(layer.currentGraph).sort()).toEqual(f.inventory.sort());
  const p198 = sourceAtPublished198V319(f.path, f.read(f.path), layer);
  expect(Buffer.from(p198).toString()).toBe(f.before);
  expect(sourceAtPublished198V319(f.retained, f.read(f.retained), layer)).toEqual(f.read(f.retained));
  expect(projectSourceBeforeV319(f.current, layer)).toBe(f.before);
  expect(projectSourceBeforeV319(f.before, layer)).toBe(f.before);
  const p197 = f.before.replace("198", "197");
  const old: SourceLayerV318 = { schemaVersion: 1, publishedCommit: SOURCE_HISTORY_PUBLISHED_V197_V318,
    previousBridgeSha256: SOURCE_HISTORY_BRIDGE_V311_SHA_V318, previousProofSha256: SOURCE_HISTORY_PROOF_V306_SHA_V318,
    captureToolSha256: SOURCE_HISTORY_CAPTURE_SHA_V318, currentGraph: { ...f.published },
    publishedGraph: { ...f.published, [f.path]: sha(p197) }, additions: {}, changes: { [f.path]: inverse(p197, f.before) } };
  verifySourceLayerV318(old, old.publishedGraph, Object.keys(f.published), p => sourceAtPublished198V319(p, f.read(p), layer));
  expect(Buffer.from(sourceAtPublished197V318(f.path, p198, old)).toString()).toBe(p197);
  expect(projectSourceBeforeV318(projectSourceBeforeV319(f.current, layer), old)).toBe(p197);
  expect(Object.isFrozen(layer)).toBeTrue();
  expect(Object.isFrozen(layer.currentGraph)).toBeTrue();
  expect(Object.isFrozen(f.receipt.changes[f.path].replacements[0])).toBeTrue();
});

test("every existing, new and publicly retained source buffer is checked using the actual supplied reader", () => {
  for (const key of ["path", "retained", "addition"] as const) {
    const f = fixture(); f.files[f[key]] += " ";
    expect(() => verifySourceLayerV319(f.receipt, f.published, f.inventory, f.read)).toThrow("Changed complete v319 source graph");
  }
  const outside = fixture(); outside.receipt.changes[outside.path].replacements[0].before = "export const version = 198;\n";
  expect(() => verifySourceLayerV319(outside.receipt, outside.published, outside.inventory, outside.read)).toThrow("Changed full v319 source complement");
  const missing = fixture(); delete missing.receipt.changes[missing.path];
  expect(() => verifySourceLayerV319(missing.receipt, missing.published, missing.inventory, missing.read)).toThrow("Changed complete");
  const wrong = fixture(); wrong.receipt.changes[wrong.path].beforeSha256 = sha("another old file");
  expect(() => verifySourceLayerV319(wrong.receipt, wrong.published, wrong.inventory, wrong.read)).toThrow("Invalid bounded");
});

test("unknown additions, removed files, duplicate inventory and empty or foreign inverse records fail closed", () => {
  const unknown = fixture(); unknown.inventory.push("src/app/src/Unknown.ts");
  expect(() => verifySourceLayerV319(unknown.receipt, unknown.published, unknown.inventory, unknown.read)).toThrow("source inventory");
  const removed = fixture(); removed.inventory = removed.inventory.filter(p => p !== removed.retained);
  expect(() => verifySourceLayerV319(removed.receipt, removed.published, removed.inventory, removed.read)).toThrow("source inventory");
  const duplicate = fixture(); duplicate.inventory.push(duplicate.path);
  expect(() => verifySourceLayerV319(duplicate.receipt, duplicate.published, duplicate.inventory, duplicate.read)).toThrow("source inventory");
  const missing = fixture(); missing.receipt.additions = {};
  expect(() => verifySourceLayerV319(missing.receipt, missing.published, missing.inventory, missing.read)).toThrow("source inventory");
  const oldAddition = fixture(); oldAddition.receipt.additions[oldAddition.path] = sha(oldAddition.current);
  expect(() => verifySourceLayerV319(oldAddition.receipt, oldAddition.published, oldAddition.inventory, oldAddition.read)).toThrow("duplicate v319 source addition");
  const empty = fixture(); empty.receipt.changes[empty.path].replacements = [];
  expect(() => verifySourceLayerV319(empty.receipt, empty.published, empty.inventory, empty.read)).toThrow("Invalid bounded");
  const foreign = fixture(); foreign.receipt.changes[foreign.addition] = inverse("foreign old file", foreign.added);
  expect(() => verifySourceLayerV319(foreign.receipt, foreign.published, foreign.inventory, foreign.read)).toThrow("Invalid bounded");
});

test("the immutable318 fixture, old306/311 pins, source anchors and reviewed capture tool stay fixed", () => {
  for (const key of ["publishedCommit", "previousProofSha256", "captureToolSha256"] as const) {
    const f = fixture(); f.receipt[key] = "0".repeat(64);
    expect(() => verifySourceLayerV319(f.receipt, f.published, f.inventory, f.read)).toThrow("Unknown immutable");
  }
  const raw = readFileSync(new URL("./fixtures/source-history-v318.json", import.meta.url));
  expect(sha(raw)).toBe(SOURCE_HISTORY_PROOF_V318_SHA_V319);
  const graph = published198SourceGraphV319(raw);
  expect(Object.keys(graph)).toHaveLength(1939);
  expect(graph["src/app/src/ReichstagRoomsV318.ts"]).toBe("63b7c46fd3a7760278244d1eaefe77bb2694586efd48838e75716c4259e06b13");
  expect(Object.isFrozen(graph)).toBeTrue();
  expect(() => published198SourceGraphV319(Buffer.concat([raw, Buffer.from(" ")]))).toThrow("Changed immutable v318");
  expect(sha(readFileSync(new URL("./fixtures/source-history-v306.json", import.meta.url)))).toBe(SOURCE_HISTORY_PROOF_V306_SHA_V318);
  expect(sha(readFileSync(new URL("./fixtures/source-history-v311.json", import.meta.url)))).toBe(SOURCE_HISTORY_BRIDGE_V311_SHA_V318);
});

test("only a verified private layer can project exact supplied bytes; copied receipts never acquire ownership", () => {
  const f = fixture(), layer = verifySourceLayerV319(f.receipt, f.published, f.inventory, f.read);
  for (const p of [f.addition, "src/app/src/Foreign.ts"]) expect(() => sourceAtPublished198V319(p, f.read(f.path), layer)).toThrow("Unknown exact");
  expect(() => sourceAtPublished198V319(f.path, Buffer.from(f.before), layer)).toThrow("Unknown exact");
  expect(() => sourceAtPublished198V319(f.path, Buffer.from(f.current + " "), layer)).toThrow("Unknown exact");
  const copied = structuredClone(layer);
  expect(() => sourceAtPublished198V319(f.path, f.read(f.path), copied)).toThrow("Unknown exact");
  expect(() => projectSourceBeforeV319(f.current, copied)).toThrow("Unverified");
  expect(projectSourceBeforeV319(f.current + " ", layer)).toBe(f.current + " ");
  const shallow = fixture(); Object.freeze(shallow.receipt);
  verifySourceLayerV319(shallow.receipt, shallow.published, shallow.inventory, shallow.read);
  expect(Object.isFrozen(shallow.receipt.changes[shallow.path].replacements[0])).toBeTrue();
  expect(() => { shallow.receipt.changes[shallow.path].currentSha256 = sha("mutation"); }).toThrow();
});

test("path escapes, ambiguous hunks and duplicate complete fingerprints cannot be projected", () => {
  const path = fixture(); path.receipt.additions["src/app/src/../Escaped.ts"] = sha("foreign");
  expect(() => verifySourceLayerV319(path.receipt, path.published, path.inventory, path.read)).toThrow("Invalid or duplicate");
  const hunk = fixture(); hunk.receipt.changes[hunk.path].replacements[0].current = "e";
  expect(() => verifySourceLayerV319(hunk.receipt, hunk.published, hunk.inventory, hunk.read)).toThrow("Ambiguous exact");
  for (const duplicated of ["addition", "retained"] as const) {
    const f = fixture(); f.files[f[duplicated]] = f.current;
    if (duplicated === "addition") f.receipt.additions[f.addition] = sha(f.current);
    else f.published[f.retained] = sha(f.current);
    const layer = verifySourceLayerV319(f.receipt, f.published, f.inventory, f.read);
    expect(() => projectSourceBeforeV319(f.current, layer)).toThrow("Ambiguous full");
  }
  const extra = fixture(); (extra.receipt.changes[extra.path].replacements[0] as unknown as Record<string, unknown>).hidden = {};
  expect(() => verifySourceLayerV319(extra.receipt, extra.published, extra.inventory, extra.read)).toThrow("Invalid bounded");
});
