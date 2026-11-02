import {expect,test} from "bun:test";
import {Group,Mesh,OrthographicCamera} from "three";
import {createSurroundingCity,disposeSurroundingCityRoot,type SurroundingCityManifest,type SurroundingCity,type SurroundingCityOptions} from "../src/SurroundingCity";
import {createSurroundingCityChunk,type SurroundingCityChunk,type SurroundingPackedMesh} from "../src/SurroundingCityGeometry";
import {type SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
import {syncQuarterLegacyFittingsV303,type QuarterLegacyReceiptV303} from "../src/QuarterLegacyFittingsV303";
import {justicePalaceV183Boxes} from "../src/justicePalaceV183Batches";

const b64=(a:Uint16Array|Uint32Array|Uint8Array)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64");
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const rectangle=(a:number,b:number,c:number,d:number)=>({ring:[[a,b],[c,b],[c,d],[a,d],[a,b]],holes:[] as number[][][]});
const ids=["ring182-7_8","ring182-8_8"];
function raw(x=0):SurroundingCityChunk {
  const part:SurroundingPackedMesh={kind:"city",positionType:"u16cm",positions:b64(new Uint16Array([0,1300,0,100,1300,0,0,1400,0])),colors:b64(new Uint8Array(9).fill(80)),indices:b64(new Uint32Array([0,1,2]))};
  return {schemaVersion:1,origin:[x,-10,0],meshes:[part],nav:{ground:[rectangle(0,0,512,512)],water:[],buildings:[{...rectangle(50,50,100,100),height:20,minHeight:0,sourceId:"old-exact-owner"}],groundY:3}};
}
function fixture(two=false,required=false){
  const source:SourceQuarterSourceV303={schemaVersion:1,keys:[],packets:{}};
  const manifest:SurroundingCityManifest={schemaVersion:1,groundY:3,footprint:[],chunks:[]};
  const packets=new Map<string,SurroundingCityChunk>();
  for(const [index,id]of ids.slice(0,two?2:1).entries()){
    const x=index*2048,packet=raw(x);manifest.footprint.push(rectangle(x,0,x+512,512));
    manifest.chunks.push({id,bounds:[x,0,x+512,512],drawn:{url:`${id}.drawn.json`,bytes:JSON.stringify(packet).length},minecraft:{url:`${id}.minecraft.json`,bytes:JSON.stringify(packet).length}});
    packets.set(id,packet);
    for(const native of [false,true]){
      const key=`${native?"minecraft":"drawn"}:${id}`,part=packet.meshes[0],pin={mesh:0,kind:part.kind,fingerprint:hash(part.positions+part.colors+part.indices)},append={...part,kind:"test-source-quarter"};
      source.keys.push(key);source.packets[key]={origin:packet.origin,records:[pin],preparedRecords:[pin],navGuard:hash(JSON.stringify(packet.nav)),preparedNavGuard:hash(JSON.stringify(packet.nav)),lineGuard:null,preparedLineGuard:null,append,appendFingerprint:hash(append.positions+append.colors+append.indices),retire:[{mesh:0,triangles:[0]}],retireLines:[],retireNav:packet.nav.buildings,appendNav:[{...packet.nav.buildings[0],height:24,sourceId:"complete-replacement"}],owners:["complete-replacement"]};
    }
  }
  const fetcher=(async(input:URL|RequestInfo)=>{const pathname=new URL(String(input)).pathname;if(pathname.endsWith("manifest.json"))return new Response(JSON.stringify(manifest));const id=pathname.split("/").at(-1)!.replace(/\.(drawn|minecraft)\.json$/,"");return new Response(JSON.stringify(packets.get(id)));})as typeof fetch;
  return {source,manifest,fetcher,injection:[{source,kind:"test-source-quarter",requiredReplacement:required}]};
}
function camera(x=256,width=550){const c=new OrthographicCamera(-width/2,width/2,300,-300,1,3000);c.position.set(x,500,256);c.up.set(0,0,-1);c.lookAt(x,0,256);c.updateMatrixWorld();return c;}
async function until(predicate:()=>boolean){for(let i=0;i<500;i++){if(predicate())return;await new Promise(r=>setTimeout(r,2));}throw Error("Finite controller did not settle");}
const rootOptions=(f:ReturnType<typeof fixture>,view=camera()):SurroundingCityOptions=>({camera:view,manifestUrl:new URL("https://example.test/manifest.json"),fetch:f.fetcher,sourceQuartersV303:true,sourceQuarterSourcesV303:f.injection});
function legacyFixture(two=false){
  const root=new Group(),parent=new Group();parent.userData={frontageCount:113,mappedBenchCount:39};root.add(parent);
  const rows=[[10,5,20,5,.2,.3,.4,0xccccbb],[22,4,31,3,.4,.2,.7,0x333322]],mesh=justicePalaceV183Boxes(rows,false);parent.add(mesh);
  const receipt:QuarterLegacyReceiptV303={owner:"legacy-house",native:false,expectedCount:2,rows:[{index:0,row:rows[0]}],requiredPacketKeys:ids.slice(0,two?2:1).map(id=>`drawn:${id}`)};
  return {root,mesh,receipt,before:new Float32Array(mesh.instanceMatrix.array)};
}

test("quarter keys announce only real resident entries after onAttach and restore legacy slots on eviction/disposal",async()=>{
  const f=fixture(),legacy=legacyFixture(),view=camera(),states:string[][]=[];let clock=0,city!:SurroundingCity;
  city=createSurroundingCity({...rootOptions(f,view),now:()=>clock,retireMs:0,onAttach(root){expect(city.residentChunkCount).toBe(0);expect(states.at(-1)??[]).toEqual([]);expect(root.userData.sourceQuarterOwnersV303).toEqual(["complete-replacement"]);expect([...legacy.mesh.instanceMatrix.array]).toEqual([...legacy.before]);},onQuarterResidentsV303(keys){expect(keys.size).toBe(city.residentChunkCount);states.push([...keys]);syncQuarterLegacyFittingsV303(legacy.root,keys,[legacy.receipt]);}});
  try{
    await city.ready;await until(()=>!city.pending&&city.residentChunkCount===1);
    expect(states.at(-1)).toEqual([`drawn:${ids[0]}`]);expect([...legacy.mesh.instanceMatrix.array.slice(0,12)]).toEqual(new Array(12).fill(0));
    view.position.set(8000,500,256);view.lookAt(8000,0,256);clock=1000;city.refresh(clock);
    await until(()=>!city.pending);expect(city.residentChunkCount).toBe(0);expect(states.at(-1)).toEqual([]);expect([...legacy.mesh.instanceMatrix.array]).toEqual([...legacy.before]);
    view.position.set(256,500,256);view.lookAt(256,0,256);clock=2000;city.refresh(clock);await until(()=>!city.pending&&city.residentChunkCount===1);
    city.dispose();expect(states.at(-1)).toEqual([]);expect([...legacy.mesh.instanceMatrix.array]).toEqual([...legacy.before]);
  }finally{city.dispose();disposeSurroundingCityRoot(legacy.root);}
});

test("onAttach disposal never announces a resident quarter or masks an old fitting",async()=>{
  const f=fixture(),legacy=legacyFixture(),states:string[][]=[];let city!:SurroundingCity,attached=0,released=0;
  city=createSurroundingCity({...rootOptions(f),onAttach(){attached++;city.dispose();},onRelease(root){released++;disposeSurroundingCityRoot(root);},onQuarterResidentsV303(keys){states.push([...keys]);syncQuarterLegacyFittingsV303(legacy.root,keys,[legacy.receipt]);}});
  await city.ready;await until(()=>!city.pending);expect(attached).toBe(1);expect(released).toBe(1);expect(city.residentChunkCount).toBe(0);expect(states.flat()).toEqual([]);expect([...legacy.mesh.instanceMatrix.array]).toEqual([...legacy.before]);disposeSurroundingCityRoot(legacy.root);
});

test("required landmark revocation inside onAttach cannot announce old-profile retirement",async()=>{
  const f=fixture(false,true),legacy=legacyFixture(),states:string[][]=[];let ready=true,city!:SurroundingCity,attaches=0;
  city=createSurroundingCity({...rootOptions(f),neukoellnLandmarksV305:()=>ready,onAttach(){attaches++;ready=false;},onQuarterResidentsV303(keys){states.push([...keys]);syncQuarterLegacyFittingsV303(legacy.root,keys,[legacy.receipt]);}});
  try{await city.ready;await until(()=>!city.pending);expect(attaches).toBe(1);expect(city.residentChunkCount).toBe(0);expect(states.flat()).toEqual([]);expect([...legacy.mesh.instanceMatrix.array]).toEqual([...legacy.before]);}finally{city.dispose();disposeSurroundingCityRoot(legacy.root);}
});

test("required landmark admission revoked after publication evicts its mask before fallback reload",async()=>{
  const f=fixture(false,true),legacy=legacyFixture(),states:string[][]=[];let ready=true,clock=0,city!:SurroundingCity;
  city=createSurroundingCity({...rootOptions(f),now:()=>clock,neukoellnLandmarksV305:()=>ready,onQuarterResidentsV303(keys){states.push([...keys]);syncQuarterLegacyFittingsV303(legacy.root,keys,[legacy.receipt]);}});
  try{await city.ready;await until(()=>!city.pending&&city.residentChunkCount===1);expect(states.at(-1)).toEqual([`drawn:${ids[0]}`]);ready=false;clock=1000;city.refresh(clock);expect([...legacy.mesh.instanceMatrix.array]).toEqual([...legacy.before]);await until(()=>!city.pending&&city.residentChunkCount===1);expect(states.at(-1)).toEqual([]);expect(city.root.children[0].userData.sourceQuarterOwnersV303).toEqual([]);}finally{city.dispose();disposeSurroundingCityRoot(legacy.root);}
});

test("family changes never relabel old remaining residents as native and clear the full legacy owner",async()=>{
  const f=fixture(true),legacy=legacyFixture(true),states:string[][]=[];let city!:SurroundingCity;
  city=createSurroundingCity({...rootOptions(f,camera(1280,4000)),onQuarterResidentsV303(keys){states.push([...keys]);syncQuarterLegacyFittingsV303(legacy.root,keys,[legacy.receipt]);}});
  try{await city.ready;await until(()=>!city.pending&&city.residentChunkCount===2);expect([...legacy.mesh.instanceMatrix.array.slice(0,12)]).toEqual(new Array(12).fill(0));const at=states.length;city.setMode("minecraft");expect([...legacy.mesh.instanceMatrix.array]).toEqual([...legacy.before]);expect(states.slice(at).flat().every(k=>k.startsWith("drawn:"))).toBe(true);await until(()=>!city.pending&&city.residentChunkCount===2);expect(states.at(-1)!.sort()).toEqual(ids.map(id=>`minecraft:${id}`).sort());expect(city.root.children.every(root=>root.userData.sourceQuarterNativeV303===true)).toBe(true);city.dispose();expect(states.at(-1)).toEqual([]);}finally{city.dispose();disposeSurroundingCityRoot(legacy.root);}
});

test("a synchronous onAttach camera cancellation cannot become a quarter resident",async()=>{
  const f=fixture(),view=camera(),states:string[][]=[];let city!:SurroundingCity,clock=0;
  city=createSurroundingCity({...rootOptions(f,view),now:()=>clock,retireMs:0,onAttach(){view.position.set(8000,500,256);view.lookAt(8000,0,256);clock=1000;city.refresh(clock);},onQuarterResidentsV303(keys){states.push([...keys]);}});
  try{await city.ready;await until(()=>!city.pending);expect(city.residentChunkCount).toBe(0);expect(states.flat()).toEqual([]);}finally{city.dispose();}
});

test("closed and unknown source gates retain the complete default geometry and navigation",()=>{
  const f=fixture(),packet=raw(),before=JSON.stringify(packet),id=ids[0],control=createSurroundingCityChunk(packet,id);
  const closed=createSurroundingCityChunk(packet,id,false,{sourceQuartersV303:false,sourceQuarterSourcesV303:f.injection});
  const unknown=createSurroundingCityChunk(packet,"unknown-site",false,{sourceQuartersV303:true,sourceQuarterSourcesV303:f.injection});
  try{for(const result of [closed,unknown]){const expected=(control.root.children[0]as Mesh).geometry,actual=(result.root.children[0]as Mesh).geometry;expect([...actual.index!.array]).toEqual([...expected.index!.array]);expect([...actual.getAttribute("position").array]).toEqual([...expected.getAttribute("position").array]);expect(result.nav).toEqual(control.nav);expect(result.root.userData.sourceQuarterOwnersV303).toEqual([]);}expect(JSON.stringify(packet)).toBe(before);}finally{for(const result of[control,closed,unknown])disposeSurroundingCityRoot(result.root);}
});
