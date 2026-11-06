import{expect,test}from"bun:test";
import{readFileSync}from"node:fs";
import{mkdtemp,mkdir,rm,writeFile}from"node:fs/promises";
import{tmpdir}from"node:os";
import{dirname,join,posix}from"node:path";
import{fileURLToPath}from"node:url";
import{gzipSync}from"node:zlib";
import ts from"typescript";
import{build}from"vite";
import config,{losslessCodecManualChunk,STARTUP_JS_BUDGET_BYTES,PROGRESSIVE_WORKER_JS_BUDGET_BYTES}from"../vite.config";
import{encodeLosslessBase85}from"../src/losslessGzipBase85";
import{losslessJsonData}from"../losslessJsonData";

test("actual Day metadata and shared codec cannot load or evaluate the deferred native packet",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"isometric-codec-chunks-"));
 try{
  const packet=fileURLToPath(new URL("../src/data/altMitteV169Native/packet-041.json",import.meta.url)),metadata=fileURLToPath(new URL("../src/data/altMitteV169Native/packet-042.json",import.meta.url)),codec=fileURLToPath(new URL("../src/losslessGzipJson.ts",import.meta.url)),paths=[packet,metadata,codec],originals=paths.map(path=>readFileSync(path));
  const entry=join(directory,"entry.ts"),packed=gzipSync('{"day":true}'),tiny=packed.toString("base64"),base85=fileURLToPath(new URL("../src/losslessGzipBase85.ts",import.meta.url));
  await writeFile(entry,`import {schemaVersion} from ${JSON.stringify(metadata)};import {decodeLosslessGzipJson} from ${JSON.stringify(codec)};import {decodeLosslessGzipJson as decode85} from ${JSON.stringify(base85)};export const day={schemaVersion,decoded:decodeLosslessGzipJson(${JSON.stringify(tiny)}),decoded85:decode85(${JSON.stringify(encodeLosslessBase85(packed))})};export const loadNative=()=>import(${JSON.stringify(packet)});`);
  const output=config.build!.rollupOptions!.output as{codeSplitting:unknown};
  const result=await build({configFile:false,root:directory,publicDir:false,logLevel:"error",plugins:[losslessJsonData([])],build:{write:false,minify:true,rolldownOptions:{input:entry,preserveEntrySignatures:"allow-extension",output:{codeSplitting:output.codeSplitting as any,format:"es",entryFileNames:"entry.js",chunkFileNames:"[name]-[hash].js"}}}});
  if(Array.isArray(result)||!("output"in result))throw Error("Expected bounded production output");
  const chunks=result.output.filter(item=>item.type==="chunk"),byName=new Map(chunks.map(item=>[item.fileName,item])),initial=chunks.find(item=>item.isEntry);if(!initial)throw Error("Missing entry");
  const closure=new Set<string>();const visit=(name:string)=>{if(closure.has(name))return;closure.add(name);const item=byName.get(name);if(!item)throw Error("Missing dependency "+name);const ast=ts.createSourceFile(name,item.code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);for(const node of ast.statements)if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))visit(posix.normalize(posix.join(posix.dirname(name),node.moduleSpecifier.text)));};visit(initial.fileName);
  const native=chunks.find(item=>item.fileName.startsWith("alt-mitte-v169-native-packet-041-"));if(!native)throw Error("Missing native packet");
  if(closure.has(native.fileName))console.log(JSON.stringify(chunks.map(c=>({file:c.fileName,imports:c.imports,exports:c.exports,modules:Object.keys(c.modules)}))));
  expect(closure.has(native.fileName)).toBeFalse();expect([...closure].reduce((n,name)=>n+Buffer.byteLength(byName.get(name)!.code),0)).toBeLessThan(100_000);expect([...closure].some(name=>name.startsWith("lossless-source-codecs-"))).toBeTrue();
  for(const item of chunks){const path=join(directory,item.fileName);await mkdir(dirname(path),{recursive:true});await writeFile(path,item.code);}
  const child=`import{readFileSync}from"node:fs";
const originalParse=JSON.parse,source=originalParse(readFileSync(${JSON.stringify(packet)},"utf8")),expectedMeshes=JSON.stringify(source.meshes);let nativeParses=0;
JSON.parse=function(value,...args){if(value===expectedMeshes)nativeParses++;return Reflect.apply(originalParse,this,[value,...args]);};
globalThis.document={querySelector:()=>null,getElementsByTagName:()=>[],createElement:()=>({relList:{supports:()=>true},setAttribute(){},addEventListener(){}}),head:{appendChild(){}}};
const module=await import(${JSON.stringify(join(directory,initial.fileName))});if(module.day.schemaVersion!==1||module.day.decoded.day!==true||module.day.decoded85.day!==true||nativeParses!==0)throw Error("Day evaluated native source");
const native=await module.loadNative();if(nativeParses!==1||JSON.stringify(native.default)!==JSON.stringify(source))throw Error("Native source changed/not eager once");
const d=Object.getOwnPropertyDescriptor(native.default,"meshes");if(!d||d.get||!d.writable||!d.enumerable||!d.configurable||d.value!==native.meshes)throw Error("Ordinary eager descriptor/aliases changed");
const held=native.default.meshes;held.codecChunkProbe={negativeZero:-0};if(native.meshes!==held||!Object.is(native.meshes.codecChunkProbe.negativeZero,-0))throw Error("Strong aliases/mutation changed");
const again=await module.loadNative();if(again!==native||again.default.meshes!==held||nativeParses!==1)throw Error("Source identity/lifetime changed");console.log(JSON.stringify({dayNativeParses:0,nativeParses,allPackedSourceStringsExact:true,ordinaryEagerAliases:true}));`;
  const run=Bun.spawnSync([process.execPath,"--eval",child],{cwd:directory});expect(run.exitCode).toBe(0);expect(run.stderr.toString()).toBe("");expect(JSON.parse(run.stdout.toString())).toEqual({dayNativeParses:0,nativeParses:1,allPackedSourceStringsExact:true,ordinaryEagerAliases:true});paths.forEach((path,i)=>expect(readFileSync(path).equals(originals[i])).toBeTrue());console.log({codecChunkFixture:{dayStaticBytes:[...closure].reduce((n,name)=>n+Buffer.byteLength(byName.get(name)!.code),0),nativeChunkBytes:Buffer.byteLength(native.code),dayNativeParses:0,requestedNativeParses:1}});
 }finally{await rm(directory,{recursive:true,force:true});}
});

 test("the finite codec boundary preserves the existing bootstrap and Worker caps",()=>{
 const root="/project/src/app/src/";for(const name of["losslessGzipJson.ts","losslessGzipBase85.ts","decodeBase64Bytes.ts","releaseScratchBuffer.ts"]){expect(losslessCodecManualChunk(root+name)).toBe("lossless-source-codecs");expect(losslessCodecManualChunk((root+name+"?import").replaceAll("/","\\"))).toBe("lossless-source-codecs");}
 expect(losslessCodecManualChunk("/project/node_modules/three/examples/jsm/libs/fflate.module.js")).toBe("lossless-source-codecs");for(const name of["/project/src/losslessGzipJson.ts",root+"data/altMitteV169Native/packet-041.json",root+"otherDecoder.ts","/project/node_modules/three/src/Three.js"])expect(losslessCodecManualChunk(name)).toBeUndefined();expect(STARTUP_JS_BUDGET_BYTES).toBe(400*1024);expect(PROGRESSIVE_WORKER_JS_BUDGET_BYTES).toBe(16*1024*1024);
 });
