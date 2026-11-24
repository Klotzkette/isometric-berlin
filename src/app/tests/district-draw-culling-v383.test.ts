import {expect,test} from "bun:test";
import {
  BufferAttribute, BufferGeometry, Frustum, Group, Matrix4, Mesh, MeshBasicMaterial,
  OrthographicCamera, PerspectiveCamera, Scene, Vector3, type GeometryGroup, type WebGLRenderer,
} from "three";
import {isParkedStaticStorageV321, parkStaticAttribute} from "../src/losslessStaticStorage";
import {installDistrictDrawCullingV383} from "../src/districtDrawCullingV383";

const positions = new Float32Array(24 * 400 * 9);
for (let tile=0,offset=0;tile<24;tile++) for (let i=0;i<400;i++) {
  const x=tile*130 + i%20*2, z=Math.floor(i/20)*2;
  positions.set([x,0,z, x+1.2,0,z+.6, x,1.3,z+1.1],offset); offset+=9;
}

function fixture(indexed:boolean) {
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new BufferAttribute(positions.slice(),3));
  if (indexed) geometry.setIndex(new BufferAttribute(Uint16Array.from({length:positions.length/3},(_,i)=>i),1));
  const material=new MeshBasicMaterial();
  const mesh=new Mesh(geometry, material);
  mesh.name="District raised kerbstones";
  const scene=new Scene(), parent=new Group();
  parent.position.set(10,7,-4);parent.rotation.y=.23;parent.add(mesh);scene.add(parent);
  scene.updateMatrixWorld(true);
  const calls: [number,number][]=[];
  const original: WebGLRenderer["renderBufferDirect"]=(cam,source,g,m,o,group)=>{
    expect(g).toBe(geometry);expect(o).toBe(mesh);expect(m).toBe(material);expect(source).toBe(scene);
    const start=Math.max(0,g.drawRange.start,group?.start??0);
    const end=Math.min(positions.length/3,g.drawRange.start+g.drawRange.count,group?group.start+group.count:Infinity);
    calls.push([start,end]);
  };
  const renderer={renderBufferDirect:original} as WebGLRenderer;
  const cleanup=installDistrictDrawCullingV383(renderer);
  expect(installDistrictDrawCullingV383(renderer)).toBe(cleanup);
  const draw=(cam: OrthographicCamera|PerspectiveCamera, group:GeometryGroup|null=null)=>{
    cam.updateMatrixWorld(true);
    calls.length=0;
    renderer.renderBufferDirect(cam,scene,geometry,material,mesh,group as GeometryGroup);
    return calls.slice();
  };
  return {geometry, material, mesh, renderer, original, draw, cleanup};
}

test("all potentially visible primitives remain in the original order under transformed perspective and orthographic cameras",()=>{
  for (const indexed of [true,false]) {
    const {geometry,mesh,draw,renderer,original,cleanup}=fixture(indexed);
    const perspective=new PerspectiveCamera(45,1.3,.1,2000);
    for (const camera of [perspective,new OrthographicCamera(-63,63,49,-49,.1,2000)]) {
      for (const x of [1170,1560]) {
        const target=new Vector3(x,0,20).applyMatrix4(mesh.matrixWorld);
        camera.position.copy(target).add(new Vector3(10,80,45));camera.lookAt(target);camera.updateMatrixWorld();
        geometry.setDrawRange(1536,26000-26000%3);
        const group={start:1995,count:24000,materialIndex:3};
        const draws=draw(camera,group);
        expect(draws.length).toBeGreaterThan(0);expect(draws.length).toBeLessThanOrEqual(8);
        expect(draws.reduce((n,[a,b])=>n+b-a,0)).toBeLessThan(15000);
        const clip=new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(mesh.matrixWorld);
        const frustum=new Frustum().setFromProjectionMatrix(clip,camera.coordinateSystem,camera.reversedDepth);
        let missing=0, possiblyVisible=0, previous=group.start;
        for (const [a,b] of draws) {expect(a).toBeGreaterThanOrEqual(previous);expect(b%3).toBe(0);previous=b;}
        for (let j=group.start;j<group.start+group.count;j+=3) {
          const [a,b,c]=[j,j+1,j+2].map(i=>new Vector3().fromBufferAttribute(geometry.getAttribute("position"),i));
          if (frustum.planes.some(p=>p.distanceToPoint(a)<0&&p.distanceToPoint(b)<0&&p.distanceToPoint(c)<0))continue;
          possiblyVisible++;
          if (!draws.some(([lo,hi])=>j>=lo&&j+3<=hi))missing++;
        }
        expect(possiblyVisible).toBeGreaterThan(30);expect(missing).toBe(0);
        expect(geometry.drawRange).toEqual({start:1536,count:25998});
      }
    }
    cleanup();expect(renderer.renderBufferDirect).toBe(original);
  }
});

test("bounds are rebuilt for changed geometry and unsupported or prewarm draws remain intact",()=>{
  const {geometry,material,mesh,draw}=fixture(true);
  const camera=new OrthographicCamera(-35,35,35,-35,.1,130);
  camera.position.set(18,55,3);camera.lookAt(18,0,3);
  expect(draw(camera).reduce((n,[a,b])=>n+b-a,0)).toBeLessThan(5000);
  const attr=geometry.getAttribute("position") as BufferAttribute;
  for(let i=0;i<attr.count;i++)attr.setX(i,attr.getX(i)+10000);attr.needsUpdate=true;
  expect(draw(camera)).toEqual([]);
  material.wireframe=true;expect(draw(camera)).toEqual([[0,attr.count]]);
  material.wireframe=false;mesh.frustumCulled=false;expect(draw(camera)).toEqual([[0,attr.count]]);
  mesh.frustumCulled=true;geometry.setDrawRange(90,0);expect(draw(camera)).toEqual([[90,90]]);
  geometry.setDrawRange(0,Infinity);const atypical={start:2,count:24000,materialIndex:1};
  expect(draw(camera,atypical)).toEqual([[2,24002]]);
});

test("camera moves reuse street bounds without inflating parked position or index arrays",()=>{
  const {geometry,draw}=fixture(true);
  const index=new BufferAttribute(Uint32Array.from({length:positions.length/3},(_,i)=>i),1);
  geometry.setIndex(index);
  const p=geometry.getAttribute("position") as BufferAttribute;
  const camera=new OrthographicCamera(-50,50,50,-50,.1,170);
  camera.position.set(12,70,15);camera.lookAt(12,0,15);
  expect(draw(camera).length).toBeGreaterThan(0);
  for(const a of [p,index]) {
    const park=parkStaticAttribute(a,true);
    while (!park.next().done) {}
    a.onUploadCallback();
    expect(isParkedStaticStorageV321(a)).toBe(true);
  }
  camera.position.x+=2;
  expect(draw(camera).length).toBeGreaterThan(0);
  expect(isParkedStaticStorageV321(p)).toBe(true);
  expect(isParkedStaticStorageV321(index)).toBe(true);
});
