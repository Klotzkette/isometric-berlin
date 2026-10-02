import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Mesh } from "three";
import { createDistrictStreets, createSourceStreetSurfaces, type StreetSource } from "../src/DistrictStreets";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import groundSource from "../public/mesh/regierungsviertel/ground-context.json";

const ground = groundSource as unknown as VoxelPayload;
const digest = (values: ArrayBufferView): string => createHash("sha256")
  .update(new Uint8Array(values.buffer, values.byteOffset, values.byteLength)).digest("hex");
// Captured from the released v1.0.71 constructor before replacing its growing
// number arrays. Every attribute/index byte and original index width survives.
const PUBLISHED_STREETS = [
  {
    "name": "District asphalt carriageways",
    "vertices": 104653,
    "positionHash": "58f4f5d37523ffc6f9ef067a926349a55d5c2e271981ccff1f2868cf972dcc49",
    "indexType": "Uint32Array",
    "indexHash": "0b4962686b2e006f5945d8f1f74b6b775da24550e699f8bb2b143d75185e87b4",
    "bytes": 2698848
  },
  {
    "name": "District mapped paved walkways",
    "vertices": 98581,
    "positionHash": "c417efdd93ebecf0478ae560dc3c8a6266431b95e78f68a6dfe540b10c2f867d",
    "indexType": "Uint32Array",
    "indexHash": "115819eeb16e22f8c5b0afbf10e3c480fe4e72106fd5a41500e421f253fc2bfd",
    "bytes": 2462292
  },
  {
    "name": "Brandenburg approach raised sidewalks",
    "vertices": 8215,
    "positionHash": "55f762b6778a25739604dff2e9d9403c4ad10a8572625fcad153241b4f758932",
    "indexType": "Uint16Array",
    "indexHash": "fd70f029873e562cc97f1c91fa32fa08491dde111210ce56e9662e6be2f1b9d4",
    "bytes": 162930
  },
  {
    "name": "Unter den Linden mapped gravel promenade",
    "vertices": 148,
    "positionHash": "67ff016336510e24dc22acd77b22b3cf9da4451b039d119b7daa167886811300",
    "indexType": "Uint16Array",
    "indexHash": "45fe4caf39eea46273f2fe67e9586f8929bdb8e94ba087d479e876540c75d3b7",
    "bytes": 3060
  },
  {
    "name": "Brandenburg approach mapped lawns",
    "vertices": 789,
    "positionHash": "fa4a7d5d966f011ce4b989a3529c4ccc197eea0a276b174798dc337a1bbf1db1",
    "indexType": "Uint16Array",
    "indexHash": "367e59f13a20ccbea37772411f21922d528fae3e6951065a6cc44c435def61ad",
    "bytes": 16740
  },
  {
    "name": "District raised kerbstones",
    "vertices": 309940,
    "positionHash": "3e33f31b16cdb07bfdf3e0c0b5bf413288c24168c545484394da5ce7ca4eab14",
    "indexType": "Uint32Array",
    "indexHash": "a343ff7e5125d60087ffd3a1c73b1ad06cbca4a4a90d38fee768ed0deba0077a",
    "bytes": 9051672
  },
  {
    "name": "District kerb ink",
    "vertices": 148122,
    "positionHash": "6731657abd885b7de4d01cda756e8c29131067b445c4a3e6694f660798171b1e",
    "indexHash": null,
    "bytes": 1777464
  },
  {
    "name": "District lane markings",
    "vertices": 18950,
    "positionHash": "17085c60f51ae9279a4b3cdc9e89e123cf82e7d96d35419d9121e94c5747b8c9",
    "indexHash": null,
    "bytes": 227400
  }
];

function source(positions: number[], indices: number[]): StreetSource {
  const encode = (values: number[], signed: boolean): string => {
    const bytes = new Uint8Array(values.length * 4);
    const view = new DataView(bytes.buffer);
    values.forEach((value, index) => signed
      ? view.setInt32(index * 4, value, true) : view.setUint32(index * 4, value, true));
    return Buffer.from(bytes).toString("base64");
  };
  return { source: {}, surfaces: [{ kind: "asphalt", positions_cm_b64: encode(positions, true),
    indices_b64: encode(indices, false) }], curbs_m: [], elevated_path_ids: [], markings_m: [] };
}

function release(root: ReturnType<typeof createDistrictStreets>): void {
  root.traverse(object => {
    if (!(object instanceof Mesh) && !("geometry" in object)) return;
    const mesh = object as Mesh;
    mesh.geometry.dispose();
    mesh.userData.dayMaterial.dispose();
    mesh.userData.nightMaterial.dispose();
  });
}

describe("bounded exact street construction", () => {
  test("preserves all published surface, kerb, ink and marking bytes", () => {
    const root = createDistrictStreets(ground);
    try {
      const actual = root.children.map(object => {
        const mesh = object as Mesh;
        const position = mesh.geometry.getAttribute("position");
        const index = mesh.geometry.index;
        return { name: mesh.name, vertices: position.count,
          positionHash: digest(position.array),
          ...(index ? { indexType: index.array.constructor.name } : {}),
          indexHash: index ? digest(index.array) : null,
          bytes: position.array.byteLength + (index?.array.byteLength ?? 0) };
      });
      expect(actual).toEqual(PUBLISHED_STREETS);
    } finally { release(root); }
  });

  test("keeps signed centimetres and Three's unsigned restart-index boundary", () => {
    const positions = [-2147483648, -1234567, 1234567, 2147483647, 12345, -54321];
    for (const maximum of [65534, 65535, 0xffffffff]) {
      const root = createSourceStreetSurfaces(ground, source(positions, [0, 1, maximum]), "fixture");
      try {
        const mesh = root.children[0] as Mesh;
        expect(mesh.geometry.index?.array.constructor.name).toBe(maximum < 65535 ? "Uint16Array" : "Uint32Array");
        expect(Array.from(mesh.geometry.index!.array)).toEqual([0, 1, maximum]);
        const p = mesh.geometry.getAttribute("position");
        for (let i = 0; i < positions.length / 2; i++) {
          expect(p.getX(i)).toBe(Math.fround(positions[i * 2] / 100));
          expect(p.getZ(i)).toBe(Math.fround(positions[i * 2 + 1] / 100));
        }
      } finally { release(root); }
    }
  });

  test("counts empty and singleton curb lines without changing index width or topology", () => {
    const input = source([], []);
    input.curbs_m = [[], [[1, 2]], [[3, 4], [5, 6]], [], [[7, 8]]];
    const root = createSourceStreetSurfaces(ground, input, "curb fixture");
    try {
      const curb = root.getObjectByName("District raised kerbstones") as Mesh;
      expect(curb.geometry.getAttribute("position").count).toBe(16);
      expect(curb.geometry.index?.array).toBeInstanceOf(Uint16Array);
      expect(Array.from(curb.geometry.index!.array)).toEqual([
        4,8,10, 4,10,6, 7,11,9, 7,9,5, 6,10,11, 6,11,7,
      ]);
      const ink = root.getObjectByName("District kerb ink") as Mesh;
      expect(ink.geometry.getAttribute("position").count).toBe(2);
    } finally { release(root); }
  });
});
