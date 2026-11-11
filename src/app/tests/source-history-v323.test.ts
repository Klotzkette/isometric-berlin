import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import {
  verifySourceLayerV323, published203SourceGraphV323, sourceAtPublished203V323, projectSourceBeforeV323,
  SOURCE_HISTORY_PUBLISHED_V203_V323, SOURCE_HISTORY_PROOF_V322_SHA_V323, SOURCE_HISTORY_CAPTURE_SHA_V323,
  type SourceReceiptV323,
} from "./helpers/sourceHistoryV323";
import {
  verifySourceLayerV322, sourceAtPublished201V322, projectSourceBeforeV322,
  SOURCE_HISTORY_PUBLISHED_V201_V322, SOURCE_HISTORY_PROOF_V321_SHA_V322, SOURCE_HISTORY_CAPTURE_SHA_V322,
  type SourceReceiptV322,
} from "./helpers/sourceHistoryV322";

const sha = (raw: string | Uint8Array) => createHash("sha256").update(raw).digest("hex");
const inverse = (before: string, current: string) => ({ beforeSha256: sha(before), currentSha256: sha(current), replacements: [{ before, current }] });
function fixture() {
  const path = "src/app/src/Packet.ts", retained = "src/app/public/mesh/source.json", addition = "src/app/src/FacadeV323.ts";
  const before = "export const version = 203;\n// complete measured source complement\n";
  const current = "export const version = 204;\n// complete measured source complement\n";
  const oldPublic = '{"allOriginalSheets":true}\n', added = "export const completeFourOwnerFronts = true;\n";
  const published = { [path]: sha(before), [retained]: sha(oldPublic) };
  const files: Record<string, string> = { [path]: current, [retained]: oldPublic, [addition]: added };
  const receipt: SourceReceiptV323 = { schemaVersion: 1, publishedCommit: SOURCE_HISTORY_PUBLISHED_V203_V323,
    previousProofSha256: SOURCE_HISTORY_PROOF_V322_SHA_V323, captureToolSha256: SOURCE_HISTORY_CAPTURE_SHA_V323,
    additions: { [addition]: sha(added) }, changes: { [path]: inverse(before, current) } };
  return { path, retained, addition, before, current, oldPublic, added, published, files, receipt,
    inventory: Object.keys(files), read: (p: string) => Buffer.from(files[p]) };
}

test("finite323 inverses compose current204 to published203 and immutable322 to201 without graph duplication", () => {
  const f = fixture(), layer = verifySourceLayerV323(f.receipt, f.published, f.inventory, f.read);
  expect(Object.keys(f.receipt)).not.toContain("currentGraph");
  expect(Object.keys(f.receipt)).not.toContain("publishedGraph");
  expect(layer.publishedGraph).toEqual(f.published);
  expect(Object.keys(layer.currentGraph).sort()).toEqual(f.inventory.sort());
  const raw203 = sourceAtPublished203V323(f.path, f.read(f.path), layer);
  expect(Buffer.from(raw203).toString()).toBe(f.before);
  expect(sourceAtPublished203V323(f.retained, f.read(f.retained), layer)).toEqual(f.read(f.retained));
  expect(projectSourceBeforeV323(f.current, layer)).toBe(f.before);
  const before201 = f.before.replace("203", "201");
  const old: SourceReceiptV322 = { schemaVersion: 1, publishedCommit: SOURCE_HISTORY_PUBLISHED_V201_V322,
    previousProofSha256: SOURCE_HISTORY_PROOF_V321_SHA_V322, captureToolSha256: SOURCE_HISTORY_CAPTURE_SHA_V322,
    additions: {}, changes: { [f.path]: inverse(before201, f.before) } };
  const oldLayer = verifySourceLayerV322(old, { ...f.published, [f.path]: sha(before201) }, Object.keys(f.published),
    path => sourceAtPublished203V323(path, f.read(path), layer));
  expect(Buffer.from(sourceAtPublished201V322(f.path, raw203, oldLayer)).toString()).toBe(before201);
  expect(projectSourceBeforeV322(projectSourceBeforeV323(f.current, layer), oldLayer)).toBe(before201);
  expect(Object.isFrozen(layer)).toBeTrue();
  expect(Object.isFrozen(layer.currentGraph)).toBeTrue();
  expect(Object.isFrozen(f.receipt.changes[f.path].replacements[0])).toBeTrue();
});

