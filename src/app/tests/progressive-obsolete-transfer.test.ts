import { expect, test } from "bun:test";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import type { ProgressiveWorldWorkerOutput } from "../src/progressiveWorld";
import { serializeObject3DForTransfer } from "../src/transferableObject3D";
import { progressiveCoverageHost } from "./helpers/progressiveCoverageHost";

type Batch = Extract<ProgressiveWorldWorkerOutput, { type: "batch" }>;
const viewerSource = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();

function fixture(deferBacking = false) {
  const world = new Group(), coverage = new Group();
  coverage.name = "Startup complete building coverage";
  const previews = [1, 2].map(index => {
    const preview = new Mesh(new BoxGeometry(10, 10, 10), new MeshBasicMaterial());
    preview.userData.progressiveBuildingPreviewId = `buildings-preview-${index}`;
    coverage.add(preview);
    return preview;
  });
  world.add(coverage);
  const host = progressiveCoverageHost(viewerSource, world, false, deferBacking);
  const disposals: string[] = [];
  const watch = (mesh: Mesh, id: string) => {
    mesh.geometry.addEventListener("dispose", () => disposals.push(`${id}:geometry`));
    (mesh.material as MeshBasicMaterial).addEventListener("dispose", () => disposals.push(`${id}:material`));
  };
  previews.forEach((preview, index) => watch(preview, `preview-${index + 1}`));
  return { world, previews, host, disposals, watch };
}

function packet(id: string, kind: Batch["kind"] = "buildings"): Batch {
  const source = new Mesh(new BoxGeometry(10, 10, 10), new MeshBasicMaterial());
  const transfer = serializeObject3DForTransfer(new Group().add(source));
  const object = structuredClone(transfer.object, { transfer: transfer.transfers });
  source.geometry.dispose();
  source.material.dispose();
  return { type: "batch", id, kind, build_ms: 0,
    replaces: kind === "buildings" ? id.replace("buildings-", "buildings-preview-") : undefined, object };
}

/** Reading this payload would enter the production decoder and fail the test. */
function unreadPacket(id: string, kind: Batch["kind"] = "buildings"): Batch {
  return { type: "batch", id, kind, build_ms: 0,
    replaces: id.replace("buildings-", "buildings-preview-"),
    get object(): Batch["object"] { throw new Error("Obsolete transfer payload was read"); } };
}

test("stale building packets ACK without decoding, disposing or changing their fallback", () => {
  const f = fixture();
  try {
    f.host.runtime.mobileBuildingWanted = ["buildings-2"];
    f.host.attach(unreadPacket("buildings-1"));
    expect(f.host.acknowledged).toEqual(["buildings-1"]);
    expect(f.host.warnings).toEqual([]);
    expect(f.host.runtime.progressiveWorldBatches).toEqual([]);
    expect(f.previews.every(preview => preview.visible)).toBeTrue();
    expect(f.world.children).toHaveLength(1);
    expect(f.host.runtime.renderInvalidated).toBeFalse();
    expect(f.disposals).toEqual([]);
  } finally { f.host.dispose(); }
  expect(f.disposals.sort()).toEqual([
    "preview-1:geometry", "preview-1:material", "preview-2:geometry", "preview-2:material",
  ]);
});

test("duplicate transfers preserve the attached exact object and its hidden fallback", () => {
  for (const kind of ["buildings", "surfaces"] as const) {
    const f = fixture(), id = kind === "buildings" ? "buildings-1" : "surface-fixture";
    try {
      f.host.attach(packet(id, kind));
      const exact = f.host.runtime.progressiveWorldBatches[0];
      f.watch(exact.children[0] as Mesh, "exact");
      f.host.attach(unreadPacket(id, kind));
      expect(f.host.acknowledged).toEqual([id, id]);
      expect(f.host.warnings).toEqual([]);
      expect(f.host.runtime.progressiveWorldBatches).toHaveLength(1);
      expect(f.host.runtime.progressiveWorldBatches[0]).toBe(exact);
      expect(exact.parent).toBe(f.world);
      expect(f.previews[0].visible).toBe(kind !== "buildings");
      expect(f.disposals).toEqual([]);
    } finally { f.host.dispose(); }
    expect(f.disposals.filter(id => id.startsWith("exact:"))).toEqual(["exact:geometry", "exact:material"]);
  }
});

test("failed stale ACK keeps successful exact geometry and unreplaced coverage", () => {
  const f = fixture();
  try {
    f.host.runtime.mobileBuildingWanted = ["buildings-2"];
    f.host.attach(packet("buildings-2"));
    const exact = f.host.runtime.progressiveWorldBatches[0];
    f.watch(exact.children[0] as Mesh, "exact");
    f.host.failAcknowledgement();
    f.host.attach(unreadPacket("buildings-1"));
    expect(f.host.acknowledged).toEqual(["buildings-2"]);
    expect(f.host.terminated).toBe(1);
    expect(f.host.warnings).toHaveLength(1);
    expect(f.host.runtime.progressiveWorldState).toBe("failed");
    expect(f.host.runtime.progressiveWorldWorker).toBeUndefined();
    expect(exact.parent).toBe(f.world);
    expect(f.previews.map(preview => preview.visible)).toEqual([true, false]);
    expect(f.disposals).toEqual([]);
  } finally { f.host.dispose(); }
});

test("wanted building and new surface transfers still decode and wait for backing before ACK", () => {
  for (const kind of ["buildings", "surfaces"] as const) {
    const f = fixture(true), id = kind === "buildings" ? "buildings-1" : "surface-fixture";
    try {
      f.host.runtime.mobileBuildingWanted = ["buildings-1"];
      const message = packet(id, kind), object = message.object;
      let reads = 0;
      Object.defineProperty(message, "object", { get: () => { reads++; return object; } });
      f.world.addEventListener("childadded", ({ child }) => {
        if (child.userData.progressiveWorldBatchId === id) expect(f.previews[0].visible).toBeTrue();
      });
      f.host.attach(message);
      expect(reads).toBe(1);
      expect(f.host.runtime.progressiveWorldBatches).toHaveLength(1);
      expect(f.previews[0].visible).toBe(kind !== "buildings");
      expect(f.host.acknowledged).toEqual([]);
      f.host.finishBacking();
      expect(f.host.acknowledged).toEqual([id]);
      expect(f.host.warnings).toEqual([]);
      expect(f.disposals).toEqual([]);
    } finally { f.host.dispose(); }
  }
});
