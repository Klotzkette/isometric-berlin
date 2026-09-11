import { expect, test } from "bun:test";
import { createHash } from 'node:crypto';
import { createGroundSlabs, type VoxelPayload } from '../src/MinecraftVoxelWorld';
import data from '../public/mesh/regierungsviertel/ground-context.json';
const ground = data as unknown as VoxelPayload;
const shades = Object.fromEntries(ground.classes.map((c,i)=>[c,[0x223344+i*350,0x445566+i*210]]));
// Baseline v1.0.32: exact matrices and Float32 linear colours, no quantization.
test('compact construction preserves every surveyed ground slab byte', () => {
const mesh = createGroundSlabs(ground,'ground',shades,{skipBridge:true,skipWater:true,skipAtWorld:(x,z)=> x > -100 && x < 250 && z > -100 && z < 400});
const hash=createHash('sha256');
for(const a of [mesh.instanceMatrix,mesh.instanceColor!]) hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
expect(mesh.count).toBe(165495);
expect(hash.digest('hex')).toBe('9f90e5419e5aa868a8c0e7e8b0e71f0d173b8081678c5d8888307efd5400c897');
expect(mesh.userData.skippedByWorldPredicateCells).toBe(10873);

});
