import { expect, test } from 'bun:test';
import { Box3, Group, InstancedMesh, Mesh, PerspectiveCamera, Scene } from 'three';
import { PergamonRevealGesture } from '../src/pergamonRevealGesture';
import { createPergamonAltarV204 } from '../src/PergamonAltarV204';
import { createPergamonOutline, createPergamonReveal, pergamonWorld } from '../src/PergamonReveal';
import { createMuseumTriadArchitecture } from '../src/MuseumTriadArchitecture';
import { snapshot } from '../scripts/pergamon-preservation-snapshot';
import baseline from './fixtures/pergamon-exterior-v203.json';
for(const b of baseline)test(`all exterior triangles and instances unchanged: native=${b.minecraft}, mobile=${b.mobileLike}`,()=>{
 const {minecraft,mobileLike,...before}=b;expect(snapshot(minecraft,mobileLike)).toEqual(before);
});
test('tap classifier rejects dragging, multiple fingers, cancellation, long presses and duplicate delivery',()=>{
 const g=new PergamonRevealGesture();g.down(1,10,10,0,true);expect(g.up(1,11,10,100)).toBe(true);expect(g.up(1,11,10,100)).toBe(false);
 g.down(1,10,10,0,true);g.move(1,40,10);expect(g.up(1,10,10,100)).toBe(false);
 g.down(1,10,10,0,true);g.down(2,10,10,30,false);expect(g.up(2,10,10,80)).toBe(false);expect(g.up(1,10,10,100)).toBe(false);
 g.down(1,10,10,0,true);g.cancel();expect(g.up(1,10,10,100)).toBe(false);
 g.down(1,10,10,0,true);expect(g.up(1,10,10,700)).toBe(false);
 g.down(1,10,10,0,false);expect(g.up(1,10,10,100)).toBe(false);
});
test('granular white west front stays bounded and texture-free on every device',()=>{
 const root=createPergamonAltarV204();let bytes=0,instances=0;
 root.traverse(o=>{if(!(o instanceof Mesh))return;for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;
  if(o instanceof InstancedMesh){bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);instances+=o.count;}
  expect(o.geometry.getAttribute('uv')).toBeUndefined();expect(o.matrixAutoUpdate).toBe(false);
 });
 expect(root.children).toHaveLength(4);expect(bytes).toBeLessThan(1_200_000);expect(instances).toBeGreaterThan(3000);
 expect(root.userData.columnCount).toBe(42);expect(root.userData.reliefFigureCount).toBe(62);
 const bounds=new Box3().setFromObject(root);expect(bounds.max.y).toBeLessThan(12.5);expect(bounds.max.z-bounds.min.z).toBeLessThan(20);
 const outline=createPergamonOutline();expect(outline.geometry.getAttribute('position').count).toBe(72);
 console.log({altarBytes:bytes,altarInstances:instances});
});
test('reveal hides only Pergamon, restores it, and survives replacing drawn with native owners',async()=>{
 const scene=new Scene(),city=createMuseumTriadArchitecture();scene.add(city);
 const camera=new PerspectiveCamera(40,1,1,5000);camera.position.copy(pergamonWorld(-160,160,-76));camera.lookAt(pergamonWorld(-50,10,-76));camera.updateMatrixWorld(true);
 const canvas={getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:800,width:800,height:800})} as HTMLCanvasElement;
 const c=createPergamonReveal({scene,camera,canvas,invalidate:()=>{},disposeObject:r=>r.removeFromParent(),onError:e=>{throw e},reducedMotion:true});
 expect(c.hit(-1,1)).toBe(false);expect(c.hit(400,400)).toBe(true);expect(c.tap(400,400)).toBe(true);
 await new Promise(r=>setTimeout(r,10));expect(c.revealed).toBe(true);c.update(performance.now());
 expect(city.children.find(o=>o.userData.pergamonExterior)?.visible).toBe(false);expect(city.children.filter(o=>!o.userData.pergamonExterior).every(o=>o.visible)).toBe(true);
 scene.remove(city);const native=createMuseumTriadArchitecture({minecraft:true});scene.add(native);c.sync();expect(native.children.find(o=>o.userData.pergamonExterior)?.visible).toBe(false);
 await new Promise(r=>setTimeout(r,420));c.tap(400,400);expect(c.revealed).toBe(false);expect(native.children.every(o=>o.visible)).toBe(true);c.dispose();
 expect(scene.children.some(o=>o.userData.pergamonReveal)).toBe(false);
});
test('a disposed lazy reveal cannot attach a late model',async()=>{
 const scene=new Scene(),camera=new PerspectiveCamera();
 const c=createPergamonReveal({scene,camera,canvas:{} as HTMLCanvasElement,initiallyRevealed:true,reducedMotion:true,invalidate:()=>{},disposeObject:r=>r.removeFromParent(),onError:e=>{throw e}});
 c.dispose();await new Promise(r=>setTimeout(r,10));expect(scene.children).toHaveLength(0);expect(c.revealed).toBe(false);
});
test('a restored mobile runtime lazily rebuilds only the bounded exhibit',async()=>{
 const scene=new Scene(),camera=new PerspectiveCamera();let changes:boolean[]=[];
 const c=createPergamonReveal({scene,camera,canvas:{} as HTMLCanvasElement,initiallyRevealed:true,onChange:v=>changes.push(v),reducedMotion:true,invalidate:()=>{},disposeObject:r=>r.removeFromParent(),onError:e=>{throw e}});
 await new Promise(r=>setTimeout(r,10));expect(c.revealed).toBe(true);expect(changes).toEqual([true]);expect(scene.children).toHaveLength(1);c.update(performance.now());c.dispose();expect(scene.children).toHaveLength(0);
});
