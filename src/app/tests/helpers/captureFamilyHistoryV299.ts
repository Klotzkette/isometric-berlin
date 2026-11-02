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
const {geometryPreservationV206}=await import("./geometryPreservationV206");
const {staticGeometryAudit,disposeStaticAudit}=await import("./staticGeometryAudit");
const {createExpandedCityDetails}=await import("../../src/ExpandedCityDetails");
const {createBerlinBoundariesV200}=await import("../../src/BerlinBoundariesV200");
const scene=(await import("../../public/mesh/regierungsviertel/scene.json")).default;
function capture(root:any){root.updateMatrixWorld(true);const nodes:any[]=[];root.traverse((o:any)=>nodes.push(o));const records=geometryPreservationV206(root),buffers:Record<string,unknown>={},states:Record<string,unknown>={};nodes.forEach((o,i)=>{if(!o.geometry)return;const mat=(m:any)=>m?Object.fromEntries(["color","emissive","emissiveIntensity","opacity","roughness","metalness","transparent","side","wireframe","vertexColors","alphaTest","depthTest","depthWrite","toneMapped","blending","polygonOffset","polygonOffsetFactor","polygonOffsetUnits","linewidth"].filter(k=>m[k]!==undefined).map(k=>[k,m[k]?.isColor?m[k].toArray():m[k]])):null;states[records[i].key]={position:o.position.toArray(),rotation:o.rotation.toArray(),scale:o.scale.toArray(),matrix:o.matrix.toArray(),visible:o.visible,renderOrder:o.renderOrder,frustumCulled:o.frustumCulled,groups:o.geometry.groups,drawRange:o.geometry.drawRange,materials:(Array.isArray(o.material)?o.material:[o.material]).map(mat)};const pack=(a:any)=>a?{type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,bytes:Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength).toString("base64")}:null;buffers[records[i].key]={...(o.isInstancedMesh?{matrix:pack(o.instanceMatrix),color:pack(o.instanceColor)}:{}),attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,a])=>[k,pack(a)])),index:pack(o.geometry.index)};});return{records,static:staticGeometryAudit(root),buffers,states,children:root.children.map((c:any)=>c.name)};}
const families:Record<string,unknown>={};
for(const profile of["full","mobile"]as const){const root=createExpandedCityDetails(scene.landmarks as any,{detailProfile:profile});try{families["expanded-"+profile]=capture(root);}finally{disposeStaticAudit(root);}}
for(const native of[false,true]){const root=createBerlinBoundariesV200(native);try{families[native?"boundaries-native":"boundaries-drawn"]=capture(root);}finally{disposeStaticAudit(root);}}
await Bun.write(output,JSON.stringify({commit,graphs:Object.fromEntries(Object.entries(graphs).sort()),families})+"\n");
