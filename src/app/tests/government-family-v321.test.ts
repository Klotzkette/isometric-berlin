import {expect,test} from "bun:test";
import {fileURLToPath} from "node:url";

test("real government family lifecycle preserves preview ownership across pending, publish, release and fallback",async()=>{
  // Regional factories use finite two-owner adapters in a separate process.
  // Their module mocks cannot affect other architecture/navigation tests.
  const child=Bun.spawn(["bun",fileURLToPath(new URL("./helpers/government-family-v321.fixture.ts",import.meta.url))],{
    cwd:fileURLToPath(new URL("..",import.meta.url)),stdout:"pipe",stderr:"pipe",
  });
  const [code,out,errors]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  if(code!==0)throw Error(errors+out);
  const result=JSON.parse(out.trim().split("\n").at(-1)!);
  expect(result).toEqual({governmentFamilyV321Cases:22,assertions:256,failures:0});
},5000);
