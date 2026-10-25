import { describe, expect, test } from 'bun:test';
import { InstancedMesh, Mesh, PerspectiveCamera, Vector3 } from 'three';
import source from '../src/data/theatresV272.json';
import { letteringStrokePaths } from '../src/drawnLettering';
import { createTheatresV272 } from '../src/TheatresV272';
import { createGripsDetailsV272 } from '../src/GripsDetailsV272';
import { THEATRES_V272_PRISM_IDS, theatresV272SourceColumn, theatresV272RoofAt } from '../src/theatresV272Profile';
function metrics(factory: typeof createTheatresV272, native: boolean, mobileLike=false) {
  const root=factory(native,{mobileLike});let calls=0,bytes=0,instances=0;
  root.traverse(o=>{
    expect(o.matrixAutoUpdate).toBe(false);
    if (!(o instanceof Mesh)) return;
    calls++;expect(o.userData.textureFree).toBe(true);
    for(const a of Object.values(o.geometry.attributes)) bytes+=a.array.byteLength;
    if(o instanceof InstancedMesh) {
      bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);instances+=o.count;
      if(native) for(let i=0;i<o.count;i++)for(const k of [1,2,4,6,8,9])expect(Math.abs(o.instanceMatrix.array[i*16+k])).toBe(0);
    }
    o.geometry.dispose();o.userData.dayMaterial.dispose();o.userData.nightMaterial.dispose();
  });return {calls,bytes,instances};
}
describe('HAU complete measured venues and additive GRIPS v272',()=>{
  test('full drawn/mobile parity and independently orthogonal native geometry',()=>{
    for(const factory of [createTheatresV272,createGripsDetailsV272]){
      const drawn=metrics(factory,false),native=metrics(factory,true);
      expect(metrics(factory,false,true)).toEqual(drawn);expect(metrics(factory,true,true)).toEqual(native);
      expect(drawn.calls).toBe(factory===createTheatresV272?2:1);expect(native.calls).toBe(1);
      expect(drawn.bytes).toBeLessThan(180_000);expect(native.bytes).toBeLessThan(700_000);
      console.log(factory.name,{drawn,native});
    }
  });
  test('HAU signs read left-to-right from the public exterior in both modes',()=>{
    for(const native of [false,true]) {
      const root=createTheatresV272(native),mesh=root.children[root.children.length-1] as InstancedMesh;
      let index=native?source.counts.nativeShellBlocks+source.counts.nativeDetailBoxes:source.counts.facadeBoxes+source.ribSegments.length;
      const signParts=new Map<string,Vector3[]>();
      for(const label of source.labels) {
        const paths=letteringStrokePaths(label.text,label.height);
        const firstPaths=letteringStrokePaths(label.text[0],label.height).length;
        const lastPaths=letteringStrokePaths(label.text.at(-1)!,label.height).length;
        const a=native?label.nativeA:label.a;
        const camera=new PerspectiveCamera(45,1,.01,200);camera.position.set(a[0]+label.n[0]*20,label.y+label.height/2,a[1]+label.n[1]*20);camera.lookAt(a[0],label.y+label.height/2,a[1]);camera.updateMatrixWorld(true);
        const first:number[]=[],last:number[]=[];
        for(let k=0;k<paths.length;k++)for(let j=1;j<paths[k].length;j++) {
          const p=paths[k][j-1],q=paths[k][j];
          const copies=native?Math.max(1,Math.ceil(Math.hypot(p[0]-q[0],p[1]-q[1])/.48)):1;
          for(let n=0;n<copies;n++) {
            const offset=index++*16;
            const position=new Vector3(mesh.instanceMatrix.array[offset+12],mesh.instanceMatrix.array[offset+13],mesh.instanceMatrix.array[offset+14]);
            const points=signParts.get(label.text)??[];points.push(position.clone());signParts.set(label.text,points);
            const projected=position.project(camera);
            if(k<firstPaths)first.push(projected.x);if(k>=paths.length-lastPaths)last.push(projected.x);
          }
        }
        if(label.text.length>1)expect(Math.max(...first)).toBeLessThan(Math.min(...last));
      }
      expect(index).toBe(mesh.count);
      // The two separately authored parts of HAU1 must also have the order
      // visible in the operator photograph: HAU left, numeral 1 right.
      const hau=source.labels.find(label=>label.text==='HAU')!,one=source.labels.find(label=>label.text==='1')!;
      const a=native?hau.nativeA:hau.a,b=native?one.nativeA:one.a;
      const centre=new Vector3((a[0]+b[0])/2,hau.y+hau.height/2,(a[1]+b[1])/2);
      const camera=new PerspectiveCamera(55,1,.01,200);
      camera.position.copy(centre).add(new Vector3(hau.n[0]*24,0,hau.n[1]*24));camera.lookAt(centre);camera.updateMatrixWorld(true);
      expect(Math.max(...signParts.get('HAU')!.map(point=>point.project(camera).x)))
        .toBeLessThan(Math.min(...signParts.get('1')!.map(point=>point.project(camera).x)));
      root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();o.userData.dayMaterial.dispose();o.userData.nightMaterial.dispose();}});
    }
  });
  test('exact old rings and heights, including HAU3 low wing, gate replacement',()=>{
    expect([...THEATRES_V272_PRISM_IDS].sort()).toEqual(['59291480','65780505','75846696','81194038','81646698']);
    expect(theatresV272SourceColumn(1018,2130,5.2,17.2)).toBe(true);
    expect(theatresV272SourceColumn(1018,2130,5.2,16.2)).toBe(false);
    expect(theatresV272SourceColumn(1018,2130,6.2,18.2)).toBe(false);
    expect(theatresV272SourceColumn(1080,2130,5.2,17.2)).toBe(false);
    expect(theatresV272SourceColumn(929,2419,5.2,9.2)).toBe(true);
    expect(theatresV272RoofAt(1018,2130)).toBeGreaterThan(20);
    expect(theatresV272RoofAt(1018,2130,true)).toBeGreaterThan(20);
    expect(theatresV272RoofAt(0,0)).toBe(null);
  });
  test('GRIPS retains its existing owner and supplies only bounded secondary fittings',()=>{
    const root=createGripsDetailsV272();expect(root.userData.additiveOnly).toBe(true);
    const mesh=root.children[0] as InstancedMesh;
    expect(mesh.userData.recognitionRoles['spiral-stair-top-landing']).toBe(1);
    expect(mesh.userData.recognitionRoles['foyer-display-case']).toBe(2);
    expect(mesh.boundingBox!.min.x).toBeGreaterThan(-2063);expect(mesh.boundingBox!.max.x).toBeLessThan(-2014);
    mesh.geometry.dispose();mesh.userData.dayMaterial.dispose();mesh.userData.nightMaterial.dispose();
  });
});
