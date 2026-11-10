import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertSourceLayerV326 } from "./helpers/sourceHistoryV326";
import {
  projectSourceBeforeV334,
  SOURCE_HISTORY_PROOF_SHA_V334,
  sourceAtPublished215V334,
} from "./helpers/sourceHistoryV334";

const root = new URL("../../..", import.meta.url);
const fixture = (version: number) => readFileSync(new URL(`./fixtures/source-history-v${version}.json`, import.meta.url));
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const published = "cb3446e69768ca1aad0f9eaeeb42a84dda2ea6e1";

test("the finite v334 chain preserves the published v215 complements and rejects new or changed bytes", () => {
  const raw = fixture(334), receipt = JSON.parse(raw.toString("utf8"));
  expect(sha(raw)).toBe(SOURCE_HISTORY_PROOF_SHA_V334);
  expect(receipt.publishedCommit).toBe(published);
  expect(receipt.previousProofSha256).toBe(sha(fixture(333)));
  expect(Object.keys(receipt.additions)).toEqual([
    "src/app/public/mesh/regierungsviertel/bus-stops-v334.json.gz",
    "src/app/src/BusStopsV334.ts",
    "src/app/src/RailAccessV334.ts",
    "src/app/src/data/busStopsV334Receipt.json",
    "src/app/src/data/katzengrabenV334.json",
    "src/app/src/data/namedElevatedStationsV334.json",
    "src/app/src/data/railAccessV334.json"
  ]);
  expect(Object.keys(receipt.changes)).toEqual([
    "src/app/losslessBase85SourcesV263.ts",
    "src/app/losslessJsonData.ts",
    "src/app/package.json",
    "src/app/src/SourcesDialog.tsx",
    "src/app/src/SurroundingCity.ts",
    "src/app/src/SurroundingCityGeometry.ts",
    "src/app/src/ThreeViewer.tsx",
    "src/app/src/namedSiteReplacementsV238.ts",
    "src/app/src/startupView.ts"
  ]);

  assertSourceLayerV326();
  for (const path of Object.keys(receipt.changes)) {
    const current = readFileSync(new URL(path, root));
    const original = execFileSync("git", ["show", `${published}:${path}`], { cwd: fileURLToPath(root) });
    expect(Buffer.from(sourceAtPublished215V334(path, current)).equals(original)).toBeTrue();
    expect(projectSourceBeforeV334(current.toString("utf8"))).toBe(original.toString("utf8"));
    expect(() => sourceAtPublished215V334(path, Buffer.concat([current, Buffer.from(" ")])))
      .toThrow("Unknown exact v335 source bytes");
  }
  for (const path of Object.keys(receipt.additions)) {
    const current = readFileSync(new URL(path, root));
    expect(sha(current)).toBe(receipt.additions[path]);
    expect(() => sourceAtPublished215V334(path, current)).toThrow("Unknown exact v334 source bytes");
  }
}, 30_000);
