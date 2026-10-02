import { describe, expect, spyOn, test } from "bun:test";
import {
  BufferGeometry,
  InterleavedBufferAttribute,
  Material,
  Mesh,
  Vector3,
} from "three";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import type { AltMitteCoreV169Source } from "../src/AltMitteCoreV169";
import type { AltMitteV169Navigation } from "../src/altMitteV169NavigationIndex";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { staticGeometryAudit } from "./helpers/staticGeometryAudit";

const encode = (a: Uint8Array | Uint16Array | Uint32Array): string =>
  Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
const packet = (x: number, native = false): SurroundingCityChunk => ({
  schemaVersion: 1,
  origin: [x, -10, -128],
  meshes: [
    {
      kind: native ? "native-source-shell" : "source-shell",
      positionType: "u16cm",
      positions: encode(
        new Uint16Array([0, 1500, 0, 3200, 2500, 0, 0, 1500, 3200]),
      ),
      colors: encode(
        new Uint8Array([120, 140, 150, 120, 140, 150, 120, 140, 150]),
      ),
      indices: encode(new Uint32Array([0, 1, 2])),
    },
  ],
  lines: { positions: encode(new Uint16Array([0, 1500, 0, 3200, 2500, 0])) },
  nav: { groundY: 5.2, ground: [], water: [], buildings: [] },
});
const core: AltMitteCoreV169Source = {
  schemaVersion: 1,
  drawnChunks: [
    { id: "west", packet: packet(128) },
    { id: "east", packet: packet(1024) },
  ],
  minecraftChunks: [
    { id: "west", packet: packet(128, true) },
    { id: "east", packet: packet(1024, true) },
  ],
  sourceParents: [{ id: "fixture-official-family" }],
};
const nav: AltMitteV169Navigation = {
  legacyPrisms: [
    {
      id: "pitched",
      ring: [
        [-200, -200],
        [200, -200],
        [200, 200],
        [-200, 200],
      ],
      holes: [
        [
          [-50, -50],
          [50, -50],
          [50, 50],
          [-50, 50],
        ],
      ],
      y0_dm: 52,
      h_dm: 93,
      roof: 3100,
    },
    {
      id: "flat",
      ring: [
        [640, 0],
        [960, 0],
        [960, 160],
        [640, 160],
      ],
      holes: [],
      y0_dm: 52,
      h_dm: 161,
      roof: 1000,
    },
  ],
  parts: [
    {
      id: "fixture-exact-part",
      ring: [
        [-20, -20],
        [20, -20],
        [20, 20],
        [-20, 20],
      ],
      holes: [
        [
          [-5, -5],
          [5, -5],
          [5, 5],
          [-5, 5],
        ],
      ],
      groundY: 5.2,
      topY: 29,
    },
  ],
  roofTriangles: [
    [
      [-32, 10, -32],
      [0, 18, -32],
      [-32, 10, 0],
    ],
    [
      [-32, 15, -32],
      [0, 23, -32],
      [-32, 15, 0],
    ],
    [
      [64, 12, 0],
      [96, 12, 0],
      [64, 20, 16],
    ],
    [
      [1, 40, 1],
      [2, 40, 2],
      [3, 40, 3],
    ], // Degenerate X/Z projection is not a roof.
  ],
  nativeRoofCells: [
    [-2, -3, 17],
    [-2, -3, 19],
    [-2, -3, 18],
    [70, 3, 25],
  ],
};

// Small fixtures exercise the production data-free runtime; source inventory and
// default full/touch wrappers are verified separately against generated assets.
const {
  ALT_MITTE_V169_GROUP,
  ALT_MITTE_V169_NATIVE_GROUP,
  createAltMitteCoreV169FromSource,
  buildAltMitteCoreV169Steps,
} = await import("../src/AltMitteCoreV169");
const { createAltMitteV169NavigationIndex } =
  await import("../src/altMitteV169NavigationIndex");
const {
  prismIds: ALT_MITTE_V169_PRISM_IDS,
  parts: ALT_MITTE_V169_PARTS,
  sourceColumn: altMitteV169SourceColumn,
  roofAt: altMitteV169RoofAt,
} = createAltMitteV169NavigationIndex(nav);

