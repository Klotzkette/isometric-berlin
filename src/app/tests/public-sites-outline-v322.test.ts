/** Actual public-site factories through the unchanged shared controller AST.
 * Other pre-existing city models and unrelated cartographic arrays are empty
 * here: this is a finite family-lifetime test, not a complete city benchmark.
 */
import{expect,test}from"bun:test";
import{readFileSync}from"node:fs";
import ts from"typescript";
import *as THREE from"three";
import{createEastParksV198}from"../src/EastParksV198";
import{createNorthParksV198}from"../src/NorthParksV198";
import{createYouthTheatresRuntimeV322Steps,prepareYouthTheatresRuntimeV322}from"../src/YouthTheatresRuntimeV322";
import{createMemorialRuntimeV322Steps}from"../src/MemorialRuntimeV322";
import{prepareMemorialPreviousV322}from"../src/MemorialPreviousV322";
import{eastParksV198SolidAt,eastParksV198WaterAt}from"../src/eastParksV198Navigation";
import{eastParksV198GroundAt}from"../src/eastParksV198Ground";
import{northParksV198SolidAt,northParksV198GroundAt,northParksV198WaterAt}from"../src/northParksV198Navigation";
import{freezeStaticSceneTransforms}from"../src/staticSceneTransforms";
import{archenholdNavigationV322}from"../src/youthTheatresV322Navigation";
import{hasCompleteArchenholdV322}from"../src/ArchenholdV322";
import{hasCompleteMemorialAccuracyV322}from"../src/MemorialAccuracyV322";
const drain=<T>(g:Generator<void,T>)=>{for(;;){const n=g.next();if(n.done)return n.value;}};
function declarations(file:string,names:string[]){const text=readFileSync(new URL("../src/"+file,import.meta.url),"utf8"),ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);const found=ast.statements.filter((q):q is ts.FunctionDeclaration=>ts.isFunctionDeclaration(q)&&!!q.name&&names.includes(q.name.text));expect(found.map(q=>q.name!.text).sort()).toEqual([...names].sort());return found.map(q=>q.getText(ast).replace(/^export /,"")).join("\n");}
function actualControllers(){
 const code=declarations("OutlineLandmarksV182.ts",["createOutlineLandmarksV182Steps","disposeOutlineConstruction"])+"\n"+declarations("OuterThinOutlines.ts",["createOuterThinOutlinesSteps"]);
 const bounds={minX:-50000,minZ:-50000,maxX:50000,maxZ:50000},empty=()=>new THREE.Group();
 const dependencies:any={...THREE,createEastParksV198,createNorthParksV198,createYouthTheatresRuntimeV322Steps,createMemorialRuntimeV322Steps,eastParkSourceV322:JSON.parse(readFileSync(new URL("../src/data/eastParksV198.json",import.meta.url),"utf8")),eastParksV198SolidAt,eastParksV198WaterAt,eastParksV198GroundAt,northParksV198SolidAt,northParksV198GroundAt,northParksV198WaterAt,data:{positions:[],features:[]},regionalV200NavigationTiles:[],PRESENTATION_BACKDROP_BOUNDS:bounds,PRESENTATION_FLOOR_Y_M:-.5,extrapolatedEnvelopeBounds:()=>bounds,outlineNavigationEnvelopeBounds:()=>bounds,terrainGroundAt:(_x:number,_z:number,fallback:number)=>fallback};
 const scope=new Proxy(dependencies,{has:()=>true,get(target,key){if(key===Symbol.unscopables)return undefined;if(key in target)return target[key];if(key in globalThis)return(globalThis as any)[key];const name=String(key);if(name.includes("SolidAt")||name.includes("WaterAt"))return()=>false;if(name.includes("GroundAt"))return()=>null;return empty;}});
 const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return new Function("scope","with(scope){"+js+";return {createOuterThinOutlinesSteps,disposeOutlineConstruction};}")(scope)as{createOuterThinOutlinesSteps:(mode:string,release?:((root:THREE.Group)=>void),ownership?:unknown)=>Generator<void,THREE.Group>;disposeOutlineConstruction:(root:THREE.Group)=>void};
}
function replacementGroups(root:THREE.Group){const arche:THREE.Group[]=[],memorials:THREE.Group[]=[];root.traverse(o=>{if(o instanceof THREE.Group){if(hasCompleteArchenholdV322(o))arche.push(o);for(const native of[false,true])for(const keys of[["schoenholz"],["berlin"],["berlin","pyramide","cadillacs"],["berlin","pyramide","cadillacs","french","british"]]as const)if(hasCompleteMemorialAccuracyV322(o,native,keys as any))memorials.push(o);}});return{arche,memorials};}
async function prepare(){for(const native of[false,true]){expect(await prepareMemorialPreviousV322(native,{keys:["schoenholz","treptow"]})).toBeTrue();expect(await prepareYouthTheatresRuntimeV322(native,true)).toBeTrue();}expect(await prepareMemorialPreviousV322(true,{keys:["berlin","pyramide","cadillacs","french","british"]})).toBeTrue();}

