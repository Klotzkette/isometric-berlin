import {expect,test}from'bun:test';
import{Group}from'three';
import{createCoreUbahnLifecycleV326}from'../src/CoreUbahnLifecycleV326';
import{createNorthernLoaderV309}from'../src/northernLoaderV309';

test('only genuine completed transitions permit a new epoch; stale builds never publish',()=>{
 const world={},other={},released:object[]=[],life=createCoreUbahnLifecycleV326<object,object>(w=>released.push(w));
 const first=life.start(world)!;expect(life.current(world,first)).toBe(true);expect(life.start(world)).toBeUndefined();
 const end=life.begin(world);expect(life.current(world,first)).toBe(false);expect(life.start(world)).toBeUndefined();
 life.finish(world,first);expect(life.start(world)).toBeUndefined();const north={};end(north);end({});
 const next=life.start(world)!;expect(next.north).toBe(north);expect(life.current(world,next)).toBe(true);
 const staleFinish=life.begin(world),latestFinish=life.begin(world);staleFinish();expect(life.start(world)).toBeUndefined();latestFinish();expect(life.start(world)?.north).toBeUndefined();
 expect(life.start(other)).toBeDefined();expect(released).toEqual([world,world,world]);
});

test('real northern loader holds the barrier through publication or full rollback/release',async()=>{
 for(const fail of[false,true]){
  const world=new Group(),events:string[]=[];const life=createCoreUbahnLifecycleV326<Group,{root:Group;complete:()=>boolean}>(()=>events.push('release U'));
  let live=false,loader:ReturnType<typeof createNorthernLoaderV309<boolean,{root:Group;complete:()=>boolean}>>;
  loader=createNorthernLoaderV309({load:async()=>true,world:()=>world,active:()=>true,
   beginTransition:w=>{const end=life.begin(w);events.push('begin');return bundle=>{expect(life.start(w)).toBeUndefined();events.push(bundle?'settled admitted':'settled restored');end(bundle);};},
   build:function*(_m,_n,onCreate){const root=new Group();onCreate(root);yield;return{root,prepared:()=>true,complete:()=>live&&root.parent===world};},
   publish:()=>{expect(life.start(world)).toBeUndefined();events.push('publish');live=true;if(fail)throw Error('controlled failure');},
   rollback:()=>{expect(life.start(world)).toBeUndefined();events.push('rollback');live=false;},release:()=>events.push('release North'),yieldTask:async()=>{},
  });
  if(fail)await expect(loader.ensure(false)).rejects.toThrow('controlled failure');else expect(await loader.ensure(false)).toBe(loader.current(false));
  expect(events).toEqual(fail?['release U','begin','publish','rollback','release North','settled restored']:['release U','begin','publish','settled admitted']);
  const ticket=life.start(world)!;expect(life.current(world,ticket)).toBe(true);expect(!!ticket.north).toBe(!fail);loader.dispose();
 }
});
