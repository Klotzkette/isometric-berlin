import { expect, test } from "bun:test";
import { InterleavedBufferAttribute, LineSegments, Mesh } from "three";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

const encode = (array: Uint8Array | Uint16Array | Uint32Array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64");

for (const nativeDecoder of [false, true]) {
  test(`bounded direct decoding preserves every source value across slice boundaries (${nativeDecoder ? "native" : "older browser"})`, () => {
    const count = 70_002;
    const positions = Uint16Array.from({ length: count * 3 }, (_, i) => i * 197 % 65_536);
    const colors = Uint8Array.from({ length: count * 3 }, (_, i) => i % 256);
    const indices = Uint32Array.from({ length: count }, (_, i) => count - i - 1);
    const chunk: SurroundingCityChunk = {
      schemaVersion: 1, origin: [512, -10, -1024],
      meshes: [{ kind: "building", positionType: "u16cm", positions: encode(positions),
        colors: encode(colors), indices: encode(indices) }],
      lines: { positions: encode(positions), colors: encode(colors) },
      nav: { groundY: 3, ground: [], buildings: [], water: [] },
    };
    const realUint8 = Uint8Array;
    const descriptor = Object.getOwnPropertyDescriptor(realUint8, "fromBase64");
    const scratchLengths: number[] = [];
    const decoderLengths: number[] = [];
    const trackedUint8 = new Proxy(realUint8, {
      construct(target, args) {
        if (typeof args[0] === "number") scratchLengths.push(args[0]);
        return Reflect.construct(target, args);
      },
    });
    Object.defineProperty(realUint8, "fromBase64", { configurable: true,
      value: nativeDecoder ? (text: string) => {
        decoderLengths.push(text.length);
        return new realUint8(Buffer.from(text, "base64"));
      } : undefined });
    globalThis.Uint8Array = trackedUint8;
    try {
      const built = createSurroundingCityChunk(chunk, "bounded exact bytes");
      try {
        for (const object of built.root.children as (Mesh | LineSegments)[]) {
          const position = object.geometry.getAttribute("position") as InterleavedBufferAttribute;
          const actual = position.data.array as Uint16Array;
          const expected = new Uint16Array(count * 6);
          for (let i = 0; i < count; i++) for (let j = 0; j < 3; j++) {
            expected[i * 6 + j] = positions[i * 3 + j];
            expected[i * 6 + j + 3] = colors[i * 3 + j] * 257;
          }
          expect(actual).toEqual(expected);
          if (object instanceof Mesh) expect(object.geometry.index!.array).toEqual(indices);
        }
        expect(built.nav).toBe(chunk.nav);
        expect(Math.max(0, ...scratchLengths)).toBeLessThanOrEqual(49_152);
        if (nativeDecoder) {
          expect(decoderLengths.length).toBeGreaterThan(10);
          expect(Math.max(...decoderLengths)).toBeLessThanOrEqual(65_536);
          expect(scratchLengths).toHaveLength(0);
        } else expect(scratchLengths.length).toBeGreaterThan(10);
      } finally { disposeSurroundingCityRoot(built.root); }
    } finally {
      globalThis.Uint8Array = realUint8;
      if (descriptor) Object.defineProperty(realUint8, "fromBase64", descriptor);
      else Reflect.deleteProperty(realUint8, "fromBase64");
    }
  });
}
