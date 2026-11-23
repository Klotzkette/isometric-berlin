import { expect, test } from "bun:test";
import { Group, InstancedMesh, Vector3 } from "three";
import { readFileSync } from "node:fs";
import {
  withCanopyParkV376,
  withCanopyVoxelsV376,
} from "../src/MitteCanopyV376";
import {
  createParkDetailsCooperative,
  decodeTrees,
  type ParkDetailsPayload,
} from "../src/ParkDetails";
import {
  forEachVoxelTreeBlock,
  minecraftVoxelTreeRetained,
} from "../src/terrainPayload";
import {
  createTiergartenTreeArrivalV379,
  type TiergartenArrivalStateV379,
} from "../src/TiergartenTreeArrivalV379";
import receipt from "../../../geo_data/regierungsviertel/tiergarten-tree-arrival-v379.json";
import first from "../src/data/tiergartenTreeFirstV379.json";
import fine from "../src/data/tiergartenTreeFillV379.json";

const state: TiergartenArrivalStateV379 = {
  native: false,
  hidden: false,
  nativeComplete: false,
  drawnComplete: false,
  legacyDrawn: false,
  snow: false,
};
const focus = new Vector3(-1462, 4, 457),
  eye = new Vector3(-1360, 95, 560);
const elsewhere = new Vector3(12500, 2, 13200),
  farEye = elsewhere.clone().addScalar(100);

function renderedLocations(root: Group) {
  const anchors = new Set<string>();
  root.traverseVisible((obj) => {
    if (!(obj instanceof InstancedMesh) || obj.name !== "Vermessene Baumstämme")
      return;
    for (let i = 0; i < obj.count; i++) {
      const a = obj.instanceMatrix.array,
        id = a[i * 16 + 12] + "," + a[i * 16 + 14];
      anchors.add(id);
    }
  });
  return anchors;
}

test("the complete packet recovers both source families throughout the mapped park", () => {
  expect(receipt.sources.berlin_official).toBe(13156);
  const families = [0, 0],
    mobile = [0, 0];
  for (const [bx, bz, f, , encoded] of [...first.blocks, ...fine]) {
    const bytes = Buffer.from(encoded as string, "base64");
    expect(bytes.length % 15).toBe(0);
    expect(typeof bx).toBe("number");
    expect(typeof bz).toBe("number");
    families[Number(f)] += bytes.length / 15;
    for (let i = 0; i < bytes.length; i += 15)
      mobile[Number(f)] += bytes[i + 14];
  }
  expect(families).toEqual([receipt.all.drawn, receipt.all.nativeFull]);
  expect(mobile[1]).toBe(receipt.all.nativeMobile);
});

test("first and infill streams own disjoint original positions with their published dimensions", () => {
  const payload = (file: string) =>
    JSON.parse(
      readFileSync(
        new URL("../public/mesh/regierungsviertel/" + file, import.meta.url),
        "utf8",
      ),
    );
  const park = withCanopyParkV376(payload("park-details.json"));
  const voxels = withCanopyVoxelsV376(payload("minecraft-voxels.json"));
  const original = new Set<string>();
  const key = (
    f: number,
    x: number,
    y: number,
    z: number,
    h: number,
    r: number,
  ) =>
    [
      f,
      Math.round(x * 100),
      Math.round(y * 1000),
      Math.round(z * 100),
      Math.round(h * 100),
      Math.round(r * 100),
    ].join(",");
  for (const tree of decodeTrees(park.trees, park.tree_vocabulary)) {
    const [x, y, z] = tree.position;
    original.add(key(0, x, y, z, tree.height_m, tree.crown_radius_m));
  }
  forEachVoxelTreeBlock(voxels, (cx, cz, y, h) => {
    if (minecraftVoxelTreeRetained(cx, cz, "full", voxels.retainSurveyTree))
      original.add(
        key(1, cx * 4 + 2, y / 10, cz * 4 + 2, Math.max(4, h / 10), 4.4),
      );
  });
  const emitted = new Set<string>();
  let foreign = 0,
    duplicates = 0;
  for (const [bx, bz, f, , encoded] of [...first.blocks, ...fine]) {
    const bytes = Buffer.from(encoded as string, "base64");
    for (let i = 0; i < bytes.length; i += 15) {
      const id = key(
        Number(f),
        Number(bx) * 256 + bytes.readUInt16LE(i) / 100,
        bytes.readInt16LE(i + 4) / 1000,
        Number(bz) * 256 + bytes.readUInt16LE(i + 2) / 100,
        bytes.readUInt16LE(i + 6) / 100,
        bytes.readUInt16LE(i + 8) / 100,
      );
      if (!original.has(id)) foreign++;
      if (emitted.has(id)) duplicates++;
      emitted.add(id);
    }
  }
  expect({ foreign, duplicates }).toEqual({ foreign: 0, duplicates: 0 });
  expect(emitted.size).toBe(receipt.all.drawn + receipt.all.nativeFull);
});

