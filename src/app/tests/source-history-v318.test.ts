import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  published197SourceGraphV318, verifySourceLayerV318, sourceAtPublished197V318, projectSourceBeforeV318,
  SOURCE_HISTORY_PUBLISHED_V197_V318, SOURCE_HISTORY_BRIDGE_V311_SHA_V318,
  SOURCE_HISTORY_PROOF_V306_SHA_V318, SOURCE_HISTORY_CAPTURE_SHA_V318,
  type SourceLayerV318, type SourceInverseV318,
} from "./helpers/sourceHistoryV318";
import { invertNativeSourceV306 } from "./helpers/sourceHistoryV306";

const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function receipt(before: string, current: string): SourceInverseV318 {
  return { beforeSha256: sha(before), currentSha256: sha(current), replacements: [{ before, current }] };
}
function fixture() {
  const path = "src/app/src/old.ts", retained = "src/app/public/mesh/retained.json", addition = "src/app/src/data/new.json";
  const before = "export const value = 197;\n// retained complete complement\n";
  const current = "export const value = 198;\n// retained complete complement\n";
  const added = '{"newCompleteOwner":true}\n', oldPublic = '{"retainedWholeGeometry":true}\n';
  const published = { [path]: sha(before), [retained]: sha(oldPublic) };
  const files: Record<string, string> = { [path]: current, [retained]: oldPublic, [addition]: added };
  const layer: SourceLayerV318 = {
    schemaVersion: 1, publishedCommit: SOURCE_HISTORY_PUBLISHED_V197_V318,
    previousBridgeSha256: SOURCE_HISTORY_BRIDGE_V311_SHA_V318, previousProofSha256: SOURCE_HISTORY_PROOF_V306_SHA_V318,
    captureToolSha256: SOURCE_HISTORY_CAPTURE_SHA_V318, currentGraph: Object.fromEntries(Object.entries(files).map(([p, value]) => [p, sha(value)])),
    publishedGraph: { ...published }, additions: { [addition]: sha(added) }, changes: { [path]: receipt(before, current) },
  };
  const read = (p: string) => Buffer.from(files[p]);
  const inventory = Object.keys(files);
  return { path, retained, addition, before, current, added, files, published, layer, inventory, read };
}

test("a complete validated v318 layer projects exact current bytes to197 before the old196/195 inverses", () => {
  const f = fixture();
  expect(verifySourceLayerV318(f.layer, f.published, f.inventory, f.read)).toBe(f.layer);
  const p197 = sourceAtPublished197V318(f.path, f.read(f.path), f.layer);
  expect(Buffer.from(p197).toString()).toBe(f.before);
  expect(sourceAtPublished197V318(f.retained, f.read(f.retained), f.layer)).toEqual(f.read(f.retained));
  expect(projectSourceBeforeV318(f.current, f.layer)).toBe(f.before);
  expect(projectSourceBeforeV318(f.before, f.layer)).toBe(f.before);
  const p196 = "export const value = 196;\n// retained complete complement\n";
  const p195 = "export const value = 195;\n// retained complete complement\n";
  const old311 = receipt(p196, f.before), old306 = receipt(p195, p196);
  expect(invertNativeSourceV306(invertNativeSourceV306(Buffer.from(p197).toString(), old311), old306)).toBe(p195);
  expect(Object.isFrozen(f.layer)).toBeTrue();
  expect(Object.isFrozen(f.layer.currentGraph)).toBeTrue();
  expect(Object.isFrozen(f.layer.changes[f.path].replacements[0])).toBeTrue();
});

