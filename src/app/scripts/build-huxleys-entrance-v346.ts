/** Photo-guided entrance on the measured eastern parking facade, not the venue POI. */
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
const id="ring182-6_7",kind="huxleys-entrance-v346";
async function predecessor(raw:any,native:boolean){
 const options=await optionsV342(id,native),tickets=[];
 for(const entry of options.sourceQuarterSourcesV303??[]){
  if(entry.kind===kind)break; if(groundOverlayKindsV329.has(entry.kind))continue;
  const p=entry.source.packets[`${native?"minecraft":"drawn"}:${id}`];if(!p)continue;
  const t=p.preparedRecords?doneV342(captureSourceQuarterPacketV303(raw,id,native,true,entry.source,entry.kind,entry.requiredReplacement)):doneV342(captureNeighbourhoodPacketV300(raw,id,native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind));if(t)tickets.push(t);
 }
 let prepared=doneV342(prepareSurroundingQuarterPredecessorV303(raw,id,native,options));
 for(const t of tickets)prepared=doneV342(prepareSourceQuarterPacketV303(prepared,t));return prepared;
}
const dir=resolve(import.meta.dir,"../public/mesh/surrounding-berlin-v159");
const source:SourceQuarterSourceV303={schemaVersion:1,keys:[],packets:{}};
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const evidence:any={retrieved:"2026-11-15",owner:"DEBE08YYF00009PW",part:"DEBE3DjqaXknEpdh",building:"OSM-way-30255865",packet:id,
 sources:["https://huxleysneuewelt.de/information","https://channelmusic.de/wp-content/uploads/2019/03/Venue-Specs-Huxleys-09-2019.pdf","https://neuewelt-berlin.de/wp-content/uploads/2020/02/SABIV_NW_Lage_200219-1.jpg","https://www.morgenpost.de/berlin/article404286900/huxleys-neue-welt-parken-anfahrt-garderobe-programm.html"],
 photoPixelsDistributed:false,registration:"Operator aerial, p.10, and directory ground plan locate the public portal north of the small eastern projecting wing, south of the adjacent Wettarena door; retained OSM parking 26832567 is east of the building, Hasenheide north. The directory north arrow points down. Projection corner and complete measured east facade locate the wall; 2.6m bay offset is a photo-derived estimate, not an entrance survey.",
 estimated:["2.6m bay centre north of the southern projecting wing", "3.1m portal width and 3.1m glazing height","shallow 1.45m canopy projection and fittings","material tones"],rejectedAnchors:["interior POI 975700421","unrelated entrance 9104186570"],modes:[]};
