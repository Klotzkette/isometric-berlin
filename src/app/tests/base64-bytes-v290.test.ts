import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { BufferAttribute, BufferGeometry, Group, Object3D } from "three";
import { gzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "../src/decodeBase64Bytes";
import { decodeLosslessGzipJson } from "../src/losslessGzipJson";
import { decodeLosslessRoofCoordinates } from "../src/losslessRoofCoordinates";
import { createMoabitLandmarksV269 } from "../src/MoabitLandmarksV269";
import { createGolgathaV270 } from "../src/GolgathaV270";
import { createTachelesFrontsV270 } from "../src/TachelesFrontsV270";
import { createAuguststrasseMuralV270 } from "../src/AuguststrasseMuralV270";
import { createPotsdamerCorridorCoreV288 } from "../src/PotsdamerCorridorCoreV288";

type NativeDecoder = (encoded: string) => Uint8Array<ArrayBuffer>;
const nativeDescriptor = Object.getOwnPropertyDescriptor(Uint8Array, "fromBase64");
const nativeDecoder = (Uint8Array as typeof Uint8Array & {
  fromBase64?: NativeDecoder;
}).fromBase64;

function withDecoder<T>(decoder: NativeDecoder | undefined, run: () => T): T {
  Object.defineProperty(Uint8Array, "fromBase64", { value: decoder, configurable: true, writable: true });
  try {
    return run();
  } finally {
    if (nativeDescriptor) Object.defineProperty(Uint8Array, "fromBase64", nativeDescriptor);
    else delete (Uint8Array as { fromBase64?: NativeDecoder }).fromBase64;
  }
}

function previousDecode(encoded: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
}

function hash(bytes: ArrayBufferView): string {
  return createHash("sha256").update(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest("hex");
}

describe("lossless Base64 byte decoding", () => {
  test("native, unavailable and rejecting implementations preserve atob inputs and independent ownership", () => {
    const valid = ["", "Zg==", "Zg", "Zm8=", "Zm8", "Zm9v", "\t Zm\n9v\r ", "Zh==", "/w=="];
    for (const decoder of [nativeDecoder, undefined, () => { throw new SyntaxError("Older decoder"); }]) {
      withDecoder(decoder, () => {
        for (const text of valid) {
          const expected = previousDecode(text), actual = decodeBase64Bytes(text);
          expect(actual).toEqual(expected);
          expect(actual.buffer).toBeInstanceOf(ArrayBuffer);
          expect(actual.byteOffset).toBe(0);
          expect(actual.byteLength).toBe(actual.buffer.byteLength);
          expect(decodeBase64Bytes(text).buffer).not.toBe(actual.buffer);
        }
        for (const text of ["A", "%%%", "a===", "Zg==A", "Zm9v_", "Zg\u00a0=="]) {
          expect(() => previousDecode(text)).toThrow();
          expect(() => decodeBase64Bytes(text)).toThrow();
        }
      });
    }
  });

  test("native success avoids the string decoder and rejection uses its original error", () => {
    const previousAtob = globalThis.atob;
    let fallbackCalls = 0;
    globalThis.atob = text => { fallbackCalls++; return previousAtob(text); };
    try {
      withDecoder(() => new Uint8Array([102]), () => {
        expect(decodeBase64Bytes("Zg==")).toEqual(new Uint8Array([102]));
        expect(fallbackCalls).toBe(0);
      });
      withDecoder(() => { throw new RangeError("native rejection"); }, () => {
        expect(decodeBase64Bytes("Zg")).toEqual(new Uint8Array([102]));
        let previousError: unknown, currentError: unknown;
        try { previousAtob("A"); } catch (error) { previousError = error; }
        try { decodeBase64Bytes("A"); } catch (error) { currentError = error; }
        expect(currentError).toBeInstanceOf((previousError as Error).constructor);
        expect((currentError as Error).message).toBe((previousError as Error).message);
        expect(fallbackCalls).toBe(2);
      });
    } finally {
      globalThis.atob = previousAtob;
    }
  });

  test("raw ArrayBuffer, Float32 and Uint32 bytes remain exact, including negative zero", () => {
    const values = [new Uint8Array(Array.from({ length: 256 }, (_, i) => i)),
      new Float32Array([-0, -Infinity, Infinity, Number.MIN_VALUE, Math.fround(1 / 3), 3.4028234663852886e38]),
      new Uint32Array([0, 1, 65535, 65536, 0x80000000, 0xffffffff])];
    for (const decoder of [nativeDecoder, undefined]) withDecoder(decoder, () => {
      for (const original of values) {
        const encoded = Buffer.from(original.buffer, original.byteOffset, original.byteLength).toString("base64");
        const bytes = decodeBase64Bytes(encoded);
        expect(hash(bytes)).toBe(hash(original));
        if (original instanceof Float32Array) expect(Object.is(new Float32Array(bytes.buffer)[0], -0)).toBe(true);
        if (original instanceof Uint32Array) expect(new Uint32Array(bytes.buffer)).toEqual(original);
      }
    });
  });

  test("the gzip JSON and exact double roof consumers keep parsed values and all byte patterns", () => {
    const json = '[-0,1.7e308,5e-324,{"__proto__":[1,2,3]}]';
    const packedJson = Buffer.from(gzipSync(new TextEncoder().encode(json))).toString("base64");
    const doubles = new Float64Array([-0, -1.7e308, 1.7e308, 5e-324, 1 / 3, 24, -71, 0, 1024]);
    const packed = Buffer.from(gzipSync(new Uint8Array(doubles.buffer))).toString("base64");
    for (const decoder of [nativeDecoder, undefined]) withDecoder(decoder, () => {
      const decoded = decodeLosslessGzipJson(packedJson) as unknown[];
      expect(decoded).toEqual(JSON.parse(json));
      expect(Object.is(decoded[0], -0)).toBe(true);
      const roof = decodeLosslessRoofCoordinates({ format: "lossless-f64le-roof-triangles-v1", triangles: 1, bytes: 72, gzip: packed });
      expect(hash(roof)).toBe(hash(doubles));
    });
  });

  test("all 72 audited drawn/native source streams preserve their exact byte receipt", async () => {
    const streams: string[] = [];
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== "object") return;
      for (const [key, field] of Object.entries(value)) {
        if (["positions", "colors", "indices"].includes(key) && typeof field === "string") streams.push(field);
        else visit(field);
      }
    };
    for (const name of ["moabitLandmarksV269", "tachelesFrontsV270", "golgathaV270", "auguststrasseMuralV270", "potsdamerCorridorCoreV288"]) {
      visit(JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), "utf8")));
    }
    expect(streams).toHaveLength(72);
    for (const decoder of [nativeDecoder, undefined]) withDecoder(decoder, () => {
      const receipt = createHash("sha256");
      let bytes = 0;
      for (const stream of streams) {
        const current = decodeBase64Bytes(stream);
        expect(hash(current)).toBe(hash(previousDecode(stream)));
        receipt.update(current); bytes += current.byteLength;
      }
      expect(bytes).toBe(2_364_510);
      expect(receipt.digest("hex")).toBe("b3c784ac43f8181855d4399fed7638faa63b11990672b381eaa2c07cc5cb4578");
    });
  });
});