test("unknown added sources, missing old files and incomplete current inventories fail closed", () => {
  const unknown = fixture();
  unknown.inventory.push("src/app/src/unknown.ts");
  expect(() => verifySourceLayerV318(unknown.layer, unknown.published, unknown.inventory, unknown.read)).toThrow("source inventory");
  const missing = fixture();
  delete missing.layer.currentGraph[missing.retained];
  missing.inventory = missing.inventory.filter(p => p !== missing.retained);
  expect(() => verifySourceLayerV318(missing.layer, missing.published, missing.inventory, missing.read)).toThrow("immutable v197 graph pins");
  const duplicate = fixture();
  duplicate.inventory.push(duplicate.path);
  expect(() => verifySourceLayerV318(duplicate.layer, duplicate.published, duplicate.inventory, duplicate.read)).toThrow("source inventory");
  const unlisted = fixture();
  unlisted.layer.additions = {};
  expect(() => verifySourceLayerV318(unlisted.layer, unlisted.published, unlisted.inventory, unlisted.read)).toThrow("Unaccounted new");
  const extra = fixture();
  extra.layer.additions[extra.retained] = extra.published[extra.retained];
  expect(() => verifySourceLayerV318(extra.layer, extra.published, extra.inventory, extra.read)).toThrow("Unaccounted new");
});

test("all full source words and the retained complement are checked before admission", () => {
  for (const pathType of ["path", "retained", "addition"] as const) {
    const f = fixture();
    f.files[f[pathType]] += " ";
    expect(() => verifySourceLayerV318(f.layer, f.published, f.inventory, f.read)).toThrow("Changed complete v318 source graph");
  }
  const outside = fixture();
  outside.layer.changes[outside.path].replacements[0].before = "export const value = 197;\n";
  expect(() => verifySourceLayerV318(outside.layer, outside.published, outside.inventory, outside.read)).toThrow("Changed full v318 source complement");
  const missing = fixture(); delete missing.layer.changes[missing.path];
  expect(() => verifySourceLayerV318(missing.layer, missing.published, missing.inventory, missing.read)).toThrow("Missing or extra");
  const extra = fixture(); extra.layer.changes[extra.retained] = receipt(extra.files[extra.retained], extra.files[extra.retained]);
  expect(() => verifySourceLayerV318(extra.layer, extra.published, extra.inventory, extra.read)).toThrow("Invalid bounded");
});

test("published checkpoints, exact capture implementation and immutable predecessor graph cannot be resigned", () => {
  for (const key of ["publishedCommit", "previousBridgeSha256", "previousProofSha256", "captureToolSha256"] as const) {
    const f = fixture(); f.layer[key] = "0".repeat(64);
    expect(() => verifySourceLayerV318(f.layer, f.published, f.inventory, f.read)).toThrow("Unknown immutable v318 source anchors");
  }
  const old = fixture(); old.layer.publishedGraph[old.path] = sha("replaced old checkpoint");
  expect(() => verifySourceLayerV318(old.layer, old.published, old.inventory, old.read)).toThrow("immutable v197 graph pins");
  const addedOld = fixture(); addedOld.layer.publishedGraph[addedOld.addition] = sha(addedOld.added);
  expect(() => verifySourceLayerV318(addedOld.layer, addedOld.published, addedOld.inventory, addedOld.read)).toThrow("immutable v197 graph pins");
  const proof = readFileSync(new URL("./fixtures/source-history-v306.json", import.meta.url));
  const bridge = readFileSync(new URL("./fixtures/source-history-v311.json", import.meta.url));
  expect(sha(proof)).toBe(SOURCE_HISTORY_PROOF_V306_SHA_V318);
  expect(sha(bridge)).toBe(SOURCE_HISTORY_BRIDGE_V311_SHA_V318);
  const graph = published197SourceGraphV318(proof, bridge);
  expect(Object.keys(graph)).toHaveLength(1923);
  expect(Object.isFrozen(graph)).toBeTrue();
  expect(graph["src/app/src/NorthContextV312.ts"]).toBe("b3d315c13256b00ee49599d8ca8069abb74e1d6e97ecd999007b791896923bf1");
  expect(() => published197SourceGraphV318(Buffer.concat([proof, Buffer.from(" ")]), bridge)).toThrow("immutable v306/v311");
  expect(() => published197SourceGraphV318(proof, Buffer.concat([bridge, Buffer.from(" ")]))).toThrow("immutable v306/v311");
});

