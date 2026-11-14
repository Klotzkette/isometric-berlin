/** Bake a finite photographic portal onto the actual retained V167 wall. */
import {readFileSync,writeFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {resolve} from "node:path";
import {Color,InstancedMesh,Matrix4,Vector3} from "three";
import {GendarmenmarktFacadeBuilder,type PerimeterFacadeEdge} from "../src/GendarmenmarktFacadeBuilder";
import {letteringStrokePaths} from "../src/drawnLettering";
import {surroundingPacketFingerprint} from "../src/surroundingPacketFingerprint";
import type {SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
import {doneV342,optionsV342} from "../tests/helpers/neukoellnPredecessorV342";
import {prepareSurroundingQuarterPredecessorV303,groundOverlayKindsV329} from "../src/SurroundingCityGeometry";
import {captureSourceQuarterPacketV303,prepareSourceQuarterPacketV303} from "../src/SourceQuarterPacketV303";
import {captureNeighbourhoodPacketV300,type NeighbourhoodSourceV300} from "../src/NeighbourhoodPacketV300";
async function predecessor(raw:any,native:boolean){
 const options=await optionsV342("6_4",native),tickets=[];
 for(const entry of options.sourceQuarterSourcesV303??[]){
  if(entry.kind==="so36-front-v345"||groundOverlayKindsV329.has(entry.kind))continue;
  const p=entry.source.packets[`${native?"minecraft":"drawn"}:6_4`];if(!p)continue;
  const t=p.preparedRecords?doneV342(captureSourceQuarterPacketV303(raw,"6_4",native,true,entry.source,entry.kind,entry.requiredReplacement)):doneV342(captureNeighbourhoodPacketV300(raw,"6_4",native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind));if(t)tickets.push(t);
 }
 let prepared=doneV342(prepareSurroundingQuarterPredecessorV303(raw,"6_4",native,options));
 for(const t of tickets)prepared=doneV342(prepareSourceQuarterPacketV303(prepared,t));return prepared;
}
const dir=resolve(import.meta.dir,"../public/mesh/surrounding-berlin-v159"),kind="so36-front-v345";
const source:SourceQuarterSourceV303={schemaVersion:1,keys:[],packets:{}};
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const evidence:any={retrieved:"2026-11-14",owner:"DEBE02YY40000ARY",poi:"OSM-node-4034138645",building:"OSM-way-37739079",mapUrl:"https://api.openstreetmap.org/api/0.6/map?bbox=13.421,52.4998,13.423,52.5009",photograph:"https://www.visitberlin.de/de/so36",credit:"visitBerlin / Prokura Nepp",photoPixelsDistributed:false,photoSha256:"cbe65f49284f99d5102dfeaec05255ea6e60ecd48d3298b3a426293fe947bf77",estimated:["portal bay centre projected from mapped POI","door, poster and lightbox dimensions","material tones"],modes:[]};
for(const native of[false,true]){
 const mode=native?"minecraft":"drawn",key=`${mode}:6_4`,raw=JSON.parse(gunzipSync(readFileSync(resolve(dir,`6_4.${mode}.json.gz`))).toString());
 const prepared=await predecessor(raw,native);
 const owner=raw.nav.buildings.find((p:any)=>p.sourceId==="DEBE02YY40000ARY");if(!owner)throw Error("Missing actual SO36 host");
 const part=raw.meshes.find((p:any)=>p.kind==="oranien-corridors-v167");if(!part)throw Error("Missing complete V167 host");
 const expected=native?[[3394,3,2132],[3398,3,2132],[3394,5,2132],[3398,5,2132]]:[[3394.09,3,2132.45],[3398.38,3,2134.46],[3394.09,21.85,2132.45],[3398.38,21.85,2134.46]];
 const pb=Buffer.from(part.positions,"base64");
 for(const p of expected){let seen=false;for(let i=0;i<pb.length;i+=6)if(p.every((v,a)=>Math.abs(pb.readUInt16LE(i+a*2)/100+raw.origin[a]-v)<.006)){seen=true;break;}if(!seen)throw Error(`Missing actual wall vertex ${mode} ${p}`);}
 const edge:PerimeterFacadeEdge={startXZ:native?[3394,2132]:[3394.09,2132.45],endXZ:native?[3398,2132]:[3398.38,2134.46],outwardSide:-1,wallBaseY:3,wallTopY:21.85,street:"Oranienstraße 190",prismId:owner.sourceId};
 const length=Math.hypot(edge.endXZ[0]-edge.startXZ[0],edge.endXZ[1]-edge.startXZ[1]),u=length/2,b=new GendarmenmarktFacadeBuilder(native,false,0);
 b.face(edge,u,5.25,Math.min(length-.08,4.2),4.2,.055,0xb8b196,.19);
 b.face(edge,u,4.82,2.06,3.16,.07,0x292b2c,.26);
 for(const side of[-1,1]){b.face(edge,u+side*1.08,4.82,.13,3.32,.13,0x89877b,.31);b.face(edge,u+side*.91,4.82,.075,3.06,.11,0x494b48,.34);}
 b.face(edge,u,6.47,2.25,.16,.16,0x99998b,.31);
 b.face(edge,u,4.05,1.88,.055,.10,0x797d76,.34);
 for(const side of[-1,1]){b.face(edge,u+side*1.64,4.9,.66,1.76,.10,0x343b40,.31);b.face(edge,u+side*1.64,4.9,.54,1.60,.04,0xc7c9c1,.38);for(let y=4.35;y<5.5;y+=.26)b.face(edge,u+side*1.64,y,.42,.06,.025,0x617781,.42);}
 if(!native)b.sign(edge,"SO36",u,6.76,.39,2.63,0x283c5b,0xe1e4d8,.38);
 else{b.face(edge,u,6.96,2.63,.74,.10,0xe1e4d8,.38);const paths=letteringStrokePaths("SO36",.39);for(const path of paths)for(let j=1;j<path.length;j++){const a=path[j-1],c=path[j],n=Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/.027);for(let i=0;i<n;i++)b.face(edge,u-(a[0]+(c[0]-a[0])*(i+.5)/n),6.76+a[1]+(c[1]-a[1])*(i+.5)/n,.04,.04,.025,0x283c5b,.46);}}
 const group=b.finish(kind),positions:number[]=[],colors:number[]=[],indices:number[]=[],m=new Matrix4(),v=new Vector3(),tone=new Color();
 group.traverse(node=>{if(!(node instanceof InstancedMesh))return;const geo=node.geometry,pos=geo.getAttribute("position"),idx=geo.index!;for(let i=0;i<node.count;i++){
  node.getMatrixAt(i,m);node.getColorAt(i,tone);const start=positions.length/3;
  for(let j=0;j<pos.count;j++){v.fromBufferAttribute(pos,j).applyMatrix4(m);for(const [a,n]of[v.x,v.y,v.z].entries())positions.push(Math.round((n-raw.origin[a])*100));colors.push(Math.round(tone.r*65535),Math.round(tone.g*65535),Math.round(tone.b*65535));}
  for(let j=0;j<idx.count;j++)indices.push(start+idx.getX(j));
 }});
 const encoded=(a:Uint16Array|Uint32Array)=>Buffer.from(a.buffer).toString("base64");
 const append={kind,positionType:"u16cm" as const,colorType:"u16linear" as const,positions:encoded(new Uint16Array(positions)),colors:encoded(new Uint16Array(colors)),indices:encoded(new Uint32Array(indices))};
 const records=(packet:any)=>packet.meshes.map((p:any,i:number)=>({mesh:i,kind:p.kind,fingerprint:doneV342(surroundingPacketFingerprint(p))}));
 const lg=(p:any)=>p.lines?hash(p.lines.positions+(p.lines.colors??"")):null;
 source.keys.push(key);source.packets[key]={origin:raw.origin,records:records(raw),preparedRecords:records(prepared),navGuard:hash(JSON.stringify(raw.nav)),lineGuard:lg(raw),preparedNavGuard:hash(JSON.stringify(prepared.nav)),preparedLineGuard:lg(prepared),append,appendFingerprint:doneV342(surroundingPacketFingerprint(append)),retire:[],retireLines:[],retireNav:[],appendNav:[],owners:[owner.sourceId]};
 evidence.modes.push({mode,actualHostVertices:expected,sourceRing:owner.ring,sourceMeshes:prepared.meshes.map((p:any)=>p.kind),newVertices:positions.length/3,newTriangles:indices.length/3});
}
writeFileSync(resolve(import.meta.dir,"../src/data/so36FrontV345.json"),JSON.stringify(source)+"\n");
writeFileSync(resolve(import.meta.dir,"../../../geo_data/regierungsviertel/so36-front-v345-evidence.json"),JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify(evidence.modes));
