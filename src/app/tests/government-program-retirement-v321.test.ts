/** Exercise real touch shader retirement with actual finite source families. */
import{expect,test}from"bun:test";
import{readFileSync}from"node:fs";
import ts from"typescript";
import{BoxGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,LineSegments,LineBasicMaterial}from"three";
import{retireSceneMaterialPrograms,isSceneMaterialProgramRetirementV321}from"../src/sceneMaterialPrograms";
import{createGovernmentOfficesV321}from"../src/GovernmentOfficesV321";
import{prepareFederalMinistryPressQuarterSourceV321}from"../src/FederalMinistryPressQuarterV321";
import{federalMinistryPreviousPlanV321,federalMinistryPreviewPlanV321,createFederalMinistriesV321,hasCompleteFederalMinistriesV321}from"../src/FederalMinistriesV321";
import{createExactOwnersSourceV321}from"../src/ExactOwnersV321";
import{berlinSenatePreviousPlanV321,berlinSenatePreviewPlanV321}from"../src/BerlinSenateBuildingsV321";
import{createIsometricCityCore,createDistantBuildingShells,setIsoNightPresentation}from"../src/IsometricCityWorld";
import{createPressQuarterV272}from"../src/PressQuarterV272";
import{runtimeConstructorOptionsV310}from"./helpers/northRuntimeActualV310";
import{compactStaticGeometry}from"../src/compactStaticGeometry";
import{setFlatUnlit,setBuildingColorMode}from"../src/drawnBuildings";
import{schwellenraumObjektmodus}from"../src/visual-modes/schwellenraum/presentation";
import{schwellenraumMaterialFor,setSchwellenraumStandardMaterialTone,hasSchwellenraumMaterialProvenance}from"../src/visual-modes/schwellenraum/materialGrade";
import{createMinecraftMaterialState,setMinecraftMaterialPresentation,restoreMinecraftMaterialPresentation,disposeMinecraftMaterialState,hasMinecraftMaterialProvenance}from"../src/visual-modes/minecraft/materialMode";
import{applyArchitecturalInkMode}from"../src/architecturalInk";
const viewer=readFileSync(new URL("../src/ThreeViewer.tsx",import.meta.url),"utf8"),ast=ts.createSourceFile("ThreeViewer.tsx",viewer,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function node(name:string){const n=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)as ts.FunctionDeclaration;if(!n)throw Error("Missing actual Viewer function "+name);return n;}
function actual(names:string[],deps:Record<string,unknown>,last=names.at(-1)!){const text=names.map(name=>node(name).getText(ast).replace(/^export /,"")).join("\n"),js=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;return new Function(...Object.keys(deps),js+";return "+last)(...Object.values(deps));}
const light=actual(["applyMaterialLighting","applyLightingToRoot"],{Mesh,LineSegments,MeshStandardMaterial,LineBasicMaterial,compactStaticGeometry,setFlatUnlit,setBuildingColorMode,schwellenraumObjektmodus,schwellenraumMaterialFor,setSchwellenraumStandardMaterialTone,applyArchitecturalInkMode,MOONLIGHT_EMISSIVE:0x1c2636,MOONLIGHT_EMISSIVE_INTENSITY:.22});
const relight=actual(["voxelModeActive","currentGovernmentOfficesV321","applyGovernmentLightingV321"],{applyLightingToRoot:light,wilhelmHousingModuleV324:undefined,wilhelmStreetModuleV325:undefined});
const scene=node("setSceneLighting"),boundary=scene.body!.statements.filter(s=>ts.isIfStatement(s)&&s.getText(ast).includes("retireSceneMaterialPrograms(runtime.scene)"));expect(boundary).toHaveLength(1);
const dayShare=scene.body!.statements.find(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText(ast)==="sharesDayMaterials"))!;
const retireBoundary=new Function("retireSceneMaterialPrograms",ts.transpileModule(`function boundary(runtime,mode){${dayShare.getText(ast)}\n${boundary[0].getText(ast)}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+";return boundary;")(retireSceneMaterialPrograms);
const p=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8")),drain=(g:any)=>{for(;;){const n=g.next();if(n.done)return n.value;}};
function dispose(root:Group){const resources=new Set<any>();root.traverse((o:any)=>{if(o.geometry)resources.add(o.geometry);if(o.isInstancedMesh)resources.add(o);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m?.dispose)resources.add(m);});for(const r of resources)r.dispose();root.clear();}

test("actual touch retirement and Viewer lighting keep complete Core20/Press1/Preview6 across six modes and lights-off",async()=>{
 expect(await prepareFederalMinistryPressQuarterSourceV321(false)).toBeTrue();const ids=new Set([...federalMinistryPreviousPlanV321().plan.owners,...berlinSenatePreviousPlanV321().plan.owners].map(o=>o.id)),previewIds=new Set([...federalMinistryPreviewPlanV321().plan.owners,...berlinSenatePreviewPlanV321().plan.owners].map(o=>o.id)),options=runtimeConstructorOptionsV310(false,true,p);
 const world=new Group(),core=createIsometricCityCore(p,null,null,null,{...options,buildings:p.buildings.filter((b:any)=>ids.has(b.id)),includeContext:false,moabitMitteV300:false,westKiezV302:false}),preview=createDistantBuildingShells(p,p.buildings.filter((b:any)=>previewIds.has(b.id)),options),press=createPressQuarterV272(false,{mobileLike:true});world.add(core,preview,press);const gov=createGovernmentOfficesV321({native:false,mobileLike:true,sourcePrisms:p.buildings})!;expect(gov).not.toBeNull();world.add(gov.root);const scene=new Group().add(world),runtime:any={scene,isoWorld:world,voxelWorld:null,coarsePointer:true,lightingMode:"day",governmentOfficesV321:{drawn:gov}};
 try{expect(drain(gov.stagePreviousSteps(core))).toBeTrue();expect(drain(gov.stagePressQuarterSteps(press))).toBeTrue();expect(drain(gov.stagePreviewSteps(preview))).toBeTrue();expect(gov.complete()).toBeTrue();
  for(const mode of["night","snowstorm","schwellenraum","flood","day","minecraft","day","night"]){retireBoundary(runtime,mode);expect(gov.complete()).toBeTrue();runtime.lightingMode=mode;relight(runtime,mode,true);setIsoNightPresentation(world,mode==="night",true,mode as any);expect(gov.complete()).toBeTrue();expect(gov.root.visible).toBeTrue();}
  relight(runtime,"night",false);expect(gov.complete()).toBeTrue();gov.root.traverse((o:any)=>{const m=o.userData.nightMaterial;if(m?.userData.nightEmissive){expect(m.emissive.getHex()).toBe(0);expect(m.emissiveIntensity).toBe(0);}});
  const source=core.children.find((o:any)=>o.isMesh)as Mesh;source.userData.dayMaterial.dispose();expect(gov.complete()).toBeFalse();expect(gov.root.visible).toBeFalse();
 }finally{gov.rollback();dispose(scene);}
});

test("real grade and Minecraft private proofs survive qualified shader retirement, but authored disposal still rejects",()=>{
 const day=new MeshStandardMaterial(),mesh=new Mesh(new BoxGeometry(),day),root=new Group().add(mesh),grade=schwellenraumMaterialFor(mesh,day),state=createMinecraftMaterialState();mesh.userData.dayMaterial=day;mesh.userData.schwellenraumMaterial=grade;
 try{mesh.material=grade;setMinecraftMaterialPresentation(root,state,true);const toon=mesh.material;expect(hasSchwellenraumMaterialProvenance(mesh,day,grade)).toBeTrue();expect(hasMinecraftMaterialProvenance(mesh,day,toon)).toBeTrue();expect(retireSceneMaterialPrograms(root)).toBeGreaterThan(0);expect(hasSchwellenraumMaterialProvenance(mesh,day,grade)).toBeTrue();expect(hasMinecraftMaterialProvenance(mesh,day,toon)).toBeTrue();(toon as MeshStandardMaterial).dispose();expect(hasMinecraftMaterialProvenance(mesh,day,toon)).toBeFalse();restoreMinecraftMaterialPresentation(state);day.dispose();expect(hasSchwellenraumMaterialProvenance(mesh,day,grade)).toBeFalse();}
 finally{disposeMinecraftMaterialState(state);dispose(root);}
});

test("actual native factory and current original voxel-grid admission remain strict after program retirement",()=>{
 const voxels=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url),"utf8")),{plan,control}=federalMinistryPreviousPlanV321(true,false),source=createExactOwnersSourceV321(plan,p.buildings,control,voxels)!;
 expect(source).not.toBeNull();const root=createFederalMinistriesV321(true,{sourcePrisms:p.buildings,voxels,mobileLike:true});
 try{expect(hasCompleteFederalMinistriesV321(root,true)).toBeTrue();expect(retireSceneMaterialPrograms(root)).toBeGreaterThan(0);expect(hasCompleteFederalMinistriesV321(root,true)).toBeTrue();expect(createExactOwnersSourceV321(plan,p.buildings,control,voxels)).toBe(source);
  const x=voxels.grid.min_x_idx;try{voxels.grid.min_x_idx++;expect(createExactOwnersSourceV321(plan,p.buildings,control,voxels)).toBeNull();}finally{voxels.grid.min_x_idx=x;}
  expect(createExactOwnersSourceV321(plan,p.buildings,control,voxels)).toBe(source);(root.children[0].children[0]as Mesh).userData.nightMaterial.dispose();expect(hasCompleteFederalMinistriesV321(root,true)).toBeFalse();
 }finally{dispose(root);}
});

test("retirement proof is exact-material, synchronous and cleared after thrown disposal",()=>{
 const a=new MeshBasicMaterial(),b=new MeshBasicMaterial(),root=new Group().add(new Mesh(new BoxGeometry(),a)),events:boolean[]=[];
 const listen=()=>{events.push(isSceneMaterialProgramRetirementV321(a));b.dispose();};a.addEventListener("dispose",listen);b.addEventListener("dispose",()=>events.push(isSceneMaterialProgramRetirementV321(b)));
 expect(isSceneMaterialProgramRetirementV321(a)).toBeFalse();retireSceneMaterialPrograms(root);expect(events).toEqual([true,false]);expect(isSceneMaterialProgramRetirementV321(a)).toBeFalse();events.length=0;a.dispose();expect(events).toEqual([false,false]);a.removeEventListener("dispose",listen);
 const fail=()=>{throw Error("real disposal listener");};a.addEventListener("dispose",fail);expect(()=>retireSceneMaterialPrograms(root)).toThrow("real disposal listener");expect(isSceneMaterialProgramRetirementV321(a)).toBeFalse();a.removeEventListener("dispose",fail);b.dispose();dispose(root);
});
