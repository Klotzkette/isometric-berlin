import {expect,test} from 'bun:test';
import {BoxGeometry,Mesh,MeshBasicMaterial,MeshStandardMaterial,ShaderLib} from 'three';
import {bindGroundFinishV348,inheritGroundFinishV348,markGroundFinishV348,patchGroundFinishShaderV348} from '../src/GroundFinishV348';
import {retireSceneMaterialPrograms} from '../src/sceneMaterialPrograms';
const compile=(material:any)=>{const shader={vertexShader:ShaderLib.basic.vertexShader,fragmentShader:ShaderLib.basic.fragmentShader,uniforms:{} as any};material.onBeforeCompile(shader,{});return shader;};
test('semantic finish preserves source geometry, colours and earlier aperture hooks',()=>{
 const material=new MeshBasicMaterial({color:0xf0d6bb});material.onBeforeCompile=s=>{s.fragmentShader='// retained aperture\n'+s.fragmentShader;};
 const mesh=new Mesh(new BoxGeometry(),material),position=mesh.geometry.attributes.position.array.slice(),json=material.toJSON();
 markGroundFinishV348(mesh,'paving');expect(bindGroundFinishV348(mesh)).toBe(1);expect(bindGroundFinishV348(mesh)).toBe(0);
 const s=compile(material);expect(s.fragmentShader).toContain('// retained aperture');expect(s.fragmentShader).toContain('#include <color_fragment>');expect(s.fragmentShader).toContain('diffuseColor.rgb=groundFinishV348(diffuseColor.rgb)');expect(mesh.geometry.attributes.position.array).toEqual(position);expect(material.toJSON()).toEqual(json);expect(s.uniforms.uGroundKindV348.value).toBe(2);
 mesh.geometry.dispose();material.dispose();
});
test('native and unmarked landmarks retain exact callbacks; transport metadata survives serialization',()=>{
 const mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());const before=mesh.material.onBeforeCompile;
 expect(bindGroundFinishV348(mesh)).toBe(0);markGroundFinishV348(mesh,'grass');expect(bindGroundFinishV348(mesh,true)).toBe(0);expect(mesh.material.onBeforeCompile).toBe(before);
 const restored=new Mesh(mesh.geometry,mesh.material);restored.userData=JSON.parse(JSON.stringify(mesh.userData));expect(bindGroundFinishV348(restored)).toBe(1);expect(compile(mesh.material).uniforms.uGroundKindV348.value).toBe(3);
 const native=new Mesh(mesh.geometry,new MeshBasicMaterial());markGroundFinishV348(native,'core-native');expect(bindGroundFinishV348(native)).toBe(0);native.material.dispose();mesh.geometry.dispose();mesh.material.dispose();
});
test('mode clones keep ground only and preserve retirement; actual disposal stops inheritance',()=>{
 const mesh=new Mesh(new BoxGeometry(),new MeshBasicMaterial());markGroundFinishV348(mesh,'asphalt');bindGroundFinishV348(mesh);
 const mode=new MeshBasicMaterial();expect(inheritGroundFinishV348(mesh.material,mode)).toBeTrue();expect(compile(mode).uniforms.uGroundKindV348.value).toBe(1);
 retireSceneMaterialPrograms(mesh);expect(compile(mesh.material).fragmentShader).toContain('groundFinishV348');
 mesh.material.dispose();expect(inheritGroundFinishV348(mesh.material,new MeshBasicMaterial())).toBeFalse();mode.dispose();mesh.geometry.dispose();
});
test('derivative-filtered finish composes standard/basic shaders and keeps instancing',()=>{
 for(const shader of [ShaderLib.basic,ShaderLib.standard]){const s=patchGroundFinishShaderV348(shader.vertexShader,shader.fragmentShader);expect(s.vertex).toContain('instanceMatrix*groundPositionV348');expect(s.vertex).toContain('batchingMatrix*groundPositionV348');expect(s.fragment).toContain('dFdx(vGroundWorldV348)');expect(patchGroundFinishShaderV348(s.vertex,s.fragment)).toEqual(s);}
});
