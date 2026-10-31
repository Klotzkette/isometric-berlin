import { expect, test } from "bun:test";
import { Matrix4, Vector3 } from "three";
import payload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import scene from "../public/mesh/regierungsviertel/scene.json";
import { decodeVoxelBuildingColumns, isCompleteRecognitionVoxelColumn } from "../src/MinecraftVoxelWorld";
import { createMinecraftArchitecturalLandmarks } from "../src/MinecraftArchitecturalLandmarks";
import { appendChancelleryPhotoV287, CHANCELLERY_NATIVE_FACES_V287 as profile, CHANCELLERY_PHOTO_V287 as P, chancelleryPhotoPlanesV287, matchesNativeChancellerySourceV287, type ChancelleryPhotoSignatureV287 } from "../src/ChancelleryPhotoV287";
type Box = { p: number[]; size: number[]; tint: number; yaw: number };
const signature = scene.architectural_signatures.find(s => s.kind === "chancellery_model")! as ChancelleryPhotoSignatureV287;
function boxes(): Box[] { const result: Box[] = []; appendChancelleryPhotoV287({ native: true, box(p, size, tint, yaw = 0) { result.push({ p, size, tint, yaw }); } }, signature); return result; }
function touchesVolume(a: Box, b: Box): boolean { return a.p.every((v, axis) => Math.min(v + a.size[axis] / 2, b.p[axis] + b.size[axis] / 2) - Math.max(v - a.size[axis] / 2, b.p[axis] - b.size[axis] / 2) > 1e-7); }
function matrixBox(values: number[]): Box {
  const matrix = new Matrix4().fromArray(values), points: Vector3[] = [];
  for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) points.push(new Vector3(x, y, z).applyMatrix4(matrix));
  const min = [0, 1, 2].map(i => Math.min(...points.map(p => p.getComponent(i)))), max = [0, 1, 2].map(i => Math.max(...points.map(p => p.getComponent(i))));
  return { p: min.map((v, i) => (v + max[i]) / 2), size: min.map((v, i) => max[i] - v), tint: 0, yaw: 0 };
}

test("native exterior receipts retain every delivered bounded column and twelve actual existing support members", () => {
  const b = profile.bounds, source = decodeVoxelBuildingColumns(payload).filter(r => r[0] >= b.minXIdx && r[0] <= b.maxXIdx && r[1] >= b.minZIdx && r[1] <= b.maxZIdx);
  expect(source).toEqual(profile.sourceColumns); expect(source).toHaveLength(241);
  const retained = source.flatMap((r, i) => !isCompleteRecognitionVoxelColumn((r[0] + .5) * 4, (r[1] + .5) * 4) ? [i] : []);
  expect(retained).toEqual(profile.retainedIndices); expect(retained).toHaveLength(195);
  const root = createMinecraftArchitecturalLandmarks(), mesh = root.children.find(m => m.userData.landmarkId === "bundeskanzleramt") as any;
  for (const support of profile.frontPylons) {
    expect(support.owners).toHaveLength(6);
    for (const owner of support.owners) {
      let matches = 0;
      for (let i = 0; i < mesh.count; i++) if (owner.matrix.every((v, j) => v === mesh.instanceMatrix.array[i * 16 + j]) && owner.color.every((v, j) => v === mesh.instanceColor.array[i * 3 + j])) matches++;
      expect(matches).toBe(1);
    }
  }
});

test("all 1811 cardinal native members clear every retained source body and both existing front supports", () => {
  const before = JSON.stringify(profile), members = boxes(); expect(members).toHaveLength(1811);
  const columns = profile.retainedIndices.map(i => { const [x, z, y0, y1] = profile.sourceColumns[i]; return { p: [(x + .5) * 4, (y0 + y1) / 20, (z + .5) * 4], size: [4, (y1 - y0) / 10, 4], tint: 0, yaw: 0 }; });
  const supports = profile.frontPylons.flatMap(s => s.owners.map(o => matrixBox(o.matrix)));
  for (const member of members) {
    expect(member.yaw).toBe(0); expect(member.size.every(v => v > 0)).toBeTrue();
    expect(columns.some(column => touchesVolume(member, column))).toBeFalse();
    expect(supports.some(support => touchesVolume(member, support))).toBeFalse();
  }
  expect(JSON.stringify(profile)).toBe(before);
});

