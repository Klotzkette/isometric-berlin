import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {Box3,Group,InstancedMesh,Mesh,Raycaster,Vector3} from "three";
import data from "../src/data/openSitesV346.json";
import {createOpenSitesV346,createOpenSitesNavigationV346,hasCompleteOpenSitesV346,openSiteSourceAdmittedV346,openSiteSolidsV346,type OpenSiteKeyV346} from "../src/OpenSitesV346";
import {parkStaticInstancesSteps} from "../src/losslessStaticStorage";
import {schwellenraumMaterialFor} from "../src/visual-modes/schwellenraum/materialGrade";
import {transformLosslessJsonData} from "../losslessJsonData";
import {decodeLosslessGzipJson} from "../src/losslessGzipJson";
const root=new URL("../public/mesh/regierungsviertel/",import.meta.url),prisms=JSON.parse(readFileSync(new URL('lod2-prisms.json',root),'utf8')).buildings,voxels=JSON.parse(readFileSync(new URL('minecraft-voxels.json',root),'utf8'));
test("both full official source families admit, retain old source, and reject changed or absent exact core owners",()=>{
 const snapshot=JSON.stringify(prisms),voxelSnapshot=JSON.stringify(voxels);
 expect(data.sites.map(s=>s.parts.length)).toEqual([4,2]);
 for(const site of data.sites){const key=site.key as OpenSiteKeyV346;expect(openSiteSourceAdmittedV346(prisms,key)).toBeTrue();expect(openSiteSourceAdmittedV346(prisms,key,voxels)).toBeTrue();
  expect(openSiteSourceAdmittedV346(prisms.filter((p:any)=>p.id!==site.source.id),key)).toBeFalse();expect(openSiteSourceAdmittedV346([...prisms,site.source],key)).toBeFalse();
  const altered=prisms.map((p:any)=>p.id===site.source.id?{...p,h_dm:p.h_dm+1}:p);expect(openSiteSourceAdmittedV346(altered,key)).toBeFalse();
  const v=structuredClone(voxels);const[x,z]=site.nativeColumns[0];const ri=z-v.grid.min_z_idx;v.building_rows[ri]=v.building_rows[ri].filter(([a,n]:number[])=>!(x-v.grid.min_x_idx>=a&&x-v.grid.min_x_idx<a+n));expect(openSiteSourceAdmittedV346(prisms,key,v)).toBeFalse();
 }
 for(const native of[false,true]){const group=createOpenSitesV346(prisms,native?voxels:undefined);expect(group.children).toHaveLength(2);group.updateMatrixWorld(true);let instances=0;
  group.traverse(node=>{if(node instanceof Mesh)expect(node.geometry.getAttribute('uv')).toBeUndefined();if(node instanceof InstancedMesh){instances+=node.count;for(let i=0;i<node.count;i++)for(const at of[1,2,4,6,8,9])expect(node.instanceMatrix.array[i*16+at]).toBe(0);}});
  expect(instances).toBe(native?946:0);expect(new Box3().setFromObject(group).max.y).toBeLessThan(20);
  for(const site of data.sites)for(const solid of openSiteSolidsV346(site.key as OpenSiteKeyV346,native)){
   const part=site.parts.find(p=>solid.sourceId.endsWith(p.id))!;
   for(const[x,z]of part.nativeCells.filter((_,i)=>i%Math.max(1,Math.floor(part.nativeCells.length/8))===0)){
    const px=x+.5,pz=z+.5,top=solid.topAt(px,pz);if(top===null)continue;
    const hits=new Raycaster(new Vector3(px,30,pz),new Vector3(0,-1,0)).intersectObject(group,true);expect(hits.length).toBeGreaterThan(0);expect(hits.some(hit=>Math.abs(hit.point.y-top)<.015)).toBeTrue();
   }
  }
 }
 expect(JSON.stringify(prisms)).toBe(snapshot);expect(JSON.stringify(voxels)).toBe(voxelSnapshot);
});


