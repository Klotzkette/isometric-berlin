import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { published206SourceGraphV326 } from "./helpers/sourceHistoryV326";
import { assertSourceLayerV336, sourceAtBeforeV336 } from "./helpers/sourceHistoryV336";
import {
  projectSourceBeforeV337,
  SOURCE_HISTORY_PROOF_SHA_V337,
  sourceAtBeforeV337,
} from "./helpers/sourceHistoryV337";

const root = new URL("../../..", import.meta.url);
const fixture = (version: number) => readFileSync(new URL(`./fixtures/source-history-v${version}.json`, import.meta.url));
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const previous = "6046c1b19018bda98b3e6f16538c487caab643f1";

test("the public mode exclusion recovers every exact previous source file", () => {
  const raw = fixture(337);
  const receipt = JSON.parse(raw.toString("utf8"));
  const changed = ["App.tsx", "StartupModeSelection.tsx", "ThreeViewer.tsx", "localization.ts", "modeLinks.ts"]
    .map(file => `src/app/src/${file}`);
  expect(sha(raw)).toBe(SOURCE_HISTORY_PROOF_SHA_V337);
  expect(receipt.previousCommit).toBe(previous);
  expect(receipt.previousProofSha256).toBe(sha(fixture(336)));
  expect(Object.keys(receipt.additions)).toEqual([]);
  expect(Object.keys(receipt.changes)).toEqual(changed);

  const graph = { ...published206SourceGraphV326(
    fixture(318), fixture(319), fixture(320), fixture(321),
    fixture(322), fixture(323), fixture(324), fixture(325),
  ) };
  for (let version = 326; version <= 335; version++) {
    const layer = JSON.parse(fixture(version).toString("utf8"));
    Object.assign(graph, layer.additions);
    for (const [source, change] of Object.entries<{ currentSha256: string }>(layer.changes)) {
      graph[source] = change.currentSha256;
    }
  }
  assertSourceLayerV336(graph);
  for (const path of changed) {
    const current = readFileSync(new URL(path, root));
    const original = execFileSync("git", ["show", `${previous}:${path}`], { cwd: fileURLToPath(root) });
    expect(Buffer.from(sourceAtBeforeV337(path, current)).equals(original)).toBeTrue();
    expect(Buffer.from(sourceAtBeforeV336(path, current)).equals(original)).toBeTrue();
    expect(projectSourceBeforeV337(current.toString("utf8"))).toBe(original.toString("utf8"));
    expect(() => sourceAtBeforeV337(path, Buffer.concat([current, Buffer.from(" ")])))
      .toThrow("Unknown exact v337 source bytes");
  }
}, 30_000);