test("the new inverse treats source replacement metacharacters as literal bytes", () => {
  const f = fixture();
  f.before = "export const literal = '$& $` $\u0027 $$';\n";
  f.published[f.path] = sha(f.before);
  f.receipt.changes[f.path] = inverse(f.before, f.current);
  const layer = verifySourceLayerV323(f.receipt, f.published, f.inventory, f.read);
  expect(Buffer.from(sourceAtPublished203V323(f.path, f.read(f.path), layer)).toString()).toBe(f.before);
  expect(projectSourceBeforeV323(f.current, layer)).toBe(f.before);
});

test("every retained and added source and the complete inverse complement is required", () => {
  for (const key of ["path", "retained", "addition"] as const) {
    const f = fixture(); f.files[f[key]] += " ";
    expect(() => verifySourceLayerV323(f.receipt, f.published, f.inventory, f.read)).toThrow("Changed complete v323 source graph");
  }
  const outside = fixture(); outside.receipt.changes[outside.path].replacements[0].before = "export const version = 203;\n";
  expect(() => verifySourceLayerV323(outside.receipt, outside.published, outside.inventory, outside.read)).toThrow("Changed full v323 source complement");
  const missing = fixture(); delete missing.receipt.changes[missing.path];
  expect(() => verifySourceLayerV323(missing.receipt, missing.published, missing.inventory, missing.read)).toThrow("Changed complete");
  const old = fixture(); old.receipt.changes[old.path].beforeSha256 = sha("different old source");
  expect(() => verifySourceLayerV323(old.receipt, old.published, old.inventory, old.read)).toThrow("Invalid bounded");
});

test("unknown, missing and duplicate inventory, unsafe paths and unproved additions fail closed", () => {
  const unknown = fixture(); unknown.inventory.push("src/app/src/Unknown.ts");
  expect(() => verifySourceLayerV323(unknown.receipt, unknown.published, unknown.inventory, unknown.read)).toThrow("source inventory");
  const missing = fixture(); missing.inventory = missing.inventory.filter(p => p !== missing.retained);
  expect(() => verifySourceLayerV323(missing.receipt, missing.published, missing.inventory, missing.read)).toThrow("source inventory");
  const duplicate = fixture(); duplicate.inventory.push(duplicate.path);
  expect(() => verifySourceLayerV323(duplicate.receipt, duplicate.published, duplicate.inventory, duplicate.read)).toThrow("source inventory");
  const undeclared = fixture(); undeclared.receipt.additions = {};
  expect(() => verifySourceLayerV323(undeclared.receipt, undeclared.published, undeclared.inventory, undeclared.read)).toThrow("source inventory");
  const old = fixture(); old.receipt.additions[old.path] = sha(old.current);
  expect(() => verifySourceLayerV323(old.receipt, old.published, old.inventory, old.read)).toThrow("duplicate v323 source addition");
  const escaped = fixture(); escaped.receipt.additions["src/app/src/../Escape.ts"] = sha("foreign");
  expect(() => verifySourceLayerV323(escaped.receipt, escaped.published, escaped.inventory, escaped.read)).toThrow("Invalid or duplicate");
  const digest = fixture(); digest.receipt.additions[digest.addition] = "foreign";
  expect(() => verifySourceLayerV323(digest.receipt, digest.published, digest.inventory, digest.read)).toThrow("Invalid or duplicate");
  const extra = fixture(); (extra.receipt as unknown as Record<string, unknown>).waiver = true;
  expect(() => verifySourceLayerV323(extra.receipt, extra.published, extra.inventory, extra.read)).toThrow("Unknown immutable");
});

