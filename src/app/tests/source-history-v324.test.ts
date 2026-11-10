import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import ts from "typescript";
import { sourceAtPublished205V325 } from "./helpers/sourceHistoryV325";
import {
  verifySourceLayerV324, published204SourceGraphV324, sourceAtPublished204V324, projectSourceBeforeV324, assertSourceLayerV324,
  SOURCE_HISTORY_PUBLISHED_V204_V324, SOURCE_HISTORY_PROOF_V323_SHA_V324, SOURCE_HISTORY_CAPTURE_SHA_V324,
  type SourceReceiptV324,
} from "./helpers/sourceHistoryV324";
import {
  verifySourceLayerV323, sourceAtPublished203V323, projectSourceBeforeV323, assertSourceLayerV323,
  SOURCE_HISTORY_PUBLISHED_V203_V323, SOURCE_HISTORY_PROOF_V322_SHA_V323, SOURCE_HISTORY_CAPTURE_SHA_V323,
  type SourceReceiptV323,
} from "./helpers/sourceHistoryV323";

const sha = (raw: string | Uint8Array) => createHash("sha256").update(raw).digest("hex");
const inverse = (before: string, current: string) => ({ beforeSha256: sha(before), currentSha256: sha(current), replacements: [{ before, current }] });
function fixture() {
  const path = "src/app/src/Packet.ts", retained = "src/app/public/mesh/source.json", addition = "src/app/src/FacadeV324.ts";
  const before = "export const version = 204;\n// complete measured source complement\n";
  const current = "export const version = 205;\n// complete measured source complement\n";
  const oldPublic = '{"allOriginalSheets":true}\n', added = "export const completeFourOwnerFronts = true;\n";
  const published = { [path]: sha(before), [retained]: sha(oldPublic) };
  const files: Record<string, string> = { [path]: current, [retained]: oldPublic, [addition]: added };
  const receipt: SourceReceiptV324 = { schemaVersion: 1, publishedCommit: SOURCE_HISTORY_PUBLISHED_V204_V324,
    previousProofSha256: SOURCE_HISTORY_PROOF_V323_SHA_V324, captureToolSha256: SOURCE_HISTORY_CAPTURE_SHA_V324,
    additions: { [addition]: sha(added) }, changes: { [path]: inverse(before, current) } };
  return { path, retained, addition, before, current, oldPublic, added, published, files, receipt,
    inventory: Object.keys(files), read: (p: string) => Buffer.from(files[p]) };
}

test("finite324 inverses compose current205 to published204 and immutable323 to203 without graph duplication", () => {
  const f = fixture(), layer = verifySourceLayerV324(f.receipt, f.published, f.inventory, f.read);
  expect(Object.keys(f.receipt)).not.toContain("currentGraph");
  expect(Object.keys(f.receipt)).not.toContain("publishedGraph");
  expect(layer.publishedGraph).toEqual(f.published);
  expect(Object.keys(layer.currentGraph).sort()).toEqual(f.inventory.sort());
  const raw204 = sourceAtPublished204V324(f.path, f.read(f.path), layer);
  expect(Buffer.from(raw204).toString()).toBe(f.before);
  expect(sourceAtPublished204V324(f.retained, f.read(f.retained), layer)).toEqual(f.read(f.retained));
  expect(projectSourceBeforeV324(f.current, layer)).toBe(f.before);
  const before203 = f.before.replace("204", "203");
  const old: SourceReceiptV323 = { schemaVersion: 1, publishedCommit: SOURCE_HISTORY_PUBLISHED_V203_V323,
    previousProofSha256: SOURCE_HISTORY_PROOF_V322_SHA_V323, captureToolSha256: SOURCE_HISTORY_CAPTURE_SHA_V323,
    additions: {}, changes: { [f.path]: inverse(before203, f.before) } };
  const oldLayer = verifySourceLayerV323(old, { ...f.published, [f.path]: sha(before203) }, Object.keys(f.published),
    path => sourceAtPublished204V324(path, f.read(path), layer));
  expect(Buffer.from(sourceAtPublished203V323(f.path, raw204, oldLayer)).toString()).toBe(before203);
  expect(projectSourceBeforeV323(projectSourceBeforeV324(f.current, layer), oldLayer)).toBe(before203);
  expect(Object.isFrozen(layer)).toBeTrue();
  expect(Object.isFrozen(layer.currentGraph)).toBeTrue();
  expect(Object.isFrozen(f.receipt.changes[f.path].replacements[0])).toBeTrue();
});

