import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import proof from "./fixtures/source-history-v390.json";
import { sourceHistoryV390 } from "./helpers/sourceHistoryV390";
import { expectedExactSourceRejection } from "./helpers/expectedExactSourceRejection";

const repository = new URL("../../..", import.meta.url);
const baseline = "73c7aa3f2b463a5efce9968ab3e21b247b3d9fb7";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("the Moabit and streaming update restores each changed source to its v1.0.269 Git blob", () => {
  for (const [path, hashes] of Object.entries(proof.changes)) {
    const current = readFileSync(new URL(path, repository));
    const previous = execFileSync("git", ["show", baseline + ":" + path], { cwd: repository, maxBuffer: 32 * 1024 * 1024 });
    expect(digest(current)).toBe(hashes.after);
    expect(digest(previous)).toBe(hashes.before);
    expect(Buffer.from(sourceHistoryV390.restore(path, current))).toEqual(previous);
    expect(() => sourceHistoryV390.restore(path, Buffer.concat([current, Buffer.from(" ")]))).toThrow(expectedExactSourceRejection(path));
  }
  for (const [path, hash] of Object.entries(proof.additions)) {
    expect(digest(readFileSync(new URL(path, repository)))).toBe(hash);
    expect(sourceHistoryV390.isAddition(path)).toBeTrue();
    expect(execFileSync("git", ["ls-tree", "--name-only", baseline, "--", path], { cwd: repository }).length).toBe(0);
  }
});