test("only exact privately verified layers project supplied bytes; clones and ambiguous inverses cannot", () => {
  const f = fixture(), layer = verifySourceLayerV323(f.receipt, f.published, f.inventory, f.read), copied = structuredClone(layer);
  for (const p of [f.addition, "src/app/src/Foreign.ts"]) expect(() => sourceAtPublished203V323(p, f.read(f.path), layer)).toThrow("Unknown exact");
  for (const text of [f.before, f.current + " "]) expect(() => sourceAtPublished203V323(f.path, Buffer.from(text), layer)).toThrow("Unknown exact");
  expect(() => sourceAtPublished203V323(f.path, f.read(f.path), copied)).toThrow("Unknown exact");
  expect(() => projectSourceBeforeV323(f.current, copied)).toThrow("Unverified");
  expect(projectSourceBeforeV323(f.current + " ", layer)).toBe(f.current + " ");
  const ambiguous = fixture(); ambiguous.receipt.changes[ambiguous.path].replacements[0].current = "e";
  expect(() => verifySourceLayerV323(ambiguous.receipt, ambiguous.published, ambiguous.inventory, ambiguous.read)).toThrow("Ambiguous exact");
  const empty = fixture(); empty.receipt.changes[empty.path].replacements = [];
  expect(() => verifySourceLayerV323(empty.receipt, empty.published, empty.inventory, empty.read)).toThrow("Invalid bounded");
  const extra = fixture(); (extra.receipt.changes[extra.path].replacements[0] as unknown as Record<string, unknown>).hidden = {};
  expect(() => verifySourceLayerV323(extra.receipt, extra.published, extra.inventory, extra.read)).toThrow("Invalid bounded");
  for (const duplicate of ["addition", "retained"] as const) {
    const d = fixture(); d.files[d[duplicate]] = d.current;
    if (duplicate === "addition") d.receipt.additions[d.addition] = sha(d.current);
    else d.published[d.retained] = sha(d.current);
    const admitted = verifySourceLayerV323(d.receipt, d.published, d.inventory, d.read);
    expect(() => projectSourceBeforeV323(d.current, admitted)).toThrow("Ambiguous full");
  }
});

test("immutable318/319/320/321/322 checkpoints reconstruct all 1990 published203 paths", () => {
  for (const key of ["publishedCommit", "previousProofSha256", "captureToolSha256"] as const) {
    const f = fixture(); f.receipt[key] = "0".repeat(64);
    expect(() => verifySourceLayerV323(f.receipt, f.published, f.inventory, f.read)).toThrow("Unknown immutable");
  }
  const raws = [318, 319, 320, 321, 322].map(version => readFileSync(new URL(`./fixtures/source-history-v${version}.json`, import.meta.url)));
  expect(sha(raws[4])).toBe(SOURCE_HISTORY_PROOF_V322_SHA_V323);
  const graph = published203SourceGraphV323(raws[0], raws[1], raws[2], raws[3], raws[4]), delta = JSON.parse(raws[4].toString());
  expect(Object.keys(graph)).toHaveLength(1990);
  expect(Object.isFrozen(graph)).toBeTrue();
  for (const [path, digest] of Object.entries(delta.additions)) expect(graph[path]).toBe(digest);
  for (const [path, value] of Object.entries(delta.changes) as [string, { currentSha256: string }][]) expect(graph[path]).toBe(value.currentSha256);
  for (let i = 0; i < raws.length; i++) {
    const changed = [...raws]; changed[i] = Buffer.concat([changed[i], Buffer.from(" ")]);
    expect(() => published203SourceGraphV323(changed[0], changed[1], changed[2], changed[3], changed[4])).toThrow("Changed immutable");
  }
  expect(sha(readFileSync(new URL("./fixtures/source-history-v306.json", import.meta.url)))).toBe("4a2bad690d9465ab3e03f5915ba015b85c160b9a2de358c7eba1e08d5c1b719b");
  expect(sha(readFileSync(new URL("./fixtures/source-history-v311.json", import.meta.url)))).toBe("b622ff4a4e972fb658a88add88155e6c6d5f8bcd267bb8c076e8c232601bddc5");
});

