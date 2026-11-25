import { expect, test } from "bun:test";
import { expectedExactSourceRejection } from "./helpers/expectedExactSourceRejection";
import { sourceHistoryV385 } from "./helpers/sourceHistoryV385";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { projectSourceBeforeV384, sourceAtBeforeV384 } from "./helpers/sourceHistoryV384";

const root = new URL("../../..", import.meta.url);
const published = "34cd50153bf3f593f5ce8a3680810b25ae81a7d6";
const receipt = JSON.parse(readFileSync(new URL("./fixtures/source-history-v384.json", import.meta.url), "utf8")) as {
  changes: Record<string, { before: string; after: string }>;
  generators: Record<string, { before: string | null; after: string }>;
};
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const publishedFile = (path: string) => execFileSync("git", ["show", published + ":" + path], { cwd: root });

test("v384 restores each changed viewer source to the exact published v1.0.263 bytes", () => {
  for (const [path, hashes] of Object.entries(receipt.changes)) {
    const latest = readFileSync(new URL(path, root));
    const current = sourceHistoryV385.restore(path, latest);
    const previous = publishedFile(path);
    expect(digest(previous)).toBe(hashes.before);
    expect(digest(current)).toBe(hashes.after);
    expect(Buffer.from(sourceAtBeforeV384(path, current)).equals(previous)).toBe(true);
    expect(sourceAtBeforeV384(path, previous)).toBe(previous);
    expect(projectSourceBeforeV384(latest.toString())).toBe(previous.toString());
    expect(() => sourceAtBeforeV384(path, Buffer.concat([latest, Buffer.from(" ")]))).toThrow(expectedExactSourceRejection(path));
  }
});

test("the v384 view preserves all 98 published v383 source digests", () => {
  const raw = readFileSync(new URL("./fixtures/source-history-v383.json", import.meta.url));
  expect(digest(raw)).toBe("1e98ed54c2a2787ae40bcc9eb31af74bb8f39cc59c7629b84c57a45e65fd1f90");
  const v383 = JSON.parse(raw.toString()) as {
    additions: Record<string, string>;
    changes: Record<string, { after: string }>;
  };
  const hashes = { ...v383.additions };
  for (const [path, entry] of Object.entries(v383.changes)) hashes[path] = entry.after;
  for (const [path, hash] of Object.entries(hashes)) {
    const current = readFileSync(new URL(path, root));
    expect(digest(sourceAtBeforeV384(path, current))).toBe(hash);
  }
});

test("v384 verifies both Schöneberg generators against the published source tree", () => {
  for (const [path, hashes] of Object.entries(receipt.generators)) {
    const listing = execFileSync("git", ["ls-tree", "--name-only", published, "--", path], { cwd: root, encoding: "utf8" });
    if (hashes.before === null) expect(listing).toBe("");
    else {
      expect(listing.trim()).toBe(path);
      expect(digest(publishedFile(path))).toBe(hashes.before);
    }
    expect(digest(readFileSync(new URL(path, root)))).toBe(hashes.after);
  }
});
