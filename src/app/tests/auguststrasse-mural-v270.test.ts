import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Box3, Group, Mesh, Raycaster, Vector3 } from 'three';
import data from '../src/data/auguststrasseMuralV270Profile.json';
import { createAuguststrasseMuralV270 } from '../src/AuguststrasseMuralV270';
import { auguststrasseRoofAtV270, auguststrasseUpperSolidsV270, isAuguststrasseOldGableRimV270 } from '../src/AuguststrasseMuralV270Profile';
import { createTachelesFrontsV270 } from '../src/TachelesFrontsV270';
import { createStreamedSurroundingCityChunkV255, disposeSurroundingCityRoot } from '../src/SurroundingCity';
import { createPedestrianEnvironment, createPedestrianState, pedestrianPointIsBlocked } from '../src/pedestrianNavigation';
import { buildingTerrainOffset } from '../src/weinbergTerrainV176';

test('one texture-free full-detail batch per mode, compact buffers and exact supported bounds', () => {
  for (const native of [false, true]) {
    const root = createAuguststrasseMuralV270(native), mesh = root.children[0] as Mesh;
    expect(root.children.length).toBe(1);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.sourceSheetsRetained).toBe(true);
    expect(mesh.matrixAutoUpdate).toBe(false);
    expect(mesh.geometry.getAttribute('uv')).toBeUndefined();
    const bytes = Object.values(mesh.geometry.attributes).reduce((n, a) => n + a.array.byteLength, mesh.geometry.index!.array.byteLength);
    expect(bytes).toBeLessThan(350_000);
    const bounds = new Box3().setFromObject(root);
    expect(bounds.min.y).toBeGreaterThanOrEqual(5.2);
    expect(bounds.max.y).toBeCloseTo(native ? 24.5 : 24.35, 2);
    expect(buildingTerrainOffset(data.prism, 1297, -756, data.groundY)).toBe(0);
    mesh.geometry.dispose(); mesh.userData.dayMaterial.dispose(); mesh.userData.nightMaterial.dispose();
  }
});

test('only the exact superseded west-wall flat-roof cornice estimate yields', () => {
  const args = [1288.3,-760.8,1291.9,-746.7,15,.22,.48] as const;
  expect(isAuguststrasseOldGableRimV270(data.previousPrism,...args)).toBe(true);
  expect(isAuguststrasseOldGableRimV270({...data.previousPrism,h_dm:151},...args)).toBe(false);
  expect(isAuguststrasseOldGableRimV270(data.previousPrism,1291.9,-746.7,1288.3,-760.8,15,.22,.48)).toBe(true);
  expect(isAuguststrasseOldGableRimV270(data.previousPrism,1288.3,-760.8,1291.9,-746.7,15,.23,.48)).toBe(false);
  expect(isAuguststrasseOldGableRimV270(data.previousPrism,1291.9,-746.7,1303.9,-750.1,15,.22,.48)).toBe(false);
  expect(isAuguststrasseOldGableRimV270({id:'unrelated',get ring(){throw Error('foreign owner must not be fingerprinted');}},...args)).toBe(false);
});

