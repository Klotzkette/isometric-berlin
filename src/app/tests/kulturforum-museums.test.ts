import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Box3, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createKulturforumMuseums, createMinecraftKulturforumMuseums, kulturforumMuseumWalls, kulturforumMuseumEntranceWalls, type KulturforumMuseumBlock } from "../src/KulturforumMuseums";
import { KULTURFORUM_MUSEUM_IDS, kulturforumMuseumRoofHeightAt, kulturforumMuseumReplacementColumn } from "../src/kulturforumMuseumsProfile";
import source from "../src/kulturforumMuseumsSource.json";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";

function signature(root: ReturnType<typeof createKulturforumMuseums>): string {
  const hash = createHash("sha256");
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    for (const [key, a] of Object.entries(o.geometry.attributes)) { hash.update(key); hash.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength)); }
    if (o.geometry.index) hash.update(Buffer.from(o.geometry.index.array.buffer));
    if (o instanceof InstancedMesh) { hash.update(Buffer.from(o.instanceMatrix.array.buffer)); if (o.instanceColor) hash.update(Buffer.from(o.instanceColor.array.buffer)); }
  });
  return hash.digest("hex");
}
describe("Kulturforum source museums", () => {
  test("retains every official source body and unmodified prior prism", () => {
    expect(KULTURFORUM_MUSEUM_IDS).toEqual(new Set(["K0002QYw", "K0002Sq5", "K0002V5W"]));
    expect(source.bodies.flatMap(b => b.surfaces)).toHaveLength(234);
    expect(source.bodies.flatMap(b => b.surfaces).filter(s => s.kind === "RoofSurface")).toHaveLength(10);
    for (const b of source.bodies) {
      expect(b.source_prism).toEqual(prisms.buildings.find(p => p.id === b.prism_id));
      expect(b.surfaces.every(s => s.rings.every(r => r.length >= 3 && r.flat().every(Number.isFinite)))).toBeTrue();
    }
  });
  for (const minecraft of [false, true]) test(`${minecraft ? "native" : "drawn"} geometry is finite and bounded`, () => {
    const root = (minecraft ? createMinecraftKulturforumMuseums : createKulturforumMuseums)({ diagnostics: true });
    let bytes = 0, calls = 0;
    root.traverse(o => {
      if (!(o instanceof Mesh)) return;
      calls++;
      for (const a of Object.values(o.geometry.attributes)) { expect(Array.from(a.array).every(Number.isFinite)).toBeTrue(); bytes += a.array.byteLength; }
      bytes += o.geometry.index?.array.byteLength ?? 0;
      if (o instanceof InstancedMesh) { expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue(); bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0); }
      expect(o.geometry.getAttribute("uv")).toBeUndefined();
    });
    expect(calls).toBe(minecraft ? 1 : 2); expect(bytes).toBeLessThan(minecraft ? 1_500_000 : 700_000);
    const b = new Box3().setFromObject(root);
    expect(b.min.x).toBeGreaterThan(-544); expect(b.max.x).toBeLessThan(-248);
    expect(b.min.z).toBeGreaterThan(967); expect(b.max.z).toBeLessThan(1203); expect(b.max.y).toBeLessThan(26.7);
    expect(root.userData.detailCounts["craft brick panel"]).toBeGreaterThan(50);
    expect(root.userData.detailCounts["gallery stone blind window"]).toBeGreaterThan(40);
    expect(root.userData.detailCounts["museum door pull"]).toBeGreaterThanOrEqual(8);
    for (const label of ["GEMÄLDEGALERIE", "KUNSTGEWERBEMUSEUM"]) expect(root.getObjectByName(`${label} entrance lettering`)?.userData.lettering).toBe(label);
  });
  test("touch and desktop drawn static detail is byte-identical", () => {
    expect(signature(createKulturforumMuseums({ mobileLike: true }))).toBe(signature(createKulturforumMuseums()));
  });
  test("source roofs, including the open KGM court, agree with actual mesh rays", () => {
    for (const minecraft of [false, true]) {
      const root = (minecraft ? createMinecraftKulturforumMuseums : createKulturforumMuseums)(); root.updateMatrixWorld(true);
      let rays = 0;
      for (const body of source.bodies) {
        const xs = body.source_prism.ring.map(p => p[0] / 10), zs = body.source_prism.ring.map(p => p[1] / 10);
        for (let x = Math.floor(Math.min(...xs) / 2) * 2 + 1; x < Math.max(...xs); x += 8) for (let z = Math.floor(Math.min(...zs) / 2) * 2 + 1; z < Math.max(...zs); z += 8) {
          const y = kulturforumMuseumRoofHeightAt(body.prism_id, x, z, minecraft); if (y === null) continue;
          if ([[2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dz]) => kulturforumMuseumRoofHeightAt(body.prism_id, x + dx, z + dz, minecraft) === null)) continue;
          const hits = new Raycaster(new Vector3(x, 40, z), new Vector3(0, -1, 0), 0, 40).intersectObject(root, true);
          expect(hits.length).toBeGreaterThan(0); expect(hits[0].point.y).toBeGreaterThanOrEqual(y - .01); expect(hits[0].point.y).toBeLessThan(y + .56); rays++;
        }
      }
      expect(rays).toBeGreaterThan(130);
      expect(kulturforumMuseumRoofHeightAt("K0002QYw", -303, 1011, minecraft)).toBeNull();
      expect(new Raycaster(new Vector3(-303, 35, 1011), new Vector3(0, -1, 0), 0, 25).intersectObject(root, true)).toHaveLength(0);
    }
  });
  test("doors stay outside the retained wall and never inside their former boxes", () => {
    const root = createKulturforumMuseums({ diagnostics: true }); root.updateMatrixWorld(true);
    const blocks = (root.userData.blocks as KulturforumMuseumBlock[]).filter(b => b.role === "museum entrance glazing");
    for (const b of blocks) {
      const w = kulturforumMuseumEntranceWalls().find(w => (w.facadeSourceId ?? w.body.prism_id) === b.sourceId)!;
      const center = new Vector3(...b.position), n = new Vector3(w.nx, 0, w.nz);
      const hits = new Raycaster(center.clone().addScaledVector(n, 5), n.clone().negate(), 0, 6).intersectObject(root, true);
      expect(hits.length).toBeGreaterThan(0); expect(hits[0].distance).toBeLessThanOrEqual(5);
    }
  });
  test("native entrance pixels remain in front of the actual block shell", () => {
    const root = createMinecraftKulturforumMuseums({ diagnostics: true }); root.updateMatrixWorld(true);
    const blocks = root.userData.blocks as KulturforumMuseumBlock[];
    for (const b of blocks.filter(b => b.role === "museum entrance glazing")) {
      const w = kulturforumMuseumEntranceWalls().find(w => (w.facadeSourceId ?? w.body.prism_id) === b.sourceId)!;
      const n = new Vector3(w.nx, 0, w.nz), p = new Vector3(...b.position).addScaledVector(n, 5);
      const hit = new Raycaster(p, n.negate(), 0, 6).intersectObject(root, true)[0];
      expect(hit).toBeDefined(); expect(blocks[hit.instanceId!].role).not.toBe("source wall block");
    }
  });
  test("both museum signs read left-to-right from the outside in both representations", () => {
    for (const factory of [createKulturforumMuseums, createMinecraftKulturforumMuseums]) {
      const root = factory({ diagnostics: true }), blocks = root.userData.blocks as KulturforumMuseumBlock[];
      for (const w of kulturforumMuseumEntranceWalls()) {
        const letters = blocks.filter(b => b.role === "museum entrance lettering" && b.sourceId === (w.facadeSourceId ?? w.body.prism_id));
        const right = new Vector3(w.nz, 0, -w.nx);
        const first = new Vector3(...letters[0].position), last = new Vector3(...letters.at(-1)!.position);
        expect(last.sub(first).dot(right)).toBeGreaterThan(5);
      }
    }
  });
  test("native caption pixels clear the entire stepped fascia in both museum signs", () => {
    const root = createMinecraftKulturforumMuseums({ diagnostics: true }); root.updateMatrixWorld(true);
    const blocks = root.userData.blocks as KulturforumMuseumBlock[];
    for (const w of kulturforumMuseumEntranceWalls()) {
      const sourceId = w.facadeSourceId ?? w.body.prism_id, n = new Vector3(w.nx, 0, w.nz);
      const letters = blocks.filter(b => b.role === "museum entrance lettering" && b.sourceId === sourceId);
      const fascia = blocks.filter(b => b.role === "museum entrance sign fascia" && b.sourceId === sourceId);
      const halfDepth = (b: KulturforumMuseumBlock) => (Math.abs(w.nx) * b.size[0] + Math.abs(w.nz) * b.size[2]) / 2;
      const outer = Math.max(...fascia.map(b => new Vector3(...b.position).dot(n) + halfDepth(b)));
      for (const b of letters) expect(new Vector3(...b.position).dot(n) - halfDepth(b)).toBeGreaterThan(outer + .07);
      for (let i = 0; i < letters.length; i += Math.max(1, Math.floor(letters.length / 40))) {
        for (const angle of [-.3, 0, .3]) {
          const direction = n.clone().add(new Vector3(w.dx * angle, .4, w.dz * angle)).normalize();
          const ray = new Raycaster(new Vector3(...letters[i].position).addScaledVector(direction, 5), direction.negate(), 0, 6);
          const hit = ray.intersectObject(root, true)[0];
          expect(hit).toBeDefined(); expect(blocks[hit.instanceId!].role).toBe("museum entrance lettering");
        }
      }
    }
  });
  test("gallery entrance uses the exposed retained shared-foyer edge without owning its body", () => {
    const w = kulturforumMuseumEntranceWalls()[1], foyer = prisms.buildings.find(p => p.id === "jfT1esZV")!;
    expect(foyer.ring[55]).toEqual(w.a.map(v => Math.round(v * 10)));
    expect(foyer.ring[56]).toEqual([w.a[0] + w.dx * w.length, w.a[1] + w.dz * w.length].map(v => Math.round(v * 10)));
    expect(KULTURFORUM_MUSEUM_IDS.has("jfT1esZV")).toBeFalse();
  });
  test("voxel ownership matches source heights and excludes unrelated columns", () => {
    for (const body of source.bodies) {
      const p = body.source_prism, low = p.y0_dm / 10, high = low + Math.ceil(p.h_dm / 40) * 4;
      const w = kulturforumMuseumWalls().find(w => w.body.prism_id === p.id && w.length > 10 && !w.inner)!;
      const x = w.a[0] + w.dx * w.length / 2 - w.nx, z = w.a[1] + w.dz * w.length / 2 - w.nz;
      expect(kulturforumMuseumReplacementColumn(x, z, low, high)).toBeTrue();
      expect(kulturforumMuseumReplacementColumn(x, z, low, high + 4)).toBeFalse();
    }
    expect(kulturforumMuseumReplacementColumn(-150, 990, 4, 28)).toBeFalse();
  });
});