describe("Alt-Mitte resident-core runtime contract", () => {
  test("publishes every source packet synchronously with deterministic unchanged centimeter coordinates", () => {
    const original = JSON.stringify(core);
    const full = createAltMitteCoreV169FromSource(core),
      repeated = createAltMitteCoreV169FromSource(core);
    expect(full).not.toBeInstanceOf(Promise);
    expect(full.name).toBe(ALT_MITTE_V169_GROUP);
    expect(full.children).toHaveLength(2);
    expect(full.userData.sourceEnvelopeResident).toBe(true);
    expect(full.userData.facadeStreamingIndependent).toBe(true);
    expect(full.userData.sourceChunkIds).toEqual(["west", "east"]);
    expect(full.userData.geometryBytes).toBe(108);
    expect(staticGeometryAudit(full)).toEqual(staticGeometryAudit(repeated));
    full.updateMatrixWorld(true);
    const body = full.children[0].children[0] as Mesh;
    const positions = body.geometry.getAttribute(
      "position",
    ) as InterleavedBufferAttribute;
    expect(positions.data.array).toBeInstanceOf(Uint16Array);
    expect(
      new Vector3()
        .fromBufferAttribute(positions, 1)
        .applyMatrix4(body.matrixWorld)
        .toArray(),
    ).toEqual([160, 15, -128]);
    expect(body.userData.dayMaterial).not.toBe(body.userData.nightMaterial);
    expect(body.matrixAutoUpdate).toBe(false);
    expect(JSON.stringify(core)).toBe(original);
    disposeSurroundingCityRoot(full);
    disposeSurroundingCityRoot(repeated);
  });

  test("uses a separate complete native packet family without ink or a drawn double", () => {
    const full = createAltMitteCoreV169FromSource(core, true),
      repeated = createAltMitteCoreV169FromSource(core, true);
    expect(full.name).toBe(ALT_MITTE_V169_NATIVE_GROUP);
    expect(full.name).not.toBe(ALT_MITTE_V169_GROUP);
    expect(full.children).toHaveLength(core.minecraftChunks.length);
    expect(full.userData.nativeMinecraft).toBe(true);
    expect(full.userData.keepInMinecraft).toBe(true);
    for (const chunk of full.children) {
      expect(chunk.children).toHaveLength(1);
      const body = chunk.children[0] as Mesh;
      expect(body.userData.dayMaterial).toBe(body.userData.nightMaterial);
    }
    expect(staticGeometryAudit(full)).toEqual(staticGeometryAudit(repeated));
    disposeSurroundingCityRoot(full);
    disposeSurroundingCityRoot(repeated);
  });

  test("staged construction retains the exact synchronous geometry", () => {
    const expected = createAltMitteCoreV169FromSource(core);
    const steps = buildAltMitteCoreV169Steps(core);
    let next = steps.next(),
      checkpoints = 0;
    while (!next.done) {
      checkpoints++;
      next = steps.next();
    }
    expect(checkpoints).toBeGreaterThan(core.drawnChunks.length);
    expect(staticGeometryAudit(next.value)).toEqual(
      staticGeometryAudit(expected),
    );
    disposeSurroundingCityRoot(expected);
    disposeSurroundingCityRoot(next.value);
  });

  test("returning from any incomplete staged checkpoint disposes every allocated buffer and material exactly once", () => {
    const completed = buildAltMitteCoreV169Steps(core);
    let next = completed.next(),
      checkpoints = 0;
    while (!next.done) {
      checkpoints++;
      next = completed.next();
    }
    disposeSurroundingCityRoot(next.value);
    for (let stop = 1; stop <= checkpoints; stop++) {
      const geometries = new Set<BufferGeometry>(),
        materials = new Set<Material>();
      const geometryDisposals = new Map<BufferGeometry, number>(),
        materialDisposals = new Map<Material, number>();
      const originalAttribute = BufferGeometry.prototype.setAttribute;
      const originalValues = Material.prototype.setValues;
      const attributes = spyOn(
        BufferGeometry.prototype,
        "setAttribute",
      ).mockImplementation(function (this: BufferGeometry, name, value) {
        geometries.add(this);
        return originalAttribute.call(this, name, value);
      });
      const values = spyOn(Material.prototype, "setValues").mockImplementation(
        function (this: Material, parameters) {
          materials.add(this);
          return originalValues.call(this, parameters);
        },
      );
      const geometryDispose = spyOn(
        BufferGeometry.prototype,
        "dispose",
      ).mockImplementation(function (this: BufferGeometry) {
        geometryDisposals.set(this, (geometryDisposals.get(this) ?? 0) + 1);
      });
      const materialDispose = spyOn(
        Material.prototype,
        "dispose",
      ).mockImplementation(function (this: Material) {
        materialDisposals.set(this, (materialDisposals.get(this) ?? 0) + 1);
      });
      const steps = buildAltMitteCoreV169Steps(core);
      try {
        for (let i = 0; i < stop; i++) expect(steps.next().done).toBe(false);
        steps.return(undefined as never);
        for (const geometry of geometries)
          expect(geometryDisposals.get(geometry)).toBe(1);
        for (const material of materials)
          expect(materialDisposals.get(material)).toBe(1);
      } finally {
        steps.return(undefined as never);
        attributes.mockRestore();
        values.mockRestore();
        geometryDispose.mockRestore();
        materialDispose.mockRestore();
      }
    }
  });

  test("a malformed later packet disposes every already-built geometry and material", () => {
    const geometryDispose = spyOn(BufferGeometry.prototype, "dispose");
    const materialDispose = spyOn(Material.prototype, "dispose");
    const broken = structuredClone(core);
    broken.drawnChunks[1].packet.meshes[0].indices = encode(
      new Uint32Array([0, 1, 999]),
    );
    try {
      expect(() => createAltMitteCoreV169FromSource(broken)).toThrow(
        "index exceeds",
      );
      expect(geometryDispose.mock.calls).toHaveLength(2);
      expect(materialDispose.mock.calls).toHaveLength(3);
    } finally {
      geometryDispose.mockRestore();
      materialDispose.mockRestore();
    }
  });
});

