import { expect, test } from 'bun:test';
import { Group, InstancedMesh, Mesh } from 'three';
import { createRkiMoabitV277 } from '../src/RkiMoabitV277';
import data from '../src/data/rkiMoabitV277.json';
import ownership from '../src/data/rkiMoabitV277Ownership.json';
import { rkiMoabitSolidsV277 } from '../src/rkiMoabitV277Profile';
import { createRkiMoabitColumnTesterV277, isRkiMoabitSourceV277 } from '../src/rkiMoabitV277Ownership';
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from '../src/pedestrianNavigation';
import type { PrismPayload } from '../src/IsometricCityWorld';
import type { VisualMode } from '../src/visualMode';
import { disposeSurroundingCityRoot } from '../src/SurroundingCity';
import { staticGeometryAudit } from './helpers/staticGeometryAudit';
import { addRequiredSiteEnvelopesV209Steps } from '../src/RequiredSiteEnvelopesV209';
import { createMinecraftVoxelWorld, type VoxelPayload } from '../src/MinecraftVoxelWorld';
import { preloadAltMitteNativeV169Source } from '../src/AltMitteNativeCoreV169';

function audit(native: boolean, mobileLike = false) {
  const root = createRkiMoabitV277(native, { mobileLike });
  try {
    root.traverse(object => {
      expect(object.matrixAutoUpdate).toBe(false);
      if (!(object instanceof Mesh)) return;
      expect(object.userData.textureFree).toBe(true);
      for (const attribute of Object.values(object.geometry.attributes)) expect([...attribute.array].every(Number.isFinite)).toBe(true);
      if (object instanceof InstancedMesh) {
        for (let i=0; i<object.count; i++) {
          const m = object.instanceMatrix.array.subarray(i*16,i*16+16);
          expect([...m].every(Number.isFinite)).toBe(true);
          if (native) for (const j of [1,2,4,6,8,9]) expect(Math.abs(m[j])).toBe(0);
          for (const j of [0,4,8]) expect(Math.hypot(m[j],m[j+1],m[j+2])).toBeGreaterThan(0);
        }
      }
    });
    return staticGeometryAudit(root);
  } finally { disposeSurroundingCityRoot(root); }
}

test('complete static RKI and plant geometry has identical mobile detail and independent orthogonal native matrices', () => {
  const drawn=audit(false), native=audit(true);
  expect(audit(false,true)).toEqual(drawn);
  expect(audit(true,true)).toEqual(native);
  expect(drawn.budget.draws).toBe(2);
  expect(native.budget.draws).toBe(1);
  expect(drawn.budget.bytes).toBeLessThan(1_900_000);
  expect(native.budget.bytes).toBeLessThan(5_200_000);
  expect(native.budget.instances).toBe(data.counts.nativeBodyBoxes+data.counts.nativeDetails);
  console.log('Nordufer/Moabit submitted geometry', {drawn:drawn.budget,native:native.budget});
});

test('every full measured part is registered to an existing exact old owner and native profiles follow actual cell unions', () => {
  const ids=new Set(ownership.previousPrisms.map(p=>p.id));
  const drawn=rkiMoabitSolidsV277(false), native=rkiMoabitSolidsV277(true);
  expect(drawn.length).toBe(data.parts.length+data.parts.reduce((n,p)=>n+p.posts.length,0));
  let i=0;
  for (const part of data.parts) {
    const solid=native[i];
    expect(ids.has(solid.sourceId)).toBe(true);
    for (const [x,z,top] of part.nativeCells) expect(solid.topAt(x+.5,z+.5)).toBe(top);
    const map=new Set(part.nativeCells.map(([x,z])=>`${x}:${z}`));
    const xs=part.nativeCells.map(p=>p[0]), zs=part.nativeCells.map(p=>p[1]);
    for(let x=Math.min(...xs);x<=Math.max(...xs);x+=3) for(let z=Math.min(...zs);z<=Math.max(...zs);z+=3) {
      if(!map.has(`${x}:${z}`)) expect(solid.topAt(x+.5,z+.5)).toBeNull();
    }
    if(part.openCanopy) for(const [x,z,top] of part.nativeCells) expect(solid.bottomAt!(x+.5,z+.5)).toBeCloseTo(top-.25,6);
    i+=1+part.nativePosts.length;
  }
});

