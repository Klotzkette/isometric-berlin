import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {Mesh,LineSegments,InterleavedBufferAttribute} from "three";
import source from "../src/data/universitiesV322Packets.json";
import index from "../src/data/universitiesV322PacketIndex.json";
import {buildSurroundingCityChunk,type SurroundingOwnershipOptions,type SurroundingCityChunk,type SurroundingChunkGeometry} from "../src/SurroundingCityGeometry";
import {loadSourceQuarterRecipesV309} from "../src/SourceQuarterCatalogueV309";
import {disposeSurroundingCityRoot} from "../src/SurroundingCity";
import {clusterFacadesSourceV320} from "../src/ClusterFacadesV320";
import type {SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
const plans=source as unknown as SourceQuarterSourceV303;
const publicRoot=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url),manifest=JSON.parse(readFileSync(new URL("manifest.json",publicRoot),"utf8"));
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
function aggregate(entry:SurroundingChunkGeometry){const m=entry.root.children.find(c=>c instanceof Mesh)as Mesh,p=m.geometry.getAttribute("position")as InterleavedBufferAttribute;return{vertices:p.data.array,indices:m.geometry.index!.array};}
test("all finite university packets keep complete XYZ/RGB words and every outside index, line and navigation owner",async()=>{
 expect(plans.keys).toHaveLength(33);expect(index.keys).toEqual(plans.keys);let triangles=0,lines=0;
 for(const key of plans.keys){const [mode,id]=key.split(":"),native=mode==="minecraft",descriptor=manifest.chunks.find((d:any)=>d.id===id),raw=JSON.parse(gunzipSync(readFileSync(new URL(descriptor[mode].url,publicRoot))).toString())as SurroundingCityChunk,before=JSON.stringify(raw),plan=plans.packets[key];
  const previous=(await loadSourceQuarterRecipesV309(id,native)).filter(e=>e.kind!=="universities-v322");
  const ownership:SurroundingOwnershipOptions={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true,sourceQuartersV303:true,neukoellnLandmarksV305:true,northFidelityV309:true,treptowWaterfrontV317:true,governmentOfficesV321:true,clusterFacadesV320:clusterFacadesSourceV320,sourceQuarterSourcesV303:previous};
  let a:SurroundingChunkGeometry|undefined,b:SurroundingChunkGeometry|undefined;
  try{
   a=drain(buildSurroundingCityChunk(structuredClone(raw),id,native,false,ownership));b=drain(buildSurroundingCityChunk(raw,id,native,false,{...ownership,universitiesV322:true,sourceQuarterSourcesV303:[{source:plans,kind:"universities-v322",requiredReplacement:true,admission:"universities-v322"},...previous]}));
   expect(JSON.stringify(raw)).toBe(before);const aa=aggregate(a),bb=aggregate(b);expect(bb.vertices).toEqual(aa.vertices);
   expect(b.root.userData.sourceQuarterTrianglesV303-(a.root.userData.sourceQuarterTrianglesV303??0)).toBe(plan.retire.reduce((n,r)=>n+r.triangles.length,0));
   const expected=aa.indices.slice();let offset=0;
   for(let mesh=0;mesh<raw.meshes.length;mesh++){for(const r of plan.retire)if(r.mesh===mesh)for(const triangle of r.triangles){const at=offset+triangle*3;expected[at+1]=expected[at];expected[at+2]=expected[at];}offset+=Buffer.from(raw.meshes[mesh].indices,"base64").byteLength/4;}
   expect(bb.indices).toEqual(expected);const nav={...a.nav,buildings:a.nav.buildings.filter(old=>!plan.retireNav.some(r=>JSON.stringify(r)===JSON.stringify(old)))};expect(b.nav).toEqual(nav);
   const oldLines=a.root.children.filter(c=>c instanceof LineSegments)as LineSegments[],newLines=b.root.children.filter(c=>c instanceof LineSegments)as LineSegments[];expect(newLines).toHaveLength(oldLines.length);
   for(let i=0;i<oldLines.length;i++){
    const old=oldLines[i].geometry.getAttribute("position"),next=newLines[i].geometry.getAttribute("position"),oa=old instanceof InterleavedBufferAttribute?old.data.array:old.array,na=next instanceof InterleavedBufferAttribute?next.data.array:next.array,copy=oa.slice(),stride=old instanceof InterleavedBufferAttribute?old.data.stride:old.itemSize;
    for(const line of plan.retireLines)for(let axis=0;axis<3;axis++)copy[(line*2+1)*stride+axis]=copy[line*2*stride+axis];expect(na).toEqual(copy);
   }
   triangles+=plan.retire.reduce((n,r)=>n+r.triangles.length,0);lines+=plan.retireLines.length;
  }finally{if(a)disposeSurroundingCityRoot(a.root);if(b)disposeSurroundingCityRoot(b.root);}
 }
 console.log(JSON.stringify({universityPacketCount:plans.keys.length,retiredTriangles:triangles,retiredLines:lines,fullOutsideWords:true}));
},60000);
