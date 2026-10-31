import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import scene from "../public/mesh/regierungsviertel/scene.json";
import {
  appendChancelleryPhotoV287, chancelleryPhotoPlanesV287, matchesChancelleryPhotoV287, CHANCELLERY_PHOTO_V287,
  type ChancelleryPhotoSignatureV287,
} from "../src/ChancelleryPhotoV287";

type Vec = [number, number, number];
type Box = { p: Vec; size: Vec; tint: number; yaw: number };
const signature = scene.architectural_signatures.find(s => s.kind === "chancellery_model")! as ChancelleryPhotoSignatureV287;
const P = CHANCELLERY_PHOTO_V287;
const yaw = signature.rotation_y_degrees * Math.PI / 180, c = Math.cos(yaw), sn = Math.sin(yaw);
function local(p: Vec): Vec {
  const x = p[0] - signature.anchor_world[0], z = p[2] - signature.anchor_world[2];
  return [c * x - sn * z, p[1] - signature.anchor_world[1], sn * x + c * z];
}
function capture(native: boolean, s = signature) {
  const boxes: Box[] = [];
  const receipt = appendChancelleryPhotoV287({ native, box(p, size, tint, yaw = 0) { boxes.push({ p, size, tint, yaw }); } }, s);
  return { boxes, receipt };
}
function corners(box: Box): Vec[] {
  const c = Math.cos(box.yaw), s = Math.sin(box.yaw), result: Vec[] = [];
  for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) result.push(local([
    box.p[0] + c * x * box.size[0] + s * z * box.size[2], box.p[1] + y * box.size[1], box.p[2] - s * x * box.size[0] + c * z * box.size[2],
  ]));
  return result;
}
function limits(box: Box) {
  const ps = corners(box);
  return { minX: Math.min(...ps.map(p => p[0])), maxX: Math.max(...ps.map(p => p[0])), minY: Math.min(...ps.map(p => p[1])), maxY: Math.max(...ps.map(p => p[1])), minZ: Math.min(...ps.map(p => p[2])), maxZ: Math.max(...ps.map(p => p[2])) };
}
function overlaps(a: { minX: number; maxX: number; minY: number; maxY: number }, b: { minX: number; maxX: number; minY: number; maxY: number }): boolean {
  return Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 1e-7 && Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > 1e-7;
}
const green = (box: Box) => (P.tint.leaves as readonly number[]).includes(box.tint);