describe("Alt-Mitte indexed source ownership and roofs", () => {
  test("retains exact identities and courtyard arrays without changing source records", () => {
    expect([...ALT_MITTE_V169_PRISM_IDS]).toEqual(["pitched", "flat"]);
    expect(ALT_MITTE_V169_PARTS).toBe(nav.parts);
    expect(ALT_MITTE_V169_PARTS[0].holes).toBe(nav.parts[0].holes);
  });

  test("removes only matching old body and four-meter roof tiers, keeping courts and mixed neighbors", () => {
    expect(altMitteV169SourceColumn(-10, -10, 5.2, 17.2)).toBe(true);
    expect(altMitteV169SourceColumn(-10, -10, 17.2, 21.2)).toBe(true);
    expect(altMitteV169SourceColumn(-10, -10, 5.2, 21.2)).toBe(false);
    expect(altMitteV169SourceColumn(-10, -10, 21.2, 25.2)).toBe(false);
    expect(altMitteV169SourceColumn(0, 0, 5.2, 17.2)).toBe(false);
    expect(altMitteV169SourceColumn(70, 4, 5.2, 25.2)).toBe(true);
    expect(altMitteV169SourceColumn(70, 4, 25.2, 29.2)).toBe(false);
    expect(altMitteV169SourceColumn(70, 4, 5.2, 17.2)).toBe(false);
    expect(altMitteV169SourceColumn(40, 4, 5.2, 25.2)).toBe(false);
    expect(altMitteV169SourceColumn(NaN, 4, 5.2, 25.2)).toBe(false);
  });

  test("interpolates the highest actual source roof and uses integer native cells including negative coordinates", () => {
    expect(altMitteV169RoofAt(-24, -24)).toBeCloseTo(17, 8);
    expect(altMitteV169RoofAt(-16, -32)).toBeCloseTo(19, 8);
    expect(altMitteV169RoofAt(64, 8)).toBeCloseTo(16, 8);
    expect(altMitteV169RoofAt(0, 0)).toBeNull();
    expect(altMitteV169RoofAt(2, 2)).toBeNull();
    expect(altMitteV169RoofAt(-1.5, -2.5, true)).toBe(19);
    expect(altMitteV169RoofAt(-2.01, -2.5, true)).toBeNull();
    expect(altMitteV169RoofAt(70.99, 3.99, true)).toBe(25);
    expect(altMitteV169RoofAt(Infinity, 0)).toBeNull();
  });

  test("losslessly indexed native roof spans match cells at negative and exclusive boundaries", () => {
    const spans = [
      [-18, -3, 18, 2, 17],
      [-2, -1, 3, 3, 22],
      [32, 16, 33, 17, 29],
    ];
    const cells: number[][] = [];
    for (const [x0, z0, x1, z1, y] of spans)
      for (let x = x0; x < x1; x++)
        for (let z = z0; z < z1; z++) cells.push([x, z, y]);
    const reference = createAltMitteV169NavigationIndex({
      ...nav,
      nativeRoofCells: cells,
    });
    const indexed = createAltMitteV169NavigationIndex({
      ...nav,
      nativeRoofCells: [],
      nativeRoofSpans: spans,
    });
    for (let x = -19; x <= 34; x++)
      for (let z = -4; z <= 18; z++) {
        expect(indexed.roofAt(x + 0.01, z + 0.99, true)).toBe(
          reference.roofAt(x + 0.01, z + 0.99, true),
        );
        expect(indexed.roofAt(x, z, true)).toBe(reference.roofAt(x, z, true));
      }
    expect(indexed.roofAt(-18.001, 0, true)).toBeNull();
    expect(indexed.roofAt(-18, 0, true)).toBe(17);
    expect(indexed.roofAt(18, 0, true)).toBeNull();
    expect(indexed.roofAt(0, 3, true)).toBeNull();
    const mixed = createAltMitteV169NavigationIndex({
      ...nav,
      nativeRoofCells: [[-2, -1, 30]],
      nativeRoofSpans: spans,
    });
    expect(mixed.roofAt(-1.5, -0.5, true)).toBe(30);
  });

  test("a near lookup never re-reads remote source rings after the 16m index is built", () => {
    const distant = structuredClone(nav.legacyPrisms[1]);
    distant.ring = distant.ring.map(([x, z]) => [x + 100000, z + 100000]);
    const data = { ...nav, legacyPrisms: [...nav.legacyPrisms, distant] };
    const index = createAltMitteV169NavigationIndex(data);
    Object.defineProperty(distant, "ring", {
      get() {
        throw new Error("remote ring scanned");
      },
    });
    expect(index.sourceColumn(-10, -10, 5.2, 17.2)).toBe(true);
    expect(index.sourceColumn(-10, -10, 1, 2)).toBe(false);
    expect(index.roofAt(-24, -24)).toBeCloseTo(17, 8);
  });
});
