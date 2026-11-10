import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import {
  projectSourceBeforeV333,
  SOURCE_HISTORY_PROOF_SHA_V333,
  sourceAtPublished214V333,
} from "./helpers/sourceHistoryV333";

const root = new URL("../../..", import.meta.url);
const fixture = (version: number) => readFileSync(new URL(`./fixtures/source-history-v${version}.json`, import.meta.url));
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const published = "4ba7d79fe50303b4cbbea752efdca751ffa59e49";

test("the finite v333 chain preserves the published v214 complements and rejects new or changed bytes", () => {
  const raw = fixture(333), receipt = JSON.parse(raw.toString("utf8"));
  expect(sha(raw)).toBe(SOURCE_HISTORY_PROOF_SHA_V333);
  expect(receipt.publishedCommit).toBe(published);
  expect(receipt.previousProofSha256).toBe(sha(fixture(332)));
  expect(Object.keys(receipt.additions)).toEqual([
    "src/app/src/CharlottenburgCourtV333.ts",
    "src/app/src/WeddingCourtV333.ts"
  ]);
  expect(Object.keys(receipt.changes)).toEqual([
    "src/app/src/CourtsParkV293.ts",
    "src/app/src/DistrictCourtsV229.ts",
    "src/app/src/MinecraftVoxelWorld.ts",
    "src/app/src/RequiredFidelityV288.ts",
    "src/app/src/RequiredSiteEnvelopesV209.ts",
    "src/app/src/SourcesDialog.tsx",
    "src/app/src/ThreeViewer.tsx",
    "src/app/src/startupView.ts"
  ]);

  assertSourceLayerV326();
  for (const path of Object.keys(receipt.changes)) {
    const current = readFileSync(new URL(path, root));
    const original = execFileSync("git", ["show", `${published}:${path}`], { cwd: fileURLToPath(root) });
    expect(Buffer.from(sourceAtPublished214V333(path, current)).equals(original)).toBeTrue();
    expect(projectSourceBeforeV333(current.toString("utf8"))).toBe(original.toString("utf8"));
    expect(() => sourceAtPublished214V333(path, Buffer.concat([current, Buffer.from(" ")])))
      .toThrow("Unknown exact v335 source bytes");
  }
  for (const path of Object.keys(receipt.additions)) {
    const current = readFileSync(new URL(path, root));
    expect(sha(current)).toBe(receipt.additions[path]);
    expect(() => sourceAtPublished214V333(path, current)).toThrow("Unknown exact v333 source bytes");
  }
}, 30_000);
