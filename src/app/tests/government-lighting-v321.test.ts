/** Execute actual Viewer lighting functions against both complete catalogues. */
import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {Group,Mesh,LineSegments,MeshStandardMaterial,LineBasicMaterial} from "three";
import {createFederalMinistriesV321,hasCompleteFederalMinistriesV321} from "../src/FederalMinistriesV321";
import {createBerlinSenateBuildingsV321,hasCompleteBerlinSenateBuildingsV321} from "../src/BerlinSenateBuildingsV321";
import {compactStaticGeometry} from "../src/compactStaticGeometry";
import {setFlatUnlit,setBuildingColorMode} from "../src/drawnBuildings";
import {schwellenraumObjektmodus} from "../src/visual-modes/schwellenraum/presentation";
import {schwellenraumMaterialFor,setSchwellenraumStandardMaterialTone} from "../src/visual-modes/schwellenraum/materialGrade";
import {applyArchitecturalInkMode} from "../src/architecturalInk";
const source=readFileSync(new URL("../src/ThreeViewer.tsx",import.meta.url),"utf8"),ast=ts.createSourceFile("ThreeViewer.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=["applyMaterialLighting","applyLightingToRoot"].map(name=>{const n=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);if(!n)throw Error("Missing actual Viewer lighting function "+name);return n.getText(ast).replace(/^export\s+/,"");}).join("\n");
const dependencies={Mesh,LineSegments,MeshStandardMaterial,LineBasicMaterial,compactStaticGeometry,setFlatUnlit,setBuildingColorMode,schwellenraumObjektmodus,schwellenraumMaterialFor,setSchwellenraumStandardMaterialTone,applyArchitecturalInkMode,MOONLIGHT_EMISSIVE:0x1c2636,MOONLIGHT_EMISSIVE_INTENSITY:.22};
const apply=new Function(...Object.keys(dependencies),ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+"\nreturn applyLightingToRoot;")(...Object.values(dependencies))as(root:Group,mode:string,lightsOn?:boolean)=>void;
const prisms=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8")).buildings;
const voxels=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url),"utf8"));
function dispose(root:Group){const resources=new Set<{dispose():void}>();root.traverse((o:any)=>{if(o.geometry)resources.add(o.geometry);if(o.isInstancedMesh)resources.add(o);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m?.dispose)resources.add(m);});for(const r of resources)r.dispose();root.clear();}
for(const native of[false,true])for(const kind of["federal","senate"]as const)test(`actual ${kind} ${native?"native":"drawn"} lights-on/off, six modes and private night-kit guards`,()=>{
 const root=kind==="federal"?createFederalMinistriesV321(native,{sourcePrisms:prisms,voxels}):createBerlinSenateBuildingsV321(native,{sourcePrisms:prisms,voxels})!;
 const complete=()=>kind==="federal"?hasCompleteFederalMinistriesV321(root,native):hasCompleteBerlinSenateBuildingsV321(root,native);
 try{expect(complete()).toBeTrue();const lights:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh&&o.userData.nightMaterial?.userData.nightEmissive)lights.push(o);});expect(lights).toHaveLength(kind==="senate"?3:1);
  for(const mode of["day","night","snowstorm","flood","schwellenraum","minecraft","night","day"]){apply(root,mode,true);expect(complete()).toBeTrue();for(const light of lights){const night=light.userData.nightMaterial as MeshStandardMaterial;expect(light.material).toBe(mode==="night"?night:mode==="schwellenraum"?light.userData.schwellenraumMaterial:light.userData.dayMaterial);if(mode==="night"){expect(night.emissive.getHex()).toBe(night.userData.nightEmissive);expect(night.emissiveIntensity).toBeGreaterThan(0);}}}
  apply(root,"night",false);expect(complete()).toBeTrue();for(const light of lights){const night=light.userData.nightMaterial as MeshStandardMaterial;expect(night.emissive.getHex()).toBe(0);expect(night.emissiveIntensity).toBe(0);
   const intensity=night.userData.nightEmissiveIntensity;night.userData.nightEmissiveIntensity=99;expect(complete()).toBeFalse();night.userData.nightEmissiveIntensity=intensity;expect(complete()).toBeTrue();}
  lights[0].geometry.dispose();expect(complete()).toBeFalse();
 }finally{dispose(root);}
});