test("actual Outer/Outline lifecycle: native-first, final freeze, parent attachment and repeated family-mode changes",async()=>{
 await prepare();const api=actualControllers(),events:string[]=[];
 const outer=drain(api.createOuterThinOutlinesSteps("minecraft",r=>events.push("release:"+r.name),{publicSitesV322:true,mobileLikeV322:true,publicSitesHooksV322:()=>({beforeSwap:(o:THREE.Object3D,k:string)=>{expect(o.parent).not.toBeNull();events.push(k);return true;},afterSwap:()=>events.push("after")})}));
 const scene=new THREE.Scene();scene.add(outer);
 try{
  for(const mode of["minecraft","day","night","schwellenraum","snowstorm","flood","minecraft","day"]){outer.userData.setMode(mode);freezeStaticSceneTransforms(outer);const groups=replacementGroups(outer);expect(groups.arche).toHaveLength(1);expect(groups.memorials.length).toBe(mode==="minecraft"?2:1);expect(outer.matrixAutoUpdate).toBeFalse();const landmarks=outer.getObjectByName("Berlin outline landmark additions v182")!;expect(landmarks.userData.previousArchenholdOwnerV322("relation/2309788")).toBeTrue();expect(outer.userData.solidAt(7037,4,3848)).toBeFalse();expect(outer.userData.groundAt(7037,3848)).toBe(eastParksV198GroundAt(7037,3848));expect(outer.userData.interiorGroundAtV322(7037,3848,4)).toBeNull();const roof=archenholdNavigationV322(groups.arche[0],mode==="minecraft")!.groundAt(7037,3848);expect(roof).not.toBeNull();expect(outer.userData.interiorGroundAtV322(7037,3848,roof)).toBe(roof);}
  const navCode=declarations("ThreeViewer.tsx",["installGovernmentNavigationV321","governmentNavigationCandidateV322","voxelModeActive"]),navJs=ts.transpileModule(navCode,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const install=new Function("currentGovernmentOfficesV321",navJs+";return installGovernmentNavigationV321;")(()=>undefined),environment:any={interiorGroundAt:()=>null,interiorSolidAt:()=>false};install({scene,outerThinOutlines:outer},environment);expect(environment.interiorGroundAt(7037,3848,4)).toBeNull();const roof=outer.userData.interiorGroundAtV322(7037,3848);expect(roof).not.toBeNull();expect(environment.interiorGroundAt(7037,3848,roof)).toBe(roof);scene.remove(outer);expect(environment.interiorGroundAt(7037,3848,roof)).toBeNull();scene.add(outer);outer.visible=false;expect(environment.interiorGroundAt(7037,3848,roof)).toBeNull();outer.visible=true;
  expect(events.some(e=>e.startsWith("release:"))).toBeTrue();expect(events.filter(e=>e==="instances").length).toBeGreaterThan(0);
 }finally{api.disposeOutlineConstruction(outer);outer.removeFromParent();}
 expect(outer.children).toHaveLength(0);
});

test("actual old navigation tests finite row bounds before new private retirement gates",()=>{let calls=0;expect(eastParksV198SolidAt(0,4,0,0,false,()=>{calls++;return false;})).toBeFalse();expect(calls).toBe(0);const seen:string[]=[];expect(eastParksV198SolidAt(7037,4,3848,0,false,owner=>{seen.push(owner);return false;})).toBeTrue();expect(seen).toContain("relation/2309788");expect(eastParksV198SolidAt(7037,4,3848,0,false,owner=>["relation/2309788","way/142701798","way/1234312660"].includes(owner))).toBeFalse();expect(eastParksV198SolidAt(7037,4,3848,0,false,owner=>owner==="way/321379819")).toBeTrue();});
