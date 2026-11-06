import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {gunzipSync} from "node:zlib";
import {InterleavedBufferAttribute, LineSegments, Mesh} from "three";
import data from "../src/data/clusterFacadesV320.json";
import {captureClusterFacadesV320, prepareClusterFacadesV320, CLUSTER_FACADES_KIND_V320} from "../src/ClusterFacadesV320";
import {buildSurroundingCityChunk, prepareSurroundingQuarterPredecessorV303, type SurroundingCityChunk, type SurroundingChunkGeometry, type SurroundingOwnershipOptions} from "../src/SurroundingCityGeometry";
import {disposeSurroundingCityRoot} from "../src/SurroundingCity";
import {loadSourceQuarterRecipesV309} from "../src/SourceQuarterCatalogueV309";
import {captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300} from "../src/NeighbourhoodPacketV300";
import {captureSourceQuarterPacketV303, prepareSourceQuarterPacketV303, type SourceQuarterTicketV303} from "../src/SourceQuarterPacketV303";
import {transformLosslessJsonData} from "../losslessJsonData";
import {decodeLosslessGzipJson} from "../src/losslessGzipJson";

const source=data as unknown as NeighbourhoodSourceV300;
const publicRoot=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("manifest.json",publicRoot),"utf8"));
const descriptors=new Map<string,any>(manifest.chunks.map((d:any)=>[d.id,d]));
function done<T>(g:Generator<void,T>):T {let n=g.next();while(!n.done)n=g.next();return n.value;}
function raw(key:string):SurroundingCityChunk {
  const [mode,id]=key.split(":"),descriptor=descriptors.get(id);if(!descriptor)throw Error("Missing actual cluster packet");
  const path=new URL(descriptor[mode].url,publicRoot),bytes=readFileSync(path);
  return JSON.parse((path.pathname.endsWith(".gz")?gunzipSync(bytes):bytes).toString());
}
function aggregate(entry:SurroundingChunkGeometry){
  const mesh=entry.root.children.find(c=>c instanceof Mesh) as Mesh|undefined;if(!mesh)throw Error("Missing real aggregate");
  const position=mesh.geometry.getAttribute("position");if(!(position instanceof InterleavedBufferAttribute))throw Error("Changed compact vertex contract");
  return {vertices:position.data.array,indices:mesh.geometry.index!.array};
}
async function options(id:string,native:boolean):Promise<SurroundingOwnershipOptions>{return {
  schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,
  operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,
  wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,
  neukoellnLandmarksV305:true,northFidelityV309:true,treptowWaterfrontV317:true,sourceQuarterSourcesV303:await loadSourceQuarterRecipesV309(id,native),
};}

