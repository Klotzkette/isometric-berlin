import { expect,test } from 'bun:test';
import { InstancedMesh,Matrix4 } from 'three';
import { createPankeBanksV229 } from '../src/PankeBanksV229';
import { staticGeometryAudit,disposeStaticAudit } from './helpers/staticGeometryAudit';
test('banks remain static, bounded and independently orthogonal in native mode',()=>{
  for(const native of [false,true]) {
    const root=createPankeBanksV229(native);
    try {
      expect(root.children.length).toBeGreaterThan(8);
      expect(root.children.length).toBeLessThan(40);
      expect(JSON.stringify(root.userData).length).toBeLessThan(500);
      root.traverse(o=>{
        expect(o.matrixAutoUpdate).toBeFalse();
        if(o instanceof InstancedMesh) {
          expect(native).toBeTrue();const m=new Matrix4();
          for(let i=0;i<o.count;i+=31) {
            o.getMatrixAt(i,m);expect(m.elements.every(Number.isFinite)).toBeTrue();
            for(const j of [1,2,4,6,8,9])expect(m.elements[j]).toBe(0);
          }
        }
      });
      const audit=staticGeometryAudit(root);expect(audit.budget.bytes).toBeLessThan(8*1024*1024);
    }finally{disposeStaticAudit(root);}
  }
});
