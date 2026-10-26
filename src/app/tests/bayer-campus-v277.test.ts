import { expect, test } from 'bun:test';
import { Group, InstancedMesh, Mesh } from 'three';
import { createBayerCampusV277 } from '../src/BayerCampusV277';
import { bayerCampusSolidsV277 } from '../src/bayerCampusV277Profile';
import { createBayerCampusColumnTesterV277, isBayerCampusSourceV277 } from '../src/bayerCampusV277Ownership';
import { retainWeddingRowsV277 } from '../src/bayerCampusV277Legacy';
import { createWeddingSitesV210 } from '../src/WeddingSitesV210';
import { addRequiredSiteEnvelopesV209Steps } from '../src/RequiredSiteEnvelopesV209';
import { createDistantBuildingShells, createIsometricCityCore, type PrismPayload } from '../src/IsometricCityWorld';
import { createProgressiveBuildingCoverage } from '../src/progressiveBuildingCoverage';
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from '../src/pedestrianNavigation';
import { createMinecraftVoxelWorld, type VoxelPayload } from '../src/MinecraftVoxelWorld';
import { preloadAltMitteNativeV169Source } from '../src/AltMitteNativeCoreV169';
import { disposeSurroundingCityRoot } from '../src/SurroundingCity';
import data from '../src/data/bayerCampusV277.json';
import ownership from '../src/data/bayerCampusV277Ownership.json';
import legacy from '../src/data/bayerCampusV277Legacy.json';
import wedding from '../src/data/weddingSitesV210.json';
import type { VisualMode } from '../src/visualMode';
import { staticGeometryAudit } from './helpers/staticGeometryAudit';

const source = { schema_version: 1, classes: ['concrete', 'glass'], buildings: ownership.previousPrisms } as PrismPayload;
const actual = [...ownership.previousPrisms, ...ownership.neighbours];
type Column = [number, number, number, number, number];
function inspect(native: boolean, mobileLike = false) {
  const root = createBayerCampusV277(native, { mobileLike });
  try {
    const summary = staticGeometryAudit(root);
    root.traverse(object => {
      expect(object.matrixAutoUpdate).toBe(false);
      if (!(object instanceof Mesh)) return;
      expect(object.userData.textureFree).toBe(true);
      expect(object.geometry.getAttribute('uv')).toBeUndefined();
      for (const attribute of Object.values(object.geometry.attributes)) expect([...attribute.array].every(Number.isFinite)).toBe(true);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) expect(Object.values(material).some(v => v && typeof v === 'object' && 'isTexture' in v)).toBe(false);
      if (object instanceof InstancedMesh) {
        for (let i = 0; i < object.count; i++) {
          const m = object.instanceMatrix.array.subarray(i * 16, i * 16 + 16);
          expect([...m].every(Number.isFinite)).toBe(true);
          if (native) for (const k of [1, 2, 4, 6, 8, 9]) expect(Math.abs(m[k])).toBe(0);
          for (const k of [0, 4, 8]) expect(Math.hypot(m[k], m[k + 1], m[k + 2])).toBeGreaterThan(0);
        }
      }
    });
    return summary;
  } finally { disposeSurroundingCityRoot(root); }
}

test('complete static architecture has identical touch detail and an independent orthogonal native model', () => {
  const drawn = inspect(false), native = inspect(true);
  expect(inspect(false, true)).toEqual(drawn);
  expect(inspect(true, true)).toEqual(native);
  expect(drawn.budget.draws).toBe(2); expect(native.budget.draws).toBe(1);
  expect(drawn.budget.instances).toBe(data.counts.drawnDetails);
  expect(native.budget.instances).toBe(data.counts.nativeBodyRuns + data.counts.nativeDetails);
  expect(drawn.budget.bytes).toBeLessThan(650_000);
  expect(native.budget.bytes).toBeLessThan(1_850_000);
  console.log('Bayer v277 actual complete submitted geometry', { drawn: drawn.budget, native: native.budget });
});

test('required model attaches completely before its first transaction yield in both modes', () => {
  for (const native of [false, true]) {
    const root = new Group(), steps = addRequiredSiteEnvelopesV209Steps(root, native);
    try {
      expect(steps.next().done).toBe(false); expect(root.children).toHaveLength(1);
      expect(root.children[0].userData.sourceId).toBe('K0004qx3');
      const reference = createBayerCampusV277(native);
      try { expect(staticGeometryAudit(root.children[0])).toEqual(staticGeometryAudit(reference)); }
      finally { disposeSurroundingCityRoot(reference); }
    } finally { steps.return(); disposeSurroundingCityRoot(root); }
  }
});

