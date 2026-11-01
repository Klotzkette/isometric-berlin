import { describe, expect, test } from "bun:test";
import { Box3, Group, InstancedMesh, LineBasicMaterial, Matrix4, Mesh, MeshStandardMaterial, Texture } from "three";
import scene from "../public/mesh/regierungsviertel/scene.json";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxels from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import data from "../src/data/chancelleryCanopyV289.json";
import { createArchitecturalSignature, type ChancelleryModelSignature } from "../src/ArchitecturalLandmarks";
import { createChancelleryCanopySourceV289, hasCompleteChancelleryCanopySourceV289, admitsChancelleryCanopyLegacyV289, setChancelleryCanopyLegacyV289 } from "../src/ChancelleryCanopySourceV289";
import { admitsChancelleryCanopySourceV289, admitsChancelleryCanopyNativeV289, isChancelleryCanopyOldPrismV289, isChancelleryCanopyOldColumnV289 } from "../src/ChancelleryCanopySourceV289Ownership";
import { chancelleryCanopyRoofAtV289, chancelleryCanopySolidsV289, chancelleryCanopyTrianglesV289 } from "../src/ChancelleryCanopyV289Navigation";
import { createDistantBuildingShells } from "../src/IsometricCityWorld";
import { prepareRequiredFidelityV288 } from "../src/RequiredFidelityV288";
import { interleaveStaticGeometry } from "../src/interleaveStaticGeometry";
import { setSchwellenraumStandardMaterialTone } from "../src/visual-modes/schwellenraum/materialGrade";
import { applyArchitecturalInkMode } from "../src/architecturalInk";
import { stabilizeInkLineMaterial } from "../src/ThreeViewer";
import { registerInkDrawObject, updateInkDrawVisibility } from "../src/inkDrawVisibility";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import type { VisualMode } from "../src/visualMode";
const signature = scene.architectural_signatures.find(s => s.kind === "chancellery_model")! as ChancelleryModelSignature;
const original = () => createArchitecturalSignature(signature)!;
const membrane = (root: Group) => root.getObjectByName("Chancellery Ehrenhof lower tensile entrance canopy") as Mesh;