describe("bounded Chancellery owner-photo Ehrenhof fitting v287", () => {
  test("the two source planes and their end/roof/ground bounds derive from the unchanged metric segments", () => {
    const before = JSON.stringify(signature), planes = chancelleryPhotoPlanesV287(signature);
    expect(matchesChancelleryPhotoV287(signature)).toBeTrue(); expect(planes).toHaveLength(2);
    for (const [i, plane] of planes.entries()) {
      const source = signature.office_segments[i];
      expect(plane.sourceZ).toBe(source.offset_world[2] + plane.towardCourt * source.depth_m / 2);
      expect(plane.minX).toBe(104); expect(plane.maxX).toBe(source.offset_world[0] + source.width_m / 2 - .7);
      expect(plane.minY + signature.anchor_world[1]).toBe(5.15);
      expect(plane.maxY).toBeLessThan(source.height_m - 1.15);
      expect(plane.openings.filter(o => o.kind === "louvred-window")).toHaveLength(4);
      expect(plane.openings.filter(o => o.kind === "slit")).toHaveLength(4);
      expect(plane.openings.every(o => o.minX > plane.minX && o.maxX < plane.maxX && o.minY > plane.minY && o.maxY < plane.maxY)).toBeTrue();
    }
    capture(false); capture(true); expect(JSON.stringify(signature)).toBe(before);
  });

  test("both complete inventories fit the existing shared-batch allowance and remain deterministic", () => {
    const drawn = capture(false), native = capture(true);
    expect(drawn.receipt).toEqual({ count: 1838, wallCount: 50, openingCount: 256, leafCount: 1030, stemCount: 246, pierCount: 256 });
    expect(native.receipt).toEqual({ count: 1811, wallCount: 192, openingCount: 720, leafCount: 571, stemCount: 232, pierCount: 96 });
    for (const out of [drawn, native]) {
      expect(out.boxes.length).toBe(out.receipt.count);
      expect(Object.entries(out.receipt).filter(([key]) => key !== "count").reduce((sum, [, n]) => sum + n, 0)).toBe(out.receipt.count);
      expect(out.receipt.count).toBeLessThanOrEqual(P.maxInstancesPerMode);
      expect(out.boxes.every(b => b.p.every(Number.isFinite) && b.size.every(s => Number.isFinite(s) && s > 0))).toBeTrue();
    }
    expect(4_686_732 + native.receipt.count * 76).toBeLessThan(5_000_000);
    expect(capture(false)).toEqual(drawn); expect(capture(true)).toEqual(native);
    expect(P.fullStaticDetailOnTouch).toBeTrue(); expect(P.textureFree).toBeTrue(); expect(P.automaticOldGeometryRetirement).toBeFalse();
  });

  test("a thin white skin covers only the two inner planes with actual holes instead of a solid wall over windows", () => {
    const planes = chancelleryPhotoPlanesV287(signature);
    // Drawn stays on the metric plane. Native exterior-block fitting has its
    // separate full source-column/support clearance proof below.
    for (const native of [false]) for (const box of capture(native).boxes.filter(b => b.tint === P.tint.stone)) {
      const bounds = limits(box), centre = local(box.p), plane = planes.reduce((a, b) => Math.abs(centre[2] - a.sourceZ) < Math.abs(centre[2] - b.sourceZ) ? a : b);
      expect(bounds.minX).toBeGreaterThanOrEqual(plane.minX - .003); expect(bounds.maxX).toBeLessThanOrEqual(plane.maxX + .003);
      expect(bounds.minY).toBeGreaterThanOrEqual(plane.minY - 1e-10); expect(bounds.maxY).toBeLessThanOrEqual(plane.maxY + 1e-10);
      for (const z of [bounds.minZ, bounds.maxZ]) {
        const offset = (z - plane.sourceZ) * plane.towardCourt;
        expect(offset).toBeGreaterThan(0); expect(offset).toBeLessThan(P.maxWallSkinOffsetM);
      }
      // Native cardinal stairs may extend .003 m laterally into the reveal;
      // the full clear opening, inset .01 m, stays unobstructed.
      for (const hole of plane.openings) expect(overlaps(bounds, { minX: hole.minX + .01, maxX: hole.maxX - .01, minY: hole.minY + .01, maxY: hole.maxY - .01 })).toBeFalse();
    }
    const drawn = capture(false).boxes.filter(b => b.tint === P.tint.stone);
    const actualArea = drawn.reduce((area, box) => area + box.size[0] * box.size[1], 0);
    const expectedArea = planes.reduce((area, p) => area + (p.maxX - p.minX) * (p.maxY - p.minY) - p.openings.reduce((a, h) => a + (h.maxX - h.minX) * (h.maxY - h.minY), 0), 0);
    expect(actualArea).toBeCloseTo(expectedArea, 8);
  });

  test("green climbing lobes and thin stems leave every window, slit and cornice clear", () => {
    const planes = chancelleryPhotoPlanesV287(signature);
    for (const native of [false]) {
      const boxes = capture(native).boxes.filter(b => (green(b) || b.tint === P.tint.stem) && local(b.p)[0] > 103);
      for (const box of boxes) {
        const bounds = limits(box), centre = local(box.p), plane = planes.reduce((a, b) => Math.abs(centre[2] - a.sourceZ) < Math.abs(centre[2] - b.sourceZ) ? a : b);
        expect(bounds.minX).toBeGreaterThan(plane.minX - .01); expect(bounds.maxX).toBeLessThan(plane.maxX + .01);
        expect(bounds.minY).toBeGreaterThanOrEqual(plane.minY - 1e-10); expect(bounds.maxY).toBeLessThanOrEqual(P.climbingCoverTopM + 1e-10);
        expect(Math.abs(centre[2] - plane.sourceZ)).toBeLessThan(.51);
        for (const opening of plane.openings) expect(overlaps(bounds, { minX: opening.minX - .13, maxX: opening.maxX + .13, minY: opening.minY - .13, maxY: opening.maxY + .13 })).toBeFalse();
      }
      // The cover has varied lobe heights and bare white islands, never a
      // full green rectangle hidden behind its edge decoration.
      for (const plane of planes) {
        const members = boxes.filter(b => Math.abs(local(b.p)[2] - plane.sourceZ) < 1), columns = new Set<number>();
        for (let x = plane.minX + 1; x < plane.maxX; x += 2) {
          let covered = 0;
          for (let y = plane.minY + .5; y < plane.maxY; y++) if (members.some(b => { const p = local(b.p); return Math.abs(p[0] - x) < b.size[0] / 2 && Math.abs(p[1] - y) < b.size[1] / 2; })) covered++;
          columns.add(covered);
        }
        expect(columns.size).toBeGreaterThan(4); expect(columns.has(0)).toBeTrue();
      }
    }
  });

  test("only the existing two end-column anchors receive bounded green cladding", () => {
    const cube = signature.cube_offset_world, court = signature.forecourt_offset_world!, dx = court[0] - cube[0], dz = court[2] - cube[2], length = Math.hypot(dx, dz);
    const anchors = [-23, 23].map(lateral => [cube[0] + dx / length * 27.2 - dz / length * lateral, cube[2] + dz / length * 27.2 + dx / length * lateral]);
    for (const native of [false]) {
      const cover = capture(native).boxes.filter(b => green(b) && local(b.p)[0] < 103), counts = [0, 0];
      expect(cover.length).toBe(native ? 96 : 256);
      for (const box of cover) {
        const p = local(box.p), distances = anchors.map(a => Math.hypot(p[0] - a[0], p[2] - a[1])), i = distances[0] < distances[1] ? 0 : 1;
        counts[i]++; expect(distances[i]).toBeLessThan(.85);
        expect(p[1] - box.size[1] / 2).toBeGreaterThan(3.59); expect(p[1] + box.size[1] / 2).toBeLessThanOrEqual(P.colonnadeCoverTopM + 1e-9);
      }
      expect(counts[0]).toBe(counts[1]);
    }
  });

  test("lower glazing has no opaque backing and upper shutters retain separate horizontal slats", () => {
    for (const native of [false]) {
      const boxes = capture(native).boxes, planes = chancelleryPhotoPlanesV287(signature);
      for (const plane of planes) for (const opening of plane.openings.filter(o => o.kind === "louvred-window")) {
        const x = opening.minX + 1.3, y = 6.0;
        const blockers = boxes.filter(b => {
          if (b.tint === P.tint.glazing) return false;
          const bounds = limits(b), p = local(b.p);
          return Math.abs(p[2] - plane.sourceZ) < 1 && x > bounds.minX && x < bounds.maxX && y > bounds.minY && y < bounds.maxY;
        });
        expect(blockers).toHaveLength(0);
        const slats = boxes.filter(b => b.tint === P.tint.louvre && Math.abs(local(b.p)[2] - plane.sourceZ) < 1 && local(b.p)[0] > opening.minX && local(b.p)[0] < opening.maxX);
        expect(new Set(slats.map(b => b.p[1])).size).toBe(native ? 11 : 22);
        expect(slats.every(b => b.size[1] < .27)).toBeTrue();
      }
    }
  });

  test("native has independently authored cardinal courses and no rotated smooth duplicate", () => {
    const drawn = capture(false), native = capture(true);
    expect(drawn.boxes.every(b => b.yaw === yaw)).toBeTrue(); expect(native.boxes.every(b => b.yaw === 0)).toBeTrue();
    expect(native.receipt.wallCount).toBeGreaterThan(drawn.receipt.wallCount * 3);
    expect(native.receipt.pierCount).toBeLessThan(drawn.receipt.pierCount / 2);
    const source = readFileSync(new URL("../src/ChancelleryPhotoV287.ts", import.meta.url), "utf8");
    for (const forbidden of ["TextureLoader", "PointLight", "requestAnimationFrame", "setInterval", ".jpg", ".png", "createArchitecturalSignature"]) expect(source.includes(forbidden)).toBeFalse();
  });

  test("a changed source frame fails before any host array is changed and cannot retire earlier detail", () => {
    let calls = 0;
    const variants: ChancelleryPhotoSignatureV287[] = [
      { ...signature, anchor_world: [-220.235, 1.554, -145.806] }, { ...signature, rotation_y_degrees: -1.338 },
      { ...signature, cube_width_m: 55.212 }, { ...signature, cube_offset_world: [66.373, 0, .043] },
      { ...signature, forecourt_offset_world: null },
      { ...signature, office_segments: signature.office_segments.map((s, i) => i ? s : { ...s, depth_m: 23.464 }) },
      { ...signature, office_segments: signature.office_segments.slice(0, 2) },
    ];
    for (const variant of variants) {
      expect(matchesChancelleryPhotoV287(variant)).toBeFalse();
      expect(() => appendChancelleryPhotoV287({ native: true, box() { calls++; } }, variant)).toThrow();
    }
    expect(calls).toBe(0);
  });

  test("owner-frame guards reject foreign descriptors without invoking any accessor", () => {
    let reads = 0, calls = 0;
    const fresh = () => structuredClone(signature), variants: ChancelleryPhotoSignatureV287[] = [];
    for (const key of ["anchor_world", "rotation_y_degrees", "cube_width_m", "cube_offset_world", "forecourt_offset_world", "office_segments"] as const) {
      const s = fresh(), original = s[key];
      Object.defineProperty(s, key, { enumerable: true, get() { reads++; return original; } }); variants.push(s);
    }
    for (const key of ["anchor_world", "cube_offset_world", "forecourt_offset_world"] as const) for (let axis = 0; axis < 3; axis++) {
      const s = fresh(), point = s[key]!, original = point[axis];
      Object.defineProperty(point, String(axis), { enumerable: true, get() { reads++; return original; } }); variants.push(s);
    }
    for (let index = 0; index < 3; index++) {
      const s = fresh(), original = s.office_segments[index];
      Object.defineProperty(s.office_segments, String(index), { enumerable: true, get() { reads++; return original; } }); variants.push(s);
      for (const key of ["width_m", "depth_m", "height_m", "offset_world"] as const) {
        const s = fresh(), segment = s.office_segments[index], original = segment[key];
        Object.defineProperty(segment, key, { enumerable: true, get() { reads++; return original; } }); variants.push(s);
      }
      for (let axis = 0; axis < 3; axis++) {
        const s = fresh(), point = s.office_segments[index].offset_world, original = point[axis];
        Object.defineProperty(point, String(axis), { enumerable: true, get() { reads++; return original; } }); variants.push(s);
      }
    }
    for (const pointKey of ["anchor_world", "cube_offset_world", "forecourt_offset_world"] as const) {
      const sparse = fresh(); delete (sparse[pointKey]! as number[])[1]; variants.push(sparse);
      const hidden = fresh(); Object.defineProperty(hidden[pointKey]!, "1", { value: hidden[pointKey]![1], enumerable: false }); variants.push(hidden);
      const extra = fresh(); Object.defineProperty(extra[pointKey]!, Symbol("foreign"), { value: 1 }); variants.push(extra);
    }
    variants.push(Object.create(signature) as ChancelleryPhotoSignatureV287);
    const revoked = Proxy.revocable(signature, {}); revoked.revoke(); variants.push(revoked.proxy);
    for (const variant of variants) {
      expect(matchesChancelleryPhotoV287(variant)).toBeFalse();
      expect(() => appendChancelleryPhotoV287({ native: false, box() { calls++; } }, variant)).toThrow();
    }
    expect(reads).toBe(0); expect(calls).toBe(0);
  });
});