test("projection requires verified ownership and actual supplied bytes, including after admission", () => {
  const f = fixture();
  expect(() => sourceAtPublished197V318(f.path, f.read(f.path), f.layer)).toThrow("Unknown exact");
  expect(() => projectSourceBeforeV318(f.current, f.layer)).toThrow("Unverified");
  verifySourceLayerV318(f.layer, f.published, f.inventory, f.read);
  expect(() => sourceAtPublished197V318(f.addition, f.read(f.addition), f.layer)).toThrow("Unknown exact");
  expect(() => sourceAtPublished197V318("src/app/src/foreign.ts", f.read(f.path), f.layer)).toThrow("Unknown exact");
  expect(() => sourceAtPublished197V318(f.path, Buffer.from(f.before), f.layer)).toThrow("Unknown exact");
  expect(() => sourceAtPublished197V318(f.path, Buffer.from(f.current + " "), f.layer)).toThrow("Unknown exact");
  const unverified = structuredClone(f.layer);
  expect(() => sourceAtPublished197V318(f.path, f.read(f.path), unverified)).toThrow("Unknown exact");
  expect(projectSourceBeforeV318(f.current + " ", f.layer)).toBe(f.current + " ");
  const shallow = fixture();
  Object.freeze(shallow.layer);
  verifySourceLayerV318(shallow.layer, shallow.published, shallow.inventory, shallow.read);
  expect(Object.isFrozen(shallow.layer.currentGraph)).toBeTrue();
  expect(Object.isFrozen(shallow.layer.changes[shallow.path].replacements[0])).toBeTrue();
  expect(() => { shallow.layer.currentGraph[shallow.path] = sha("another file"); }).toThrow();
});

test("ambiguous hunks, duplicate full fingerprints and source-path escapes are rejected", () => {
  const hunk = fixture(); hunk.layer.changes[hunk.path].replacements[0].current = "e";
  expect(() => verifySourceLayerV318(hunk.layer, hunk.published, hunk.inventory, hunk.read)).toThrow("Ambiguous exact");
  const escaped = fixture(); escaped.layer.currentGraph["src/app/src/../escaped.ts"] = sha("bad");
  expect(() => verifySourceLayerV318(escaped.layer, escaped.published, escaped.inventory, escaped.read)).toThrow("Invalid finite");
  const two = fixture(), second = "src/app/src/second.ts";
  two.files[second] = two.current; two.inventory.push(second);
  two.published[second] = sha(two.before); two.layer.publishedGraph[second] = sha(two.before);
  two.layer.currentGraph[second] = sha(two.current); two.layer.changes[second] = receipt(two.before, two.current);
  verifySourceLayerV318(two.layer, two.published, two.inventory, two.read);
  expect(() => projectSourceBeforeV318(two.current, two.layer)).toThrow("Ambiguous full");
  const addition = fixture();
  addition.files[addition.addition] = addition.current;
  addition.layer.currentGraph[addition.addition] = sha(addition.current); addition.layer.additions[addition.addition] = sha(addition.current);
  verifySourceLayerV318(addition.layer, addition.published, addition.inventory, addition.read);
  expect(() => projectSourceBeforeV318(addition.current, addition.layer)).toThrow("Ambiguous full");
  const retained = fixture();
  retained.files[retained.retained] = retained.current;
  retained.layer.currentGraph[retained.retained] = retained.published[retained.retained] = retained.layer.publishedGraph[retained.retained] = sha(retained.current);
  verifySourceLayerV318(retained.layer, retained.published, retained.inventory, retained.read);
  expect(() => projectSourceBeforeV318(retained.current, retained.layer)).toThrow("Ambiguous full");
  const extraField = fixture();
  (extraField.layer.changes[extraField.path].replacements[0] as unknown as Record<string, unknown>).foreign = {};
  expect(() => verifySourceLayerV318(extraField.layer, extraField.published, extraField.inventory, extraField.read)).toThrow("Invalid bounded");
});