test('only complete original prism records and exclusive exact column tuples can retire', () => {
  const originals=ownership.previousPrisms;
  for(const p of originals) {
    expect(isRkiMoabitSourceV277(p)).toBe(true);
    expect(isRkiMoabitSourceV277({...p,h_dm:p.h_dm+1})).toBe(false);
    expect(isRkiMoabitSourceV277({...p,tone:(p.tone??0)+1})).toBe(false);
  }
  const all=[...originals,...ownership.neighbours], yes=createRkiMoabitColumnTesterV277(all,4);
  for(const [x,z,lo,hi,k] of ownership.columns) {
    expect(yes(x,z,lo,hi,k)).toBe(true);
    expect(yes(x,z,lo,hi+1,k)).toBe(false);
  }
  for(const [x,z,lo,hi,k] of ownership.retainedSharedColumns) expect(yes(x,z,lo,hi,k)).toBe(false);
  const c=ownership.columns[0] as [number,number,number,number,number];
  expect(createRkiMoabitColumnTesterV277(originals.slice(1),4)(...c)).toBe(false);
  expect(createRkiMoabitColumnTesterV277([...all,originals[0]],4)(...c)).toBe(false);
  expect(createRkiMoabitColumnTesterV277(all,2)(...c)).toBe(false);
  const foreign={...originals[0],id:'new-neighbour',ring:[[c[0]*40,c[1]*40],[(c[0]+1)*40,c[1]*40],[(c[0]+1)*40,(c[1]+1)*40],[c[0]*40,(c[1]+1)*40]]};
  expect(createRkiMoabitColumnTesterV277([...all,foreign],4)(...c)).toBe(false);
});

test('real navigation replaces low plant proxy with full high roof in both live visual modes', () => {
  let mode:VisualMode='day';
  const source={schema_version:1,classes:['concrete','glass'],buildings:ownership.previousPrisms} as PrismPayload;
  const old=compilePedestrianObstacles(source,()=>mode);
  const current=compilePedestrianObstacles(source,()=>mode,{rkiMoabitV277:true});
  const high=data.parts.find(p=>p.parentId.endsWith('2Lsy'))!;
  const [ix,iz]=high.nativeCells[Math.floor(high.nativeCells.length/2)];
  const x=ix+.5,z=iz+.5;
  expect(pedestrianPointIsBlocked(x,z,30,old)).toBe(false);
  for(const m of ['day','minecraft','day'] as VisualMode[]) {
    mode=m;
    expect(pedestrianPointIsBlocked(x,z,30,current)).toBe(true);
    expect(pedestrianPointIsBlocked(x,z,90,current)).toBe(false);
  }
  const altered={...source,buildings:source.buildings.map(p=>p.id==='27218732'?{...p,h_dm:p.h_dm+1}:p)};
  const guarded=compilePedestrianObstacles(altered,()=>mode,{rkiMoabitV277:true});
  expect(pedestrianPointIsBlocked(x,z,30,guarded)).toBe(false);
});

test('required-site loading attaches the complete family atomically before yielding in both modes', () => {
  for (const native of [false,true]) {
    const root=new Group(), steps=addRequiredSiteEnvelopesV209Steps(root,native);
    try {
      let match:Group|undefined;
      for(let i=0;i<4&&!match;i++) {
        expect(steps.next().done).toBe(false);
        match=root.children.find(c=>c.userData.sourceEvidenceSha256===data.sourceSha256) as Group|undefined;
      }
      expect(match).toBeDefined();
      const separate=createRkiMoabitV277(native);
      try { expect(staticGeometryAudit(match!)).toEqual(staticGeometryAudit(separate)); }
      finally { disposeSurroundingCityRoot(separate); }
    } finally { steps.return(); disposeSurroundingCityRoot(root); }
  }
});

test('actual native constructor removes exclusively receipted old columns and their generic windows on activation', async () => {
  await preloadAltMitteNativeV169Source();
  const xs=ownership.columns.map(c=>c[0]),zs=ownership.columns.map(c=>c[1]);
  const minX=Math.min(...xs),minZ=Math.min(...zs),cols=Math.max(...xs)-minX+1,rows=Math.max(...zs)-minZ+1;
  const fixture:VoxelPayload={schema_version:1,cell_m:4,
    classes:['grass','asphalt','water','concrete','glass','plazaBrick','bridge','basin','wall','pond'],
    grid:{cols,rows,min_x_idx:minX,min_z_idx:minZ},
    ground_height:{cols,rows,stride_cells:1,y_dm:Array(cols*rows).fill(52)},
    ground_rows:[],buildings:ownership.columns as [number,number,number,number,number][],trees:[],water_top_y_m:-1.15};
  const count=(enabled:boolean)=>{
    const root=createMinecraftVoxelWorld(fixture,null,null,{sourcePrisms:ownership.previousPrisms,rkiMoabitV277:enabled});
    try { return {bodies:(root.getObjectByName('Voxel building columns') as InstancedMesh).count,windows:(root.getObjectByName('Voxel facade windows') as InstancedMesh|undefined)?.count??0}; }
    finally {disposeSurroundingCityRoot(root);}
  };
  const old=count(false),after=count(true);
  expect(old.bodies).toBeGreaterThan(0);expect(old.windows).toBeGreaterThan(0);
  expect(after).toEqual({bodies:0,windows:0});
},60000);
