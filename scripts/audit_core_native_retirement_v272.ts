/** Reproducible, test-only HEAD retirement receipt. No live geometry changes. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { InstancedMesh } from 'three';
import { auditCoreOwnersV272 } from '../src/app/tests/helpers/coreOwnersV272Audit';
import { preloadAltMitteNativeV169Source } from '../src/app/src/AltMitteNativeCoreV169';
import { createMinecraftVoxelWorld, decodeVoxelBuildingColumns, type VoxelPayload } from '../src/app/src/MinecraftVoxelWorld';
import { disposeSurroundingCityRoot } from '../src/app/src/SurroundingCity';
import payloadData from '../src/app/public/mesh/regierungsviertel/minecraft-voxels.json';

const BASE = '931a33a0bd8fb615e900c9c012305e9a2ffb5747';
const repo = resolve(import.meta.dir, '..'), app = join(repo, 'src/app');
const mirror = join(homedir(), '.cache/codex-berlin-v272/core-native-head/src/app');
mkdirSync(join(mirror, 'src'), { recursive: true });
for (const name of readdirSync(join(app, 'src'))) {
  if (name === 'MinecraftVoxelWorld.ts') continue;
  const target = join(mirror, 'src', name);
  if (!existsSync(target)) symlinkSync(join(app, 'src', name), target);
}
for (const name of ['node_modules', 'public']) if (!existsSync(join(mirror, name))) symlinkSync(join(app, name), join(mirror, name));
const baseSource = execFileSync('git', ['-c', 'gc.auto=0', 'show', `${BASE}:src/app/src/MinecraftVoxelWorld.ts`], { cwd: repo });
writeFileSync(join(mirror, 'src/MinecraftVoxelWorld.ts'), baseSource);
const previous = await import(pathToFileURL(join(mirror, 'src/MinecraftVoxelWorld.ts')).href);
await preloadAltMitteNativeV169Source();
const payload = payloadData as unknown as VoxelPayload;
const audit = auditCoreOwnersV272(decodeVoxelBuildingColumns(payload), payload.cell_m);
const names = ['Voxel building columns', 'Voxel facade windows'];
type Snapshot = { count: number; matrix: Float32Array; color: Float32Array; sha256: string };
const hash = (matrix: Float32Array, color: Float32Array) => new Bun.CryptoHasher('sha256').update(matrix).update(color).digest('hex');
function snapshot(factory: typeof createMinecraftVoxelWorld, profile: 'full' | 'mobile') {
  const root = factory(payload, null, null, { detailProfile: profile });
  const result: Record<string, Snapshot> = {};
  for (const name of names) {
    const mesh = root.getObjectByName(name) as InstancedMesh | undefined;
    if (!mesh) continue;
    const matrix = mesh.instanceMatrix.array.slice() as Float32Array, color = mesh.instanceColor!.array.slice() as Float32Array;
    result[name] = { count: mesh.count, matrix, color, sha256: hash(matrix, color) };
  }
  disposeSurroundingCityRoot(root); return result;
}
function record(snapshot: Snapshot, i: number) {
  const out = new Float32Array(19); out.set(snapshot.matrix.subarray(i * 16, (i + 1) * 16)); out.set(snapshot.color.subarray(i * 3, (i + 1) * 3), 16); return out;
}
function equal(a: Snapshot, ai: number, b: Snapshot, bi: number) {
  for (let k = 0; k < 16; k++) if (a.matrix[ai * 16 + k] !== b.matrix[bi * 16 + k]) return false;
  for (let k = 0; k < 3; k++) if (a.color[ai * 3 + k] !== b.color[bi * 3 + k]) return false;
  return true;
}
function difference(before: Snapshot, after: Snapshot, windows: boolean) {
  const removed: object[] = [], added: object[] = []; let old = 0, next = 0, retained = 0;
  while (old < before.count || next < after.count) {
    if (old < before.count && next < after.count && equal(before, old, after, next)) { old++; next++; retained++; continue; }
    if (old < before.count) {
      const value = record(before, old), owner = audit.removed(value, windows);
      if (owner) { removed.push({ index: old++, data: Buffer.from(value.buffer).toString('base64'), ...owner }); continue; }
    }
    if (windows && next < after.count) {
      const value = record(after, next), owner = audit.exposed(value);
      if (owner) { added.push({ index: next++, data: Buffer.from(value.buffer).toString('base64'), ...owner }); continue; }
    }
    throw Error(`Unowned difference ${windows ? 'windows' : 'columns'} old=${old} next=${next}: ${JSON.stringify({ before: old < before.count ? Array.from(record(before, old)) : null, after: next < after.count ? Array.from(record(after, next)) : null })}`);
  }
  return { beforeCount: before.count, afterCount: after.count, retainedCount: retained,
    beforeSha256: before.sha256, afterSha256: after.sha256, removed, added };
}
const profiles: Record<string, unknown> = {};
for (const profile of ['full', 'mobile'] as const) {
  let before = snapshot(previous.createMinecraftVoxelWorld, profile); Bun.gc(true);
  let after = snapshot(createMinecraftVoxelWorld, profile); Bun.gc(true);
  const result: Record<string, unknown> = {};
  for (const name of Object.keys(before)) {
    const delta = difference(before[name], after[name], name.includes('windows')); result[name] = delta;
    console.log(profile, name, JSON.stringify({ before: delta.beforeCount, after: delta.afterCount, removed: delta.removed.length, added: delta.added.length }));
  }
  profiles[profile] = result; before = {}; after = {}; Bun.gc(true);
}
const output = { baseCommit: BASE, baseWorldSourceSha256: new Bun.CryptoHasher('sha256').update(baseSource).digest('hex'),
  scope: 'Exact HAU/Press source-column retirement only; all retained matrix/color bytes preserve order.',
  sourceColumns: audit.owned, profiles };
writeFileSync(join(app, 'tests/fixtures/minecraft-payload-v272-delta.json'), JSON.stringify(output));
