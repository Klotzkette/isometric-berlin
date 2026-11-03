import {describe,expect,test} from "bun:test";
import {BoxGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,MeshToonMaterial} from "three";
import {copyMinecraftMaterialPresentation,createMinecraftMaterialState,disposeMinecraftMaterialState,hasMinecraftMaterialProvenance,minecraftOriginalMaterialFor,releaseCopiedMinecraftMaterialPresentation,releaseMinecraftMaterialBindings,restoreMinecraftMaterialPresentation,setMinecraftMaterialPresentation} from "../src/visual-modes/minecraft/materialMode";
import {schwellenraumMaterialFor} from "../src/visual-modes/schwellenraum/materialGrade";
function fixture(){const root=new Group(),day=new MeshStandardMaterial({color:0xabbccd}),own=new MeshStandardMaterial({color:0x778899,vertexColors:true}),source=new Mesh(new BoxGeometry(),day),target=new Mesh(new BoxGeometry(),own),state=createMinecraftMaterialState();root.add(source,target);return{root,day,own,source,target,state};}
function dispose(f:ReturnType<typeof fixture>){disposeMinecraftMaterialState(f.state);f.source.geometry.dispose();f.target.geometry.dispose();f.day.dispose();f.own.dispose();}
describe("private Minecraft material provenance v309",()=>{
 test("real toon copy uses the target's own source colour and vertex paint",()=>{
  const f=fixture();setMinecraftMaterialPresentation(f.source,f.state,true);
  const toon=f.source.material;expect(hasMinecraftMaterialProvenance(f.source,f.day,toon)).toBe(true);
  expect(minecraftOriginalMaterialFor(f.source)).toBe(f.day);
  expect(copyMinecraftMaterialPresentation(f.source,f.target)).toBe(true);
  expect(f.target.material).toBeInstanceOf(MeshToonMaterial);expect(f.target.material).not.toBe(toon);
  expect((f.target.material as MeshToonMaterial).color.equals(f.own.color)).toBe(true);
  expect((f.target.material as MeshToonMaterial).vertexColors).toBe(true);
  expect(f.state.originals.get(f.target)).toBe(f.own);expect(f.source.material).toBe(toon);
  expect(hasMinecraftMaterialProvenance(f.target,f.own,f.target.material)).toBe(true);dispose(f);
 });
 test("public tags, arbitrary cached clones and injected original maps cannot prove a binding",()=>{
  const f=fixture();setMinecraftMaterialPresentation(f.source,f.state,true);
  const clone=(f.source.material as MeshToonMaterial).clone();f.target.material=clone;clone.userData.minecraftToon=true;
  expect(hasMinecraftMaterialProvenance(f.target,f.day,clone)).toBe(false);
  expect(copyMinecraftMaterialPresentation(f.target,f.source)).toBe(false);
  f.state.originals.set(f.target,f.day);setMinecraftMaterialPresentation(f.target,f.state,true);
  expect(hasMinecraftMaterialProvenance(f.target,f.day,f.target.material)).toBe(false);
  const before=f.target.material;expect(copyMinecraftMaterialPresentation(f.source,f.target)).toBe(false);expect(f.target.material).toBe(before);
  clone.dispose();dispose(f);
 });
 test("restore and release revoke proof, real re-enable creates a new active binding",()=>{
  const f=fixture();setMinecraftMaterialPresentation(f.source,f.state,true);copyMinecraftMaterialPresentation(f.source,f.target);
  restoreMinecraftMaterialPresentation(f.state);expect(f.source.material).toBe(f.day);
  expect(minecraftOriginalMaterialFor(f.source)).toBe(null);
  expect(hasMinecraftMaterialProvenance(f.source,f.day,f.source.material)).toBe(false);
  expect(copyMinecraftMaterialPresentation(f.source,f.target)).toBe(false);
  setMinecraftMaterialPresentation(f.source,f.state,true);expect(hasMinecraftMaterialProvenance(f.source,f.day,f.source.material)).toBe(true);
  copyMinecraftMaterialPresentation(f.source,f.target);const old=f.target.material;
  releaseMinecraftMaterialBindings(f.target,f.state);expect(f.target.material).toBe(f.own);
  expect(hasMinecraftMaterialProvenance(f.target,f.own,old)).toBe(false);
  expect(hasMinecraftMaterialProvenance(f.source,f.day,f.source.material)).toBe(true);
  expect(copyMinecraftMaterialPresentation(f.source,f.target)).toBe(true);expect(f.target.material).not.toBe(old);
  setMinecraftMaterialPresentation(f.source,f.state,false);expect(hasMinecraftMaterialProvenance(f.source,f.day,f.source.material)).toBe(false);dispose(f);
 });
 test("foreign states and disposed material/state cannot inherit provenance",()=>{
  const f=fixture(),other=createMinecraftMaterialState();setMinecraftMaterialPresentation(f.source,f.state,true);
  setMinecraftMaterialPresentation(f.source,other,true);
  expect(hasMinecraftMaterialProvenance(f.source,f.day,f.source.material)).toBe(false);
  expect(copyMinecraftMaterialPresentation(f.source,f.target)).toBe(false);
  restoreMinecraftMaterialPresentation(f.state);setMinecraftMaterialPresentation(f.source,f.state,true);
  (f.source.material as MeshToonMaterial).dispose();expect(hasMinecraftMaterialProvenance(f.source,f.day,f.source.material)).toBe(false);
  disposeMinecraftMaterialState(other);dispose(f);
  const g=fixture();setMinecraftMaterialPresentation(g.source,g.state,true);g.day.dispose();
  expect(hasMinecraftMaterialProvenance(g.source,g.day,g.source.material)).toBe(false);dispose(g);
  const h=fixture();setMinecraftMaterialPresentation(h.source,h.state,true);const material=h.source.material;
  disposeMinecraftMaterialState(h.state);expect(h.source.material).toBe(material);
  expect(hasMinecraftMaterialProvenance(h.source,h.day,material)).toBe(false);dispose(h);
 });
 test("a genuine grade source is privately attributable to its original day material",()=>{
  const f=fixture();f.source.material=schwellenraumMaterialFor(f.source,f.day);
  setMinecraftMaterialPresentation(f.source,f.state,true);
  expect(hasMinecraftMaterialProvenance(f.source,f.day,f.source.material)).toBe(true);
  expect(copyMinecraftMaterialPresentation(f.source,f.target)).toBe(true);dispose(f);
 });
 test("real direct Basic-material mode bindings also copy through the provider",()=>{
  const f=fixture(),basic=new MeshBasicMaterial({color:0xabc123});f.source.material=basic;
  setMinecraftMaterialPresentation(f.source,f.state,true);
  expect(f.source.material).toBe(basic);expect(hasMinecraftMaterialProvenance(f.source,basic,basic)).toBe(true);
  expect(copyMinecraftMaterialPresentation(f.source,f.target)).toBe(true);
  expect(hasMinecraftMaterialProvenance(f.target,f.own,f.target.material)).toBe(true);
  releaseMinecraftMaterialBindings(f.root,f.state);expect(hasMinecraftMaterialProvenance(f.source,basic,basic)).toBe(false);basic.dispose();dispose(f);
 });
 test("detached copied targets release strong state bindings even after restore",()=>{
  const f=fixture();setMinecraftMaterialPresentation(f.source,f.state,true);copyMinecraftMaterialPresentation(f.source,f.target);
  restoreMinecraftMaterialPresentation(f.state);f.root.remove(f.target);
  expect(f.state.originals.has(f.target)).toBe(true);
  releaseCopiedMinecraftMaterialPresentation(f.target);
  expect(f.state.originals.has(f.target)).toBe(false);expect(f.target.material).toBe(f.own);
  setMinecraftMaterialPresentation(f.source,f.state,true);
  expect(hasMinecraftMaterialProvenance(f.source,f.day,f.source.material)).toBe(true);dispose(f);
 });
});