function geometryReceipt(root: Group): { sha256: string; bytes: number; renderables: number } {
  const receipt = createHash("sha256");
  let bytes = 0, renderables = 0;
  root.traverse((object: Object3D & { geometry?: BufferGeometry; instanceMatrix?: BufferAttribute; instanceColor?: BufferAttribute | null }) => {
    receipt.update(JSON.stringify([object.name, object.position.toArray(), object.scale.toArray(), object.quaternion.toArray()]));
    if (!object.geometry) return;
    renderables++;
    const update = (key: string, attribute: BufferAttribute): void => {
      receipt.update(key);
      receipt.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
      bytes += attribute.array.byteLength;
    };
    for (const [key, attribute] of Object.entries(object.geometry.attributes)) {
      receipt.update(key);
      receipt.update(JSON.stringify([attribute.itemSize, attribute.normalized]));
      const values = (attribute as BufferAttribute).array;
      receipt.update(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
      bytes += values.byteLength;
    }
    for (const [key, attribute] of [["index", object.geometry.index], ["matrix", object.instanceMatrix], ["colour", object.instanceColor]] as const) {
      if (attribute) update(key, attribute);
    }
  });
  return { sha256: receipt.digest("hex"), bytes, renderables };
}

test("all ten published model variants match their complete pre-change geometry receipts", () => {
  // Collected from the released constructor paths before this decoder edit.
  const fixtures = [
    [createMoabitLandmarksV269, ["3a1155da5518829c269a8e6dce502647e0d5a6e9dc4f0444ecac7d69f06a4f98", 247269, 2], ["1864b0d2337f368d90eb2e0c702b7ad81815616eb95d1c64b4a45a81d1305cd4", 1542042, 2]],
    [createGolgathaV270, ["cd9538b77ce44bbff681ffdcb83c250544aefdc242a6eedcf555cebffd41217f", 56607, 3], ["96db12d3d8bfcfa5bccf7ddca6d7bcebf36da1a2ca8e1c5849889df5440d1427", 80670, 2]],
    [createTachelesFrontsV270, ["9d8f23093b380361dde34675f526c8479a0bace14a63b6e824ae49481a29f6b4", 398082, 5], ["43e6ee72d55753f4ce8ba36b4fb9d4df40ef9fe11f93e9c4dad3fe6748a1c45d", 902556, 5]],
    [createAuguststrasseMuralV270, ["4559cd074feaf11da92d01fcf7199396ff42fe6429ce647c16e7754af55fa9be", 185487, 1], ["1586121d77566cfe810eb728ddefcd01e60bf6fab1d1a216d1dc4342d97d1433", 308964, 1]],
    [createPotsdamerCorridorCoreV288, ["58608fd819448161c5b681ddc95027d30ea2d90cf36bf7fe94ee3cb76b53e5cf", 212268, 2], ["472155366e21498b08239f5e3848bfc741c2973967692f88a706ad3db68eaa88", 865528, 1]],
  ] as const;
  for (const decoder of [nativeDecoder, undefined]) withDecoder(decoder, () => {
    for (const [create, drawn, native] of fixtures) for (const [mode, expected] of [[false, drawn], [true, native]] as const) {
      const root = create(mode);
      try {
        expect(geometryReceipt(root)).toEqual({ sha256: expected[0], bytes: expected[1], renderables: expected[2] });
      } finally {
        root.traverse(object => {
          const geometry = (object as Object3D & { geometry?: BufferGeometry }).geometry;
          geometry?.dispose();
        });
      }
    }
  });
});
