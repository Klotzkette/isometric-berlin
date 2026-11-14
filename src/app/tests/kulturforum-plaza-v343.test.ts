import { expect, test } from 'bun:test';
import { Group, Mesh, MeshBasicMaterial } from 'three';
import { createKulturforumPlazaV343, preparedKulturforumPlazaV343, KulturforumPlazaMaterialV343 } from '../src/KulturforumPlazaV343';
import { schwellenraumMaterialFor } from '../src/visual-modes/schwellenraum/materialGrade';
import source from '../src/data/kulturforumPlazaV343.json';
import type { VoxelPayload } from '../src/terrainPayload';
const ground = await Bun.file(`${import.meta.dir}/../public/mesh/regierungsviertel/ground-context.json`).json() as VoxelPayload;

test('only complete constructed source-bound plaza admits raster retirement',()=>{
 const root=createKulturforumPlazaV343(ground)!;
 expect(root).not.toBeNull();expect(preparedKulturforumPlazaV343(root)).toBe(source);
 expect(preparedKulturforumPlazaV343(new Group())).toBeNull();
 const mesh=root.children[0] as Mesh, pos=mesh.geometry.getAttribute('position');
 expect(pos.count).toBe(source.counts.vertices);
 pos.setY(0,pos.getY(0)+1);expect(preparedKulturforumPlazaV343(root)).toBeNull();
 const second=createKulturforumPlazaV343(ground)!;
 new Group().add(second);expect(preparedKulturforumPlazaV343(second)).toBeNull();
 const third=createKulturforumPlazaV343(ground)!;
 (third.children[0] as Mesh).geometry.dispose();expect(preparedKulturforumPlazaV343(third)).toBeNull();
});

test('altered measured ground fails closed before creating or retiring surfaces',()=>{
 expect(createKulturforumPlazaV343({...ground,cell_m:2})).toBeNull();
 const changed={...ground,ground_height:{...ground.ground_height!,y_dm:[...ground.ground_height!.y_dm]}};
 changed.ground_height.y_dm[0]++;
 expect(createKulturforumPlazaV343(changed)).toBeNull();
});

test('real day, night and Schwellenraum material path keeps filtered paving joints',()=>{
 const root=createKulturforumPlazaV343(ground)!, mesh=root.children[0] as Mesh;
 const day=mesh.userData.dayMaterial as KulturforumPlazaMaterialV343;
 const night=mesh.userData.nightMaterial as KulturforumPlazaMaterialV343;
 const grade=schwellenraumMaterialFor(mesh,day);
 for(const material of [day,night,day.clone(),grade]){
  expect(material instanceof MeshBasicMaterial).toBe(true);
  const shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <opaque_fragment>'};
  material.onBeforeCompile(shader as never,{} as never);
  expect(shader.vertexShader).toContain('vKulturforumPavingM');
  expect(shader.fragmentShader).toContain('fwidth(vKulturforumPavingM)');
  expect(shader.fragmentShader).toContain('plazaFade');
 }
 expect(grade.customProgramCacheKey()).toContain('kulturforum-plaza-v343');
 expect(grade.customProgramCacheKey()).toContain('schwellenraum-material-grade');
});
