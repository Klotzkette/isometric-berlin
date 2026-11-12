import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { published206SourceGraphV326 } from "./helpers/sourceHistoryV326";
import {
  assertSourceLayerV336,
  projectSourceBeforeV336,
  SOURCE_HISTORY_PROOF_SHA_V336,
  sourceAtBeforeV336,
} from "./helpers/sourceHistoryV336";

const root = new URL("../../..", import.meta.url);
const fixture = (version: number) => readFileSync(new URL(`./fixtures/source-history-v${version}.json`, import.meta.url));
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const previous = "d299176316d230be97f80b7cc24b80a1425110d8";

test("the public packet transport delta recovers the exact previous source", () => {
  const raw = fixture(336);
  const receipt = JSON.parse(raw.toString("utf8"));
  const path = "src/app/src/SurroundingCity.ts";
  const added = "src/app/src/SurroundingPacketDelta.ts";
  expect(sha(raw)).toBe(SOURCE_HISTORY_PROOF_SHA_V336);
  expect(receipt.previousCommit).toBe(previous);
  expect(receipt.previousProofSha256).toBe(sha(fixture(335)));
  expect(Object.keys(receipt.additions)).toEqual([added]);
  expect(Object.keys(receipt.changes)).toEqual([path]);

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
  const current = readFileSync(new URL(path, root));
  const original = execFileSync("git", ["show", `${previous}:${path}`], { cwd: fileURLToPath(root) });
  expect(Buffer.from(sourceAtBeforeV336(path, current)).equals(original)).toBeTrue();
  expect(projectSourceBeforeV336(current.toString("utf8"))).toBe(original.toString("utf8"));
  expect(() => sourceAtBeforeV336(path, Buffer.concat([current, Buffer.from(" ")])))
    .toThrow(/Unknown exact v33[67] source bytes/);
  expect(() => sourceAtBeforeV336(added, readFileSync(new URL(added, root))))
    .toThrow("Unknown exact v336 source bytes");
}, 30_000);
