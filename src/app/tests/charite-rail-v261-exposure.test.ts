import { expect, test } from 'bun:test';
import { Color, Group, InstancedMesh, Raycaster, Vector3 } from 'three';
import source from '../src/data/chariteRailV261.json';
import { chariteFacadePointExposed, chariteRingWalls } from '../src/HistoricChariteCampus';
import { createMinecraftChariteHistoricShells } from '../src/MinecraftChariteHistoricShells';
import { createChariteRailV261 } from '../src/ChariteRailV261';

test('both oriel glazing fields clear the retained source projections in both modes',()=>{
  const wall=chariteRingWalls(source.parts.find(p=>p.id==='mEGhfy5X')!.ring)[2];
  for(const native of [false,true]){
    const root=new Group();root.add(createMinecraftChariteHistoricShells(source.parts),createChariteRailV261(native));root.updateMatrixWorld(true);
    for(const id of ['bzFr0aOE','M09vcMVr']){
      const part=source.parts.find(p=>p.id===id)!;
      const u=part.ring.reduce((sum,p)=>sum+((p[0]/10-wall.x1)*wall.dirX+(p[1]/10-wall.z1)*wall.dirZ)/part.ring.length,0);
      for(const du of [-1,-.25,.25,1])for(const dy of [-.8,.05,.9]){
        const x=wall.x1+wall.dirX*(u+du)+wall.nx*4,z=wall.z1+wall.dirZ*(u+du)+wall.nz*4;
        const hits=new Raycaster(new Vector3(x,8.7+dy,z),new Vector3(-wall.nx,0,-wall.nz)).intersectObject(root,true);
        const hit=hits[0],color=new Color();(hit.object as InstancedMesh).getColorAt(hit.instanceId!,color);
        expect({id,native,du,dy,paint:color.getHex()}).toEqual({id,native,du,dy,paint:0x557375});
      }
      for(const [du,dy] of [[-.51,-.8],[.51,-.8],[0,.48]]){
        const x=wall.x1+wall.dirX*(u+du)+wall.nx*4,z=wall.z1+wall.dirZ*(u+du)+wall.nz*4;
        const hit=new Raycaster(new Vector3(x,8.7+dy,z),new Vector3(-wall.nx,0,-wall.nz)).intersectObject(root,true)[0];
        const color=new Color();(hit.object as InstancedMesh).getColorAt(hit.instanceId!,color);
        expect({id,native,du,dy,paint:color.getHex()}).toEqual({id,native,du,dy,paint:0xeeeadd});
      }
    }
  }
});

test('Lesser vertical cross-mullions remain in front of glazing in each mode',()=>{
  for(const native of [false,true]){
    const root=createChariteRailV261(native);root.updateMatrixWorld(true);
    let checked=0;
    const lesser=source.parts.filter(p=>p.parent.endsWith('0AME'));
    for(const part of lesser)for(const wall of chariteRingWalls(part.ring).filter(w=>w.length>12)){
      const n=Math.max(1,Math.floor((wall.length-.8)/3.3)),pitch=(wall.length-.8)/n,u=.4+.5*pitch;
      if(!chariteFacadePointExposed(part.id,wall,u,part.y0_dm/10+10,lesser))continue;
      checked++;
      const x=wall.x1+wall.dirX*u+wall.nx*(native?3:.8),z=wall.z1+wall.dirZ*u+wall.nz*(native?3:.8);
      const hits=new Raycaster(new Vector3(x,part.y0_dm/10+2.35-.65,z),new Vector3(-wall.nx,0,-wall.nz)).intersectObject(root,true);
      expect(hits.length).toBeGreaterThan(0);
      const hit=hits[0],color=new Color();(hit.object as InstancedMesh).getColorAt(hit.instanceId!,color);
      expect({native,part:part.id,wall:wall.index,paint:color.getHex()}).toEqual({native,part:part.id,wall:wall.index,paint:0xeeeadd});
    }
    expect(checked).toBeGreaterThan(0);
  }
});