test("world-owned walking closes on hidden, detached, missing, mutated and disposed complete models",()=>{
 for(const native of[false,true]){
  const world=new Group(),model=createOpenSitesV346(prisms,native?voxels:undefined);world.add(model);
  const nav=createOpenSitesNavigationV346(world,model,native),part=data.sites[0].parts[1];
  const [x,z]=part.nativeCells[Math.floor(part.nativeCells.length/2)],px=x+.5,pz=z+.5;
  const top=nav.groundAt(px,pz,30)!;expect(top).toBeGreaterThan(10);expect(nav.groundAt(px,pz,5)).toBeNull();expect(nav.solidAt(px,top-1,pz)).toBeTrue();expect(nav.solidAt(px,top+1,pz)).toBeFalse();
  expect(hasCompleteOpenSitesV346(model,native)).toBeTrue();expect(hasCompleteOpenSitesV346(model,!native)).toBeFalse();expect(hasCompleteOpenSitesV346(model.clone(),native)).toBeFalse();
  // Existing day/night/Schwellenraum variants and lossless matrix parking are admissible.
  for(const mode of["day","night","schwellenraum"]){model.traverse(node=>{if(node instanceof Mesh)node.material=mode==="day"?node.userData.dayMaterial:mode==="night"?node.userData.nightMaterial:schwellenraumMaterialFor(node,node.userData.dayMaterial);});expect(hasCompleteOpenSitesV346(model,native)).toBeTrue();}
  const park=parkStaticInstancesSteps(model);while(!park.next().done){}expect(hasCompleteOpenSitesV346(model,native)).toBeTrue();
  for(const hidden of[world,model,model.children[0]]){hidden.visible=false;expect(nav.groundAt(px,pz,30)).toBeNull();expect(nav.solidAt(px,top-1,pz)).toBeFalse();hidden.visible=true;expect(nav.groundAt(px,pz,30)).toBe(top);}
  world.remove(model);expect(nav.groundAt(px,pz,30)).toBeNull();world.add(model);expect(nav.groundAt(px,pz,30)).toBe(top);
  model.position.x=.1;expect(nav.solidAt(px,top-1,pz)).toBeFalse();model.position.x=0;
  const mesh=model.children[0].children[0]as Mesh;mesh.geometry.dispose();expect(hasCompleteOpenSitesV346(model,native)).toBeFalse();expect(nav.solidAt(px,top-1,pz)).toBeFalse();expect(nav.groundAt(px,pz,30)).toBeNull();
 }
 for(const change of[(m:Group)=>m.children.pop(),(m:Group)=>{const mesh=m.children[0].children[0]as Mesh;mesh.geometry.drawRange.count=0;},(m:Group)=>{const mesh=m.children[0].children[0]as Mesh;mesh.geometry.getAttribute("position").needsUpdate=true;}]){
  const model=createOpenSitesV346(prisms);change(model);expect(hasCompleteOpenSitesV346(model,false)).toBeFalse();
 }
});

test("the existing construction codec round-trips every source and roof word without retaining a top-level site map",()=>{
 const path=fileURLToPath(new URL("../src/data/openSitesV346.json",import.meta.url)),text=readFileSync(path,"utf8"),result=transformLosslessJsonData(text,path)!;
 expect(result.code).toContain("new WeakRef(value)");expect(result.code.length).toBeLessThan(text.length*.8);
 const code=result.code.replace(/^import[^\n]+\n/,"").replace(/export \{[^\n]+\};/,"").replace("export default","return");
 const decoded=new Function("__decodeLosslessGzip",code)(decodeLosslessGzipJson);expect(decoded).toEqual(JSON.parse(text));
 const runtime=readFileSync(new URL("../src/OpenSitesV346.ts",import.meta.url),"utf8");expect(runtime).not.toContain("const sites=new Map");
});
