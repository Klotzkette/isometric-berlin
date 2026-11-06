/** Finite authored-component finalizer. Original sources are read only. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
const repo=resolve(import.meta.dir,'../../..'),folder=process.argv[2];
if(!folder||!isAbsolute(folder)||folder.startsWith(repo+'/'))throw Error('External exact dual-engine capture required');
const a=JSON.parse(readFileSync(folder+'/bun.json','utf8')),b=JSON.parse(readFileSync(folder+'/node.json','utf8'));
if(JSON.stringify(a.records)!==JSON.stringify(b.records)||JSON.stringify(a.sources)!==JSON.stringify(b.sources))throw Error('Different actual engine words');
for(const[path,expected]of Object.entries(a.sources)){const got=createHash('sha256').update(readFileSync(repo+'/'+path)).digest('hex');if(got!==expected)throw Error('Changed original '+path);}
const hash=(v:unknown)=>{const s=JSON.stringify(v);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const ground=JSON.parse(readFileSync(repo+'/src/app/public/mesh/regierungsviertel/ground-context.json','utf8'));
const families:Record<string,unknown>={};
for(const record of a.records){const key=record.key==='schoenholz-mother'?'schoenholz':record.key,mode=record.native?'native':'drawn',sourceRecord=record.sourceRecord,input:Record<string,unknown>={};
 if(key==='berlin'||key==='pyramide'){const x=sourceRecord.poi.x_dm/10,z=sourceRecord.poi.z_dm/10,h=ground.ground_height,col=Math.min(h.cols-1,Math.floor((x/ground.cell_m-ground.grid.min_x_idx)/h.stride_cells)),row=Math.min(h.rows-1,Math.floor((z/ground.cell_m-ground.grid.min_z_idx)/h.stride_cells)),sampleIndex=row*h.cols+col;sourceRecord.ground={cell_m:ground.cell_m,grid:ground.grid,height:{cols:h.cols,rows:h.rows,stride_cells:h.stride_cells},sampleIndex,valueDm:h.y_dm[sampleIndex]};}
 else if(key==='schoenholz'){const module='data/northParksV198'+(record.native?'Native':'Drawn')+'0.json',original=JSON.parse(readFileSync(repo+'/src/app/src/'+module,'utf8')),rows=record.selected[0];Object.assign(input,{module,cellsControl:hash(original.cells),cellIndex:original.cells.findIndex((c:any)=>c.id==='0:-7'),cellId:'0:-7',rowIndices:rows.globalRows});}
 else if(key==='treptow'){Object.assign(input,{module:'data/eastParksV198.json',cenotaphsControl:hash(sourceRecord.cenotaphs),ownerCount:16,retiredCount:record.components.reduce((n:number,c:any)=>n+c.instances.count,0)});}
 const plan={schemaVersion:1,native:record.native,sourceBasename:'memorial-authored-v322',owners:[{id:sourceRecord.id,sourcePrism:sourceRecord,components:record.components}]};
 ((families[key]??={})as any)[mode]={groupName:record.groupName,sourceRecord,input,plan,control:hash(plan)};
}
const boulevard=JSON.parse(readFileSync(repo+'/geo_data/regierungsviertel/boulevard-v322-source.json','utf8')),cad=bowlevardSite();
function bowlevardSite(){const s=boulevard.sites.find((s:any)=>s.id==='node/1270806845');if(!s)throw Error('Missing mapped Vostell source');const [x,z]=s.point,h=ground.ground_height,col=Math.min(h.cols-1,Math.floor((x/ground.cell_m-ground.grid.min_x_idx)/h.stride_cells)),row=Math.min(h.rows-1,Math.floor((z/ground.cell_m-ground.grid.min_z_idx)/h.stride_cells)),sampleIndex=row*h.cols+col;return {...s,source:boulevard.source,ground:{cell_m:ground.cell_m,grid:ground.grid,height:{cols:h.cols,rows:h.rows,stride_cells:h.stride_cells},sampleIndex,valueDm:h.y_dm[sampleIndex]}};}
const allied=JSON.parse(readFileSync(repo+"/geo_data/regierungsviertel/allied-memorials-v322-source.json","utf8"));
const profile={schemaVersion:1,families,additions:{cadillacs:cad,french:{...allied.sites.french,source:allied.source},british:{...allied.sites.british,source:allied.source}}};writeFileSync(repo+'/src/app/src/data/memorialPreviousV322.json',JSON.stringify(profile)+'\n');
console.log(JSON.stringify({profile:hash(profile),plans:Object.fromEntries(Object.entries(families).map(([key,value]:any)=>[key,Object.fromEntries(Object.entries(value).map(([mode,p]:any)=>[mode,{control:p.control,input:p.input}]))])),bytes:JSON.stringify(profile).length}));
