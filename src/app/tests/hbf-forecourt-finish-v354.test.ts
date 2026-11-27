import {expect,test} from 'bun:test';
import {BoxGeometry,Color,InstancedMesh,Matrix4,MeshBasicMaterial,MeshStandardMaterial,ShaderLib} from 'three';
import {bindHbfForecourtFinishV354 as bind,hbfForecourtPavedAtV354 as paved,inheritHbfForecourtFinishV354 as inherit,markHbfForecourtFinishV354 as mark,patchHbfForecourtShaderV354 as patch} from '../src/HbfForecourtFinishV354';
import {bindGroundFinishV348,markGroundFinishV348,patchGroundFinishShaderV348} from '../src/GroundFinishV348';
import {groundRangeShaderSafeV383} from '../src/groundRangeShaderProvenanceV383';
import {retireSceneMaterialPrograms} from '../src/sceneMaterialPrograms';
import {deserializeTransferredObject3D,serializeObject3DForTransfer} from '../src/transferableObject3D';

function ground(native=false){
 const mesh=new InstancedMesh(new BoxGeometry(),new MeshStandardMaterial(),1);
 mesh.name=native?'Voxel ground runs':'Drawn ground slabs';mesh.setMatrixAt(0,new Matrix4().makeScale(4,3,4).setPosition(-140,3,-800));
 mesh.setColorAt(0,new Color(native?0x74b043:0xb9d9aa));return mesh;
}
function compile(m:any){const shader={vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(shader,{});return shader;}
test('ground draw ranges accept both authored finishes only over known vertex behavior',()=>{
 for(const native of [false,true])for(const foreign of [false,true]){
  const mesh=ground(native), material=mesh.material;
  if(foreign)material.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += float(gl_InstanceID);');};
  markGroundFinishV348(mesh,native?'core-native':'core-drawn');
  expect(bindGroundFinishV348(mesh,native)).toBe(native?0:1);
  expect(groundRangeShaderSafeV383(material)).toBe(!foreign);
  expect(mark(mesh,native)).toBe(true);expect(bind(mesh)).toBe(1);
  expect(groundRangeShaderSafeV383(material)).toBe(!foreign);
  const shader=compile(material);
  expect(shader.vertexShader.includes('gl_InstanceID')).toBe(foreign);
  expect(shader.vertexShader.includes('vGroundWorldV348')).toBe(!native);
  expect(shader.vertexShader).toContain('forecourtPositionV354=instanceMatrix*forecourtPositionV354');
  mesh.geometry.dispose();material.dispose();
 }
});
test('actual place masks preserve grove, planted holes and the complete outside',()=>{
 for(const native of [false,true]){
  expect(paved(-100,-500,native)).toBe(true);expect(paved(-140,-800,native)).toBe(true);
  expect(paved(-80,-780,native)).toBe(true);
  for(const [x,z]of[[-180,-500],[-160,-920],[0,0],[-1000,-800],[-130,-700]])expect(paved(x,z,native)).toBe(false);
 }
 expect(paved(NaN,-500)).toBe(false);
});
test('only marked source ground qualifies and all original buffers stay exact',()=>{
 for(const native of [false,true]){
  const m=ground(native),matrix=m.instanceMatrix.array.slice(),colours=m.instanceColor!.array.slice(),positions=m.geometry.attributes.position.array.slice(),indices=m.geometry.index!.array.slice();
  expect(bind(m)).toBe(0);expect(mark(m,native)).toBe(true);expect(bind(m)).toBe(1);expect(bind(m)).toBe(0);
  const shader=compile(m.material);expect(shader.fragmentShader).toContain('forecourtFinishV354');
  expect(m.instanceMatrix.array).toEqual(matrix);expect(m.instanceColor!.array).toEqual(colours);expect(m.geometry.attributes.position.array).toEqual(positions);expect(m.geometry.index!.array).toEqual(indices);
  expect(m.material.map).toBeNull();expect(m.material.depthWrite).toBe(true);expect(m.material.transparent).toBe(false);
  m.name='unrelated grass';const unbound=new MeshBasicMaterial();m.material=unbound as any;expect(bind(m)).toBe(0);m.geometry.dispose();unbound.dispose();
 }
});
test('shader chains original ground finish, keeps source discard and exits before polygon tests outside station',()=>{
 for(const native of [false,true]){
  let first=patchGroundFinishShaderV348(ShaderLib.standard.vertexShader,ShaderLib.standard.fragmentShader);
  const result=patch(first.vertex,'// prior discard\n'+first.fragment,native);
  expect(result.fragment).toContain('// prior discard');expect(result.fragment).toContain('diffuseColor.rgb=groundFinishV348(diffuseColor.rgb);\ndiffuseColor.rgb=forecourtFinishV354(diffuseColor.rgb);');
  expect(result.fragment.indexOf('if(p.x<')).toBeLessThan(result.fragment.indexOf('if(!(distance'));
  expect(result.vertex).toContain('instanceMatrix*forecourtPositionV354');expect(result.fragment).toContain('abs(n.y)<length(n)*.9');
  expect(patch(result.vertex,result.fragment,native)).toEqual(result);
 }
});
test('worker roundtrip, independent clone and GPU program retirement preserve bounded finish; disposal ends it',()=>{
 const m=ground();mark(m);bind(m);
 const restored=deserializeTransferredObject3D(structuredClone(serializeObject3DForTransfer(m).object)) as InstancedMesh;
 expect(bind(restored)).toBe(1);expect(restored.instanceMatrix.array).toEqual(m.instanceMatrix.array);
 const clone=new MeshBasicMaterial();expect(inherit(m.material,clone)).toBe(true);expect(compile(clone).fragmentShader).toContain('forecourtFinishV354');
 retireSceneMaterialPrograms(m);expect(compile(m.material).fragmentShader).toContain('forecourtFinishV354');
 m.material.dispose();expect(compile(m.material).fragmentShader).not.toContain('forecourtFinishV354');
 const later=new MeshBasicMaterial();expect(inherit(m.material,later)).toBe(false);
 restored.geometry.dispose();(restored.material as MeshStandardMaterial).dispose();m.geometry.dispose();clone.dispose();later.dispose();
});
