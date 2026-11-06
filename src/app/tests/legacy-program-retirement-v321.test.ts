/** Actual earlier constructors keep private source lifetimes on a touch program-cache retirement. */
import {expect,test} from "bun:test";
import {Group,InstancedMesh,Material,Mesh} from "three";
import {retireSceneMaterialPrograms} from "../src/sceneMaterialPrograms";
import {createNorthSitesV306,hasCompleteNorthSitesV306} from "../src/NorthSitesV306";
import {createHospitalArchitectureV308,hasCompleteHospitalArchitectureV308} from "../src/HospitalArchitectureV308";
import {applyHospitalPreviousV308} from "../src/HospitalArchitectureV308Previous";
import {createHospitalRecognitionV228} from "../src/HospitalRecognitionV228";
import {createHospitalEnvelopesV228} from "../src/HospitalEnvelopesV228";
import {createBundeswehrHospitalV214} from "../src/BundeswehrHospitalV214";
import {createRailStationsV190} from "../src/RailStationsV190";
import {createRailSseArchitectureV307} from "../src/RailSseArchitectureV307";
import {createRailTerrainContactV307} from "../src/RailTerrainContactV307";
import {applyRailSseLegacyV307} from "../src/RailSseLegacyV307";

function dispose(root:Group){const resources=new Set<{dispose():void}>();root.traverse(o=>{if(o instanceof Mesh){resources.add(o.geometry);if(o instanceof InstancedMesh)resources.add(o);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m instanceof Material)resources.add(m);}});for(const resource of resources)resource.dispose();root.clear();}

test("actual north models survive real program retirement; every authored material still invalidates",()=>{
 for(const native of[false,true]){const root=createNorthSitesV306(native);try{expect(hasCompleteNorthSitesV306(root,native)).toBe(true);expect(retireSceneMaterialPrograms(root)).toBeGreaterThan(0);expect(hasCompleteNorthSitesV306(root,native)).toBe(true);(root.children[0]as Mesh).userData.nightMaterial.dispose();expect(hasCompleteNorthSitesV306(root,native)).toBe(false);}finally{dispose(root);}
  const grade=createNorthSitesV306(native);try{retireSceneMaterialPrograms(grade);expect(hasCompleteNorthSitesV306(grade,native)).toBe(true);(grade.children[0]as Mesh).userData.schwellenraumMaterial.dispose();expect(hasCompleteNorthSitesV306(grade,native)).toBe(false);}finally{dispose(grade);}}
});

test("actual required hospital models keep program retirement separate from authored disposal",()=>{
 for(const native of[false,true]){const root=createHospitalArchitectureV308(native);try{expect(hasCompleteHospitalArchitectureV308(root,native)).toBe(true);expect(retireSceneMaterialPrograms(root)).toBeGreaterThan(0);expect(hasCompleteHospitalArchitectureV308(root,native)).toBe(true);(root.children[0]as Mesh).userData.dayMaterial.dispose();expect(hasCompleteHospitalArchitectureV308(root,native)).toBe(false);}finally{dispose(root);}}
});

test("actual hospital predecessor transfer survives program retirement and restores on authored disposal",()=>{
 for(const native of[false,true]){const source=createHospitalRecognitionV228(native),envelopes=createHospitalEnvelopesV228(native),ward=createBundeswehrHospitalV214(native),model=createHospitalArchitectureV308(native),root=new Group().add(source,envelopes,ward,model);try{expect(applyHospitalPreviousV308(root,native,true,model)).toBe(true);expect(retireSceneMaterialPrograms(root)).toBeGreaterThan(0);expect(applyHospitalPreviousV308(root,native,true,model)).toBe(true);const selected=source.children.find(c=>c instanceof Mesh&&!c.visible)as Mesh;expect(selected).toBeDefined();selected.userData.dayMaterial.dispose();expect(applyHospitalPreviousV308(root,native,true,model)).toBe(false);expect(selected.visible).toBe(true);}finally{dispose(root);}}
});

test("actual two-station legacy transfer survives program retirement and restores on authored disposal",()=>{
 for(const native of[false,true]){const source=createRailStationsV190(native),model=createRailSseArchitectureV307(native),terrain=createRailTerrainContactV307(native),root=new Group().add(source,model,terrain);try{expect(applyRailSseLegacyV307(source,native,true,model,terrain)).toBe(true);expect(retireSceneMaterialPrograms(root)).toBeGreaterThan(0);expect(applyRailSseLegacyV307(source,native,true,model,terrain)).toBe(true);let selected:Mesh|undefined;source.traverse(o=>{if(o instanceof Mesh&&!o.visible)selected??=o;});expect(selected).toBeDefined();selected!.userData.dayMaterial.dispose();expect(applyRailSseLegacyV307(source,native,true,model,terrain)).toBe(false);expect(selected!.visible).toBe(true);expect(applyRailSseLegacyV307(source,native,true,model,terrain)).toBe(false);}finally{dispose(root);}}
});
