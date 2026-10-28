import { describe, expect, test } from 'bun:test';
import { Box3, InstancedMesh, Matrix4, Mesh } from 'three';
import data from '../src/data/steppengartenShelterV283.json';
import { createSteppengartenShelterV283 } from '../src/SteppengartenShelterV283';
import { steppengartenShelterSolidsV283 } from '../src/steppengartenShelterV283Profile';
import { createSteppengartenShelterColumnTesterV283, isSteppengartenShelterSourceV283 } from '../src/steppengartenShelterV283Ownership';
import { createDistantBuildingShells, type PrismPayload } from '../src/IsometricCityWorld';

describe('Steppengarten low limestone shelter v283', () => {
  test('actual drawn/native models have low roofs, no textures or tower', () => {
    for (const native of [false, true]) {
      const root = createSteppengartenShelterV283(native);
      const bounds = new Box3().setFromObject(root);
      expect(bounds.max.y).toBeLessThan(7);
      expect(bounds.min.y).toBeGreaterThanOrEqual(data.groundY - .01);
      expect(root.children.length).toBe(native ? 1 : 2);
      root.traverse(object => {
        if (!(object instanceof Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) expect((material as unknown as { map?: unknown }).map ?? null).toBeNull();
        if (native && object instanceof InstancedMesh) {
          const matrix = new Matrix4();
          for (let i=0;i<object.count;i++) {
            object.getMatrixAt(i,matrix);
            for (const j of [1,2,4,6,8,9]) expect(Math.abs(matrix.elements[j])).toBe(0);
          }
        }
        object.geometry.dispose(); materials.forEach(m=>m.dispose());
      });
    }
  });

  test('navigation keeps the gable approach and interior open below its roof', () => {
    const [a,b,c,d] = data.ring;
    const centre=[(a[0]+b[0]+c[0]+d[0])/4,(a[1]+b[1]+c[1]+d[1])/4];
    for (const native of [false,true]) {
      const solids=steppengartenShelterSolidsV283(native);
      const roofs=solids.filter(s=>(s.topAt(...centre as [number,number])??-Infinity)>data.groundY+3);
      expect(roofs.length).toBeGreaterThan(0);
      for(const roof of roofs) expect(roof.bottomAt?.(...centre as [number,number])??roof.minY).toBeGreaterThan(data.groundY+2);
      expect(Math.max(...solids.map(s=>s.maxY))).toBeLessThan(7);
    }
  });

  test('exact source tuple guards preserve changed or ambiguous owners', () => {
    const original=data.previousPrisms[0];
    expect(isSteppengartenShelterSourceV283(original)).toBe(true);
    expect(isSteppengartenShelterSourceV283({...original,h_dm:original.h_dm+1})).toBe(false);
    const test=createSteppengartenShelterColumnTesterV283([original],4);
    for(const row of data.columns) expect(test(...row as [number,number,number,number,number])).toBe(true);
    expect(test(...[...data.columns[0].slice(0,3),999,0] as [number,number,number,number,number])).toBe(false);
    for(const source of [[],[original,original],[{...original,h_dm:1}]]) {
      expect(createSteppengartenShelterColumnTesterV283(source,4)(...data.columns[0] as [number,number,number,number,number])).toBe(false);
    }
    const foreign={...original,id:'foreign'};
    const protectedColumn=createSteppengartenShelterColumnTesterV283([original,foreign],4);
    expect(protectedColumn(...data.columns[0] as [number,number,number,number,number])).toBe(false);
  });

  test('distant coverage removes only the enabled exact former tower', () => {
    const buildings=data.previousPrisms as PrismPayload['buildings'];
    const payload={buildings, classes:['concrete','glass']} as PrismPayload;
    const replaced=createDistantBuildingShells(payload,buildings,{steppengartenShelterV283:true});
    expect(replaced.children.length).toBe(0);
    const retained=createDistantBuildingShells(payload,buildings);
    expect(retained.children.length).toBeGreaterThan(0);
  });
});
