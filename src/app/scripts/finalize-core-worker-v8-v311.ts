/** Separate exact V8 profile controls; never edits an earlier source receipt. */
import{readFileSync,writeFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{gzipSync}from'node:zlib';
const data=import.meta.dir+'/../src/data/',path=process.argv[2]??data+'coreWorkerV8V311.json';
const base=JSON.parse(readFileSync(data+'coreTerrainContactV307.json','utf8')),actual=JSON.parse(readFileSync(data+'coreTerrainActualV310.json','utf8')),bridge=JSON.parse(readFileSync(data+'gesundbrunnenBridgeCoreV309Delta.json','utf8')),profile=JSON.parse(readFileSync(path,'utf8'));
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const fnv=(value:unknown)=>{let h=2166136261;const text=JSON.stringify(value);for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;return h;};
if(sha(data+'coreTerrainContactV307.json')!==profile.baseSourceSha256||sha(data+'coreTerrainActualV310.json')!==profile.actualDeltaSha256||sha(data+'gesundbrunnenBridgeCoreV309Delta.json')!==profile.bridgeDeltaSha256||fnv(actual)!==profile.actualDeltaControl||fnv(bridge)!==profile.bridgeDeltaControl)throw Error('Immutable original/actual/bridge source changed');
for(const[key,control]of Object.entries(actual.baseVariantControls))if(fnv(base.variants[key])!==control)throw Error('Original variant changed');
const variants={...base.variants};for(const[key,row]of Object.entries(actual.variants)as[string,any][]){const old=variants[key];if(old.parts.length!==1||fnv(old.parts[0])!==row.basePartControl)throw Error('Original actual-client Main changed');variants[key]={...old,captureSha256:row.captureSha256,parts:[{...old.parts[0],instances:row.instances,retire:row.retire}]};}
for(const[key,patch]of Object.entries(bridge.variants)as[string,any][]){const old=variants[key];variants[key]={...old,parts:old.parts.map((p:any)=>{const row=patch.parts.find((r:any)=>r.name===p.name&&r.parentName===p.parentName&&(r.batchId??null)===(p.batchId??null));if(!row)return p;if(fnv(p)!==row.basePartControl)throw Error('Original bridge source changed');return{...p,retire:[...p.retire,...row.retire].sort((a:number,b:number)=>a-b),outsideAdditions:row.outsideAdditions};})};}
for(const[key,control]of Object.entries(profile.baseVariantControls))if(fnv(variants[key])!==control)throw Error('Composed actual JSC/bridge source changed');
const key=profile.variant,old=variants[key],row=profile.part,matches=old.parts.map((p:any,i:number)=>({p,i})).filter(({p}:any)=>p.name===row.name&&p.parentName===row.parentName&&p.batchId===row.batchId);if(matches.length!==1)throw Error('One exact original lawn part required');const{p,i}=matches[0];row.basePartControl=fnv(p);
const retire=p.retire.map((n:number)=>n>=row.retireShift.fromOrdinal?n+row.retireShift.delta:n);if(retire.filter((n:number,j:number)=>n!==p.retire[j]).length!==918||p.retire.some((n:number)=>n>=1336986&&n<1337586))throw Error('Unknown source retirement block');
const parts=old.parts.slice();parts[i]={...p,attributes:row.attributes,index:row.index,retire};const candidate={...old,parts};
writeFileSync(path,JSON.stringify(profile));
const result={schemaVersion:1,profileSha256:sha(path),profileControl:fnv(profile),basePartControl:row.basePartControl,v8VariantControl:fnv(candidate),variantControls:{...profile.baseVariantControls,[key]:fnv(candidate)},oldRetireCount:p.retire.length,shiftedRetireCount:918,insideOutsideAndNavUnchanged:true};
writeFileSync(import.meta.dir+'/../../../geo_data/regierungsviertel/core-worker-v8-v311-controls.json.gz',gzipSync(JSON.stringify(result)));if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
