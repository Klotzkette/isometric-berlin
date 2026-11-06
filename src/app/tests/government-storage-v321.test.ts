import {expect,test} from "bun:test";
import {BufferAttribute,DynamicDrawUsage} from "three";
import {isParkedStaticStorageV321,parkStaticAttribute,staticStorageInfo} from "../src/losslessStaticStorage";
function finish<T>(steps:Generator<void,T>):T{let next=steps.next();while(!next.done)next=steps.next();return next.value;}
const source=()=>new BufferAttribute(new Float32Array(96000).fill(1.25),3);
test("private canonical parking is readable without inflating a retired mutable view",async()=>{
  const a=source(),before=a.array,pin=staticStorageInfo(a);
  expect(isParkedStaticStorageV321(a)).toBeFalse();expect(finish(parkStaticAttribute(a,true))).toBeGreaterThan(0);
  expect(before.byteLength).toBe(0);for(let i=0;i<10;i++)expect(isParkedStaticStorageV321(a)).toBeTrue();
  expect(staticStorageInfo(a).arrayIdentity).toBe(pin.arrayIdentity);
  const live=a.array;expect(live[123]).toBe(1.25);expect(isParkedStaticStorageV321(a)).toBeFalse();
  await new Promise(resolve=>setTimeout(resolve,10));expect(live.byteLength).toBe(0);expect(isParkedStaticStorageV321(a)).toBeTrue();
  a.needsUpdate=true;expect(isParkedStaticStorageV321(a)).toBeFalse();expect(a.array[123]).toBe(1.25);
});
test("copied accessors, changed getters, usage and replacement cannot assert canonical provenance",()=>{
  const a=source();finish(parkStaticAttribute(a,true));const array=Object.getOwnPropertyDescriptor(a,"array")!,update=Object.getOwnPropertyDescriptor(a,"needsUpdate")!;
  const forged=source();Object.defineProperty(forged,"array",array);Object.defineProperty(forged,"needsUpdate",update);
  expect(isParkedStaticStorageV321(forged)).toBeFalse();a.setUsage(DynamicDrawUsage);expect(isParkedStaticStorageV321(a)).toBeFalse();
  const b=source();finish(parkStaticAttribute(b,true));let calls=0;
  Object.defineProperty(b,"array",{configurable:true,get(){calls++;return new Float32Array(96000);}});
  expect(isParkedStaticStorageV321(b)).toBeFalse();expect(calls).toBe(0);
  const c=source();finish(parkStaticAttribute(c,true));c.array=new Float32Array(96000);expect(isParkedStaticStorageV321(c)).toBeFalse();
});