test("native white courses sit just outside actual column faces; two low green strips have existing block supports", () => {
  const members = boxes(), columns = profile.retainedIndices.map(i => profile.sourceColumns[i]);
  for (const wall of members.filter(m => m.tint === P.tint.stone)) {
    const north = wall.p[2] < signature.anchor_world[2], rear = north ? wall.p[2] - wall.size[2] / 2 : wall.p[2] + wall.size[2] / 2;
    const support = columns.some(([ix, iz, y0, y1]) => ix * 4 < wall.p[0] + wall.size[0] / 2 && (ix + 1) * 4 > wall.p[0] - wall.size[0] / 2 && y0 / 10 < wall.p[1] + wall.size[1] / 2 && y1 / 10 > wall.p[1] - wall.size[1] / 2 && Math.abs(rear - (north ? iz + 1 : iz) * 4) < .016);
    expect(support).toBeTrue(); expect(wall.size[2]).toBeLessThan(.14);
  }
  const cover = members.filter(m => (P.tint.leaves as readonly number[]).includes(m.tint) && m.p[0] < -122);
  expect(cover).toHaveLength(96);
  for (const support of profile.frontPylons) {
    const north = support.side === "north", face = north ? support.maxZ : support.minZ;
    const leaves = cover.filter(m => (m.p[2] < signature.anchor_world[2]) === north); expect(leaves).toHaveLength(48);
    for (const leaf of leaves) {
      expect(leaf.p[0] - leaf.size[0] / 2).toBeGreaterThan(support.minX);
      expect(leaf.p[0] + leaf.size[0] / 2).toBeLessThan(support.maxX);
      expect(Math.abs((north ? leaf.p[2] - leaf.size[2] / 2 : leaf.p[2] + leaf.size[2] / 2) - face)).toBeCloseTo(.19, 10);
      expect(leaf.p[1] - leaf.size[1] / 2).toBeGreaterThan(5.15);
      expect(leaf.p[1] + leaf.size[1] / 2).toBeLessThanOrEqual(signature.anchor_world[1] + P.colonnadeCoverTopM + 1e-9);
    }
  }
});

test("native exterior adaptation keeps the eight window/slit apertures clear of white stone and foliage in their cardinal elevation", () => {
  const members = boxes(), yaw = signature.rotation_y_degrees * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
  for (const plane of chancelleryPhotoPlanesV287(signature)) for (const opening of plane.openings) {
    const a = signature.anchor_world[0] + c * opening.minX + s * plane.sourceZ, b = signature.anchor_world[0] + c * opening.maxX + s * plane.sourceZ;
    const minX = Math.min(a, b) + .08, maxX = Math.max(a, b) - .08, minY = signature.anchor_world[1] + opening.minY + .08, maxY = signature.anchor_world[1] + opening.maxY - .08;
    for (const member of members.filter(m => m.tint === P.tint.stone || m.tint === P.tint.stem || (P.tint.leaves as readonly number[]).includes(m.tint))) {
      if ((member.p[2] < signature.anchor_world[2]) !== (plane.sourceZ < 0)) continue;
      const overlap = Math.min(maxX, member.p[0] + member.size[0] / 2) - Math.max(minX, member.p[0] - member.size[0] / 2) > 1e-7 && Math.min(maxY, member.p[1] + member.size[1] / 2) - Math.max(minY, member.p[1] - member.size[1] / 2) > 1e-7;
      expect(overlap).toBeFalse();
    }
  }
});

test("native source admission fails closed for changed/missing/duplicate cells, schema/grid/classes and accessors", () => {
  expect(matchesNativeChancellerySourceV287(payload)).toBeTrue(); let reads = 0;
  const fresh = () => structuredClone(payload), variants: unknown[] = [];
  const [ix, iz] = profile.sourceColumns[0], rowIndex = iz - payload.grid.min_z_idx;
  const runIndex = payload.building_rows[rowIndex].findIndex(([offset, length]) => ix >= payload.grid.min_x_idx + offset && ix < payload.grid.min_x_idx + offset + length);
  const height = fresh(); height.building_rows[rowIndex][runIndex][3]++; variants.push(height);
  const missing = fresh(); missing.building_rows[rowIndex].splice(runIndex, 1); variants.push(missing);
  const duplicate = fresh(); duplicate.building_rows[rowIndex].push([...duplicate.building_rows[rowIndex][runIndex]] as any); variants.push(duplicate);
  const cell = fresh(); cell.cell_m = 2; variants.push(cell);
  const grid = fresh(); grid.grid.min_x_idx++; variants.push(grid);
  const classes = fresh(); classes.classes[3] = "foreign"; variants.push(classes);
  const schema = fresh(); schema.schema_version++; variants.push(schema);
  const getter = fresh(); Object.defineProperty(getter.building_rows[rowIndex][runIndex], "0", { enumerable: true, get() { reads++; return payload.building_rows[rowIndex][runIndex][0]; } }); variants.push(getter);
  const rowGetter = fresh(); Object.defineProperty(rowGetter.building_rows, String(rowIndex), { enumerable: true, get() { reads++; return payload.building_rows[rowIndex]; } }); variants.push(rowGetter);
  for (const value of variants) expect(matchesNativeChancellerySourceV287(value)).toBeFalse();
  expect(reads).toBe(0);
});
