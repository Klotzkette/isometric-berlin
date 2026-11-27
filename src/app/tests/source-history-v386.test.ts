import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import proof from "./fixtures/source-history-v386.json";
import { sourceHistoryV386 } from "./helpers/sourceHistoryV386";
import { expectedExactSourceRejection } from "./helpers/expectedExactSourceRejection";

const repository = new URL("../../..", import.meta.url);
const baseline = "81c372bea1e6df2db96074aa2dc5db97f1158b49";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("the mobile viewer restores each changed source to its v1.0.265 Git blob", () => {
  for (const [path, hashes] of Object.entries(proof.changes)) {
    const current = readFileSync(new URL(path, repository));
    const previous = execFileSync("git", ["show", baseline + ":" + path], { cwd: repository, maxBuffer: 32 * 1024 * 1024 });
    expect(digest(current)).toBe(hashes.after);
    expect(digest(previous)).toBe(hashes.before);
    expect(Buffer.from(sourceHistoryV386.restore(path, current))).toEqual(previous);
    expect(() => sourceHistoryV386.restore(path, Buffer.concat([current, Buffer.from(" ")]))).toThrow(expectedExactSourceRejection(path));
  }
  for (const [path, hash] of Object.entries(proof.additions)) {
    expect(digest(readFileSync(new URL(path, repository)))).toBe(hash);
    expect(sourceHistoryV386.isAddition(path)).toBeTrue();
    expect(execFileSync("git", ["ls-tree", "--name-only", baseline, "--", path], { cwd: repository }).length).toBe(0);
  }
});
