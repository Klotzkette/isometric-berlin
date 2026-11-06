import {expect,test} from "bun:test";
import {fileURLToPath} from "node:url";

test("owner readiness leaves real losslessly parked indexes compressed across frame and GC boundaries",async()=>{
  const child=Bun.spawn(["bun",fileURLToPath(new URL("./helpers/exact-owners-park-v321.fixture.ts",import.meta.url))],{
    cwd:fileURLToPath(new URL("..",import.meta.url)),stdout:"pipe",stderr:"pipe",
  });
  const [code,out,errors]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  if(code!==0)throw Error(errors+out);
  expect(JSON.parse(out.trim().split("\n").at(-1)!)).toEqual({exactOwnersParkV321Cases:1,assertions:7,failures:0});
},5000);
