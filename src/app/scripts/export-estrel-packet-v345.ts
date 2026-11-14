/** Offline complete model export: existing streamed ownership owns body and nav together. */
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {InstancedMesh,Mesh,Matrix4,Vector3,Color} from "three";
import {createEstrelTowerV345} from "../src/EstrelTowerV345";
import {estrelTowerSolidsV345} from "../src/EstrelTowerV345Navigation";
import {createSourceQuarterRecipeLoaderV309,SOURCE_QUARTER_CATALOGUE_V309} from "../src/SourceQuarterCatalogueV309";
import {captureSourceQuarterPacketV303} from "../src/SourceQuarterPacketV303";
import {captureNeighbourhoodPacketV300,type NeighbourhoodSourceV300} from "../src/NeighbourhoodPacketV300";
import {prepareSurroundingQuarterPredecessorV303,groundOverlayKindsV329,type SurroundingOwnershipOptions} from "../src/SurroundingCityGeometry";
import {surroundingPacketFingerprint} from "../src/surroundingPacketFingerprint";
const directory=process.argv[2];if(!directory)throw Error("Supply scratch output directory");mkdirSync(directory,{recursive:true});
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const load=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>e.kind!=="estrel-tower-v345"));
for(const native of[false,true]){
 const mode=native?"minecraft":"drawn",id="ring182-11_10",raw=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString());
 const recipes=await load(id,native),settings:SurroundingOwnershipOptions={neighbourhoodV300:true,westKiezV302:true,stralauSisyphosV299:true,sourceQuartersV303:true,northFidelityV309:true,treptowWaterfrontV317:true,neukoellnLandmarksV305:true,southFidelityV294:true,tachelesFrontsV270:true,littenStadthausV297:true,wallGalleryV298:true,sourceQuarterSourcesV303:recipes};
 const tickets=recipes.filter(e=>!groundOverlayKindsV329.has(e.kind)).map(e=>e.source.packets[`${mode}:${id}`]?.preparedRecords?drain(captureSourceQuarterPacketV303(raw,id,native,true,e.source,e.kind,e.requiredReplacement)):drain(captureNeighbourhoodPacketV300(raw,id,native,true,e.source as unknown as NeighbourhoodSourceV300,e.kind)));
 let prepared=drain(prepareSurroundingQuarterPredecessorV303(raw,id,native,settings));for(const ticket of tickets)if(ticket)prepared=drain(ticket(prepared));
 const root=createEstrelTowerV345(native);root.updateMatrixWorld(true);
 const positions:number[]=[],colors:number[]=[],indices:number[]=[],unique=new Map<string,number>(),matrix=new Matrix4(),point=new Vector3(),tint=new Color();
 root.traverse(node=>{if(!(node instanceof Mesh))return;const a=node.geometry.getAttribute("position"),c=node.geometry.getAttribute("color"),index=node.geometry.index;
  for(let instance=0;instance<(node instanceof InstancedMesh?node.count:1);instance++){
   if(node instanceof InstancedMesh){node.getMatrixAt(instance,matrix);matrix.premultiply(node.matrixWorld);node.getColorAt(instance,tint);}else{matrix.copy(node.matrixWorld);tint.setRGB(1,1,1);}
   const remap:number[]=[];
   for(let v=0;v<a.count;v++){
    point.fromBufferAttribute(a,v).applyMatrix4(matrix);
    const xyz=[point.x,point.y,point.z].map((n,k)=>Math.round((n-raw.origin[k])*100));
    const rgb=[tint.r,tint.g,tint.b].map((n,k)=>Math.round(n*(c?c.array[v*3+k]:1)*65535));
    if([...xyz,...rgb].some(n=>!Number.isFinite(n)||n<0||n>65535))throw Error("Export outside quantized domain");
    const key=[...xyz,...rgb].join("/"),prior=unique.get(key);let at=prior;
    if(at===undefined){at=positions.length/3;unique.set(key,at);positions.push(...xyz);colors.push(...rgb);}remap.push(at);
   }
   for(let i=0;i<(index?.count??a.count);i++)indices.push(remap[index?index.getX(i):i]);
  }
 });
 const encode=(a:Uint16Array|Uint32Array)=>Buffer.from(a.buffer).toString("base64");
 const append={kind:"estrel-tower-v345",positionType:"u16cm" as const,colorType:"u16linear" as const,positions:encode(new Uint16Array(positions)),colors:encode(new Uint16Array(colors)),indices:encode(new Uint32Array(indices))};
 const [ox,,oz]=raw.origin,round=(x:number)=>Math.round(x*100)/100;
 const nav=estrelTowerSolidsV345(native).map(s=>{
  const ring=s.ring.map(([x,z])=>[round(x-ox),round(z-oz)]),height=round(s.maxY-3);
  const local=(triangles:number[][][])=>triangles.map(t=>t.map(([x,y,z])=>[round(x-ox),round(y-3),round(z-oz)]));
  const roofTriangles=local(s.roofTriangles),bottomRoofTriangles=local(s.bottomRoofTriangles);
  return {ring,holes:[],height,minHeight:round(s.minY-3),sourceId:s.sourceId,heightSource:"OSM building:part + operator height; photo interpretation",...(roofTriangles.length?{roofTriangles}:{}),...(bottomRoofTriangles.length?{bottomRoofTriangles}:{})};
 });
 const pins=(p:typeof raw)=>p.meshes.map((m:any,mesh:number)=>({mesh,kind:m.kind,fingerprint:drain(surroundingPacketFingerprint(m))}));
 const line=(p:typeof raw)=>p.lines?hash(p.lines.positions+(p.lines.colors??"")):null;
 const plan={origin:raw.origin,records:pins(raw),preparedRecords:pins(prepared),navGuard:hash(JSON.stringify(raw.nav)),preparedNavGuard:hash(JSON.stringify(prepared.nav)),lineGuard:line(raw),preparedLineGuard:line(prepared),append,appendFingerprint:drain(surroundingPacketFingerprint(append)),appendNav:nav};
 writeFileSync(`${directory}/${mode}.json`,JSON.stringify({raw,prepared,plan}));
 console.log(JSON.stringify({mode,vertices:positions.length/3,triangles:indices.length/3,nav:nav.length,preparedVertices:prepared.meshes.reduce((n:number,m:any)=>n+Buffer.from(m.positions,"base64").length/6,0)}));
}