test('complete old facade tuples retire only on explicit activation and all unrelated authored detail stays byte-identical', () => {
  for (const native of [false, true]) {
    const rows = native ? wedding.blocks : wedding.boxes;
    const kept = retainWeddingRowsV277(rows, native, true);
    expect(retainWeddingRowsV277(rows, native)).toBe(rows);
    expect(rows.length - kept.length).toBe(native ? legacy.nativeCount : legacy.drawnCount);
    expect(kept.filter(r => r.at(-2) === 'erika')).toEqual(rows.filter(r => r.at(-2) === 'erika'));
    const old = createWeddingSitesV210(native), fresh = createWeddingSitesV210(native, { bayerCampusV277: true });
    try {
      expect(staticGeometryAudit(old.children[0])).toEqual(staticGeometryAudit(fresh.children[0]));
      const expected = new Set(kept.filter(r => r.at(-2) === 'bayer'));
      const before = old.children[1] as InstancedMesh, after = fresh.children[1] as InstancedMesh;
      let i = 0, j = 0;
      for (const row of rows.filter(r => r.at(-2) === 'bayer')) {
        if (expected.has(row)) {
          expect(after.instanceMatrix.array.subarray(j*16, j*16+16)).toEqual(before.instanceMatrix.array.subarray(i*16, i*16+16));
          expect(after.instanceColor!.array.subarray(j*3,j*3+3)).toEqual(before.instanceColor!.array.subarray(i*3,i*3+3)); j++;
        }
        i++;
      }
      expect(j).toBe(after.count);
    } finally { disposeSurroundingCityRoot(old); disposeSurroundingCityRoot(fresh); }
    const index = rows.findIndex(r => !kept.includes(r));
    for (const key of [0, 3, rows[index].length - 2, rows[index].length - 1]) {
      const changed = [...rows], tuple = [...rows[index]]; tuple[key] = typeof tuple[key] === 'number' ? Number(tuple[key]) + .01 : 'changed'; changed[index] = tuple;
      expect(retainWeddingRowsV277(changed, native, true)).toContain(tuple);
    }
  }
});

test('exact old prism and complete exclusive native tuples fail closed on geometry, material, height, missing or duplicate owners', () => {
  const old = source.buildings[0], first = ownership.columns[0] as Column;
  expect(ownership.columns).toHaveLength(498); expect(ownership.retainedSharedColumns).toHaveLength(13);
  const good = createBayerCampusColumnTesterV277(actual, 4);
  for (const c of ownership.columns) expect(good(...c as Column)).toBe(true);
  for (const c of ownership.retainedSharedColumns) expect(good(...c as Column)).toBe(false);
  const ring = old.ring.map(p => [...p]); ring[0][0] += 1;
  const mutations = [{ ...old, id: 'foreign' }, { ...old, ring }, { ...old, holes: undefined }, { ...old, holes: [[[1, 1], [2, 1], [2, 2]]] }, { ...old, h_dm: old.h_dm + 1 }, { ...old, y0_dm: old.y0_dm! + 1 }, { ...old, class: old.class + 1 }, { ...old, roof: old.roof! + 1 }, { ...old, tone: [1, 2, 3] }];
  for (const p of mutations) {
    expect(isBayerCampusSourceV277(p)).toBe(false);
    expect(createBayerCampusColumnTesterV277([p, ...ownership.neighbours], 4)(...first)).toBe(false);
  }
  for (const values of [undefined, [], ownership.neighbours, [...actual, old]]) expect(createBayerCampusColumnTesterV277(values, 4)(...first)).toBe(false);
  expect(createBayerCampusColumnTesterV277(actual, 2)(...first)).toBe(false);
  const [x,z] = first;
  const foreign = {id:'new-owner',ring:[[x*40,z*40],[x*40+40,z*40],[x*40+40,z*40+40],[x*40,z*40+40]]};
  expect(createBayerCampusColumnTesterV277([...actual, foreign],4)(...first)).toBe(false);
  const far = ownership.columns.find(c => Math.abs(c[0]-x)>3 || Math.abs(c[1]-z)>3)! as Column;
  expect(createBayerCampusColumnTesterV277([...actual, foreign],4)(...far)).toBe(true);
});

test('actual initial, distant and progressive production paths retire the one stale 24m prism only when activated', () => {
  for (const enabled of [false, true]) {
    const options = { bayerCampusV277: enabled };
    const core = createIsometricCityCore(source, null, null, null, { includeContext: false, ...options });
    const distant = createDistantBuildingShells(source, source.buildings, options);
    const progressive = createProgressiveBuildingCoverage(source, { initial: [], omitted: source.buildings, remaining: [] }, options);
    try {
      expect(core.children.length > 0).toBe(!enabled);
      expect(distant.userData.visibleBuildingCount).toBe(enabled ? 0 : 1);
      expect(progressive.children[0].userData.visibleBuildingCount).toBe(enabled ? 0 : 1);
    } finally { for (const root of [core,distant,progressive]) disposeSurroundingCityRoot(root); }
  }
  const changed = { ...source.buildings[0], h_dm: source.buildings[0].h_dm + 1 };
  const core = createIsometricCityCore({ ...source, buildings: [changed] }, null,null,null,{includeContext:false,bayerCampusV277:true});
  const distant = createDistantBuildingShells(source,[changed],{bayerCampusV277:true});
  try { expect(core.children.length).toBeGreaterThan(0); expect(distant.userData.visibleBuildingCount).toBe(1); }
  finally { disposeSurroundingCityRoot(core); disposeSurroundingCityRoot(distant); }
});

