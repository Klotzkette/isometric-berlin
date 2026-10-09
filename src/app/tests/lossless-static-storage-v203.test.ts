import { afterEach, expect, test } from "bun:test";
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Group, InterleavedBuffer, InterleavedBufferAttribute, Mesh, MeshBasicMaterial } from "three";
import { parkStaticAttribute, parkStaticGeometrySteps, staticStorageInfo } from "../src/losslessStaticStorage";
const nativeWeakRef=globalThis.WeakRef;
const references:Array<{clear():void}>=[];
function emulateCollection(){globalThis.WeakRef=class<T extends WeakKey>{
 private value:T|undefined;
 constructor(value:T){this.value=value;references.push(this)}
 deref(){return this.value} clear(){this.value=undefined}
 get [Symbol.toStringTag](){return "WeakRef"}
} as typeof WeakRef;}
afterEach(()=>{globalThis.WeakRef=nativeWeakRef;references.length=0});
function finish<T>(steps:Generator<void,T>):T{let n=steps.next();while(!n.done)n=steps.next();return n.value}
function bits(a:ArrayBufferView){return Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("hex")}
function source(){const a=new Float32Array(190001);for(let i=0;i<a.length;i++)a[i]=(i%37)/10;
 const w=new Uint32Array(a.buffer);w[0]=0x80000000;w[1]=0x7fc00001;w[2]=0x7fa00011;return a;}
test("multi-block storage restores every bit including signed zero and NaN payloads",()=>{
 emulateCollection();const a=new BufferAttribute(source(),1),expected=bits(a.array),count=a.count;
 expect(finish(parkStaticAttribute(a))).toBeGreaterThan(500000);
 for(let i=0;i<3;i++){references.forEach(r=>r.clear());const restored=a.array;
 expect(bits(restored)).toBe(expected);expect(a.array).toBe(restored);expect(a.count).toBe(count);expect(a.version).toBe(0)}
});
test("later Three mutation permanently retains its exact writable result",()=>{
 emulateCollection();const a=new BufferAttribute(source(),1);finish(parkStaticAttribute(a));references.forEach(r=>r.clear());
 a.setX(100,134.125);a.needsUpdate=true;references.forEach(r=>r.clear());
 expect(a.getX(100)).toBe(134.125);expect(a.version).toBe(1);
 expect(Object.getOwnPropertyDescriptor(a,"array")?.get).toBeUndefined();expect(finish(parkStaticAttribute(a))).toBe(0);
 a.needsUpdate=true;expect(a.version).toBe(2);
});
test("replacement and mutation during cooperative compression cannot restore stale bytes",()=>{
 emulateCollection();const a=new BufferAttribute(source(),1),steps=parkStaticAttribute(a);steps.next();a.setX(1,42);a.needsUpdate=true;
 expect(finish(steps)).toBe(0);finish(parkStaticAttribute(a));const replacement=source();replacement[0]=777;a.array=replacement;
 references.forEach(r=>r.clear());expect(a.array).toBe(replacement);
});
test("shared interleaved fields, indices, bounds and draw range remain intact",()=>{
 emulateCollection();const g=new BufferGeometry(),data=new InterleavedBuffer(new Float32Array(180000).fill(.125),6);
 g.setAttribute("position",new InterleavedBufferAttribute(data,3,0));g.setAttribute("color",new InterleavedBufferAttribute(data,3,3));
 g.setIndex(new BufferAttribute(new Uint32Array(30000).fill(2),1));g.userData.losslessStaticBacking=true;
 g.setDrawRange(6,300);g.computeBoundingBox();g.computeBoundingSphere();const bounds=g.boundingBox!.clone(),sphere=g.boundingSphere!.clone();
 const root=new Group();root.add(new Mesh(g,new MeshBasicMaterial()),new Mesh(g,new MeshBasicMaterial()));
 expect(finish(parkStaticGeometrySteps(root))).toBeGreaterThan(700000);references.forEach(r=>r.clear());
 expect(g.getAttribute("position").getX(123)).toBe(.125);expect(g.getAttribute("color").getZ(123)).toBe(.125);expect(g.index!.getX(10)).toBe(2);
 expect(g.boundingBox!.equals(bounds)).toBe(true);expect(g.boundingSphere!.equals(sphere)).toBe(true);expect(g.drawRange).toEqual({start:6,count:300});
});
test("dynamic, unapproved, tiny and unsupported storage stays ordinary",()=>{
 expect(finish(parkStaticAttribute(new BufferAttribute(source(),1).setUsage(DynamicDrawUsage)))).toBe(0);
 expect(finish(parkStaticAttribute(new BufferAttribute(new Float32Array(3),3)))).toBe(0);
 const g=new BufferGeometry().setAttribute("position",new BufferAttribute(source(),1));expect(finish(parkStaticGeometrySteps(new Mesh(g,new MeshBasicMaterial())))).toBe(0);
 globalThis.WeakRef=undefined as unknown as typeof WeakRef;expect(finish(parkStaticAttribute(new BufferAttribute(source(),1)))).toBe(0);
});

test("exclusive decoded views retire between jobs and rehydrate for uploads without GC", async()=>{
 const a=new BufferAttribute(source(),1),expected=bits(a.array),old=a.array,info=staticStorageInfo(a);
 expect(finish(parkStaticAttribute(a,true))).toBeGreaterThan(0);expect(old.byteLength).toBe(0);
 expect(staticStorageInfo(a).arrayIdentity).toBe(info.arrayIdentity);
 const upload=a.array;expect(bits(upload)).toBe(expected);
 await new Promise(resolve=>setTimeout(resolve,10));expect(upload.byteLength).toBe(0);
 expect(bits(a.array)).toBe(expected);a.setX(100,321);a.needsUpdate=true;
 const mutable=a.array;await new Promise(resolve=>setTimeout(resolve,10));
 expect(mutable.byteLength).toBeGreaterThan(0);expect(a.getX(100)).toBe(321);
});
test("exclusive-root retirement protects aliased buffers",async()=>{
 const values=source(),g=new BufferGeometry();g.userData.losslessStaticBacking=true;
 g.setAttribute("position",new BufferAttribute(values,1));g.setAttribute("normal",new BufferAttribute(values,1));
 finish(parkStaticGeometrySteps(new Mesh(g,new MeshBasicMaterial()),true));
 await new Promise(resolve=>setTimeout(resolve,10));expect(values.byteLength).toBeGreaterThan(0);
 expect(bits(g.getAttribute("position").array)).toBe(bits(values));
});