for(const native of[false,true]){
 const mode=native?"minecraft":"drawn",key=`${mode}:${id}`,raw=JSON.parse(gunzipSync(readFileSync(resolve(dir,`${id}.${mode}.json.gz`))).toString());
 const prepared=await predecessor(raw,native);
 const part=prepared.meshes.find((p:any)=>p.kind==="elevated-station-v238");if(!part)throw Error("Missing complete Huxleys V238 host");
 // Four actual corners of the retained wall/independent native skin rectangle.
 const expected=native?[[3342,3,3652],[3342,13,3652],[3342,3,3656],[3342,13,3656]]:[[3341.67,3,3656.6],[3342.49,3,3645.06],[3341.67,15.61,3656.6],[3342.49,15.61,3645.06]];
 const pb=Buffer.from(part.positions,"base64");
 for(const p of expected){let seen=false;for(let i=0;i<pb.length;i+=6)if(p.every((v,a)=>Math.abs(pb.readUInt16LE(i+a*2)/100+raw.origin[a]-v)<.011)){seen=true;break;}if(!seen)throw Error(`Missing actual wall vertex ${mode} ${p}`);}
 const edge:PerimeterFacadeEdge={startXZ:native?[3342,3656]:[3341.666,3656.602],endXZ:native?[3342,3652]:[3342.495,3645.062],outwardSide:1,wallBaseY:3,wallTopY:15.61,street:"Neue Welt eastern parking frontage",prismId:evidence.part};
 const u=native?2:2.6,b=new GendarmenmarktFacadeBuilder(native,false,0),frame=0x71453c,steel=0x777d78,glass=0x52686a;
 // Existing wall, old north-front details and every roof remain untouched.
 b.face(edge,u,4.65,3.1,3.22,.07,glass,.14);
 for(const dx of[-1.55,-1.01,0,1.01,1.55])b.face(edge,u+dx,4.65,dx===0?.07:.09,3.28,.12,frame,.22);
 for(const y of[3.04,5.55,6.28])b.face(edge,u,y,3.18,.10,.13,frame,.24);
 for(const dx of[-.94,.94])b.face(edge,u+dx,4.22,.05,.42,.08,0xb6b5a8,.32);
 // One unbranded, original outline lettering interpretation; no photo/poster/logo pixels.
 b.face(edge,u,6.56,2.48,.48,.10,0x222729,.25);
 const text=(word:string,y:number,cap:number,width:number)=>{
  if(!native){b.sign(edge,word,u,y,cap,width,0xe7e7dd,0x222729,.30);return;}
  const paths=letteringStrokePaths(word,cap),xs=paths.flat().map(p=>p[0]),scale=Math.min(1,(width-.15)/(Math.max(...xs)-Math.min(...xs)));
  for(const path of paths)for(let j=1;j<path.length;j++){const a=path[j-1],c=path[j],n=Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/.025);for(let i=0;i<n;i++)b.face(edge,u+(a[0]+(c[0]-a[0])*(i+.5)/n)*scale,y+a[1]+(c[1]-a[1])*(i+.5)/n,.028,.028,.025,0xe7e7dd,.38);}
 };
 text("HUXLEYS",6.49,.22,2.35);text("NEUE WELT",6.34,.095,1.36);
 // Thin shallow gable canopy, visibly open underneath. Native uses cardinal
 // horizontal strips and small cubical tie rods, never rotated native members.
 const roof=(x:number)=>6.94+.24*(1-Math.abs(x)/1.82);
 for(let i=0;i<18;i++){const x=-1.82+(i+.5)*3.64/18;b.face(edge,u+x,roof(x),3.64/18,.035,1.45,0xa8b7b4,.91);}
 for(const d of[.23,.92,1.62]){
  for(const side of[-1,1]){
   const a=b.point(edge,u,roof(0)+.04,d),c=b.point(edge,u+side*1.86,roof(1.82)+.04,d);
   if(native){for(let j=0;j<12;j++){const t=(j+.5)/12;b.box(a.map((v,i)=>v+(c[i]-v)*t) as [number,number,number],[.09,.09,.17],steel);}}
   else b.beam(a,c,.07,steel);
  }
 }
 for(const side of[-1,1]){
  b.face(edge,u+side*1.82,6.98,.075,.075,1.52,steel,.91);
  const a=b.point(edge,u+side*1.65,7.78,.18),c=b.point(edge,u+side*1.65,6.98,1.6);
  if(native){for(let i=0;i<24;i++){const t=(i+.5)/24;b.box(a.map((v,j)=>v+(c[j]-v)*t) as [number,number,number],[.055,.055,.075],steel);}}
  else b.beam(a,c,.045,steel);
 }
 const group=b.finish(kind),positions:number[]=[],colors:number[]=[],indices:number[]=[],m=new Matrix4(),v=new Vector3(),tone=new Color();
 group.traverse(node=>{if(!(node instanceof InstancedMesh))return;const geo=node.geometry,pos=geo.getAttribute("position"),idx=geo.index!;for(let i=0;i<node.count;i++){
  node.getMatrixAt(i,m);node.getColorAt(i,tone);const start=positions.length/3;
  if(native)for(let col=0;col<3;col++)if([0,1,2].filter(row=>Math.abs(m.elements[col*4+row])>1e-8).length!==1)throw Error("Non-cardinal native entrance");
  for(let j=0;j<pos.count;j++){v.fromBufferAttribute(pos,j).applyMatrix4(m);for(const [a,n]of[v.x,v.y,v.z].entries()){const q=Math.round((n-raw.origin[a])*100);if(q<0||q>65535)throw Error("Entrance exceeds packet");positions.push(q);}colors.push(Math.round(tone.r*65535),Math.round(tone.g*65535),Math.round(tone.b*65535));}
  for(let j=0;j<idx.count;j++)indices.push(start+idx.getX(j));
 }});
 const encoded=(a:Uint16Array|Uint32Array)=>Buffer.from(a.buffer).toString("base64");
 const append={kind,positionType:"u16cm" as const,colorType:"u16linear" as const,positions:encoded(new Uint16Array(positions)),colors:encoded(new Uint16Array(colors)),indices:encoded(new Uint32Array(indices))};
 const records=(packet:any)=>packet.meshes.map((p:any,i:number)=>({mesh:i,kind:p.kind,fingerprint:doneV342(surroundingPacketFingerprint(p))}));
 const lg=(p:any)=>p.lines?hash(p.lines.positions+(p.lines.colors??"")):null;
 source.keys.push(key);source.packets[key]={origin:raw.origin,records:records(raw),preparedRecords:records(prepared),navGuard:hash(JSON.stringify(raw.nav)),lineGuard:lg(raw),preparedNavGuard:hash(JSON.stringify(prepared.nav)),preparedLineGuard:lg(prepared),append,appendFingerprint:doneV342(surroundingPacketFingerprint(append)),retire:[],retireLines:[],retireNav:[],appendNav:[],owners:[evidence.owner]};
 evidence.modes.push({mode,actualHostVertices:expected,wall:edge,estimatedBayU:u,center:b.point(edge,u,3,0),sourceMeshes:prepared.meshes.map((p:any)=>p.kind),newVertices:positions.length/3,newTriangles:indices.length/3});
}
writeFileSync(resolve(import.meta.dir,"../src/data/huxleysEntranceV346.json"),JSON.stringify(source)+"\n");
writeFileSync(resolve(import.meta.dir,"../../../geo_data/regierungsviertel/huxleys-entrance-v346-evidence.json"),JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify(evidence.modes));