test("the new inverse treats source replacement metacharacters as literal bytes", () => {
  const f = fixture();
  f.before = "export const literal = '$& $` $\u0027 $$';\n";
  f.published[f.path] = sha(f.before);
  f.receipt.changes[f.path] = inverse(f.before, f.current);
  const layer = verifySourceLayerV324(f.receipt, f.published, f.inventory, f.read);
  expect(Buffer.from(sourceAtPublished204V324(f.path, f.read(f.path), layer)).toString()).toBe(f.before);
  expect(projectSourceBeforeV324(f.current, layer)).toBe(f.before);
});

test("every retained and added source and the complete inverse complement is required", () => {
  for (const key of ["path", "retained", "addition"] as const) {
    const f = fixture(); f.files[f[key]] += " ";
    expect(() => verifySourceLayerV324(f.receipt, f.published, f.inventory, f.read)).toThrow("Changed complete v324 source graph");
  }
  const outside = fixture(); outside.receipt.changes[outside.path].replacements[0].before = "export const version = 204;\n";
  expect(() => verifySourceLayerV324(outside.receipt, outside.published, outside.inventory, outside.read)).toThrow("Changed full v324 source complement");
  const missing = fixture(); delete missing.receipt.changes[missing.path];
  expect(() => verifySourceLayerV324(missing.receipt, missing.published, missing.inventory, missing.read)).toThrow("Changed complete");
  const old = fixture(); old.receipt.changes[old.path].beforeSha256 = sha("different old source");
  expect(() => verifySourceLayerV324(old.receipt, old.published, old.inventory, old.read)).toThrow("Invalid bounded");
});

test("unknown, missing and duplicate inventory, unsafe paths and unproved additions fail closed", () => {
  const unknown = fixture(); unknown.inventory.push("src/app/src/Unknown.ts");
  expect(() => verifySourceLayerV324(unknown.receipt, unknown.published, unknown.inventory, unknown.read)).toThrow("source inventory");
  const missing = fixture(); missing.inventory = missing.inventory.filter(p => p !== missing.retained);
  expect(() => verifySourceLayerV324(missing.receipt, missing.published, missing.inventory, missing.read)).toThrow("source inventory");
  const duplicate = fixture(); duplicate.inventory.push(duplicate.path);
  expect(() => verifySourceLayerV324(duplicate.receipt, duplicate.published, duplicate.inventory, duplicate.read)).toThrow("source inventory");
  const undeclared = fixture(); undeclared.receipt.additions = {};
  expect(() => verifySourceLayerV324(undeclared.receipt, undeclared.published, undeclared.inventory, undeclared.read)).toThrow("source inventory");
  const old = fixture(); old.receipt.additions[old.path] = sha(old.current);
  expect(() => verifySourceLayerV324(old.receipt, old.published, old.inventory, old.read)).toThrow("duplicate v324 source addition");
  const escaped = fixture(); escaped.receipt.additions["src/app/src/../Escape.ts"] = sha("foreign");
  expect(() => verifySourceLayerV324(escaped.receipt, escaped.published, escaped.inventory, escaped.read)).toThrow("Invalid or duplicate");
  const digest = fixture(); digest.receipt.additions[digest.addition] = "foreign";
  expect(() => verifySourceLayerV324(digest.receipt, digest.published, digest.inventory, digest.read)).toThrow("Invalid or duplicate");
  const extra = fixture(); (extra.receipt as unknown as Record<string, unknown>).waiver = true;
  expect(() => verifySourceLayerV324(extra.receipt, extra.published, extra.inventory, extra.read)).toThrow("Unknown immutable");
});

