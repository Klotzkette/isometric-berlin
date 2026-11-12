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

test("distant packets use only the viewer's own directory in either family", () => {
  for (const native of [false, true]) {
    const asset = native ? far.minecraft : far.drawn;
    const expected = new URL(asset.url + "?v=" + digest, manifest);
    expect(surroundingPacketUrl(far, native, manifest).href).toBe(expected.href);
  }
});

test("rejects mirrored and escaping packet paths", () => {
  const input = { schemaVersion: 1, chunks: [far], footprint: [], groundY: 3 };
  expect(validateSurroundingManifest(input)).toBe(input);
  expect(() => validateSurroundingManifest({ ...input, packetMirrorCommit: revision })).toThrow();
  for (const url of ["../tile.json.gz", "%2e%2e/tile.json.gz", "//elsewhere.test/file", " //elsewhere.test/file", "https://elsewhere.test/file"]) {
    const chunk = { ...far, drawn: { ...far.drawn, url } };
    expect(() => validateSurroundingManifest({ ...input, chunks: [chunk] })).toThrow();
    expect(() => surroundingPacketUrl(chunk, false, manifest)).toThrow();
  }
});
