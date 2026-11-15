import { describe, expect, test } from 'bun:test';
import { Group, Mesh } from 'three';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createNamedGravesV347, NAMED_GRAVE_SITES_V347, WALL_MARKER_SITES_V352, namedGraveGeometryV347 } from '../src/NamedGravesV347';
import { worldGroundSampler } from '../src/terrainPayload';

describe('V352 Wall memorial uses the existing bounded memorial controller', () => {
  test('earlier complete grave source is byte-identical and admission disks stay disjoint', () => {
    const root=resolve(import.meta.dir,'../../..');
    const path='src/app/src/data/namedGravesV347.json';
    const old=execFileSync('git',['show',`69810478:${path}`],{cwd:root});
    expect(readFileSync(resolve(root,path)).equals(old)).toBe(true);
    const sites=[...NAMED_GRAVE_SITES_V347,...WALL_MARKER_SITES_V352];
    for(let i=0;i<sites.length;i++)for(let j=i+1;j<sites.length;j++){
      expect(Math.hypot(sites[i].anchor[0]-sites[j].anchor[0],sites[i].anchor[1]-sites[j].anchor[1])).toBeGreaterThan(360);
    }
  });
  for(const native of [false,true])test(`${native?'Native':'Drawn'} exact anchor, real Core support, collision and retirement`,async()=>{
    const file=native?'minecraft-voxels.json':'ground-context.json';
    const ground=worldGroundSampler(await Bun.file(new URL(`../public/mesh/regierungsviertel/${file}`,import.meta.url)).json());
    const site=WALL_MARKER_SITES_V352[0], [x,z]=site.anchor;
    const c=createNamedGravesV347();new Group().add(c.root);
    const support={ground,water:()=>false,blocked:()=>false};
    expect(c.refresh(x,z,native,support)).toBe(true);
    expect(c.root.children.length).toBe(1);
    const mesh=c.root.children[0] as Mesh;
    expect(mesh.userData.sourceId).toBe('node/3624148007');
    expect(mesh.geometry.boundingBox!.max.y*.01-mesh.geometry.boundingBox!.min.y*.01).toBeCloseTo(2.6,5);
    expect(c.solidAt(x,ground(x,z)!+1,z,0,native)).toBe(true);
    expect(c.solidAt(x+.5,ground(x,z)!+1,z,0,native)).toBe(false);
    expect(c.refresh(x,z,native,support)).toBe(false);
    let disposed=0;mesh.geometry.addEventListener('dispose',()=>disposed++);
    expect(c.refresh(x,z,native,{...support,ground:()=>null})).toBe(true);
    expect(disposed).toBe(1);expect(c.root.children.length).toBe(0);
    expect(c.solidAt(x,6,z,0,native)).toBe(false);
    expect(c.refresh(x,z,native,{...support,water:()=>true})).toBe(false);
    expect(c.refresh(x,z,native,{...support,blocked:()=>true})).toBe(false);
    expect(c.refresh(x,z,native,{...support,ground:(sx)=>sx<x-.15?null:5.2})).toBe(false);
    c.dispose();
  });
  test('Native steel column and every navigation edge are independently cardinal',()=>{
    const model=WALL_MARKER_SITES_V352[0].models.minecraft,g=namedGraveGeometryV347(model),p=g.getAttribute('position'),ix=g.index!;
    for(let i=0;i<ix.count;i+=3){
      const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2);
      expect(['getX','getY','getZ'].some(axis=>{const get=p[axis as 'getX'].bind(p);return get(a)===get(b)&&get(b)===get(c);})).toBe(true);
    }
    for(const solid of model.solids)for(let i=0;i<solid.ring.length;i++){
      const a=solid.ring[i],b=solid.ring[(i+1)%solid.ring.length];expect(a[0]===b[0]||a[1]===b[1]).toBe(true);
    }
    g.dispose();
  });
});
