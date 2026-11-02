import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { Color, InstancedMesh, Matrix4, Mesh, Quaternion, Raycaster, Vector3 } from 'three';
import { createHbfNorthApproach } from '../src/HbfNorthApproach';
import { invalidenEntryFloorV257At, invalidenEntryTreadsV257 } from '../src/invalidenCivicV257Navigation';
import { appendInvalidenCivicV257 } from '../src/InvalidenCivicV257';
import { appendGovernmentStreetLampsV286 } from '../src/GovernmentStreetLampsV286';
import { bakeGovernmentWayfindingV286 } from '../src/GovernmentWayfindingV286';
import { GOVERNMENT_STREET_LAMP_ANCHORS_V286, GOVERNMENT_WAYFINDING_PLACEMENT_V286 } from '../src/governmentStreetFurnitureV286Profile';
import { appendChancelleryPhotoNativeOwnedV287 } from '../src/ChancelleryPhotoV287Batch';
import chancelleryOwners from '../src/data/chancelleryPhotoV287Owners.json';

type Vec = [number, number, number];
function completeAppendReplay(native: boolean) {
  const matrices: number[] = [], colors: number[] = [];
  const parts = {
    native,
    box(p: Vec, size: Vec, tint: number, yaw = 0) {
      new Matrix4().compose(new Vector3(...p), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw), new Vector3(...size)).toArray(matrices, matrices.length);
      new Color(tint).toArray(colors, colors.length);
    },
    beam(a: Vec, b: Vec, width: number, height: number, tint: number) {
      const dx=b[0]-a[0],dz=b[2]-a[2],run=Math.hypot(dx,dz); if(run<.001)return;
      if(!native)throw Error('The drawn government lamps belong to ParkDetails, not this batch');
      const count=Math.ceil(run/Math.max(.4,Math.min(1.5,width)));
      for(let i=0;i<count;i++){const t=(i+.5)/count;parts.box([a[0]+dx*t,a[1]+(b[1]-a[1])*t,a[2]+dz*t],[Math.max(width,run/count),height,Math.max(width,run/count)],tint);}
    },
    polygon() { throw Error('The native street-lamp append must remain cardinal box geometry'); },
  };
  const civic = appendInvalidenCivicV257(parts), civicCount = colors.length / 3;
  // The historical v257 cap still applies to its own append. Later source-owned
  // v286 lamps/wayfinding and v287 greenery are separate exact replay stages.
  expect(civicCount).toBeLessThanOrEqual(native ? 18155 : 5552);
  if(native)appendGovernmentStreetLampsV286(parts,()=>5.2,GOVERNMENT_STREET_LAMP_ANCHORS_V286);
  const post=GOVERNMENT_WAYFINDING_PLACEMENT_V286;
  const wayfinding=bakeGovernmentWayfindingV286({native,anchorWorld:[post.x,5.2,post.z],directions:post.directions});
  matrices.push(...wayfinding.matrices); colors.push(...wayfinding.colors);
  const chancellery=native?appendChancelleryPhotoNativeOwnedV287(parts,chancelleryOwners.sourceSignature):undefined;
  return { matrices:new Float32Array(matrices), colors:new Float32Array(colors), civic, chancellery };
}

describe('Invaliden civic v257 bounded additive recognition', () => {
  for (const native of [false, true]) test(`preserved prior buffers, exact steps and bounded ${native ? 'native' : 'drawn'} addition`, () => {
    const root = createHbfNorthApproach(() => 5.2, native); root.updateMatrixWorld(true);
    let draws = 0, bytes = 0; const meshes: InstancedMesh[] = [];
    root.traverse(o => { if (!(o instanceof Mesh)) return; draws++; for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength; bytes += o.geometry.index?.array.byteLength ?? 0;
      if (o instanceof InstancedMesh) { meshes.push(o); bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0); }
    });
    expect(draws).toBe(native ? 1 : 2); expect(bytes).toBeLessThan(5_000_000);
    const mesh = meshes[0], priorCount = native ? 40414 : 5429;
    const hash = (a: ArrayBufferLike, size: number) => createHash('sha256').update(new Uint8Array(a, 0, size)).digest('hex');
    expect(hash(mesh.instanceMatrix.array.buffer, priorCount * 64)).toBe(native ? '917b8b9f92ae3c1ca59d13d0d560326950ae1cb448d81d542cd0dd7983e7223b' : '64fe74e44191287b4d7fb26a1fac0081af0d50f5d5395d73c56e831d1b3f8bc7');
    expect(hash(mesh.instanceColor!.array.buffer, priorCount * 12)).toBe(native ? '363b86614d4971a98b98dc8c9feeeeda9e3deafcf85dc7fd286344e3be259f2d' : '00f92935f5750c07e504f9f3a1f7e6f2a93b019f2c995298e26b7bd1583374e3');
    // HbfNorthApproach and all these append modules are byte-identical to the
    // v192 baseline 0f617436. Keep both immutable historical prefix hashes above;
    // replay the complete already-existing tail instead of extending its cap.
    const replay=completeAppendReplay(native);
    expect(mesh.count-priorCount).toBe(replay.colors.length/3);
    expect((mesh.instanceMatrix.array as Float32Array).subarray(priorCount*16)).toEqual(replay.matrices);
    expect((mesh.instanceColor!.array as Float32Array).subarray(priorCount*3)).toEqual(replay.colors);
    expect(root.userData.invalidenCivicV257).toEqual(replay.civic);
    if(native)expect(root.userData.chancelleryPhotoV287).toEqual(replay.chancellery);
    if (native) { const matrix = new Matrix4(); for (let i = priorCount; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); for (const k of [1, 2, 4, 6, 8, 9]) expect(Math.abs(matrix.elements[k])).toBeLessThan(1e-7); } }
    for (const t of invalidenEntryTreadsV257(native)) {
      const floor = invalidenEntryFloorV257At(t.p[0], t.p[2], native)!;
      const hits = new Raycaster(new Vector3(t.p[0], 7, t.p[2]), new Vector3(0, -1, 0), 0, 2).intersectObject(root, true);
      expect(hits.some(hit => Math.abs(hit.point.y - floor) < .0001)).toBe(true);
    }
    expect(invalidenEntryFloorV257At(440, -1235, native)).toBeNull();
    root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();o.userData.nightMaterial?.dispose();}});
  });
  test('production walking uses exact treads without extending partial grids or overwriting other floors', async () => {
    const { createPedestrianEnvironment } = await import('../src/pedestrianNavigation');
    const ground = await Bun.file(new URL('../public/mesh/regierungsviertel/ground-context.json', import.meta.url)).json();
    const environment = createPedestrianEnvironment(ground, { water: [] });
    for (const native of [false, true]) {
      environment.visualMode = () => native ? 'minecraft' : 'day';
      for (const t of invalidenEntryTreadsV257(native)) expect(environment.groundAt(t.p[0], t.p[2])).toBeCloseTo(invalidenEntryFloorV257At(t.p[0], t.p[2], native)!, 5);
    }
    const limited = createPedestrianEnvironment({ ...ground, grid: { min_x_idx: 0, min_z_idx: 0, cols: 2, rows: 2 } }, { water: [] });
    const t = invalidenEntryTreadsV257(false)[0]; expect(limited.groundAt(t.p[0], t.p[2])).toBeNull();
    expect(environment.groundAt(-333, -1160)).toBeLessThan(-2);
  });
});