test("actual production packets retain every previous XYZ/RGB word, line and unretired index with complete new fronts",async()=>{
  expect(source.keys.length).toBeGreaterThan(0);expect(new Set(source.keys).size).toBe(source.keys.length);
  for(const key of source.keys){
    const [mode,id]=key.split(":"),native=mode==="minecraft",input=raw(key),before=JSON.stringify(input),ownership=await options(id,native),plan=source.packets[key];
    let baseline:SurroundingChunkGeometry|undefined,current:SurroundingChunkGeometry|undefined;
    try{
      baseline=done(buildSurroundingCityChunk(structuredClone(input),id,native,false,ownership));
      current=done(buildSurroundingCityChunk(input,id,native,false,{...ownership,clusterFacadesV320:source}));
      expect(current.root.userData.sourceKinds).toContain(CLUSTER_FACADES_KIND_V320);expect(baseline.root.userData.sourceKinds).not.toContain(CLUSTER_FACADES_KIND_V320);
      expect(JSON.stringify(input)).toBe(before);expect(current.nav).toEqual(baseline.nav);
      const a=aggregate(baseline),b=aggregate(current);expect(b.vertices.subarray(0,a.vertices.length)).toEqual(a.vertices);
      const expected=a.indices.slice(),offsets:number[]=[];let total=0;
      for(const part of input.meshes){offsets.push(total);total+=Buffer.from(part.indices,"base64").byteLength/4;}
      for(const part of plan.retire)for(const triangle of part.triangles){const at=offsets[part.mesh]+triangle*3;expected[at+1]=expected[at];expected[at+2]=expected[at];}
      // The existing decoder promotes a complete index buffer to u32 when
      // appended vertices cross 65,535. Compare the retained index values.
      expect(b.indices.subarray(0,expected.length).every((value,i)=>value===expected[i])).toBeTrue();
      const positionsBytes=Buffer.from(plan.append.positions,"base64").byteLength,appendBytes=Buffer.from(plan.append.indices,"base64");
      expect(b.vertices.byteLength-a.vertices.byteLength).toBe(positionsBytes*2);
      expect(b.indices.length-a.indices.length).toBe(appendBytes.byteLength/4);
      expect(current.geometryBytes-baseline.geometryBytes).toBe(b.vertices.byteLength-a.vertices.byteLength+b.indices.byteLength-a.indices.byteLength);
      const expectedAppend=new Uint32Array(appendBytes.buffer.slice(appendBytes.byteOffset,appendBytes.byteOffset+appendBytes.byteLength));
      for(let i=0;i<expectedAppend.length;i++)expectedAppend[i]+=a.vertices.length/6;
      expect(Array.from(b.indices.subarray(expected.length))).toEqual(Array.from(expectedAppend));
      const aa=baseline.root.children.filter(c=>c instanceof LineSegments),bb=current.root.children.filter(c=>c instanceof LineSegments);expect(bb.length).toBe(aa.length);
      for(let i=0;i<aa.length;i++){
        const beforeGeometry=(aa[i] as LineSegments).geometry,afterGeometry=(bb[i] as LineSegments).geometry;
        expect(Object.keys(afterGeometry.attributes)).toEqual(Object.keys(beforeGeometry.attributes));
        for(const name of Object.keys(beforeGeometry.attributes)){
          const beforeAttribute=beforeGeometry.getAttribute(name),afterAttribute=afterGeometry.getAttribute(name);
          expect([afterAttribute.count,afterAttribute.itemSize,afterAttribute.normalized]).toEqual([beforeAttribute.count,beforeAttribute.itemSize,beforeAttribute.normalized]);
          expect(afterAttribute instanceof InterleavedBufferAttribute?afterAttribute.data.array:afterAttribute.array).toEqual(beforeAttribute instanceof InterleavedBufferAttribute?beforeAttribute.data.array:beforeAttribute.array);
        }
        expect(afterGeometry.index?.array).toEqual(beforeGeometry.index?.array);
      }
    }finally{if(baseline)disposeSurroundingCityRoot(baseline.root);if(current)disposeSurroundingCityRoot(current.root);}
  }
},120000);

test("new facade capture defaults closed, rejects changed originals and can be cancelled without source mutation",()=>{
  const key=source.keys[0],[mode,id]=key.split(":"),native=mode==="minecraft",input=raw(key),snapshot=JSON.stringify(input);
  expect(done(captureClusterFacadesV320(input,id,native))).toBeUndefined();
  const changed=structuredClone(input);changed.meshes[0].colors="AAAA"+changed.meshes[0].colors.slice(4);
  expect(done(captureClusterFacadesV320(changed,id,native,true))).toBeUndefined();
  const steps=captureClusterFacadesV320(input,id,native,true);expect(steps.next().done).toBeFalse();steps.return(undefined);expect(JSON.stringify(input)).toBe(snapshot);
  const ticket=done(captureClusterFacadesV320(input,id,native,true));expect(ticket).toBeDefined();
  const foreign={...input,origin:[input.origin[0]+1,...input.origin.slice(1)]};expect(done(prepareClusterFacadesV320(foreign,ticket))).toBe(foreign);
});

test("the new recipe catalogue keeps eager keys and reads only one weak per-packet construction plan",()=>{
  const raw=readFileSync(new URL("../src/data/clusterFacadesV320.json",import.meta.url),"utf8");
  const code=transformLosslessJsonData(raw,"/project/src/app/src/data/clusterFacadesV320.json")!.code;
  expect(code).toContain("WeakRef");let reads=0;
  const script=code.replace(/^import[^\n]*\n/,"").replace(/^export \{.*\};$/m,"").replace("export default __source;","return __source;");
  const transformed=new Function("__decodeLosslessGzip",script)((s:string)=>{reads++;return decodeLosslessGzipJson(s)});
  expect(transformed.keys).toEqual(source.keys);expect(reads).toBe(0);
  const first=transformed.packets[source.keys[0]];expect(first).toEqual(source.packets[source.keys[0]]);expect(reads).toBe(1);
  expect(transformed.packets[source.keys[0]]).toBe(first);expect(reads).toBe(1);
});