test("genuine first-frame crowns, localized fill, eastern owner and complete-world handoff", async () => {
  let imports = 0;
  const owner = createTiergartenTreeArrivalV379(
    new Group(),
    false,
    async () => {
      imports++;
      return fine as [number, number, 0 | 1, number, string][];
    },
  );
  owner.update(elsewhere, farEye, state, 0);
  expect(imports).toBe(0);
  expect(owner.root.children).toHaveLength(0);
  owner.update(focus, eye, state, 1);
  const anchors = renderedLocations(owner.root);
  expect(anchors.size).toBe(receipt.first.drawn);
  const source = [...anchors].map((p) => p.split(",").map(Number));
  expect(
    source.filter(([x, z]) => Math.hypot(x - focus.x, z - focus.z) < 200)
      .length,
  ).toBeGreaterThan(60);
  expect(source.some(([x]) => x < -2500)).toBe(true);
  expect(source.some(([x]) => x > 200)).toBe(true);
  await Promise.resolve();
  for (let i = 0; i < 14; i++) owner.update(focus, eye, state, 2 + i);
  expect(renderedLocations(owner.root).size).toBeGreaterThan(3000);
  expect(owner.root.children[0].children.length).toBeLessThanOrEqual(11);
  owner.update(focus, eye, { ...state, legacyDrawn: true }, 20);
  expect(
    owner.root.getObjectByName("Vom frühen Ostbestand übernommene Kronen")
      ?.visible,
  ).toBe(false);
  owner.update(focus, eye, { ...state, drawnComplete: true }, 21);
  expect(owner.root.children.length).toBe(0);
  expect(imports).toBe(1);
  owner.dispose();
});

test("block first paint uses the native profile's own cells; switching, cancellation and retirement", async () => {
  for (const mobile of [true, false]) {
    const scene = new Group();
    let resolve!: (x: typeof fine) => void;
    const promise = new Promise<typeof fine>((r) => {
      resolve = r;
    });
    const owner = createTiergartenTreeArrivalV379(
      scene,
      mobile,
      async () => (await promise) as [number, number, 0 | 1, number, string][],
    );
    owner.update(focus, eye, { ...state, native: true }, 0);
    const positions = renderedLocations(owner.root);
    expect(positions.size).toBe(
      mobile ? receipt.first.nativeMobile : receipt.first.nativeFull,
    );
    for (const p of positions)
      expect(
        p
          .split(",")
          .map(Number)
          .every((n) => Number.isInteger((n - 2) / 4)),
      ).toBe(true);
    owner.update(
      focus,
      eye,
      { ...state, native: true, nativeComplete: true },
      1,
    );
    expect(positions.size).toBeGreaterThan(1000);
    expect(owner.root.children.length).toBe(0);
    owner.update(focus, eye, state, 2);
    expect(renderedLocations(owner.root).size).toBe(receipt.first.drawn);
    owner.dispose();
    resolve(fine);
    await promise;
    expect(scene.children.length).toBe(0);
    expect(owner.update(focus, eye, state, 3)).toBe(false);
  }
});

test("input may interrupt the full park during source decoding and during the trunk buffer write", async () => {
  const source = { position: [-1462, 4, 457], h: 12, cr: 3, tr: 0.2, v: 1 };
  const rows = Array.from({ length: 1024 }, () => source);
  let decoded = 0;
  const monitored = new Proxy(rows, {
    get(target, name, receiver) {
      if (typeof name === "string" && /^\d+$/.test(name)) decoded++;
      return Reflect.get(target, name, receiver);
    },
  });
  const park = {
    schema_version: 3,
    source: { attribution: "test" },
    trees: monitored,
    paths: [],
    playgrounds: [],
    street_lights: [],
    wall_traces: [],
    hedges: [],
    shrub_patches: [],
  } as unknown as ParkDetailsPayload;
  let started = false,
    stop = false;
  await expect(
    createParkDetailsCooperative(
      park,
      { detailProfile: "full" },
      {
        onRoot: () => {
          started = true;
        },
        budgetMs: 0,
        isCancelled: () => stop,
        yieldTask: async () => {
          if (started) stop = true;
        },
      },
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(decoded).toBe(256);
  let owner: Group | undefined,
    written = 0;
  await expect(
    createParkDetailsCooperative(
      park,
      { detailProfile: "full" },
      {
        onRoot: (r) => {
          owner = r;
        },
        budgetMs: 0,
        isCancelled: () => written > 0,
        yieldTask: async () => {
          const m = owner?.getObjectByName(
            "OSM instanced granular tree trunks",
          ) as InstancedMesh | undefined;
          if (!m || !m.count) return;
          const a = m.instanceMatrix.array;
          if (a[15] === 1 && a[(m.count - 1) * 16 + 15] === 0)
            for (let i = 0; i < m.count; i++)
              if (a[i * 16 + 15] === 1) written++;
        },
      },
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(written).toBe(256);
  expect(owner?.parent).toBeNull();
});
