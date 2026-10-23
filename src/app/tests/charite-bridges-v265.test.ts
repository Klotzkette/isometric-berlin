import { expect,test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Box3,InstancedMesh,Matrix4,Mesh } from "three";
import { createChariteBridgesV265 } from "../src/ChariteBridgesV265";
import { createChariteBridgeColumnTesterV265,isChariteBridgeSourceV265,chariteBridgeSolidsForV265 } from "../src/ChariteBridgesV265Profile";
import { compilePedestrianObstacles,pedestrianPointIsBlocked,createPedestrianEnvironment,createPedestrianState,stepPedestrian } from "../src/pedestrianNavigation";
import { preloadAltMitteV169NativeNavigation } from "../src/altMitteV169Profile";
import drawnManifest from "../src/data/altMitteDrawnV169Source.json";
import data from "../src/data/chariteBridgesV265.json";
import previous from "../src/data/chariteBridgesV265AltMittePrevious.json";
import retained from "../src/data/chariteBridgesV265RetainedNative.json";
import { isChariteBridgePreviousPartV265,transferChariteBridgeTrianglesV265,transferChariteBridgeLinesV265 } from "../src/chariteBridgesV265Ownership";
import type { PrismPayload } from "../src/IsometricCityWorld";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

const evidence=JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/charite-bridges-v265-evidence.json",import.meta.url),"utf8"));
const prisms=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8")) as PrismPayload;
const args=(c:number[])=>c as [number,number,number,number,number];
const packetEvidence=JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/charite-bridges-v265-alt-mitte-evidence.json",import.meta.url),"utf8"));
function packet(file:string){const raw=readFileSync(new URL(`../../../${file}`,import.meta.url));return JSON.parse((file.endsWith(".gz")?gunzipSync(raw):raw).toString());}
function complete<T>(it:Generator<void,T>):T{let r=it.next();while(!r.done)r=it.next();return r.value;}

test("only all exact source fields authorize the three bridge replacements; eastern bridge unchanged",()=>{
  for(const site of data.sites){
    const p=site.previousPrism;expect(isChariteBridgeSourceV265(p)).toBe(true);
    expect(isChariteBridgeSourceV265({...p,h_dm:p.h_dm+1})).toBe(false);
    expect(isChariteBridgeSourceV265({...p,ring:p.ring.map((r,i)=>i?[...r]:[r[0]+1,r[1]])})).toBe(false);
    expect(isChariteBridgeSourceV265({...p,tone:[0,0,0]})).toBe(false);
  }
  expect(isChariteBridgeSourceV265(evidence.unchanged_east_bridge_control)).toBe(false);
  expect(chariteBridgeSolidsForV265("L2e097lj")).toEqual([]);
  expect(isChariteBridgeSourceV265(null)).toBe(false);
});

test("twelve exact native columns transfer while six whole-cell foreign owners stay",()=>{
  const tester=createChariteBridgeColumnTesterV265(prisms.buildings,4);
  expect(data.columns.length).toBe(12);expect(evidence.retained_foreign_native_columns.length).toBe(6);
  for(const c of data.columns){expect(tester(...args(c))).toBe(true);expect(tester(c[0],c[1],c[2],c[3]+1,c[4])).toBe(false);expect(tester(c[0],c[1],c[2],c[3],4)).toBe(false);}
  for(const r of evidence.retained_foreign_native_columns)expect(tester(...args(r.column))).toBe(false);
  const first=data.columns[0];
  expect(createChariteBridgeColumnTesterV265(undefined,4)(...args(first))).toBe(false);
  expect(createChariteBridgeColumnTesterV265(prisms.buildings,2)(...args(first))).toBe(false);
  const changed=prisms.buildings.map(p=>p.id==="EWePLFPr"?{...p,h_dm:p.h_dm+1}:p);
  expect(createChariteBridgeColumnTesterV265(changed,4)(...args(first))).toBe(false);
  const newcomer={id:"foreign-new",ring:[[5160,-8520],[5200,-8520],[5200,-8480],[5160,-8480]],holes:[],y0_dm:52,h_dm:100,class:0};
  expect(createChariteBridgeColumnTesterV265([...prisms.buildings,newcomer],4)(...args(first))).toBe(false);
});

test("opt-in navigation preserves open underpasses, real supports and raised enclosed rooms",async()=>{
  await preloadAltMitteV169NativeNavigation();
  const fixture={buildings:data.sites.map(s=>s.previousPrism)} as PrismPayload;
  for(const mode of ["day","minecraft"] as const){
    const legacy=compilePedestrianObstacles(fixture,()=>mode),corrected=compilePedestrianObstacles(fixture,()=>mode,{replaceChariteBridges:true});
    for(const [x,z] of [[526,-850],[477,-667],[490,-654]]){
      expect(pedestrianPointIsBlocked(x,z,5.2,legacy)).toBe(true);
      expect(pedestrianPointIsBlocked(x,z,5.2,corrected)).toBe(false);
      expect(pedestrianPointIsBlocked(x,z,10,corrected)).toBe(true);
    }
    expect(pedestrianPointIsBlocked(485.8,-652.7,5.2,corrected)).toBe(true);
    expect(pedestrianPointIsBlocked(526,-850,18,corrected)).toBe(false);
    const changed={buildings:fixture.buildings.map(p=>p.id==="gQwBfdam"?{...p,h_dm:p.h_dm+1}:p)};
    const guarded=compilePedestrianObstacles(changed,()=>mode,{replaceChariteBridges:true});
    expect(pedestrianPointIsBlocked(477,-667,5.2,guarded)).toBe(true);
  }
});

