import { describe, expect, test } from 'bun:test';
import { Box3, Group, InstancedMesh, Mesh, Raycaster, Vector3 } from 'three';
import { createJamesSimonArchitecture } from '../src/JamesSimonArchitecture';
import { JAMES_SIMON_HIGH_POSTS, jamesSimonWorld, jamesSimonMainStairTopAt, jamesSimonWalkSurfaceAt, jamesSimonTerraceVoidAt, jamesSimonExtraSolidAt } from '../src/jamesSimonProfile';
import { createPergamonPanoramaV202, panoramaRotundaRing } from '../src/PergamonPanoramaV202';
import { PERGAMON_PANORAMA_V202_SOURCE as S, PERGAMON_PANORAMA_V202_PROFILE as P, panoramaWorld, panoramaStairYAt, pergamonPanoramaV202PassageAt, pergamonPanoramaV202SolidAt, pergamonPanoramaV202GroundAt, isPergamonPanoramaV202ReplacementColumn } from '../src/pergamonPanoramaV202Profile';
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from '../src/pedestrianNavigation';
import prisms from '../public/mesh/regierungsviertel/lod2-prisms.json';
import overrides from './fixtures/museums-v202-overrides.json';

function budget(root: Group) {
  let bytes = 0, draws = 0, instances = 0, vertices = 0;
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    draws++; expect(o.matrixAutoUpdate).toBeFalse(); expect(o.geometry.getAttribute('uv')).toBeUndefined();
    for (const a of Object.values(o.geometry.attributes)) { bytes += a.array.byteLength; expect([...a.array].every(Number.isFinite)).toBeTrue(); }
    bytes += o.geometry.index?.array.byteLength ?? 0;
    expect(o.userData.dayMaterial.map).toBeNull(); expect(o.userData.nightMaterial.map).toBeNull();
    vertices += o.geometry.getAttribute('position').count * (o instanceof InstancedMesh ? o.count : 1);
    if (o instanceof InstancedMesh) { instances += o.count; bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0); }
  });
  return { bytes, draws, instances, vertices };
}
describe('source-bound Museum Island architectural correction v202', () => {
  test('92 supplier-dimension high columns preserve earlier positions and leave real gaps', () => {
    expect(JAMES_SIMON_HIGH_POSTS).toHaveLength(92);
    for (let i = 0; i <= 40; i++) expect(JAMES_SIMON_HIGH_POSTS.some(p => Math.abs(p.u - (5.8 + i * 97.2 / 40)) < 1e-8 && p.v === 0)).toBeTrue();
    for (const p of JAMES_SIMON_HIGH_POSTS) expect(jamesSimonExtraSolidAt(...jamesSimonWorld(p.u, 14, p.v))).toBeTrue();
    expect(jamesSimonExtraSolidAt(...jamesSimonWorld(55, 14, 0), .28)).toBeFalse();
  });
  test('the main stair has three exposed flights and walkable headroom in drawn and native forms', () => {
    const obstacles = compilePedestrianObstacles(prisms), access = { walkableInteriorAt: jamesSimonTerraceVoidAt, interiorSolidAt: jamesSimonExtraSolidAt };
    for (const minecraft of [false, true]) {
      const root = createJamesSimonArchitecture({ minecraft }); root.updateMatrixWorld(true);
      for (const u of [101.9, 98.3, 93.1, 88.7, 83.6, 78.3, 72.1, 70.3]) {
        const p = jamesSimonWorld(u, 40, -14.5), top = jamesSimonMainStairTopAt(u, -14.5)!;
        const hit = new Raycaster(new Vector3(...p), new Vector3(0, -1, 0)).intersectObject(root, true)[0];
        expect(hit.point.y).toBeCloseTo(top, 3);
        expect(jamesSimonWalkSurfaceAt(p[0], p[2], top)).toBeCloseTo(top, 6);
        expect(pedestrianPointIsBlocked(p[0], p[2], top, obstacles, access)).toBeFalse();
      }
    }
  });
  test('Panorama preserves the complete old owner and measured OSM arc with published dimensions', () => {
    expect(S.previous_display_prism).toEqual(prisms.buildings.find(p => p.id === '35493631'));
    expect(panoramaRotundaRing().slice(0, 21)).toEqual(S.ring.slice(0, 21));
    expect(S.rotunda_fit.radius_m).toBeCloseTo(18, 1); expect(S.rotunda_fit.max_residual_m).toBeLessThan(.02);
    expect(S.official_entrance.surfaces.length).toBeGreaterThan(4);
    expect(P.rotundaTopY - P.baseY).toBe(32.5); expect(P.hallTopY - P.baseY).toBe(9.5);
    for (const minecraft of [false, true]) expect(new Box3().setFromObject(createPergamonPanoramaV202({ minecraft })).max.y).toBeCloseTo(37.43, 2);
    expect(S.native_replacement_columns).toHaveLength(161);
    for(const c of S.native_replacement_columns){expect(isPergamonPanoramaV202ReplacementColumn(...c as [number,number,number,number])).toBeTrue();expect(isPergamonPanoramaV202ReplacementColumn(c[0],c[1],c[2],c[3]+.1)).toBeFalse();}
    expect(isPergamonPanoramaV202ReplacementColumn(1530,-210,5.2,13.2)).toBeFalse();
    expect(isPergamonPanoramaV202ReplacementColumn(1600, -200, 4.9, 16.9)).toBeFalse();
  });
  test('front portico is open to recessed doors and supports are collidable', () => {
    for (const minecraft of [false, true]) {
      const root = createPergamonPanoramaV202({ minecraft }); root.updateMatrixWorld(true);
      const p = panoramaWorld(110, 7, 0), q = panoramaWorld(95, 7, 0);
      const hit = new Raycaster(new Vector3(...p), new Vector3(...q).sub(new Vector3(...p)).normalize()).intersectObject(root, true)[0];
      expect(hit.distance).toBeGreaterThan(8); expect(hit.distance).toBeLessThan(9.5);
      const gap = panoramaWorld(106, 6.5, 0);
      expect(pergamonPanoramaV202PassageAt(...gap, '35493631')).toBeTrue(); expect(pergamonPanoramaV202PassageAt(...gap, 'unrelated')).toBeFalse();
      expect(pergamonPanoramaV202SolidAt(...gap)).toBeFalse(); expect(pergamonPanoramaV202SolidAt(...panoramaWorld(107.45, 7, 2.2))).toBeTrue();
      expect(pergamonPanoramaV202GroundAt(gap[0], gap[2], 5.95)).toBe(5.95);
      for (let i = 0; i < 7; i++) {
        const u = 111.9 - i * .6, point = panoramaWorld(u, 8, 0), top = panoramaStairYAt(u, 0)!;
        expect(new Raycaster(new Vector3(...point), new Vector3(0, -1, 0)).intersectObject(root, true)[0].point.y).toBeCloseTo(top, 4);
      }
    }
  });
  test('roof support is never overridden by the lower entrance floor or bulk collision',()=>{
    const obstacles=compilePedestrianObstacles(prisms),access={walkableInteriorAt:pergamonPanoramaV202PassageAt,interiorSolidAt:pergamonPanoramaV202SolidAt};
    const entry=panoramaWorld(106,14.4,0);
    expect(pergamonPanoramaV202GroundAt(entry[0],entry[2],14.4)).toBeNull();
    expect(pergamonPanoramaV202GroundAt(entry[0],entry[2],37.4)).toBeNull();
    expect(pedestrianPointIsBlocked(entry[0],entry[2],14.4,obstacles,access)).toBeFalse();
    expect(pedestrianPointIsBlocked(P.centre[0],P.centre[1],37.4,obstacles,access)).toBeFalse();
  });
  test('bounded static buffers retain full touch detail and independent native blocks', () => {
    expect(budget(createJamesSimonArchitecture())).toEqual(overrides.james); expect(budget(createJamesSimonArchitecture({ minecraft: true }))).toEqual(overrides.jamesMC);
    expect(budget(createJamesSimonArchitecture({minecraft:true,mobileLike:true}))).toEqual(overrides.jamesMC);
    const drawn = createPergamonPanoramaV202(), native = createPergamonPanoramaV202({ minecraft: true });
    expect(budget(drawn)).toEqual({ bytes: 47992, draws: 2, instances: 343, vertices: 8823 });
    expect(budget(native)).toEqual({ bytes: 111456, draws: 1, instances: 1458, vertices: 34992 });
    expect(budget(createPergamonPanoramaV202({ mobileLike: true }))).toEqual(budget(drawn));
    expect(native.children).toHaveLength(1); expect(native.children[0]).toBeInstanceOf(InstancedMesh);
  });
});
