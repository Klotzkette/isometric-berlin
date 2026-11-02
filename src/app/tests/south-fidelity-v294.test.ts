import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  BufferAttribute, BufferGeometry, DoubleSide, Group, InstancedMesh, Matrix4,
  Mesh, MeshBasicMaterial, OrthographicCamera, Raycaster, Vector3,
} from "three";
import data from "../src/data/southFidelityV294.json";
import receipts from "../src/data/southFidelityV294Packets.json";
import { createSouthFidelityV294, hasCompleteSouthFidelityV294, southFidelityContainsV294,
  southFidelityGeometryV294, southFidelitySolidsV294 } from "../src/SouthFidelityV294";
import { prepareSouthFidelityV294, applySouthFidelityTrianglesV294,
  southFidelityNavigationV294 } from "../src/SouthFidelityV294Packets";
import { createSurroundingCity, createStreamedSurroundingCityChunkV255, disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { surroundingBuildingSolidAt, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { technikmuseumGeometryV272 } from "../src/TechnikmuseumV272";

function finish<T>(it:Generator<void,T>):T { let x=it.next();while(!x.done)x=it.next();return x.value; }
const manifest=JSON.parse(readFileSync("public/mesh/surrounding-berlin-v159/manifest.json","utf8"));
function packet(id:string,native=false):SurroundingCityChunk {
  const desc=manifest.chunks.find((d:{id:string})=>d.id===id),raw=readFileSync("public/mesh/surrounding-berlin-v159/"+desc[native?"minecraft":"drawn"].url);
  return JSON.parse(gunzipSync(raw).toString());
}

test("all requested southern sites have structural geometry, with exact source plans and complete mobile parity",()=>{
  const model=southFidelityGeometryV294(),sites=new Set(model.rows.map(r=>r.site));
  for(const site of ["nkz","moebel-olfe","schlesisches-tor","kottbusser-tor","metropol","nollendorfplatz","winterfeldtplatz","hasenheide","huxleys","hermannplatz","formerMercedes","forumTower","theatreCasino","theatreNorth","atrium-tower","philharmonie"])expect(sites.has(site)).toBe(true);
  expect(model.roles["u1-source-course-elevated-deck"]).toBeGreaterThan(25);
  expect(model.roles["metropol-korbbogen-stone-surround"]).toBe(30);
  expect(model.roles["nollendorf-open-steel-dome-rib"]).toBe(224);
  expect(model.roles["winterfeldt-market-awning"]).toBe(12);
  expect(model.roles["hasenheide-naturtheater-seat-row"]).toBeGreaterThan(8);
  expect(model.roles["philharmonie-source-panel-end-fastener"]).toBe(906);
  expect(model.triangles.filter(t=>t.role==="nkz-complete-retained-roof").length).toBeGreaterThan(8);
  for(const native of [false,true]){
    const a=createSouthFidelityV294(native),b=createSouthFidelityV294(native,{mobileLike:true});expect(hasCompleteSouthFidelityV294(a)).toBe(true);
    expect(a.userData.records).toBeUndefined();expect(a.children.length).toBe(native?2:3);let bytes=0;
    a.children.forEach((child,i)=>{if(child instanceof Group)return;const m=child as Mesh,n=b.children[i]as Mesh;expect(m.matrixAutoUpdate).toBe(false);expect(m.geometry.getAttribute("uv")).toBeUndefined();for(const[k,attr]of Object.entries(m.geometry.attributes)){expect(attr.array).toEqual(n.geometry.getAttribute(k).array);bytes+=attr.array.byteLength;}
      if(m instanceof InstancedMesh){const peer=n as InstancedMesh;expect(m.instanceMatrix.array).toEqual(peer.instanceMatrix.array);expect(m.instanceColor!.array).toEqual(peer.instanceColor!.array);bytes+=m.instanceMatrix.array.byteLength+m.instanceColor!.array.byteLength;
        if(native){const matrix=new Matrix4();for(let j=0;j<m.count;j++){m.getMatrixAt(j,matrix);for(const k of[1,2,4,6,8,9])expect(matrix.elements[k]).toBe(0);}}
      }
    });expect(bytes).toBeLessThan(native?5_100_000:600_000);disposeSurroundingCityRoot(a);disposeSurroundingCityRoot(b);
  }
});

test("mapped Adalbertstraße is clear in both complete actual source assemblies and has a physical overhead",()=>{
  for(const native of[false,true]){
    const original=packet("6_4",native),chunk=finish(prepareSouthFidelityV294(original,"6_4",native,true));expect(chunk).not.toBe(original);
    const root=new Group();root.add(createSouthFidelityV294(native));
    // Decode the real retained old packet, retire exactly the admitted original
    // triangles, and combine it with the required replacement. This catches a
    // false clear result from testing only the new factory in isolation.
    for(let mi=0;mi<chunk.meshes.length;mi++){
      const mesh=chunk.meshes[mi],raw=new Uint16Array(Uint8Array.from(Buffer.from(mesh.positions,"base64")).buffer),positions=new Float32Array(raw.length);
      for(let i=0;i<raw.length;i++)positions[i]=raw[i]/100+chunk.origin[i%3];
      const index=new Uint32Array(Uint8Array.from(Buffer.from(mesh.indices,"base64")).buffer);finish(applySouthFidelityTrianglesV294(chunk,mi,index,0));
      const g=new BufferGeometry();g.setAttribute("position",new BufferAttribute(positions,3));g.setIndex(new BufferAttribute(index,1));root.add(new Mesh(g,new MeshBasicMaterial({side:DoubleSide})));
    }
    root.updateMatrixWorld(true);
    const nav=southFidelityNavigationV294(chunk,original.nav);
    for(const y of[4.5,4.9,6.0]){
      const a=new Vector3(3151.77675,y,2141.60785),b=new Vector3(3132.64515,y,2182.9168),d=b.clone().sub(a);
      expect(new Raycaster(a,d.clone().normalize(),0,d.length()).intersectObjects(root.children,true)).toHaveLength(0);
      for(let j=0;j<=30;j++){const p=a.clone().lerp(b,j/30);expect(surroundingBuildingSolidAt(nav,p.x-chunk.origin[0],p.y,p.z-chunk.origin[2],.25)).toBe(false);}
    }
    const x=(data.passage.points[0][0]+data.passage.points.at(-1)![0])/2,z=(data.passage.points[0][1]+data.passage.points.at(-1)![1])/2;
    const hits=new Raycaster(new Vector3(x,4.9,z),new Vector3(0,1,0),0,40).intersectObjects(root.children,true);expect(hits.length).toBeGreaterThan(0);expect(hits[0].point.y).toBeGreaterThanOrEqual(7.0);
    expect(hits[0].point.y).toBeLessThan(9);disposeSurroundingCityRoot(root);
  }
});

test("owner transfer fails closed without the complete factory and preserves every other packet triangle/navigation owner",()=>{
  for(const native of[false,true]){
    const old=packet("6_4",native),snapshot=JSON.stringify(old);
    expect(finish(prepareSouthFidelityV294(old,"6_4",native,false))).toBe(old);
    expect(finish(prepareSouthFidelityV294(old,"unrelated",native,true))).toBe(old);
    const bad=structuredClone(old);bad.meshes[0].colors=bad.meshes[0].colors.slice(0,-4)+"AAAA";
    expect(finish(prepareSouthFidelityV294(bad,"6_4",native,true))).toBe(bad);
    const changed=structuredClone(old);changed.nav.buildings=changed.nav.buildings.filter(b=>b.sourceId!=="DEBE02YY40001ISn");
    expect(finish(prepareSouthFidelityV294(changed,"6_4",native,true))).toBe(changed);
    const next=finish(prepareSouthFidelityV294(old,"6_4",native,true));const receipt=receipts.packets[native?"minecraft:6_4":"drawn:6_4"];
    for(let mi=0;mi<old.meshes.length;mi++){
      const encoded=old.meshes[mi].indices,index=new Uint32Array(Uint8Array.from(Buffer.from(encoded,"base64")).buffer),before=index.slice();
      const removed=new Set(receipt.records.filter(r=>r.mesh===mi).flatMap(r=>r.triangles));expect(finish(applySouthFidelityTrianglesV294(next,mi,index,0))).toBe(removed.size);
      for(let t=0;t<index.length/3;t++){if(removed.has(t)){expect(index[t*3+1]).toBe(index[t*3]);expect(index[t*3+2]).toBe(index[t*3]);}else{expect(index[t*3]).toBe(before[t*3]);expect(index[t*3+1]).toBe(before[t*3+1]);expect(index[t*3+2]).toBe(before[t*3+2]);}}
    }
    const nav=southFidelityNavigationV294(next,old.nav),retained=old.nav.buildings.filter(b=>!["DEBE02YY40001ISn","DEBE00YY1IW0004t"].includes(b.sourceId));
    expect(nav.buildings.filter(b=>!b.sourceId.startsWith("south-v294-"))).toEqual(retained);expect(JSON.stringify(old)).toBe(snapshot);
  }
});

test("elevated courses leave traffic headroom and market/park fittings remain in mapped areas",()=>{
  for(const native of[false,true]){
    const model=southFidelityGeometryV294(native),decks=model.rows.filter(r=>r.role==="u1-source-course-elevated-deck");
    expect(decks.every(r=>r.p[1]-r.s[1]/2>=8.5)).toBe(true);expect(model.rows.filter(r=>r.role==="u1-1435mm-elevated-rail").every(r=>r.p[1]===9.04)).toBe(true);
    for(const r of model.rows.filter(r=>r.role==="winterfeldt-market-awning"))for(const dx of[-r.s[0]/2,r.s[0]/2])for(const dz of[-r.s[2]/2,r.s[2]/2])expect(southFidelityContainsV294(data.plans["168901481"],r.p[0]+dx,r.p[2]+dz)).toBe(true);
    for(const r of model.rows.filter(r=>r.role==="hasenheide-bounded-rose-bed"))expect(southFidelityContainsV294(data.plans["217402343"],r.p[0],r.p[2])).toBe(true);
    const solids=southFidelitySolidsV294(native);expect(solids.filter(s=>s.sourceId==="south-v294-u1-source-course-elevated-deck").every(s=>s.minY>8.5)).toBe(true);
    expect(model.triangles.length===0).toBe(native);
  }
});

test("C47 keeps its full measured aircraft plan while gaining rounded skins, two radial engines and six propeller tips",()=>{
  for(const native of[false,true]){
    const m=technikmuseumGeometryV272(native);expect(m.roles["c47-rounded-fuselage"]).toBe(21);expect(m.roles["c47-twin-radial-engine"]).toBe(2);expect(m.roles["c47-propeller-tip"]).toBe(6);
    expect(m.roles["c47-swept-tail-fin"]).toBeGreaterThan(1);expect(m.roles["c47-tail-leading-edge"]).toBeGreaterThan(0);
    expect(m.roles["osm-c47-complete-wing-plan"]).toBeGreaterThan(5);
    if(!native)expect(m.roles["c47-aluminium-curved-fuselage-skin"]).toBe(672);
  }
});


test("production streaming codec gates complete South owners and publishes the matching passage geometry/navigation",async()=>{
  for(const native of[false,true]){
    const closed=await createStreamedSurroundingCityChunkV255(packet("6_4",native),"6_4",native,{yield:async()=>{}},{});
    expect(closed.root.userData.southFidelityTrianglesV294??0).toBe(0);
    expect(closed.nav.buildings.some(b=>b.sourceId==="DEBE02YY40001ISn")).toBe(true);disposeSurroundingCityRoot(closed.root);
    const open=await createStreamedSurroundingCityChunkV255(packet("6_4",native),"6_4",native,{yield:async()=>{}},{southFidelityV294:true});
    expect(open.root.userData.southFidelityTrianglesV294).toBe(native?258:98);
    if(!native)expect(open.root.userData.southFidelityLineSegmentsV294).toBe(34);
    const root=new Group();root.add(createSouthFidelityV294(native),open.root);root.updateMatrixWorld(true);
    for(const y of[4.5,4.9,6]){
      const a=new Vector3(3151.77675,y,2141.60785),b=new Vector3(3132.64515,y,2182.9168),d=b.clone().sub(a);
      expect(new Raycaster(a,d.clone().normalize(),0,d.length()).intersectObjects(root.children,true).filter(h=>(h.object as Mesh).isMesh)).toHaveLength(0);
      for(let j=0;j<=30;j++){const p=a.clone().lerp(b,j/30);expect(surroundingBuildingSolidAt(open.nav,p.x-open.origin[0],p.y,p.z-open.origin[2],.25)).toBe(false);}
    }
    expect(open.nav.buildings.some(b=>b.sourceId.startsWith("south-v294-nkz-"))).toBe(true);disposeSurroundingCityRoot(root);
  }
});


test("late complete-owner admission redecodes only exact South receipt tiles and revocation restores closed source without resetting neighbours",async()=>{
 const until=async(p:()=>boolean)=>{for(let i=0;i<600;i++){if(p())return;await new Promise(r=>setTimeout(r,5));}throw new Error("bounded admission fixture did not settle");};
 for(const native of[false,true]){
  const original=packet("6_4",native),body=JSON.stringify(original),real=manifest.chunks.find((d:{id:string})=>d.id==="6_4"),asset={url:"owner.json",bytes:Buffer.byteLength(body)};
  const encode=(a:Uint8Array|Uint16Array|Uint32Array)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64"),foreign:SurroundingCityChunk={schemaVersion:1,origin:[3000,-10,2000],meshes:[{kind:"ground",positionType:"u16cm",positions:encode(new Uint16Array([0,1300,0,20000,1300,0,0,1300,20000])),colors:encode(new Uint8Array([128,64,32,128,64,32,128,64,32])),indices:encode(new Uint32Array([0,1,2]))}],nav:{groundY:3,ground:[{ring:[[0,0],[200,0],[200,200],[0,200]],holes:[]}],water:[],buildings:[]}},foreignBody=JSON.stringify(foreign),foreignAsset={url:"foreign.json",bytes:Buffer.byteLength(foreignBody)};
  const source={schemaVersion:1,groundY:3,footprint:[{ring:[[3000,2000],[3600,2000],[3600,2600],[3000,2600]],holes:[]}],chunks:[{...real,drawn:asset,minecraft:asset},{id:"unrelated-v294-fixture",bounds:[3000,2000,3200,2200],drawn:foreignAsset,minecraft:foreignAsset}]};
  const cam=new OrthographicCamera(-350,350,350,-350,1,3000);cam.position.set(3150,500,2200);cam.up.set(0,0,-1);cam.lookAt(3150,0,2200);cam.updateMatrixWorld();let admitted=false;const calls=new Map<string,number>();
  const city=createSurroundingCity({manifestUrl:new URL("https://example.test/manifest.json"),camera:cam,mode:native?"minecraft":"day",southFidelityV294:()=>admitted,fetch:(async input=>{const path=new URL(String(input)).pathname;calls.set(path,(calls.get(path)??0)+1);return new Response(path.endsWith("manifest.json")?JSON.stringify(source):path.endsWith("owner.json")?body:foreignBody);})as typeof fetch});
  await city.ready;await until(()=>city.residentChunkCount===2&&!city.pending);
  const oldOwner=city.root.children.find(c=>c.name.includes(" 6_4"))!,untouched=city.root.children.find(c=>c.name.includes(" unrelated-v294-fixture"))!,nav=()=>city.navigationTiles.find(t=>t.bounds[2]===real.bounds[2])!.nav;
  expect(nav().buildings.some(b=>b.sourceId==="DEBE02YY40001ISn")).toBe(true);expect(calls.get("/owner.json")).toBe(1);expect(calls.get("/foreign.json")).toBe(1);
  admitted=true;city.refresh(performance.now()+1000);await until(()=>city.residentChunkCount===2&&!city.pending&&nav().buildings.some(b=>b.sourceId.startsWith("south-v294-nkz-")));
  expect(city.root.children.includes(oldOwner)).toBe(false);expect(city.root.children.includes(untouched)).toBe(true);expect(calls.get("/owner.json")).toBe(2);expect(calls.get("/foreign.json")).toBe(1);
  city.refresh(performance.now()+2000);await new Promise(r=>setTimeout(r,10));expect(calls.get("/owner.json")).toBe(2);
  admitted=false;city.refresh(performance.now()+3000);await until(()=>city.residentChunkCount===2&&!city.pending&&nav().buildings.some(b=>b.sourceId==="DEBE02YY40001ISn"));expect(calls.get("/owner.json")).toBe(3);expect(calls.get("/foreign.json")).toBe(1);expect(city.root.children.includes(untouched)).toBe(true);city.dispose();
 }
});