test('native artwork remains first visible against real 2_-2 and resident056/057 production packets', async () => {
  const base = 'public/mesh/surrounding-berlin-v159/';
  const manifest = JSON.parse(readFileSync(base+'manifest.json','utf8'));
  const descriptor = manifest.chunks.find((c:{id:string})=>c.id==='2_-2');
  const packets = [JSON.parse(gunzipSync(readFileSync(base+descriptor.minecraft.url)).toString()),
    ...['056','057'].map(id=>JSON.parse(readFileSync('src/data/altMitteV169Native/packet-'+id+'.json','utf8')))];
  const scene = new Group(), mural = createAuguststrasseMuralV270(true), fronts = createTachelesFrontsV270(true);
  scene.add(mural,fronts);
  for (let i=0;i<packets.length;i++) {
    const packet=packets[i];
    const entry=await createStreamedSurroundingCityChunkV255(packet,i===0?'2_-2':'alt-mitte-v169-'+packet.id,true,
      {budgetMs:4,yield:async()=>{}},{tachelesFrontsV270:true,golgathaV270:true});
    scene.add(entry.root);
  }
  scene.updateMatrixWorld(true);
  const evidence=JSON.parse(gunzipSync(readFileSync('../../geo_data/regierungsviertel/auguststrasse-mural-v270-evidence.json.gz')).toString());
  const eye=new Vector3(1235,31,-732),ray=new Raycaster();let checked=0;
  const runs=evidence.nativePaintRuns as number[][];
  for(let i=0;i<runs.length;i+=19){
    const [x,y,z0,z1]=runs[i];if(y<7||y>22.8)continue;
    const target=new Vector3(x,y+.05,(z0+z1)/2);
    ray.set(eye,target.clone().sub(eye).normalize());ray.far=eye.distanceTo(target)+.2;
    const first=ray.intersectObject(scene,true)[0];
    expect(first,`sample ${x}/${y}/${(z0+z1)/2}`).toBeDefined();
    expect(first.object,`occluder ${first.object.name} at ${first.point.toArray()}`).toBe(mural.children[0]);checked++;
  }
  expect(checked).toBeGreaterThan(80);
  disposeSurroundingCityRoot(scene);
}, 30_000);

test('roof callback matches actual rendered complete roof in each mode', () => {
  for (const native of [false, true]) {
    const root = createAuguststrasseMuralV270(native); root.updateMatrixWorld(true);
    const ray = new Raycaster(), down = new Vector3(0, -1, 0);
    let tested = 0;
    for (let x = 1288.25; x < 1304; x += 1) for (let z = -765.75; z < -746; z += 1) {
      const top = auguststrasseRoofAtV270(x, z, native);
      if (top === null) continue;
      ray.set(new Vector3(x, 40, z), down);
      const hit = ray.intersectObject(root, true)[0];
      expect(hit).toBeDefined();
      const delta = hit.point.y - top;
      // Native paint follows horizontal stair faces 2 cm above their actual support.
      // Navigation remains on the complete structural roof, not on the paint skin.
      expect(native ? Math.min(Math.abs(delta),Math.abs(delta-.02)) : Math.abs(delta)).toBeLessThan(native ? .001 : .018);
      tested++;
    }
    expect(tested).toBeGreaterThan(150);
    expect(auguststrasseRoofAtV270(1200, -700, native)).toBeNull();
    expect(auguststrasseUpperSolidsV270(native).every(s => s.minY === (native ? 21.2 : 20.2))).toBe(true);
    const mesh = root.children[0] as Mesh; mesh.geometry.dispose(); mesh.userData.dayMaterial.dispose(); mesh.userData.nightMaterial.dispose();
  }
});

test('integrated production navigation keeps original body and follows measured roof on mode changes', () => {
  const ground = JSON.parse(readFileSync('public/mesh/regierungsviertel/ground-context.json', 'utf8'));
  const voxels = JSON.parse(readFileSync('public/mesh/regierungsviertel/minecraft-voxels.json', 'utf8'));
  const prisms = JSON.parse(readFileSync('public/mesh/regierungsviertel/lod2-prisms.json', 'utf8'));
  const env = createPedestrianEnvironment({ ...voxels, ...ground }, { water: [] }, null, prisms, undefined, { includeAuguststrasseMuralV270: true });
  let native = false; env.visualMode = () => native ? 'minecraft' : 'day';
  for (const mode of [false, true, false]) {
    native = mode;
    for (const [x, z] of [[1297.25, -756.75], [1295.25, -752.75], [1300.25, -752.75]]) {
      const top = auguststrasseRoofAtV270(x, z, native)!;
      const state = createPedestrianState(env, { x, z, yaw: 0, groundYHint: top, preserveHorizontalPosition: true });
      expect(state.x).toBe(x); expect(state.z).toBe(z); expect(state.groundY).toBeCloseTo(top, 5);
      expect(pedestrianPointIsBlocked(x, z, 7, env.obstacles, env)).toBe(true);
      expect(pedestrianPointIsBlocked(x, z, top, env.obstacles, env)).toBe(false);
    }
  }
});
