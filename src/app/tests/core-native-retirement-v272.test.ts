import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { InstancedMesh } from 'three';
import { preloadAltMitteNativeV169Source } from '../src/AltMitteNativeCoreV169';
import { createMinecraftVoxelWorld, decodeVoxelBuildingColumns, type VoxelPayload } from '../src/MinecraftVoxelWorld';
import { disposeSurroundingCityRoot } from '../src/SurroundingCity';
import payloadData from '../public/mesh/regierungsviertel/minecraft-voxels.json';
import { auditCoreOwnersV272 } from './helpers/coreOwnersV272Audit';
import { decodedInstance, replayLegacyInstanceHash, type InstanceBufferDelta } from './helpers/instanceBufferReplay';

type OwnerRecord = { index: number; data: string; column: number[]; ownerIds: string[] };
type Delta = InstanceBufferDelta & { beforeSha256: string; afterSha256: string; removed: OwnerRecord[]; added: OwnerRecord[] };
type Receipt = { baseCommit: string; baseWorldSourceSha256: string; sourceColumns: object[];
  profiles: Record<'full' | 'mobile', Record<string, Delta>> };
const receipt: Receipt = JSON.parse(readFileSync(new URL('./fixtures/minecraft-payload-v272-delta.json', import.meta.url), 'utf8'));
const payload = payloadData as unknown as VoxelPayload;
const audit = auditCoreOwnersV272(decodeVoxelBuildingColumns(payload), payload.cell_m);
await preloadAltMitteNativeV169Source();

test('v272 native retirement is bound to the recorded HEAD source and exact HAU/Press owner columns', () => {
  expect(receipt.baseCommit).toBe('931a33a0bd8fb615e900c9c012305e9a2ffb5747');
  expect(receipt.baseWorldSourceSha256).toBe('f22faaa55ca9d771b7b82cc663fc075937ad6086800c3986ea2c9468d6b37df3');
  expect(audit.owned).toEqual(receipt.sourceColumns);
  expect(audit.owned).toHaveLength(369);
  for (const [profile, meshes] of Object.entries(receipt.profiles)) {
    for (const [name, delta] of Object.entries(meshes)) {
      const windows = name === 'Voxel facade windows';
      for (const record of delta.removed) {
        expect(audit.removed(decodedInstance(record), windows)).toEqual({ column: record.column, ownerIds: record.ownerIds });
      }
      for (const record of delta.added) {
        expect(windows).toBe(true);
        expect(audit.exposed(decodedInstance(record))).toEqual({ column: record.column, ownerIds: record.ownerIds });
      }
      if (!windows) {
        expect(delta.added).toHaveLength(0);
        expect(delta.removed).toHaveLength(profile === 'full' ? 1079 : 369);
      }
    }
  }
  const windows = receipt.profiles.full['Voxel facade windows'];
  expect(windows.removed).toHaveLength(2205);
  expect(windows.added).toHaveLength(225);
  expect(windows.beforeCount - windows.afterCount).toBe(1980);
  // Both venue groups have explicit removed and newly exposed ownership;
  // the 225 neighbouring panes are restored detail, never unexplained noise.
  for (const [kind, counts] of [['removed', { press: 1891, theatres: 314 }],
    ['added', { press: 79, theatres: 146 }]] as const) {
    for (const [family, count] of Object.entries(counts)) {
      expect(windows[kind].filter(record => record.ownerIds.some(id => id.startsWith(`${family}:`)))).toHaveLength(count);
    }
  }
});

for (const profile of ['full', 'mobile'] as const) {
  test(`${profile}: every retained native matrix and colour byte replays the complete pre-v272 HEAD buffers`, () => {
    Bun.gc(true);
    const root = createMinecraftVoxelWorld(payload, null, null, { detailProfile: profile });
    try {
      for (const [name, delta] of Object.entries(receipt.profiles[profile])) {
        const mesh = root.getObjectByName(name) as InstancedMesh;
        expect(mesh).toBeDefined();
        expect(new Bun.CryptoHasher('sha256').update(mesh.instanceMatrix.array).update(mesh.instanceColor!.array).digest('hex'))
          .toBe(delta.afterSha256);
        // Every added record is verified, every removed record is restored at
        // its exact index, and all retained bytes must produce the HEAD hash.
        expect(replayLegacyInstanceHash(mesh, delta)).toBe(delta.beforeSha256);
        if (profile === 'full' && name === 'Voxel facade windows') {
          const matrix = mesh.instanceMatrix.array, saved = matrix[12];
          const first = new Float32Array(19); first.set(matrix.subarray(0, 16));
          first.set(mesh.instanceColor!.array.subarray(0, 3), 16);
          expect(audit.removed(first, true)).toBeUndefined();
          expect(delta.added.some(record => record.index === 0)).toBe(false);
          try {
            matrix[12] += .25;
            expect(replayLegacyInstanceHash(mesh, delta)).not.toBe(delta.beforeSha256);
          } finally { matrix[12] = saved; }
        }
      }
    } finally { disposeSurroundingCityRoot(root); }
  }, 60_000);
}
