import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import {
  projectSourceBeforeV335,
  SOURCE_HISTORY_PROOF_SHA_V335,
  sourceAtPublished216V335,
} from "./helpers/sourceHistoryV335";

const root = new URL("../../..", import.meta.url);
const fixture = (version: number) => readFileSync(new URL(`./fixtures/source-history-v${version}.json`, import.meta.url));
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const published = "4385dbad98de73af1605001f65e452425d34e49c";

test("the viewer routing change preserves exact v216 source bytes and rejects unknown inputs", () => {
  const raw = fixture(335);
  const receipt = JSON.parse(raw.toString("utf8"));
  const path = "src/app/src/SurroundingCity.ts";
  expect(sha(raw)).toBe(SOURCE_HISTORY_PROOF_SHA_V335);
  expect(receipt.publishedCommit).toBe(published);
  expect(receipt.previousProofSha256).toBe(sha(fixture(334)));
  expect(Object.keys(receipt.additions)).toEqual([]);
  expect(Object.keys(receipt.changes)).toEqual([path]);

  assertSourceLayerV326();
  const current = readFileSync(new URL(path, root));
  const original = execFileSync("git", ["show", `${published}:${path}`], { cwd: fileURLToPath(root) });
  expect(Buffer.from(sourceAtPublished216V335(path, current)).equals(original)).toBeTrue();
  expect(projectSourceBeforeV335(current.toString("utf8"))).toBe(original.toString("utf8"));
  expect(() => sourceAtPublished216V335(path, Buffer.concat([current, Buffer.from(" ")])))
    .toThrow("Unknown exact v335 source bytes");
  expect(() => sourceAtPublished216V335("src/app/src/Unknown.ts", current))
    .toThrow("Unknown exact v335 source bytes");
}, 30_000);
