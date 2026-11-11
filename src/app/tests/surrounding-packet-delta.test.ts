import { expect, test } from "bun:test";
import { restoreSurroundingPacketDelta } from "../src/SurroundingPacketDelta";

function fixture() {
  // Successive X coordinates decrease while the Y and Z predictors increase.
  const encodedPositions = "~12:" + Buffer.from([2, 4, 6, 1, 2, 2]).toString("base64");
  const encodedIndices = "~20:" + Buffer.from([1, 2, 0, 2, 1]).toString("base64");
  const positions = Buffer.from([1, 0, 2, 0, 3, 0, 0, 0, 3, 0, 4, 0]).toString("base64");
  const indexBytes = Buffer.alloc(20);
  indexBytes.writeUInt32LE(0xffffffff, 0);
  indexBytes.writeUInt32LE(1, 12);
  const indices = indexBytes.toString("base64");
  const packed = {
    meshes: [{ positionType: "u16cm", positions: encodedPositions, indices: encodedIndices, colors: "source" }],
    nav: { origin: [-0, 0, 0] },
  };
  const original = {
    meshes: [{ ...packed.meshes[0], positions, indices }],
    nav: packed.nav,
  };
  const expansion = JSON.stringify(original).length - JSON.stringify(packed).length;
  return { packed, original, expansion };
}

test("restores the source strings before the rest of the tile is consumed", async () => {
  const { packed, original, expansion } = fixture();
  expect(await restoreSurroundingPacketDelta(packed, expansion, new AbortController().signal)).toEqual(original);
  expect(Object.is(packed.nav.origin[0], -0)).toBeTrue();
});

test("rejects an incorrect size, malformed varint and cancelled packet", async () => {
  const signal = new AbortController().signal;
  const short = fixture();
  await expect(restoreSurroundingPacketDelta(short.packed, short.expansion - 1, signal)).rejects.toThrow();
  const corrupt = fixture();
  corrupt.packed.meshes[0].positions = "~12:" + Buffer.from([2, 4, 6, 1, 2, 130]).toString("base64");
  await expect(restoreSurroundingPacketDelta(corrupt.packed, corrupt.expansion, signal)).rejects.toThrow("Incomplete");
  const cancelled = fixture();
  await expect(restoreSurroundingPacketDelta(cancelled.packed, cancelled.expansion, AbortSignal.abort()))
    .rejects.toHaveProperty("name", "AbortError");
});