test("only exact privately verified layers project supplied bytes; clones and ambiguous inverses cannot", () => {
  const f = fixture(), layer = verifySourceLayerV324(f.receipt, f.published, f.inventory, f.read), copied = structuredClone(layer);
  for (const p of [f.addition, "src/app/src/Foreign.ts"]) expect(() => sourceAtPublished204V324(p, f.read(f.path), layer)).toThrow("Unknown exact");
  for (const text of [f.before, f.current + " "]) expect(() => sourceAtPublished204V324(f.path, Buffer.from(text), layer)).toThrow("Unknown exact");
  expect(() => sourceAtPublished204V324(f.path, f.read(f.path), copied)).toThrow("Unknown exact");
  expect(() => projectSourceBeforeV324(f.current, copied)).toThrow("Unverified");
  expect(projectSourceBeforeV324(f.current + " ", layer)).toBe(f.current + " ");
  const ambiguous = fixture(); ambiguous.receipt.changes[ambiguous.path].replacements[0].current = "e";
  expect(() => verifySourceLayerV324(ambiguous.receipt, ambiguous.published, ambiguous.inventory, ambiguous.read)).toThrow("Ambiguous exact");
  const empty = fixture(); empty.receipt.changes[empty.path].replacements = [];
  expect(() => verifySourceLayerV324(empty.receipt, empty.published, empty.inventory, empty.read)).toThrow("Invalid bounded");
  const extra = fixture(); (extra.receipt.changes[extra.path].replacements[0] as unknown as Record<string, unknown>).hidden = {};
  expect(() => verifySourceLayerV324(extra.receipt, extra.published, extra.inventory, extra.read)).toThrow("Invalid bounded");
  for (const duplicate of ["addition", "retained"] as const) {
    const d = fixture(); d.files[d[duplicate]] = d.current;
    if (duplicate === "addition") d.receipt.additions[d.addition] = sha(d.current);
    else d.published[d.retained] = sha(d.current);
    const admitted = verifySourceLayerV324(d.receipt, d.published, d.inventory, d.read);
    expect(() => projectSourceBeforeV324(d.current, admitted)).toThrow("Ambiguous full");
  }
});

test("immutable318/319/320/321/322/323 checkpoints reconstruct all 1996 published204 paths", () => {
  for (const key of ["publishedCommit", "previousProofSha256", "captureToolSha256"] as const) {
    const f = fixture(); f.receipt[key] = "0".repeat(64);
    expect(() => verifySourceLayerV324(f.receipt, f.published, f.inventory, f.read)).toThrow("Unknown immutable");
  }
  const raws = [318, 319, 320, 321, 322, 323].map(version => readFileSync(new URL(`./fixtures/source-history-v${version}.json`, import.meta.url)));
  expect(sha(raws[5])).toBe(SOURCE_HISTORY_PROOF_V323_SHA_V324);
  const graph = published204SourceGraphV324(raws[0], raws[1], raws[2], raws[3], raws[4], raws[5]), delta = JSON.parse(raws[5].toString());
  expect(Object.keys(graph)).toHaveLength(1996);
  expect(Object.isFrozen(graph)).toBeTrue();
  for (const [path, digest] of Object.entries(delta.additions)) expect(graph[path]).toBe(digest);
  for (const [path, value] of Object.entries(delta.changes) as [string, { currentSha256: string }][]) expect(graph[path]).toBe(value.currentSha256);
  for (let i = 0; i < raws.length; i++) {
    const changed = [...raws]; changed[i] = Buffer.concat([changed[i], Buffer.from(" ")]);
    expect(() => published204SourceGraphV324(changed[0], changed[1], changed[2], changed[3], changed[4], changed[5])).toThrow("Changed immutable");
  }
  expect(sha(readFileSync(new URL("./fixtures/source-history-v306.json", import.meta.url)))).toBe("4a2bad690d9465ab3e03f5915ba015b85c160b9a2de358c7eba1e08d5c1b719b");
  expect(sha(readFileSync(new URL("./fixtures/source-history-v311.json", import.meta.url)))).toBe("b622ff4a4e972fb658a88add88155e6c6d5f8bcd267bb8c076e8c232601bddc5");
});

