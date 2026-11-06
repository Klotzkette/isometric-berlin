import {test,expect} from "bun:test";
import {loadStartupModuleV323} from "../src/startupModuleLoadingV323";
test("split imports retry at real task boundaries and return the actual module",async()=>{
 const events:string[]=[],module={factory:()=>42};let attempts=0;
 const loaded=await loadStartupModuleV323(async()=>{events.push("import");if(++attempts<3)throw Error("transport");return module;},async()=>{events.push("task");});
 expect(loaded).toBe(module);expect(loaded.factory()).toBe(42);expect(events).toEqual(["import","task","import","task","import"]);
});
test("permanent import failures reject after exactly three attempts",async()=>{
 let attempts=0;const failure=Error("offline");
 await expect(loadStartupModuleV323(async()=>{attempts++;throw failure;},async()=>{})).rejects.toBe(failure);
 expect(attempts).toBe(3);
});
test("dispose while waiting prevents another import",async()=>{
 let attempts=0,cancelled=false;
 await expect(loadStartupModuleV323(async()=>{attempts++;throw Error("transport");},async()=>{cancelled=true;},()=>cancelled)).rejects.toMatchObject({name:"AbortError"});
 expect(attempts).toBe(1);
});