test("the frozen inventory contains fifty real four-owner groups and all eighty-six prepared packets stay within their original caps",async()=>{
  type FrontReport={windows:number;floors:number;bays:number};
  type Resolved={cluster:string;host:string;face:{owner:string;chunk:string;family:string};
    modes:Record<"drawn"|"minecraft",{fronts:FrontReport[];triangles:number;retire:{mesh:number;triangles:number[]}[]}>};
  type PreparedGuard={key:string;rawNavGuard:number;preparedNavGuard:number;rawLineGuard:number|null;
    preparedLineGuard:number|null;preparedParts:number;preparedKinds:string[]};
  const repoRoot=new URL("../../../",import.meta.url);
  const proof=JSON.parse(gunzipSync(readFileSync(new URL("geo_data/regierungsviertel/cluster-facades-v320-evidence.json.gz",repoRoot))).toString()) as {
    schemaVersion:number;groups:number;owners:number;bodyTrianglesRetired:number;sourceFilesWritten:number;
    pendingBunPrimaryGuards:string[];clusters:{id:string;ring:"inner"|"outer"}[];resolved:Resolved[];
    profiles:{path:string;sha256:string}[];actualPreparedGuards:PreparedGuard[];
    counts:{drawnTriangles:number;minecraftTriangles:number};
  };
  expect(proof.schemaVersion).toBe(1);expect(proof.groups).toBe(50);expect(proof.owners).toBe(200);
  expect(proof.clusters).toHaveLength(50);expect(new Set(proof.clusters.map(c=>c.id)).size).toBe(50);
  expect(proof.clusters.filter(c=>c.ring==="inner")).toHaveLength(28);
  expect(proof.clusters.filter(c=>c.ring==="outer")).toHaveLength(22);
  expect(proof.resolved).toHaveLength(200);expect(new Set(proof.resolved.map(r=>r.face.owner)).size).toBe(200);
  expect(proof.bodyTrianglesRetired).toBe(0);expect(proof.sourceFilesWritten).toBe(0);
  expect(proof.pendingBunPrimaryGuards).toEqual([]);

  // Bind the artifact back to every regional selection; counts alone cannot
  // certify a cluster that has no actual source owner or emitted windows.
  const profilePaths=["north","south","west"].map(region=>`geo_data/regierungsviertel/cluster-facades-v320-${region}-profile.json`).sort();
  expect(proof.profiles.map(p=>p.path).sort()).toEqual(profilePaths);
  const selected=new Map<string,{cluster:string;owner:string;chunk:string;family:string}>();
  for(const pin of proof.profiles){
    const bytes=readFileSync(new URL(pin.path,repoRoot));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(pin.sha256);
    const profile=JSON.parse(bytes.toString());
    for(const cluster of profile.clusters){
      expect(cluster.faces).toHaveLength(4);expect(new Set(cluster.faces.map((f:any)=>f.owner)).size).toBe(4);
      expect(proof.clusters.find(c=>c.id===cluster.id)?.ring).toBe(cluster.ring);
      for(const face of cluster.faces){
        expect(selected.has(face.owner)).toBeFalse();
        selected.set(face.owner,{cluster:cluster.id,owner:face.owner,chunk:face.chunk,family:face.family});
      }
    }
  }
  expect(selected.size).toBe(200);
  const grouped=new Map(proof.clusters.map(c=>[c.id,[] as Resolved[]]));
  const expectedOwners=new Map<string,Set<string>>();
  const emitted={drawn:0,minecraft:0};
  for(const row of proof.resolved){
    expect(selected.get(row.face.owner)).toEqual({cluster:row.cluster,owner:row.face.owner,chunk:row.face.chunk,family:row.face.family});
    expect(grouped.has(row.cluster)).toBeTrue();grouped.get(row.cluster)!.push(row);
    expect(Object.keys(row.modes).sort()).toEqual(["drawn","minecraft"]);
    for(const mode of ["drawn","minecraft"] as const){
      const report=row.modes[mode],key=`${mode}:${row.host}`;
      expect(report.fronts.length).toBeGreaterThan(0);expect(report.triangles).toBeGreaterThan(0);
      for(const front of report.fronts){
        expect(Number.isSafeInteger(front.windows)&&front.windows>0).toBeTrue();
        expect(Number.isSafeInteger(front.floors)&&front.floors>0).toBeTrue();
        expect(Number.isSafeInteger(front.bays)&&front.bays>0).toBeTrue();
      }
      expect(source.packets[key]?.owners).toContain(row.face.owner);
      if(row.face.family==="primary")expect(report.retire).toEqual([]);
      if(!expectedOwners.has(key))expectedOwners.set(key,new Set());expectedOwners.get(key)!.add(row.face.owner);
      emitted[mode]+=report.triangles;
    }
  }
  for(const rows of grouped.values())expect(rows).toHaveLength(4);
  expect(source.keys).toHaveLength(86);expect(new Set(source.keys).size).toBe(86);
  expect(Object.keys(source.packets).sort()).toEqual(source.keys);
  expect([...expectedOwners.keys()].sort()).toEqual(source.keys);
  const hosts=new Set(source.keys.map(key=>key.slice(key.indexOf(":")+1)));expect(hosts.size).toBe(43);
  for(const host of hosts)for(const mode of ["drawn","minecraft"])expect(source.keys).toContain(`${mode}:${host}`);
  expect(proof.actualPreparedGuards).toHaveLength(86);
  expect(new Set(proof.actualPreparedGuards.map(g=>g.key)).size).toBe(86);
  expect(proof.actualPreparedGuards.map(g=>g.key).sort()).toEqual(source.keys);
  const guards=new Map(proof.actualPreparedGuards.map(g=>[g.key,g]));
  const packedCount=(encoded:string,stride:number)=>Buffer.from(encoded,"base64").byteLength/stride;
  const appended={drawn:0,minecraft:0};
  for(const key of source.keys){
    expect(key).toMatch(/^(drawn|minecraft):[^:]+$/);
    const [mode,id]=key.split(":"),native=mode==="minecraft",input=raw(key),plan=source.packets[key],pin=guards.get(key)!;
    expect(plan.owners).toEqual([...expectedOwners.get(key)!].sort());
    expect(pin.rawNavGuard).toBe(plan.navGuard);expect(pin.preparedNavGuard).toBe(plan.preparedNavGuard!);
    expect(pin.rawLineGuard).toBe(plan.lineGuard);expect(pin.preparedLineGuard).toBe(plan.preparedLineGuard!);
    expect(Number.isSafeInteger(plan.preparedNavGuard)&&plan.preparedNavGuard!>0).toBeTrue();
    for(const retire of plan.retire){
      expect(["district-facades-v188","outer-facades-v230"]).toContain(input.meshes[retire.mesh].kind);
    }
    const ownership=await options(id,native),ticket=done(captureClusterFacadesV320(input,id,native,true));
    expect(ticket).toBeDefined();
    const quarters:SourceQuarterTicketV303[]=[];
    for(const entry of ownership.sourceQuarterSourcesV303??[]){
      const predecessor=entry.source.packets[key];if(!predecessor)continue;
      const prior=predecessor.preparedRecords
        ?done(captureSourceQuarterPacketV303(input,id,native,true,entry.source,entry.kind,entry.requiredReplacement))
        :done(captureNeighbourhoodPacketV300(input,id,native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind));
      if(prior)quarters.push(prior);
    }
    let prepared=done(prepareSurroundingQuarterPredecessorV303(input,id,native,ownership));
    for(const quarter of quarters)prepared=done(prepareSourceQuarterPacketV303(prepared,quarter));
    expect(prepared.meshes.length).toBe(pin.preparedParts);expect(prepared.meshes.map(p=>p.kind)).toEqual(pin.preparedKinds);
    const current=done(prepareClusterFacadesV320(prepared,ticket));
    expect(current).not.toBe(prepared);expect(current.meshes).toHaveLength(prepared.meshes.length+1);
    expect(current.meshes.length).toBeLessThanOrEqual(16);
    expect(current.meshes.reduce((n,p)=>n+packedCount(p.positions,6),0)).toBeLessThanOrEqual(400_000);
    expect(current.meshes.reduce((n,p)=>n+packedCount(p.indices,4),0)).toBeLessThanOrEqual(2_400_000);
    expect(current.meshes.at(-1)).toEqual(plan.append);
    appended[mode as "drawn"|"minecraft"]+=packedCount(plan.append.indices,12);
  }
  expect(appended.drawn).toBe(proof.counts.drawnTriangles);expect(appended.minecraft).toBe(proof.counts.minecraftTriangles);
  expect(emitted).toEqual(appended);
},120000);
