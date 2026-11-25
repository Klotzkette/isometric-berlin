import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { sourceHistoryV385 } from "./helpers/sourceHistoryV385";

const root = new URL("../../..", import.meta.url);
const base = "4863cd5fc0ef1d48941ec4bd37f207afe90955fa";
const digest = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const fixture = (name: string) => readFileSync(new URL(`./fixtures/source-history-${name}.json`, import.meta.url));
const current = (path: string) => readFileSync(new URL(path, root));
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const receipt = JSON.parse(fixture("v385").toString()) as {
  changes: Record<string, { before: string; after: string }>;
  additions: Record<string, string>;
  sources: Record<string, { before: string | null; after: string }>;
};

test("each v385 change restores the exact v1.0.264 Git blob and rejects unknown input", () => {
  for (const [path, entry] of Object.entries(receipt.changes)) {
    const before = git("show", `${base}:${path}`);
    const after = current(path);
    expect(digest(before)).toBe(entry.before);
    expect(digest(after)).toBe(entry.after);
    expect(Buffer.from(sourceHistoryV385.restore(path, after)).equals(before)).toBeTrue();
    expect(sourceHistoryV385.restore(path, before)).toBe(before);
    expect(sourceHistoryV385.project(after.toString())).toBe(before.toString());
    expect(() => sourceHistoryV385.restore(path, Buffer.concat([after, Buffer.from(" ")]))).toThrow(`Unknown exact v385 source bytes: ${path}`);
  }
  for (const [path, hash] of Object.entries(receipt.additions)) {
    expect(git("ls-tree", "--name-only", base, "--", path).length).toBe(0);
    expect(sourceHistoryV385.isAddition(path)).toBeTrue();
    expect(digest(current(path))).toBe(hash);
  }
});

test("the published Schöneberg proof and all its sources reconstruct unchanged", () => {
  const historical = fixture("v384");
  expect(digest(historical)).toBe("f395636525aa3e7681ca2d44210ff9f848f06b39e5a33d72a54675e3304c0ff5");
  const previous = JSON.parse(historical.toString()) as { changes: Record<string, { after: string }> };
  for (const [path, { after }] of Object.entries(previous.changes)) {
    expect(digest(sourceHistoryV385.restore(path, current(path)))).toBe(after);
  }
});

test("Potsdamer Platz generators and archived source data match the documented inputs", () => {
  for (const [path, entry] of Object.entries(receipt.sources)) {
    if (entry.before === null) expect(git("ls-tree", "--name-only", base, "--", path).length).toBe(0);
    else expect(digest(git("show", `${base}:${path}`))).toBe(entry.before);
    expect(digest(current(path))).toBe(entry.after);
  }
});