test("only V322 adapter entrypoints change and the complete history import graph remains acyclic", () => {
  const file = "src/app/tests/helpers/sourceHistoryV322.ts";
  const before = execFileSync("git", ["show", `${SOURCE_HISTORY_PUBLISHED_V203_V323}:${file}`],
    { cwd: new URL("../../..", import.meta.url), encoding: "utf8" });
  const current = readFileSync(new URL("./helpers/sourceHistoryV322.ts", import.meta.url), "utf8");
  const unchanged = (source: string) => {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    return ast.statements.filter(node => !(ts.isImportDeclaration(node)) && !(ts.isFunctionDeclaration(node)
      && ["assertSourceLayerV322", "sourceAtPublished201V322", "projectSourceBeforeV322"].includes(node.name?.text ?? "")))
      .map(node => node.getText(ast));
  };
  expect(unchanged(current)).toEqual(unchanged(before));
  const root = new URL("./helpers/", import.meta.url);
  const graph = new Map<string, string[]>();
  for (const name of readdirSync(root).filter(name => /^sourceHistoryV\d+\.ts$/.test(name))) {
    const ast = ts.createSourceFile(name, readFileSync(new URL(name, root), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    graph.set(name, ast.statements.flatMap(node => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
      && /^\.\/sourceHistoryV\d+$/.test(node.moduleSpecifier.text) ? [node.moduleSpecifier.text.slice(2) + ".ts"] : []));
  }
  const active = new Set<string>(), visited = new Set<string>();
  const visit = (name: string) => {
    if (active.has(name)) throw Error(`Cyclic source history: ${name}`);
    if (visited.has(name)) return;
    active.add(name);
    for (const dependency of graph.get(name) ?? []) visit(dependency);
    active.delete(name); visited.add(name);
  };
  for (const name of graph.keys()) visit(name);
  expect(visited.size).toBe(graph.size);
  expect(graph.get("sourceHistoryV327.ts")).toEqual(["sourceHistoryV328.ts"]);expect(graph.get("sourceHistoryV328.ts")).toEqual(["sourceHistoryV329.ts"]);expect(graph.get("sourceHistoryV329.ts")).toEqual(["sourceHistoryV330.ts"]);expect(graph.get("sourceHistoryV330.ts")).toEqual(["sourceHistoryV331.ts"]);expect(graph.get("sourceHistoryV331.ts")).toEqual(["sourceHistoryV332.ts"]);expect(graph.get("sourceHistoryV332.ts")).toEqual(["sourceHistoryV333.ts"]);expect(graph.get("sourceHistoryV333.ts")).toEqual(["sourceHistoryV334.ts"]);expect(graph.get("sourceHistoryV334.ts")).toEqual(["sourceHistoryV335.ts"]);expect(graph.get("sourceHistoryV335.ts")).toEqual(["sourceHistoryV336.ts"]);expect(graph.get("sourceHistoryV336.ts")).toEqual(["sourceHistoryV337.ts"]);expect(graph.get("sourceHistoryV337.ts")).toEqual([]);
  expect(graph.get("sourceHistoryV326.ts")).toEqual(["sourceHistoryV327.ts"]);
  expect(graph.get("sourceHistoryV325.ts")).toEqual(["sourceHistoryV326.ts"]);
  expect(graph.get("sourceHistoryV324.ts")).toEqual(["sourceHistoryV325.ts"]);
  expect(graph.get("sourceHistoryV323.ts")).toEqual(["sourceHistoryV324.ts"]);
  expect(graph.get("sourceHistoryV322.ts")).toEqual(["sourceHistoryV323.ts"]);
});