test('actual navigation follows low podium, tall tower and open road bridge through live mode changes', () => {
  let mode: VisualMode = 'day';
  const before = compilePedestrianObstacles(source);
  const after = compilePedestrianObstacles(source, () => mode, { bayerCampusV277: true });
  const bridge = [-198.27668,-2440.97335] as const, podium = [-145.00638,-2416.05305] as const, tower = [-137.22327,-2380.73825] as const;
  expect(pedestrianPointIsBlocked(...bridge,7,before)).toBe(true);
  expect(pedestrianPointIsBlocked(...tower,50,before)).toBe(false);
  expect(pedestrianPointIsBlocked(...podium,24,before)).toBe(true);
  for (const native of [false,true,false]) {
    mode = native ? 'minecraft':'day';
    expect(pedestrianPointIsBlocked(...bridge,7,after)).toBe(false);
    expect(pedestrianPointIsBlocked(...bridge,20,after)).toBe(true);
    expect(pedestrianPointIsBlocked(...tower,50,after)).toBe(true);
    expect(pedestrianPointIsBlocked(...podium,24,after)).toBe(false);
    expect(pedestrianPointIsBlocked(...podium,7,after)).toBe(true);
    for (const solid of bayerCampusSolidsV277(native)) expect(solid.sourceId).toBe('K0004qx3');
  }
  const changed = { ...source.buildings[0], h_dm: source.buildings[0].h_dm + 1 };
  const guarded = compilePedestrianObstacles({...source,buildings:[changed]},()=>mode,{bayerCampusV277:true});
  expect(pedestrianPointIsBlocked(...bridge,7,guarded)).toBe(true);
  expect(pedestrianPointIsBlocked(...tower,50,guarded)).toBe(false);
});

test('actual native constructor retires exclusive old columns and retains all thirteen shared columns without changing guard defaults', async () => {
  await preloadAltMitteNativeV169Source();
  const columns = [...ownership.columns, ...ownership.retainedSharedColumns] as Column[];
  const xs = columns.map(c=>c[0]), zs=columns.map(c=>c[1]);
  const minX=Math.min(...xs),minZ=Math.min(...zs),cols=Math.max(...xs)-minX+1,rows=Math.max(...zs)-minZ+1;
  const fixture: VoxelPayload={schema_version:1,cell_m:4,classes:['grass','asphalt','water','concrete','glass','plazaBrick','bridge','basin','wall','pond'],grid:{cols,rows,min_x_idx:minX,min_z_idx:minZ},ground_height:{cols,rows,stride_cells:1,y_dm:Array(cols*rows).fill(52)},ground_rows:[],buildings:columns,trees:[],water_top_y_m:-1.15};
  const construct=(enabled:boolean,parts=actual)=>{
    const root=createMinecraftVoxelWorld(fixture,null,null,{sourcePrisms:parts,bayerCampusV277:enabled});
    try {const mesh=root.getObjectByName('Voxel building columns') as InstancedMesh; return {count:mesh.count,matrices:[...mesh.instanceMatrix.array]};}
    finally {disposeSurroundingCityRoot(root);}
  };
  const before=construct(false),after=construct(true);
  const centres=(value:{count:number,matrices:number[]})=>new Set(Array.from({length:value.count},(_,i)=>`${Math.floor(value.matrices[i*16+12]/4)}:${Math.floor(value.matrices[i*16+14]/4)}`));
  expect(centres(before)).toEqual(new Set(columns.map(c=>`${c[0]}:${c[1]}`)));
  expect(centres(after)).toEqual(new Set(ownership.retainedSharedColumns.map(c=>`${c[0]}:${c[1]}`)));
  console.log("Bayer constructor source cells and actual instances",{beforeCells:centres(before).size,afterCells:centres(after).size,beforeInstances:before.count,afterInstances:after.count});
  const matrices=new Set(Array.from({length:before.count},(_,i)=>before.matrices.slice(i*16,i*16+16).join('/')));
  for(let i=0;i<after.count;i++) expect(matrices.has(after.matrices.slice(i*16,i*16+16).join('/'))).toBe(true);
  const changed=actual.map(p=>p.id==='K0004qx3'?{...p,h_dm:p.h_dm+1}:p);
  expect(construct(true,changed)).toEqual(before);
},60_000);