describe("complete open Ehrenhof source canopy v289", () => {
  test("the four original roof sheets keep source coordinates and a common rigid datum", () => {
    const previous = JSON.stringify(data), root = createChancelleryCanopySourceV289();
    expect(hasCompleteChancelleryCanopySourceV289(root)).toBeTrue(); expect(hasCompleteChancelleryCanopySourceV289(new Group())).toBeFalse();
    expect(data.oldPrisms.map(p => p.id)).toEqual(["1rlNcfOH", "K0003Umc"]);
    expect(data.roofs).toHaveLength(4); expect(data.source.rigidYTranslationM).toBe(-28.851);
    expect(chancelleryCanopyTrianglesV289().length).toBeGreaterThan(100);
    const bbox = new Box3().setFromObject(root); expect(bbox.max.y).toBeCloseTo(11.581, 4); expect(bbox.min.y).toBeCloseTo(5.15, 4);
    expect(new Box3().setFromObject(root.getObjectByName("Chancellery source-bound small vestibule roof v289")!).max.y).toBeCloseTo(9.144, 4);
    root.traverse(o => { if (o instanceof Mesh) { const m = o.material as MeshStandardMaterial; expect(m.map).toBeNull(); expect(o.userData.photograph).toBeUndefined(); } });
    expect(JSON.stringify(data)).toBe(previous);
  });
  test("native is a bounded cardinal roof/edge and shell recipe with clear space beneath", () => {
    const root = createChancelleryCanopySourceV289(true), mesh = root.children[0] as InstancedMesh, m = new Matrix4();
    expect(root.children).toHaveLength(1); expect(mesh.count).toBeLessThan(1500);
    expect((mesh.material as MeshStandardMaterial).vertexColors).toBeFalse();expect(mesh.instanceColor).not.toBeNull();
    for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, m); for (const j of [1,2,4,6,8,9]) expect(m.elements[j]).toBe(0); }
    for (const native of [false,true]) {
      const roof = chancelleryCanopySolidsV289(native).filter(s => s.sourceId === "K0003Umc" && s.maxY > 8 && s.minY > 5.2);
      expect(roof.length).toBeGreaterThan(0);
      expect(roof.some(s => (s.bottomAt?.(-115, -145) ?? s.minY) > 8)).toBeTrue();
    }
    expect(chancelleryCanopyRoofAtV289(-115,-145)).toBeGreaterThan(9);
    expect(chancelleryCanopyRoofAtV289(-50,-145)).toBeNull();
  });
  test("source and native admission reject changed/missing/duplicate/accessor/foreign owners", () => {
    expect(admitsChancelleryCanopySourceV289(prisms)).toBeTrue(); expect(admitsChancelleryCanopyNativeV289(voxels)).toBeTrue();
    expect(data.native.exclusiveColumns).toHaveLength(15);
    for (const c of data.native.exclusiveColumns) expect(isChancelleryCanopyOldColumnV289(c)).toBeTrue();
    expect(isChancelleryCanopyOldColumnV289(data.native.sharedColumns[0].column)).toBeFalse();
    const old = data.oldPrisms[0]; expect(isChancelleryCanopyOldPrismV289(old)).toBeTrue(); expect(isChancelleryCanopyOldPrismV289({...old,h_dm:old.h_dm+1})).toBeFalse();
    const payloads = [
      {...prisms, buildings: prisms.buildings.filter(p => p.id !== old.id)},
      {...prisms, buildings: [...prisms.buildings,old]},
      {...prisms, buildings: prisms.buildings.map(p => p.id === old.id ? {...p,h_dm:p.h_dm+1} : p)},
      {...prisms, buildings: [...prisms.buildings,{...data.oldPrisms[1],id:"unexpected-foreign-owner"}]},
    ];
    for (const p of payloads) { expect(admitsChancelleryCanopySourceV289(p)).toBeFalse(); expect(prepareRequiredFidelityV288(p,voxels,true).chancelleryCanopy).toBeFalse(); }
    const changed = structuredClone(voxels), [ix,iz] = data.native.exclusiveColumns[0], row = changed.building_rows[iz-changed.grid.min_z_idx];
    row.find(([offset,n]) => ix >= changed.grid.min_x_idx + offset && ix < changed.grid.min_x_idx + offset + n)![3]++;
    expect(admitsChancelleryCanopyNativeV289(changed)).toBeFalse(); expect(admitsChancelleryCanopyNativeV289({...voxels,cell_m:2})).toBeFalse();
    let reads=0; const getter={...old};Object.defineProperty(getter,"h_dm",{enumerable:true,get(){reads++;return old.h_dm;}});
    expect(admitsChancelleryCanopySourceV289({...prisms,buildings:prisms.buildings.map(p=>p.id===old.id?getter:p)})).toBeFalse();expect(reads).toBe(0);
  });
  test("exact predecessor guards preserve edited poses/materials/hierarchy and admit legitimate grading/packing", () => {
    const originalRoot = original(); expect(admitsChancelleryCanopyLegacyV289(originalRoot)).toBeTrue();
    interleaveStaticGeometry(originalRoot); expect(admitsChancelleryCanopyLegacyV289(originalRoot)).toBeTrue();
    const material=membrane(originalRoot).material as MeshStandardMaterial;setSchwellenraumStandardMaterialTone(material,"schwellenraum");
    expect(admitsChancelleryCanopyLegacyV289(originalRoot)).toBeTrue();expect(setChancelleryCanopyLegacyV289(originalRoot,true)).toBeTrue();
    expect(membrane(originalRoot).visible).toBeFalse();expect(originalRoot.getObjectByName("Chancellery monumental concave roof shell")!.visible).toBeTrue();
    expect(setChancelleryCanopyLegacyV289(originalRoot,false)).toBeTrue();expect(membrane(originalRoot).visible).toBeTrue();
    for(const mode of ["day","night","snowstorm","schwellenraum","flood"] as const){
      const root=original();root.traverse(o=>{const m=(o as Mesh).material;if(m instanceof LineBasicMaterial&&m.userData.modeInk)applyArchitecturalInkMode(m,mode);if(m instanceof MeshStandardMaterial)setSchwellenraumStandardMaterialTone(m,mode);});
      expect(admitsChancelleryCanopyLegacyV289(root)).toBeTrue();expect(setChancelleryCanopyLegacyV289(root,true)).toBeTrue();expect(setChancelleryCanopyLegacyV289(root,false)).toBeTrue();
    }
    for(const opacity of [0,.13,.74]){
      const root=original(),line=root.getObjectByName("Chancellery Ehrenhof lower tensile entrance canopy drawn perimeter") as any;
      stabilizeInkLineMaterial(line.material);registerInkDrawObject(line);line.material.opacity=opacity;line.material.userData.stableInkAppliedOpacity=opacity;updateInkDrawVisibility(line.material);
      expect(admitsChancelleryCanopyLegacyV289(root)).toBeTrue();expect(setChancelleryCanopyLegacyV289(root,true)).toBeTrue();expect(setChancelleryCanopyLegacyV289(root,false)).toBeTrue();
    }
    const edits: ((r:Group)=>void)[] = [
      r=>{membrane(r).position.x+=1;}, r=>{membrane(r).quaternion.x=.1;},
      r=>{r.position.x+=1;}, r=>{membrane(r).add(new Group());},
      r=>{const g=new Group();r.add(g);g.add(membrane(r));},
      r=>{(membrane(r).material as MeshStandardMaterial).map=new Texture();},
      r=>{(membrane(r).material as MeshStandardMaterial).roughness=.01;},
      r=>{r.add(membrane(r).clone());}, r=>{membrane(r).geometry.getAttribute("normal").setX(0,.5);},
    ];
    for (const edit of edits) { const root=original();edit(root);expect(admitsChancelleryCanopyLegacyV289(root)).toBeFalse();expect(setChancelleryCanopyLegacyV289(root,true)).toBeFalse(); }
  });
  test("required complete models precede exact source retirement, with a conservative fallback", () => {
    const root=original(), made=prepareRequiredFidelityV288(prisms,voxels,false,admitsChancelleryCanopyLegacyV289(root));expect(made.chancelleryCanopy).toBeTrue();
    expect(made.root.getObjectByName("Required open source-bound Chancellery Ehrenhof canopy v289")).toBeDefined();
    const old=prisms.buildings.filter(p=>data.oldPrisms.some(o=>o.id===p.id));
    expect(createDistantBuildingShells(prisms,old).children.length).toBeGreaterThan(0);
    expect(createDistantBuildingShells(prisms,old,{chancelleryCanopySourceV289:true}).children).toHaveLength(0);
    expect(prepareRequiredFidelityV288(prisms,voxels,false,false).chancelleryCanopy).toBeFalse();
  });
  test("live navigation restores the old solids on fallback and opens only the represented canopy underside",()=>{
    let active=false,mode:VisualMode="day";
    const index=compilePedestrianObstacles(prisms,()=>mode,{chancelleryCanopySourceV289:()=>active});
    expect(pedestrianPointIsBlocked(-115,-145,5.15,index)).toBeTrue();
    active=true;
    for(const next of ["day","night","snowstorm","schwellenraum","flood","minecraft"] as const){
      mode=next;expect(pedestrianPointIsBlocked(-115,-145,5.15,index)).toBeFalse();
      expect(pedestrianPointIsBlocked(-112.007,-156.311,5.15,index)).toBeTrue();
      expect(pedestrianPointIsBlocked(-115,-145,chancelleryCanopyRoofAtV289(-115,-145)!-.04,index)).toBeTrue();
    }
    active=false;expect(pedestrianPointIsBlocked(-115,-145,5.15,index)).toBeTrue();
  });
});
