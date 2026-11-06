/** Independent proof: night geometry is only a subset of actual retained panes. */
import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {Group,Mesh,MeshBasicMaterial,MeshStandardMaterial} from "three";
import {createBerlinSenateBuildingsV321,hasCompleteBerlinSenateBuildingsV321} from "../src/BerlinSenateBuildingsV321";
const base=new URL("../public/mesh/regierungsviertel/",import.meta.url);
const prisms=JSON.parse(readFileSync(new URL("lod2-prisms.json",base),"utf8")).buildings;
const voxels=JSON.parse(readFileSync(new URL("minecraft-voxels.json",base),"utf8"));
function fixture(native:boolean){const root=createBerlinSenateBuildingsV321(native,{sourcePrisms:prisms,voxels})!;
  expect(hasCompleteBerlinSenateBuildingsV321(root,native)).toBeTrue();
  const parent=root.children[0]as Mesh,nightRoot=parent.children[0]as Group,mesh=nightRoot.children[0]as Mesh;
  return{root,parent,nightRoot,mesh};}
function bytes(view:ArrayBufferView){return Buffer.from(view.buffer,view.byteOffset,view.byteLength);}
function cleanup(root:Group){const resources=new Set<{dispose():void}>();root.traverse((o:any)=>{if(o.geometry)resources.add(o.geometry);
  for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m?.dispose)resources.add(m);});for(const r of resources)r.dispose();root.clear();}
for(const native of[false,true]){
  test(`actual ${native?"cardinal":"drawn"} night layer preserves exact source position, colour and normal words for every admitted pane`,()=>{
    const f=fixture(native);try{
      const original=f.parent.geometry,extra=f.mesh.geometry,index=extra.index!.array,sourceIndex=original.index!.array;
      expect(index.length/3).toBe(native?428:1012);expect(index.length/6).toBe(native?214:506);
      expect(bytes(extra.getAttribute("position").array)).toEqual(bytes(original.getAttribute("position").array));
      expect(bytes(extra.getAttribute("color").array)).toEqual(bytes(original.getAttribute("color").array));
      const originals=new Set<string>();for(let i=0;i<sourceIndex.length;i+=3)originals.add(`${sourceIndex[i]},${sourceIndex[i+1]},${sourceIndex[i+2]}`);
      const rgb=native?[4366,7666,9072]:[3788,6395,7500],colors=extra.getAttribute("color").array;
      const foreign:string[]=[],changedNormals:number[]=[];for(let i=0;i<index.length;i+=3){
        const key=`${index[i]},${index[i+1]},${index[i+2]}`;if(!originals.has(key))foreign.push(key);
        for(let j=0;j<3;j++)for(let c=0;c<3;c++)if(colors[index[i+j]*3+c]!==rgb[c])foreign.push(`colour:${i+j}`);
      }
      for(const vertex of new Set(index))for(let c=0;c<3;c++)if(!Object.is(extra.getAttribute("normal").array[vertex*3+c],original.getAttribute("normal").array[vertex*3+c]))changedNormals.push(vertex*3+c);
      expect(foreign).toEqual([]);expect(changedNormals).toEqual([]);
      const day=f.mesh.userData.dayMaterial as MeshBasicMaterial,night=f.mesh.userData.nightMaterial as MeshStandardMaterial;
      expect(day.transparent).toBeTrue();expect(day.opacity).toBe(0);expect(day.depthWrite).toBeFalse();expect(day.colorWrite).toBeFalse();
      expect(night.polygonOffset).toBeTrue();expect(night.polygonOffsetFactor).toBe(-1);expect(night.userData.nightEmissive).toBe(0xffc47e);
      expect(hasCompleteBerlinSenateBuildingsV321(f.root,native)).toBeTrue();
    }finally{cleanup(f.root);}
  });
  test(`actual ${native?"cardinal":"drawn"} night kit rejects cloned provenance, hidden/moved/detached layers and disposed resources`,()=>{
    const f=fixture(native);try{
      expect(hasCompleteBerlinSenateBuildingsV321(f.root.clone(true),native)).toBeFalse();
      f.nightRoot.visible=false;expect(hasCompleteBerlinSenateBuildingsV321(f.root,native)).toBeFalse();f.nightRoot.visible=true;
      f.nightRoot.position.x=1;expect(hasCompleteBerlinSenateBuildingsV321(f.root,native)).toBeFalse();f.nightRoot.position.x=0;
      f.nightRoot.removeFromParent();expect(hasCompleteBerlinSenateBuildingsV321(f.root,native)).toBeFalse();f.parent.add(f.nightRoot);
      const extra=new Group();f.parent.add(extra);expect(hasCompleteBerlinSenateBuildingsV321(f.root,native)).toBeFalse();extra.removeFromParent();
      const day=f.mesh.userData.dayMaterial as MeshBasicMaterial;day.opacity=1;expect(hasCompleteBerlinSenateBuildingsV321(f.root,native)).toBeFalse();day.opacity=0;
      expect(hasCompleteBerlinSenateBuildingsV321(f.root,native)).toBeTrue();day.dispose();expect(hasCompleteBerlinSenateBuildingsV321(f.root,native)).toBeFalse();
    }finally{cleanup(f.root);}
  });
}
