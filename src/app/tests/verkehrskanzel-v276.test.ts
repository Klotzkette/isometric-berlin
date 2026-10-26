import { expect, test } from 'bun:test';
import { InstancedMesh, Mesh } from 'three';
import { createVerkehrskanzelV276 } from '../src/VerkehrskanzelV276';
import { verkehrskanzelSolidsV276 } from '../src/verkehrskanzelV276Profile';
import { isVerkehrskanzelSourceV276, createVerkehrskanzelColumnTesterV276 } from '../src/verkehrskanzelV276Ownership';
import data from '../src/data/verkehrskanzelV276.json';
import ownership from '../src/data/verkehrskanzelV276Ownership.json';
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from '../src/pedestrianNavigation';
import type { PrismPayload } from '../src/IsometricCityWorld';
import { staticGeometryAudit } from './helpers/staticGeometryAudit';
import { disposeSurroundingCityRoot } from '../src/SurroundingCity';

test('complete pavilion and cabin have bounded full mobile geometry in both modes', () => {
  for (const native of [false,true]) {
    const root=createVerkehrskanzelV276(native), touch=createVerkehrskanzelV276(native,{mobileLike:true});
    try {
      const audit=staticGeometryAudit(root);
      expect(staticGeometryAudit(touch)).toEqual(audit);
      expect(audit.budget.draws).toBe(native?1:2);
      expect(audit.budget.bytes).toBeLessThan(65000);
      root.traverse(o=>{
        expect(o.matrixAutoUpdate).toBe(false);
        if (!(o instanceof Mesh)) return;
        for(const a of Object.values(o.geometry.attributes)) expect([...a.array].every(Number.isFinite)).toBe(true);
        if(o instanceof InstancedMesh && native) for(let i=0;i<o.count;i++) for(const k of [1,2,4,6,8,9]) expect(Math.abs(o.instanceMatrix.array[i*16+k])).toBe(0);
      });
      console.log('Verkehrskanzel v276',native?'native':'drawn',audit.budget);
    } finally {disposeSurroundingCityRoot(root);disposeSurroundingCityRoot(touch);}
  }
});

test('finite ownership fails closed for changed sources and shared neighbours',()=>{
  expect(ownership.previousPrisms).toHaveLength(2);
  for(const p of ownership.previousPrisms) {
    expect(isVerkehrskanzelSourceV276(p)).toBe(true);
    expect(isVerkehrskanzelSourceV276({...p,h_dm:p.h_dm+1})).toBe(false);
  }
  const tester=createVerkehrskanzelColumnTesterV276(ownership.previousPrisms,4);
  for(const [x,z,lo,hi,k] of ownership.columns) {
    expect(tester(x,z,lo,hi,k)).toBe(true);
    expect(tester(x,z,lo,hi+1,k)).toBe(false);
    expect(createVerkehrskanzelColumnTesterV276(ownership.previousPrisms.slice(1),4)(x,z,lo,hi,k)).toBe(false);
  }
});

test('walking remains possible under canopy while kiosk and actual pillars block',()=>{
  const prisms={schema_version:1,classes:['concrete'],buildings:ownership.previousPrisms} as PrismPayload;
  let native=false;
  const index=compilePedestrianObstacles(prisms,()=>native?'minecraft':'day',{verkehrskanzelV276:true});
  for (native of [false,true]) {
    const roofs=verkehrskanzelSolidsV276(native);
    const canopy=roofs.find(s=>s.sourceId==='09164073')!;
    expect(canopy.topAt(-2792.5,1660.5)).toBeGreaterThan(8);
    expect(canopy.bottomAt!(-2792.5,1660.5)).toBeGreaterThan(8);
    expect(pedestrianPointIsBlocked(-2792.5,1660.5,5.2,index)).toBe(false);
    expect(pedestrianPointIsBlocked(-2787.5,1653.5,5.2,index)).toBe(true);
  }
  expect(data.posts).toHaveLength(3);
});
