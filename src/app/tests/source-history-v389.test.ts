import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import proof from "./fixtures/source-history-v389.json";
import { sourceHistoryV389 } from "./helpers/sourceHistoryV389";
import { sourceHistoryV390 } from "./helpers/sourceHistoryV390";
import { expectedExactSourceRejection } from "./helpers/expectedExactSourceRejection";

const repository = new URL("../../..", import.meta.url);
const baseline = "eb573901a91187c1704b7033e76d408ac6c8e64f";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("the Schwellentraum and Viktoria update restores each changed source to its v1.0.268 Git blob", () => {
  for (const [path, hashes] of Object.entries(proof.changes)) {
    const current = Buffer.from(sourceHistoryV390.restore(path, readFileSync(new URL(path, repository))));
    const previous = execFileSync("git", ["show", baseline + ":" + path], { cwd: repository, maxBuffer: 32 * 1024 * 1024 });
    expect(digest(current)).toBe(hashes.after);
    expect(digest(previous)).toBe(hashes.before);
    expect(Buffer.from(sourceHistoryV389.restore(path, current))).toEqual(previous);
    expect(() => sourceHistoryV389.restore(path, Buffer.concat([current, Buffer.from(" ")]))).toThrow(expectedExactSourceRejection(path));
  }
  for (const [path, hash] of Object.entries(proof.additions)) {
    expect(digest(sourceHistoryV390.restore(path, readFileSync(new URL(path, repository))))).toBe(hash);
    expect(sourceHistoryV389.isAddition(path)).toBeTrue();
    expect(execFileSync("git", ["ls-tree", "--name-only", baseline, "--", path], { cwd: repository }).length).toBe(0);
  }
});
