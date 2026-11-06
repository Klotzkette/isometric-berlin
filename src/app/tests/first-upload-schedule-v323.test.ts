import {describe,test,expect} from "bun:test";
import {createFirstUploadScheduleV323} from "../src/firstUploadScheduleV323";
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return{promise,resolve};};
function setup(){
 const paint=deferred(), events:string[]=[];
 const task=createFirstUploadScheduleV323({*parkSteps(){events.push("park1");yield;events.push("park2");},release(){events.push("release");}}, {
  yieldTask:async()=>{},yieldAfterPaint:()=>paint.promise,isCancelled:()=>false,
  onSettled:()=>events.push("settled"),onError:()=>events.push("error"),
 });return{paint,events,task};
}
describe("first upload parking scheduling",()=>{
 test("a failed post-render paint scheduler still drains and opens the barrier",async()=>{
  const events:string[]=[];
  const task=createFirstUploadScheduleV323({*parkSteps(){events.push("park");},release(){events.push("release");}}, {
   yieldTask:async()=>{},yieldAfterPaint:async()=>{throw Error("scheduler");},isCancelled:()=>false,
   onSettled:()=>events.push("settled"),onError:()=>events.push("error"),
  });
  task.afterRender();for(let i=0;i<10;i++)await Promise.resolve();
  expect(events).toEqual(["error","park","release","settled"]);expect(task.pending).toBe(false);
 });
 test("keeps buffers through the render and paint, then drains once",async()=>{
  const{paint,events,task}=setup();expect(task.pending).toBe(true);
  await Promise.resolve();expect(events).toEqual([]);
  task.afterRender();task.afterRender();await Promise.resolve();expect(events).toEqual([]);
  paint.resolve();await paint.promise;await task.finish();
  expect(events).toEqual(["park1","park2","release","settled"]);expect(task.pending).toBe(false);
  await task.finish();task.afterRender();expect(events).toHaveLength(4);
 });
 test("a mode change drains before a first frame without waiting for paint",async()=>{
  const{paint,events,task}=setup();task.afterRender();await task.finish();
  expect(events).toEqual(["park1","park2","release","settled"]);
  paint.resolve();await paint.promise;await Promise.resolve();expect(events).toHaveLength(4);
 });
 test("dispose releases references and cannot start delayed work",async()=>{
  const{paint,events,task}=setup();task.afterRender();task.release();paint.resolve();
  await paint.promise;await task.finish();expect(events).toEqual(["release"]);expect(task.pending).toBe(false);
 });
 test("cancellation releases once and cannot resume background work",async()=>{
  const step=deferred(),events:string[]=[];let cancelled=false;
  const task=createFirstUploadScheduleV323({*parkSteps(){events.push("started");yield;},release(){events.push("released");}}, {
   yieldTask:()=>step.promise,yieldAfterPaint:async()=>{},isCancelled:()=>cancelled,
   onSettled:()=>events.push("settled"),onError:()=>{},
  });
  const result=task.finish();task.release();cancelled=true;step.resolve();
  await expect(result).rejects.toMatchObject({name:"AbortError"});
  expect(events).toEqual(["released"]);expect(task.pending).toBe(false);
 });
});
