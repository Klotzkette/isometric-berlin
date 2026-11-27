import { expect, test } from 'bun:test';
import { BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShaderLib } from 'three';
import { bindHbfVentFinishV349, HBF_VENT_FINISH_V349, inheritHbfVentFinishV349, markHbfVentFinishV349, patchHbfVentFinishShaderV349 } from '../src/HbfVentFinishV349';
import { retireSceneMaterialPrograms } from '../src/sceneMaterialPrograms';
import { schwellenraumMaterialFor } from '../src/visual-modes/schwellenraum/materialGrade';
import { deserializeTransferredObject3D, serializeObject3DForTransfer } from '../src/transferableObject3D';
const compile = (material: any) => {
  const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} };
  material.onBeforeCompile(shader, {}); return shader;
};
const wall = () => {
  const mesh = new Mesh(new BoxGeometry(8.2, 60, .2), new MeshStandardMaterial({ color: 0xb5c2c5 }));
  mesh.name = HBF_VENT_FINISH_V349.owner; markHbfVentFinishV349(mesh); return mesh;
};
test('only exact marked owner qualifies, including restored Worker metadata', () => {
  const mesh = wall(), restored = new Mesh(mesh.geometry, new MeshStandardMaterial()); restored.name = mesh.name;
  expect(bindHbfVentFinishV349(restored)).toBe(0);
  restored.userData = JSON.parse(JSON.stringify(mesh.userData));
  expect(bindHbfVentFinishV349(restored, true)).toBe(0); expect(bindHbfVentFinishV349(restored)).toBe(1); expect(bindHbfVentFinishV349(restored)).toBe(0);
  const unrelated = wall(); unrelated.name = 'unrelated wall'; expect(bindHbfVentFinishV349(unrelated)).toBe(0);
  restored.material.dispose(); unrelated.material.dispose(); mesh.material.dispose(); unrelated.geometry.dispose(); mesh.geometry.dispose();
});
test('finish retains arrays, depth/opacity and earlier aperture hook', () => {
  const mesh = wall(), positions = mesh.geometry.attributes.position.array.slice();
  const indices = mesh.geometry.index!.array.slice(), source = mesh.material.toJSON();
  mesh.material.onBeforeCompile = shader => { shader.fragmentShader = '// prior aperture\n' + shader.fragmentShader; };
  expect(bindHbfVentFinishV349(mesh)).toBe(1); const shader = compile(mesh.material);
  expect(shader.fragmentShader).toContain('// prior aperture'); expect(shader.fragmentShader).toContain('#include <color_fragment>');
  expect(shader.fragmentShader).toContain('diffuseColor.rgb=hbfVentFinishV349(diffuseColor.rgb)');
  expect(mesh.geometry.attributes.position.array).toEqual(positions); expect(mesh.geometry.index!.array).toEqual(indices); expect(mesh.material.toJSON()).toEqual(source);
  expect(mesh.material.transparent).toBe(false); expect(mesh.material.depthWrite).toBe(true); mesh.geometry.dispose(); mesh.material.dispose();
});
test('mode clone survives program retirement; actual disposal ends inheritance', () => {
  const mesh = wall(), mode = new MeshBasicMaterial(); bindHbfVentFinishV349(mesh);
  expect(inheritHbfVentFinishV349(mesh.material, mode)).toBe(true); expect(compile(mode).fragmentShader).toContain('hbfVentFinishV349');
  retireSceneMaterialPrograms(mesh); expect(compile(mesh.material).fragmentShader).toContain('hbfVentFinishV349'); mesh.material.dispose();
  const later = new MeshBasicMaterial(); expect(inheritHbfVentFinishV349(mesh.material, later)).toBe(false);
  expect(compile(mesh.material).fragmentShader).not.toContain('hbfVentFinishV349'); later.dispose(); mode.dispose(); mesh.geometry.dispose();
});
test('standard/basic composition preserves projection and antialiases the local pattern', () => {
  for (const shader of [ShaderLib.basic, ShaderLib.standard]) {
    const patched = patchHbfVentFinishShaderV349(shader.vertexShader, shader.fragmentShader);
    expect(patched.vertex).toContain('#include <project_vertex>'); expect(patched.fragment).toContain('fwidth(p)'); expect(patched.fragment).toContain('smoothstep(.22,.8');
    expect(patchHbfVentFinishShaderV349(patched.vertex, patched.fragment)).toEqual(patched);
  }
});

test('actual Worker round trip restores the exact mesh finish without texture payload', () => {
  const mesh = wall(); bindHbfVentFinishV349(mesh);
  const restored = deserializeTransferredObject3D(structuredClone(serializeObject3DForTransfer(mesh).object)) as Mesh;
  expect(restored.name).toBe(HBF_VENT_FINISH_V349.owner);
  expect(restored.geometry.attributes.position.array).toEqual(mesh.geometry.attributes.position.array);
  expect(restored.geometry.index!.array).toEqual(mesh.geometry.index!.array);
  expect(bindHbfVentFinishV349(restored)).toBe(1);
  const material = restored.material as MeshStandardMaterial;
  expect(material.map).toBeNull(); expect(material.transparent).toBe(false);
  expect(compile(material).fragmentShader).toContain('hbfVentFinishV349');
  material.dispose(); restored.geometry.dispose(); mesh.material.dispose(); mesh.geometry.dispose();
});

test('cache identity retains each earlier hook before wrapping and remains stable', () => {
  const a = wall(), b = wall();
  a.material.onBeforeCompile = s => { s.fragmentShader = '// hook A\n' + s.fragmentShader; };
  b.material.onBeforeCompile = s => { s.fragmentShader = '// hook B\n' + s.fragmentShader; };
  const aKey = a.material.customProgramCacheKey(), bKey = b.material.customProgramCacheKey();
  expect(aKey).not.toBe(bKey); bindHbfVentFinishV349(a); bindHbfVentFinishV349(b);
  expect(a.material.customProgramCacheKey()).toBe(aKey + '|hbf-vent-finish-v349');
  expect(b.material.customProgramCacheKey()).toBe(bKey + '|hbf-vent-finish-v349');
  expect(a.material.customProgramCacheKey()).not.toBe(b.material.customProgramCacheKey());
  a.material.dispose(); b.material.dispose(); a.geometry.dispose(); b.geometry.dispose();
});
test('retained finish utility composes explicitly with a Schwellenraum grade', () => {
  const mesh = wall(); bindHbfVentFinishV349(mesh);
  const graded = schwellenraumMaterialFor(mesh, mesh.material);
  // V354 retires automatic inheritance with the erroneous north tower.
  expect(inheritHbfVentFinishV349(mesh.material, graded)).toBe(true);
  const shader = compile(graded);
  expect(shader.fragmentShader).toContain('diffuseColor.rgb=hbfVentFinishV349(diffuseColor.rgb)');
  expect(shader.fragmentShader).toContain('schwellenraumLuma');
  expect(shader.fragmentShader.match(/vec3 hbfVentFinishV349\(/g)).toHaveLength(1);
  expect(graded.customProgramCacheKey()).toContain('|schwellenraum-material-grade-v4|hbf-vent-finish-v349');
  expect(bindHbfVentFinishV349(mesh)).toBe(0);
  expect(compile(graded).fragmentShader).toEqual(shader.fragmentShader);
  mesh.material.dispose(); mesh.geometry.dispose();
});
