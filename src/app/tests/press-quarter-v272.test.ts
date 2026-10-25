import { test, expect } from 'bun:test';
import { InstancedMesh, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { createPressQuarterV272 } from '../src/PressQuarterV272';
import { pressQuarterV272RoofAt, pressQuarterV272SourceColumn } from '../src/pressQuarterV272Profile';
import source from '../src/data/pressQuarterV272.json';
import { letteringStrokePaths } from '../src/drawnLettering';
import { disposeSurroundingCityRoot } from '../src/SurroundingCity';
function inspect(native:boolean,mobileLike=false){
 const root=createPressQuarterV272(native,{mobileLike});let calls=0,bytes=0,instances=0;
 root.traverse(o=>{if(!(o instanceof Mesh))return;calls++;expect(o.userData.textureFree).toBe(true);for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);if(native){let orthogonal=true;for(let i=0;i<o.count;i++)for(const k of [1,2,4,6,8,9])orthogonal&&=o.instanceMatrix.array[i*16+k]===0;expect(orthogonal).toBe(true)}}});
 disposeSurroundingCityRoot(root);return{calls,bytes,instances};
}
test('press facades retain full mobile geometry and bounded independent native batches',()=>{
 for(const native of [false,true]){const m=inspect(native);expect(inspect(native,true)).toEqual(m);expect(m.calls).toBe(native?1:2);expect(m.bytes).toBeLessThan(8_000_000);expect(m.instances).toBeGreaterThan(15_000);console.log(native?'native':'drawn',m)}
});
test('tower transfer and roof profiles preserve exact legacy height and actual location',()=>{
 expect(pressQuarterV272SourceColumn(1720,1295,5.2,85.2)).toBe(true);
 expect(pressQuarterV272SourceColumn(1720,1295,5.2,17.2)).toBe(false);
 expect(pressQuarterV272SourceColumn(0,0,5.2,85.2)).toBe(false);
 expect(pressQuarterV272RoofAt(1720,1295)).toBeGreaterThan(80);
 expect(pressQuarterV272RoofAt(1720,1295,true)).toBeGreaterThan(80);
 expect(pressQuarterV272RoofAt(0,0)).toBe(null);
});

  test('Springer and taz signs read left-to-right from the public exterior in both modes',()=>{
    for(const native of [false,true]) {
      const root=createPressQuarterV272(native),mesh=root.children[root.children.length-1] as InstancedMesh;
      let index=native?source.counts.nativeShellBlocks+source.counts.nativeDetailBoxes:source.counts.facadeBoxes+source.ribSegments.length;
      for(const label of source.labels) {
        const paths=letteringStrokePaths(label.text,label.cap);
        const firstPaths=letteringStrokePaths(label.text[0],label.cap).length;
        const lastPaths=letteringStrokePaths(label.text.at(-1)!,label.cap).length;
        const a=native?label.nativeA:[label.a[0]+label.d[0]*label.length/2+label.n[0]*.82,label.a[1]+label.d[1]*label.length/2+label.n[1]*.82];
        const camera=new PerspectiveCamera(45,1,.01,200);camera.position.set(a[0]+label.n[0]*20,label.y+label.cap/2,a[1]+label.n[1]*20);camera.lookAt(a[0],label.y+label.cap/2,a[1]);camera.updateMatrixWorld(true);
        const first:number[]=[],last:number[]=[];
        for(let k=0;k<paths.length;k++)for(let j=1;j<paths[k].length;j++) {
          const p=paths[k][j-1],q=paths[k][j];
          const copies=native?Math.max(1,Math.ceil(Math.hypot(p[0]-q[0],p[1]-q[1])/.48)):1;
          for(let n=0;n<copies;n++) {
            const offset=index++*16;
            const projected=new Vector3(mesh.instanceMatrix.array[offset+12],mesh.instanceMatrix.array[offset+13],mesh.instanceMatrix.array[offset+14]).project(camera);
            if(k<firstPaths)first.push(projected.x);if(k>=paths.length-lastPaths)last.push(projected.x);
          }
        }
        if(label.text.length>1)expect(Math.max(...first)).toBeLessThan(Math.min(...last));
      }
      expect(index).toBe(mesh.count);
      root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();o.userData.dayMaterial.dispose();o.userData.nightMaterial.dispose();}});
    }
  });
