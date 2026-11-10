import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import {
  projectSourceBeforeV332,
  SOURCE_HISTORY_PROOF_SHA_V332,
  sourceAtPublished213V332,
} from "./helpers/sourceHistoryV332";

const root = new URL("../../..", import.meta.url);
const fixture = (version: number) => readFileSync(new URL(`./fixtures/source-history-v${version}.json`, import.meta.url));
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const published = "bad399196ffccf13192d06d6daba5c9d4c51a7d3";

test("the finite v332 chain preserves the published v213 complements and rejects new or changed bytes", () => {
  const raw = fixture(332), receipt = JSON.parse(raw.toString("utf8"));
  expect(sha(raw)).toBe(SOURCE_HISTORY_PROOF_SHA_V332);
  expect(receipt.publishedCommit).toBe(published);
  expect(receipt.previousProofSha256).toBe(sha(fixture(331)));
  expect(Object.keys(receipt.additions)).toEqual([
    "src/app/src/NaunynSpaetiV332.ts",
    "src/app/src/PublicAmenitiesV332.ts",
    "src/app/src/PublicAmenityFurnitureV332.ts",
    "src/app/src/PublicRecreationFurnitureV332.ts",
    "src/app/src/data/publicAmenitiesV332.json",
  ]);
  expect(Object.keys(receipt.changes)).toEqual([
    "src/app/src/App.tsx",
    "src/app/src/SourcesDialog.tsx",
    "src/app/src/SurroundingCity.ts",
    "src/app/src/ThreeViewer.tsx",
    "src/app/src/startupView.ts",
  ]);

  assertSourceLayerV326();
  for (const path of Object.keys(receipt.changes)) {
    const current = readFileSync(new URL(path, root));
    const original = execFileSync("git", ["show", `${published}:${path}`], { cwd: fileURLToPath(root) });
    expect(Buffer.from(sourceAtPublished213V332(path, current)).equals(original)).toBeTrue();
    expect(projectSourceBeforeV332(current.toString("utf8"))).toBe(original.toString("utf8"));
    expect(() => sourceAtPublished213V332(path, Buffer.concat([current, Buffer.from(" ")])))
      .toThrow("Unknown exact v335 source bytes");
  }
  for (const path of Object.keys(receipt.additions)) {
    const current = readFileSync(new URL(path, root));
    expect(sha(current)).toBe(receipt.additions[path]);
    expect(() => sourceAtPublished213V332(path, current)).toThrow("Unknown exact v332 source bytes");
  }
}, 30_000);
