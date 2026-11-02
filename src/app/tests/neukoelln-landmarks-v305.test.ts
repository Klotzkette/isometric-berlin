import {describe,expect,test}from "bun:test";
import {BufferAttribute,Group,InstancedMesh,Mesh}from "three";
import {createNeukoellnLandmarksV305,hasCompleteNeukoellnLandmarksV305}from "../src/NeukoellnLandmarksV305";
import {neukoellnLandmarksV305Solids}from "../src/NeukoellnLandmarksV305Navigation";
import {applyNeukoellnLegacyV227V305}from "../src/NeukoellnLandmarksV305Previous";
import {createDistrictTownhallsV227}from "../src/DistrictTownhallsV227";
import {parkStaticGeometrySteps}from "../src/losslessStaticStorage";
import {setIsoNightPresentation}from "../src/IsometricCityWorld";
import {createMinecraftMaterialState,disposeMinecraftMaterialState,setMinecraftMaterialPresentation}from "../src/visual-modes/minecraft/materialMode";
import data from "../src/data/neukoellnLandmarksV305Core.json";
import profile from "../src/data/neukoellnLandmarksV305Profile.json";
function dispose(root:Group){const seen=new Set<object>();root.traverse(o=>{if(o instanceof Mesh){if(!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}for(const m of[o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial])if(m&&!seen.has(m)){seen.add(m);m.dispose();}if(o instanceof InstancedMesh)o.dispose();}});root.clear();}
function contains(r:number[][],x:number,z:number){let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
describe("Complete Neukölln landmarks v305",()=>{
 test("all source sheets, outside complements and full touch geometry are attached",()=>{
  const a=createNeukoellnLandmarksV305(),b=createNeukoellnLandmarksV305(false,{mobileLike:true});
  try{expect(profile.sites.map(s=>s.parts)).toEqual([65,15]);expect(data.counts.sourceSurfaces).toBe(1104);expect(hasCompleteNeukoellnLandmarksV305(a,false)).toBe(true);expect(hasCompleteNeukoellnLandmarksV305(b,false)).toBe(true);expect(a.children.length).toBe(b.children.length);expect((a.children[0]as Mesh).geometry.index!.count).toBe(data.counts.sourceTriangles*3);expect(data.fittings).toHaveLength(8993);expect(profile.sites.every(s=>s.outsideComplementAreaM2>0)).toBe(true);}finally{dispose(a);dispose(b);}
 });
 test("native construction is independently cardinal and its navigation follows actual full cells",()=>{
  const root=createNeukoellnLandmarksV305(true);
  try{expect(hasCompleteNeukoellnLandmarksV305(root,true)).toBe(true);expect(data.nativeBoxes.every(r=>r[6]===0)).toBe(true);const solids=neukoellnLandmarksV305Solids(true);expect(solids.length).toBe(profile.nativeRegions.length+profile.towerNavigation.native.length);for(const row of profile.nativeNavigation){const x=(Number(row[1])+Number(row[3]))*.25,z=(Number(row[2])+Number(row[4]))*.25,solid=solids.find(s=>s.parentId===row[0]&&s.minY===row[5]&&contains(s.ring,x,z)&&!s.holes.some(h=>contains(h,x,z)));expect(solid).toBeDefined();expect(solid!.topAt(x,z)).toBe(row[6]);expect(solid!.minY).toBe(row[5]);}}finally{dispose(root);}
 });
 test("private admission rejects partial, forged and replaced attribute models",()=>{
  const root=createNeukoellnLandmarksV305();try{expect(hasCompleteNeukoellnLandmarksV305(new Group())).toBe(false);const first=root.children[0]as Mesh;const position=first.geometry.getAttribute("position")as BufferAttribute;first.geometry.setAttribute("position",position.clone());expect(hasCompleteNeukoellnLandmarksV305(root)).toBe(false);first.geometry.setAttribute("position",position);expect(hasCompleteNeukoellnLandmarksV305(root)).toBe(true);first.visible=false;expect(hasCompleteNeukoellnLandmarksV305(root)).toBe(false);}finally{dispose(root);}
 });
 test("lossless parking keeps private model admission without retaining original arrays",()=>{
  const root=createNeukoellnLandmarksV305();try{const g=parkStaticGeometrySteps(root,true);let r=g.next();while(!r.done)r=g.next();root.traverse(o=>{if(o instanceof Mesh){for(const a of Object.values(o.geometry.attributes))if(a instanceof BufferAttribute)a.onUploadCallback();o.geometry.index?.onUploadCallback();if(o instanceof InstancedMesh){o.instanceMatrix.onUploadCallback();o.instanceColor?.onUploadCallback();}}});expect(hasCompleteNeukoellnLandmarksV305(root)).toBe(true);}finally{dispose(root);}
 });
 for(const native of[false,true])test(`only complete admitted model can retire exact old Rathaus fittings (${native})`,()=>{
  const old=createDistrictTownhallsV227(native),replacement=createNeukoellnLandmarksV305(native),host=new Group();host.add(old,replacement);
  try{const own=old.children.filter(o=>o.userData.siteKey==="neukoelln"),foreign=old.children.filter(o=>o.userData.siteKey!=="neukoelln");expect(applyNeukoellnLegacyV227V305(old,native,false,replacement)).toBe(false);expect(own.every(o=>o.visible)).toBe(true);expect(applyNeukoellnLegacyV227V305(old,native,true,new Group())).toBe(false);expect(applyNeukoellnLegacyV227V305(old,native,true,replacement)).toBe(true);expect(own.every(o=>!o.visible)).toBe(true);expect(foreign.every(o=>o.visible)).toBe(true);expect(applyNeukoellnLegacyV227V305(old,native,true,replacement)).toBe(true);host.remove(replacement);expect(applyNeukoellnLegacyV227V305(old,native,true,replacement)).toBe(false);expect(own.every(o=>o.visible)).toBe(true);host.add(replacement);}finally{dispose(host);}
 });
 test("a changed actual old batch retains every predecessor",()=>{
  const old=createDistrictTownhallsV227(),replacement=createNeukoellnLandmarksV305(),host=new Group();host.add(old,replacement);
  try{const own=old.children.filter(o=>o.userData.siteKey==="neukoelln")as InstancedMesh[];own[0].instanceMatrix.array[0]+=.1;expect(applyNeukoellnLegacyV227V305(old,false,true,replacement)).toBe(false);expect(own.every(o=>o.visible)).toBe(true);}finally{dispose(host);}
 });
 for(const native of[false,true])test(`legitimate six-mode material bindings preserve admission (${native})`,()=>{
  const root=createNeukoellnLandmarksV305(native),state=createMinecraftMaterialState();try{for(const mode of["day","night","flood","snowstorm","schwellenraum","minecraft","day"]as const){setIsoNightPresentation(root,mode==="night",true,mode);setMinecraftMaterialPresentation(root,state,mode==="minecraft");expect(hasCompleteNeukoellnLandmarksV305(root,native)).toBe(true);}setMinecraftMaterialPresentation(root,state,false);const mesh=root.children[0]as Mesh;mesh.material=(mesh.userData.dayMaterial as any).clone();expect(hasCompleteNeukoellnLandmarksV305(root,native)).toBe(false);(mesh.material as any).dispose();}finally{disposeMinecraftMaterialState(state);dispose(root);}
 });
 for(const native of[false,true])test(`old Rathaus fittings re-admit through six modes after required-model revocation (${native})`,()=>{
  const old=createDistrictTownhallsV227(native),replacement=createNeukoellnLandmarksV305(native),host=new Group();host.add(old,replacement);
  try{const own=old.children.filter(c=>c.userData.siteKey==="neukoelln");expect(applyNeukoellnLegacyV227V305(old,native,true,replacement)).toBe(true);for(const mode of["day","night","flood","snowstorm","schwellenraum","minecraft"]as const){setIsoNightPresentation(old,mode==="night",true,mode);host.remove(replacement);expect(applyNeukoellnLegacyV227V305(old,native,true,replacement)).toBe(false);expect(own.every(c=>c.visible)).toBe(true);host.add(replacement);expect(applyNeukoellnLegacyV227V305(old,native,true,replacement)).toBe(true);expect(own.every(c=>!c.visible)).toBe(true);}}finally{dispose(host);}
 });
 test("an arbitrary public old grade cannot acquire first admission",()=>{
  const old=createDistrictTownhallsV227(),replacement=createNeukoellnLandmarksV305(),host=new Group();host.add(old,replacement);
  try{const own=old.children.filter(c=>c.userData.siteKey==="neukoelln")as Mesh[],fake=own[0].userData.dayMaterial.clone();own[0].userData.schwellenraumMaterial=fake;fake.userData.schwellenraumMaterialGrade=true;expect(applyNeukoellnLegacyV227V305(old,false,true,replacement)).toBe(false);expect(own.every(c=>c.visible)).toBe(true);}finally{dispose(host);}
 });
 test("real late v227 factories are masked by actual cold-boot hooks before first mode and parking",async()=>{
  const viewer=await Bun.file(new URL("../src/ThreeViewer.tsx",import.meta.url)).text(),voxel=await Bun.file(new URL("../src/MinecraftVoxelWorld.ts",import.meta.url)).text();
  const drawnMarker="yield* sitesV209.addRequiredSiteEnvelopesV209Steps(isoWorld);",drawnAt=viewer.indexOf(drawnMarker),drawnCompact=viewer.indexOf("yield* compactStaticGeometrySteps(isoWorld);",drawnAt);
  expect(drawnAt).toBeGreaterThan(0);expect(drawnCompact).toBeGreaterThan(drawnAt);const drawnHook=viewer.slice(drawnAt+drawnMarker.length,drawnCompact);expect(drawnHook.includes("applyNeukoellnLegacyV227V305(isoWorld,false,true,fidelityV288.neukoellnModel)")).toBe(true);
  const nativeAt=viewer.indexOf("await completeCooperatively(sitesV209.addRequiredSiteEnvelopesV209Steps(provisionalVoxelWorld, true)"),nativeHookAt=viewer.indexOf("provisionalVoxelWorld.userData.prepareNeukoellnLegacyV305?.();",nativeAt),nativeParkAt=viewer.indexOf("parkStaticInstancesSteps(provisionalVoxelWorld)",nativeAt);expect(nativeAt).toBeGreaterThan(0);expect(nativeHookAt).toBeGreaterThan(nativeAt);expect(nativeHookAt).toBeLessThan(nativeParkAt);
  const closureAt=voxel.indexOf("let neukoellnAdmissionV305=applyNeukoellnLegacyV227V305(group,true"),closureEnd=voxel.indexOf("group.userData.moabitMitteV300=",closureAt);expect(closureAt).toBeGreaterThan(0);expect(closureEnd).toBeGreaterThan(closureAt);
  for(const native of[false,true]){
   const root=new Group(),required=new Group(),model=createNeukoellnLandmarksV305(native),state=createMinecraftMaterialState();required.add(model);root.add(required);const fidelity={root:required,neukoellnModel:model};
   try{
    // The real initial constructor sees no v227 children. RequiredSite's real
    // townhall constructor arrives later, exactly as in both production paths.
    expect(applyNeukoellnLegacyV227V305(root,native,true,model)).toBe(false);
    if(native)new Function("group","options","fidelityV288","applyNeukoellnLegacyV227V305","hasCompleteNeukoellnLandmarksV305",voxel.slice(closureAt,closureEnd))(root,{neighbourhoodV300:true},fidelity,applyNeukoellnLegacyV227V305,hasCompleteNeukoellnLandmarksV305);
    const legacy=createDistrictTownhallsV227(native);root.add(legacy);const own=legacy.children.filter(c=>c.userData.siteKey==="neukoelln");expect(own.length).toBe(native?1:2);expect(own.every(c=>c.visible)).toBe(true);
    if(native)new Function("provisionalVoxelWorld",viewer.slice(nativeHookAt,nativeHookAt+"provisionalVoxelWorld.userData.prepareNeukoellnLegacyV305?.();".length))(root);
    else expect(new Function("isoWorld","fidelityV288","applyNeukoellnLegacyV227V305","provisionalPedestrianEnvironment","let neukoellnAdmissionV305=false;"+drawnHook+"return neukoellnAdmissionV305;")(root,fidelity,applyNeukoellnLegacyV227V305,null)).toBe(true);
    expect(own.every(c=>!c.visible)).toBe(true);setIsoNightPresentation(root,false,true,"schwellenraum");expect(own.every(c=>!c.visible)).toBe(true);expect(hasCompleteNeukoellnLandmarksV305(model,native)).toBe(true);
    root.remove(required);expect(applyNeukoellnLegacyV227V305(root,native,false,model)).toBe(false);expect(own.every(c=>c.visible)).toBe(true);root.add(required);expect(applyNeukoellnLegacyV227V305(root,native,true,model)).toBe(true);expect(own.every(c=>!c.visible)).toBe(true);
    setIsoNightPresentation(root,false,true,"minecraft");setMinecraftMaterialPresentation(root,state,true);expect(hasCompleteNeukoellnLandmarksV305(model,native)).toBe(true);setMinecraftMaterialPresentation(root,state,false);expect(hasCompleteNeukoellnLandmarksV305(model,native)).toBe(true);
   }finally{disposeMinecraftMaterialState(state);dispose(root);}
  }
 });
});
