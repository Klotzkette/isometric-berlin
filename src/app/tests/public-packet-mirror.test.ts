import { expect, test } from "bun:test";
import { surroundingPacketUrl, validateSurroundingManifest, type SurroundingChunkDescriptor } from "../src/SurroundingCity";

const manifest = new URL("https://klotzkette.github.io/isometric-berlin/mesh/surrounding-berlin-v159/manifest.json");
const revision = "4385dbad98de73af1605001f65e452425d34e49c";
const digest = "a".repeat(64);
const far: SurroundingChunkDescriptor = {
  id: "outer187--24_15-grunewald-v190-1",
  bounds: [-12288, 7680, -11776, 8192],
  drawn: { url: "grunewald-v190/example.drawn.json.gz", sha256: digest, encoding: "gzip", bytes: 100, decodedBytes: 300 },
  minecraft: { url: "grunewald-v190/example.minecraft.json.gz", sha256: digest, encoding: "gzip", bytes: 100, decodedBytes: 300 },
};

test("only configured distant gzip packets use the pinned GitHub source", () => {
  for (const native of [false, true]) {
    const asset = native ? far.minecraft : far.drawn;
    const expected = `https://raw.githubusercontent.com/Klotzkette/isometric-berlin/${revision}/src/app/public/mesh/surrounding-berlin-v159/${asset.url}?v=${digest}`;
    expect(surroundingPacketUrl(far, native, manifest, revision).href).toBe(expected);
    expect(surroundingPacketUrl(far, native, manifest).origin).toBe(manifest.origin);
    expect(surroundingPacketUrl({ ...far, bounds: [9728, -256, 10240, 256] }, native, manifest, revision).origin).toBe(manifest.origin);
  }
  expect(surroundingPacketUrl({ ...far, bounds: [9744, -256, 10256, 256] }, false, manifest, revision).hostname).toBe("raw.githubusercontent.com");
});

test("manifest admits only relative paths and a full lowercase Git commit", () => {
  const input = { schemaVersion: 1, chunks: [far], footprint: [], groundY: 3, packetMirrorCommit: revision };
  expect(validateSurroundingManifest(input).packetMirrorCommit).toBe(revision);
  expect(() => validateSurroundingManifest({ ...input, packetMirrorCommit: "main" })).toThrow();
  expect(() => validateSurroundingManifest({ ...input, chunks: [{ ...far, drawn: { ...far.drawn, url: "../tile.json.gz" } }] })).toThrow();
  const escaped = { ...far, drawn: { ...far.drawn, url: "%2e%2e/tile.json.gz" } };
  expect(surroundingPacketUrl(escaped, false, manifest, revision).origin).toBe(manifest.origin);
});
