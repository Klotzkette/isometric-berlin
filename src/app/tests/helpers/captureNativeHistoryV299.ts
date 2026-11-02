/** Test-only isolated immutable-source capture; never changes a repo module. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const [commit, output] = Bun.argv.slice(2);
if (!commit || !output) throw Error("Expected immutable commit/current and output path");
const root = resolve(import.meta.dir, "../../../..");
const graphs: Record<string,string> = {};
const sha = (raw: Uint8Array|string) => createHash("sha256").update(raw).digest("hex");
Bun.plugin({name:"isolated native historical v299 capture",setup(builder){
  builder.onLoad({filter:/\/src\/app\/(src|public)\/.*\.(ts|json)$/},args=>{
    const path=relative(root,args.path);
    const raw=commit==="current"?readFileSync(args.path):(()=>{
      const p=Bun.spawnSync(["git","show",`${commit}:${path}`],{cwd:root,maxBuffer:64*1024*1024});
      if(p.exitCode!==0)throw Error(new TextDecoder().decode(p.stderr));return p.stdout;
    })();
    graphs[path]=sha(raw);if(Bun.env.V299_CAPTURE_TRACE)process.stderr.write(path+"\n");
    const text=new TextDecoder().decode(raw);
    if(!args.path.endsWith(".json"))return{contents:text,loader:"ts"};
    const names=Object.keys(JSON.parse(text)).filter(k=>/^[a-zA-Z_$][\w$]*$/.test(k)&&k!=="default");
    return{contents:`const json=JSON.parse(${JSON.stringify(text)});export default json;`+names.map((k,i)=>`const field${i}=json[${JSON.stringify(k)}];export {field${i} as ${k}};`).join(""),loader:"js"};
  });
}});
const {preloadAltMitteNativeV169Source}=await import("../../src/AltMitteNativeCoreV169");
const {nativeV211,snapshotV211,disposeV211}=await import("./coreMaterialV211");
const {coreRecordsV281}=await import("./coreMaterialV281");
await preloadAltMitteNativeV169Source();
const profiles:Record<string,unknown>={};
const selected=new Set([
  "North rail concrete, rails, catenary and park furniture",
  "Minecraft Spreebogenpark surface blocks","Minecraft Reichstag block signature",
  "Minecraft Berlin Hauptbahnhof block signature","Sony surroundings block-native facades",
  "Block-native Leipziger Platz perimeter facades stone, glazing and frames",
  "Zoo native aviaries climbing rocks and furniture",
  "Surrounding Berlin outline alt-mitte-v169-5_0-piece-0 native Minecraft mapped surfaces and massing",
]);
for(const profile of["full","mobile"]as const){
  const world=nativeV211(profile);
  try{
    world.updateMatrixWorld(true);const records=coreRecordsV281(world),buffers:Record<string,unknown>={};let index=0;
    world.traverse((o:any)=>{if(!o.isMesh&&!o.isLineSegments)return;const rec=records[index++];if(!Bun.env.V299_CAPTURE_BUFFERS||!selected.has(o.name))return;
      const pack=(a:any)=>a?{type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,bytes:Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength).toString("base64")}:null;
      buffers[rec.key]=o.isInstancedMesh?{matrix:pack(o.instanceMatrix),color:pack(o.instanceColor)}:{attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,a])=>[k,pack(a)])),index:pack(o.geometry.index)};
    });
    profiles[profile]={snapshot:snapshotV211(world),records,buffers,children:world.children.map(c=>({name:c.name,children:c.children.length,userDataKeys:Object.keys(c.userData)}))};
  }
  finally{disposeV211(world);Bun.gc(true);}
}
const {createMinecraftArchitecturalLandmarks}=await import("../../src/MinecraftArchitecturalLandmarks");
const architectureRoot=createMinecraftArchitecturalLandmarks();architectureRoot.updateMatrixWorld(true);
const architectureRecords=coreRecordsV281(architectureRoot),architectureBuffers:Record<string,unknown>={};
architectureRoot.children.forEach((o:any,i)=>{if(!selected.has(o.name))return;const pack=(a:any)=>({type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,bytes:Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength).toString("base64")});architectureBuffers[architectureRecords[i].key]={matrix:pack(o.instanceMatrix),color:pack(o.instanceColor)};});
const architecture={snapshot:snapshotV211(architectureRoot),records:architectureRecords,buffers:architectureBuffers,children:architectureRoot.children.map((o:any)=>({name:o.name,count:o.count,cues:o.userData.cueCounts}))};disposeV211(architectureRoot);
await Bun.write(output,JSON.stringify({commit,graphs:Object.fromEntries(Object.entries(graphs).sort()),profiles,architecture},null,2)+"\n");