test("the complete reconstructed 204 inventory and every original blob match independent Git204 bytes", async () => {
  const raws = [318, 319, 320, 321, 322, 323].map(version => readFileSync(new URL(`./fixtures/source-history-v${version}.json`, import.meta.url)));
  const graph = published204SourceGraphV324(raws[0], raws[1], raws[2], raws[3], raws[4], raws[5]);
  const paths = Object.keys(graph).sort(), cwd = new URL("../../..", import.meta.url);
  const tree = execFileSync("git", ["ls-tree", "-r", "--name-only", SOURCE_HISTORY_PUBLISHED_V204_V324, "--", "src/app/src"], { cwd, encoding: "utf8" })
    .trim().split("\n").filter(path => /\.(?:ts|tsx|json)$/.test(path)).sort();
  expect(tree).toEqual(paths.filter(path => path.startsWith("src/app/src/")));
  expect(sha(JSON.stringify(Object.fromEntries(paths.map(path => [path, graph[path]])))))
    .toBe("d066238273379823b853aae3dd610369a36e57b5763613850922a3e4023294c0");

  // One bounded stream hashes the blobs without retaining a full source graph
  // of bytes or launching one subprocess per source. No workspace bytes enter
  // this independent published-history check.
  const process = spawn("git", ["cat-file", "--batch"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
  const closed = new Promise<number | null>((resolve, reject) => {
    process.once("error", reject); process.once("close", code => resolve(code));
  });
  let stderr = "";
  process.stderr.on("data", chunk => { stderr += chunk.toString(); });
  process.stdin.end(paths.map(path => `${SOURCE_HISTORY_PUBLISHED_V204_V324}:${path}\n`).join(""));
  let pending = Buffer.alloc(0), remaining: number | null = null, index = 0;
  let digest: ReturnType<typeof createHash> | null = null;
  try {
    for await (const chunk of process.stdout) {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      for (;;) {
        if (remaining === null) {
          const newline = pending.indexOf(10); if (newline < 0) break;
          const header = pending.subarray(0, newline).toString("utf8").split(" ");
          expect(header).toHaveLength(3); expect(header[1]).toBe("blob");
          remaining = Number(header[2]);
          expect(Number.isSafeInteger(remaining) && remaining >= 0 && index < paths.length).toBeTrue();
          digest = createHash("sha256"); pending = pending.subarray(newline + 1);
        }
        const length = Math.min(remaining, pending.length);
        digest!.update(pending.subarray(0, length)); pending = pending.subarray(length); remaining -= length;
        if (remaining || !pending.length) break;
        expect(pending[0]).toBe(10); pending = pending.subarray(1);
        expect(digest!.digest("hex")).toBe(graph[paths[index++]]);
        digest = null; remaining = null;
      }
    }
    expect(await closed).toBe(0); expect(stderr).toBe("");
    expect(index).toBe(1996); expect(remaining).toBeNull(); expect(pending.length).toBe(0);
  } finally {
    process.stdin.destroy(); process.stdout.destroy(); process.stderr.destroy();
    if (process.exitCode === null) process.kill();
  }
}, 30000);

test("the frozen actual205 default layer proves every current byte and composes all published204/203 bytes", () => {
  const raw = readFileSync(new URL("./fixtures/source-history-v324.json", import.meta.url));
  expect(raw.byteLength).toBe(43398);
  expect(sha(raw)).toBe("a06b9868dcad2aea02dee8b082640163565a10a1604d84039a3c89cab4620c03");
  const layer = assertSourceLayerV324(), previous = assertSourceLayerV323();
  expect(Object.keys(layer.currentGraph)).toHaveLength(2006); expect(Object.keys(layer.publishedGraph)).toHaveLength(1996);
  expect(Object.keys(layer.receipt.additions)).toHaveLength(10); expect(Object.keys(layer.receipt.changes)).toHaveLength(7);
  expect(Object.keys(previous.currentGraph)).toHaveLength(1996); expect(Object.keys(previous.publishedGraph)).toHaveLength(1990);
  const sorted = Object.fromEntries(Object.keys(layer.currentGraph).sort().map(path => [path, layer.currentGraph[path]]));
  expect(sha(JSON.stringify(sorted))).toBe("ebd56fa35066008ecc35ae28a262a334d77b09bb0107e48e7546c8b6e1e59876");
  const root = new URL("../../..", import.meta.url);
  for (const path of Object.keys(layer.currentGraph)) {
    const current = readFileSync(new URL(path, root)); expect(sha(sourceAtPublished205V325(path, current))).toBe(layer.currentGraph[path]);
    if (Object.hasOwn(layer.receipt.additions, path)) {
      expect(() => sourceAtPublished204V324(path, current)).toThrow("Unknown exact");
      continue;
    }
    const old204 = sourceAtPublished204V324(path, current);
    expect(sha(old204)).toBe(layer.publishedGraph[path]); expect(sha(old204)).toBe(previous.currentGraph[path]);
    if (Object.hasOwn(previous.publishedGraph, path)) expect(sha(sourceAtPublished203V323(path, current))).toBe(previous.publishedGraph[path]);
    if (Object.hasOwn(layer.receipt.changes, path)) {
      expect(projectSourceBeforeV324(current.toString())).toBe(Buffer.from(old204).toString());
      expect(projectSourceBeforeV323(current.toString())).toBe(Buffer.from(sourceAtPublished203V323(path, current)).toString());
    }
  }
}, 30000);

test("only V323 adapter entrypoints change and the complete history import graph remains acyclic", () => {
  const file = "src/app/tests/helpers/sourceHistoryV323.ts";
  const before = execFileSync("git", ["show", `${SOURCE_HISTORY_PUBLISHED_V204_V324}:${file}`],
    { cwd: new URL("../../..", import.meta.url), encoding: "utf8" });
  const current = readFileSync(new URL("./helpers/sourceHistoryV323.ts", import.meta.url), "utf8");
  const unchanged = (source: string) => {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    return ast.statements.filter(node => !(ts.isImportDeclaration(node)) && !(ts.isFunctionDeclaration(node)
      && ["assertSourceLayerV323", "sourceAtPublished203V323", "projectSourceBeforeV323"].includes(node.name?.text ?? "")))
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
  expect(graph.get("sourceHistoryV327.ts")).toEqual(["sourceHistoryV328.ts"]);expect(graph.get("sourceHistoryV328.ts")).toEqual(["sourceHistoryV329.ts"]);expect(graph.get("sourceHistoryV329.ts")).toEqual(["sourceHistoryV330.ts"]);expect(graph.get("sourceHistoryV330.ts")).toEqual(["sourceHistoryV331.ts"]);expect(graph.get("sourceHistoryV331.ts")).toEqual(["sourceHistoryV332.ts"]);expect(graph.get("sourceHistoryV332.ts")).toEqual(["sourceHistoryV333.ts"]);expect(graph.get("sourceHistoryV333.ts")).toEqual(["sourceHistoryV334.ts"]);expect(graph.get("sourceHistoryV334.ts")).toEqual(["sourceHistoryV335.ts"]);expect(graph.get("sourceHistoryV335.ts")).toEqual([]);
  expect(graph.get("sourceHistoryV326.ts")).toEqual(["sourceHistoryV327.ts"]);
  expect(graph.get("sourceHistoryV325.ts")).toEqual(["sourceHistoryV326.ts"]);
  expect(graph.get("sourceHistoryV324.ts")).toEqual(["sourceHistoryV325.ts"]);
  expect(graph.get("sourceHistoryV323.ts")).toEqual(["sourceHistoryV324.ts"]);
});