test("measured plans produce bounded static texture-free models in both independent modes",()=>{
  for(const native of [false,true]){
    const root=createChariteBridgesV265(native);let bytes=0,instances=0,meshes=0;
    try{
      expect(root.children.length).toBe(native?4:3);expect(root.userData.requiredBeforeNavigation).toBe(true);expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      root.traverse(o=>{
        expect(o.matrixAutoUpdate).toBe(false);if(!(o instanceof Mesh))return;
        meshes++;expect(o.userData.textureFree).toBe(true);expect(o.geometry.getAttribute("uv")).toBeUndefined();
        for(const a of Object.values(o.geometry.attributes)){bytes+=a.array.byteLength;expect(Array.from(a.array).every(Number.isFinite)).toBe(true);}
        if(o instanceof InstancedMesh){
          instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;
          expect(o.instanceMatrix.array.length).toBe(o.count*16);
          const m=new Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);expect(m.elements.every(Number.isFinite)).toBe(true);if(native)for(const j of [1,2,4,6,8,9])expect(m.elements[j]).toBe(0);}
        }
      });
      const bridgeRoot=new Box3();for(const child of root.children.slice(0,3))bridgeRoot.union(new Box3().setFromObject(child));expect(bridgeRoot.min.y).toBeCloseTo(5.2,3);expect(bridgeRoot.max.y).toBeCloseTo(17.5,3);
      expect(bytes).toBeLessThan(native?550000:45000);expect(meshes).toBe(native?4:6);expect(instances).toBe(native?5427:405);
    }finally{disposeStaticAudit(root);}
  }
});

test("real core terrain and all source buildings allow walking beneath each span without roof snapping",async()=>{
  await preloadAltMitteV169NativeNavigation();
  const ground=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url),"utf8"));
  for(const mode of ["day","minecraft"] as const){
    const env=createPedestrianEnvironment(ground,{water:[]},null,prisms,undefined,{replaceChariteBridges:true,replaceAEGCampusPrisms:true,replaceTownhallPrisms:true,replaceDistrictCourtPrisms:true,replaceColonnadesPrisms:true,replaceSchlossplatzPrisms:true});env.visualMode=()=>mode;
    for(const [x,z,yaw] of [[526,-855,Math.PI],[473,-664,Math.atan2(.8,.6)],[490,-660,Math.PI]]){
      let state=createPedestrianState(env,{x,z,yaw,groundYHint:env.groundAt(x,z)!,preserveHorizontalPosition:true});
      for(let frame=0;frame<60;frame++){
        const result=stepPedestrian(state,{forward:1,strafe:0,turn:0,look:0,sprint:false},1/60,env);state=result.state;
        expect(result.respawned).toBe(false);expect(state.groundY).toBeLessThan(5.4);expect(state.groundY).toBeGreaterThan(5);
      }
      expect(Math.hypot(state.x-x,state.z-z)).toBeGreaterThan(11);
    }
  }
});

test("exact immutable packets transfer only owned triangles and preserve all other bytes",()=>{
  expect(previous.counts).toEqual({drawn:45,front:272,minecraft:747,inkSegments:40});
  for(const r of previous.records){
    const info=packetEvidence.records.find((v:{tile:string;mode:string;layer:string})=>v.tile===r.tile&&v.mode===r.mode&&v.layer===r.layer);
    const p=packet(info.file),mesh=p.meshes[info.meshIndex],raw=Buffer.from(mesh.indices,"base64");
    const indices=new Uint32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),before=indices.slice();
    expect(complete(transferChariteBridgeTrianglesV265(false,r.tile,r.mode==="minecraft",mesh,indices,0))).toBe(0);expect(indices).toEqual(before);
    expect(complete(transferChariteBridgeTrianglesV265(true,r.tile,r.mode==="minecraft",mesh,indices,0))).toBe(r.triangles.length);
    const selected=new Set(r.triangles);for(let i=0;i<indices.length;i+=3)expect(Array.from(indices.slice(i,i+3))).toEqual(selected.has(i/3)?[before[i],before[i],before[i]]:Array.from(before.slice(i,i+3)));
    const changed=before.slice();expect(complete(transferChariteBridgeTrianglesV265(true,r.tile,r.mode==="minecraft",{...mesh,colors:mesh.colors+"A"},changed,0))).toBe(0);expect(changed).toEqual(before);
  }
  for(const r of previous.lineRecords){
    const info=drawnManifest.chunkFiles.find(p=>`alt-mitte-v169-${p.id}`===r.tile)!;const p=packet(`src/app/src/data/${info.file}`),raw=Buffer.from(p.lines.positions,"base64");
    const values=new Uint16Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),before=values.slice(),selected=new Set(r.segments);
    expect(complete(transferChariteBridgeLinesV265(true,r.tile,p.lines,values,3))).toBe(r.segments.length);
    for(let i=0;i<values.length;i+=6)if(!selected.has(i/6))expect(Array.from(values.slice(i,i+6))).toEqual(Array.from(before.slice(i,i+6)));
  }
  for(const p of previous.previousNavigationParts){expect(isChariteBridgePreviousPartV265(p)).toBe(true);expect(isChariteBridgePreviousPartV265({...p,topY:p.topY+.01})).toBe(false);}
  expect(retained.parts).toEqual(["DEBE3DEoYsy3csRF","DEBE3DwIwW6P5hSu"]);
  expect(packetEvidence.retainedNativeSourceParts.map((p:{id:string})=>p.id)).toEqual(retained.parts);
  for(const [points] of retained.triangles){const p=points as number[][];expect([0,1,2].some(axis=>p.every(v=>v[axis]===p[0][axis]))).toBe(true);}
});
