import { describe, expect, test } from 'bun:test';
import { Group, Mesh } from 'three';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createNamedGravesV347, NAMED_GRAVE_SITES_V347, WALL_MARKER_SITES_V352, namedGraveGeometryV347 } from '../src/NamedGravesV347';
import { createTiergartenMonuments, setFechterFallbackHiddenV352 } from '../src/TiergartenMonuments';
import { prepareMemorialPreviousV322 } from '../src/MemorialPreviousV322';
import { createMemorialRuntimeV322Steps } from '../src/MemorialRuntimeV322';
import { worldGroundSampler } from '../src/terrainPayload';
import originalGeometry from './fixtures/fechter-v352-original-geometry.json';

const publicRoot = new URL('../public/mesh/regierungsviertel/', import.meta.url);
const street = JSON.parse(readFileSync(new URL('street-details.json', publicRoot), 'utf8'));
const groundPayload = JSON.parse(readFileSync(new URL('ground-context.json', publicRoot), 'utf8'));
const drain = <T>(steps: Generator<void, T>): T => { for (;;) { const r = steps.next(); if (r.done) return r.value; } };
function geometryWords(root: Group) {
  const records: string[] = [];
  root.traverse(object => {
    const o = object as Mesh & { isLineSegments?: boolean };
    if (!o.geometry) return;
    const g = o.geometry, names = Object.keys(g.attributes).sort(), size = o.isLineSegments ? 2 : 3;
    const count = g.index?.count ?? g.attributes.position.count;
    for (let i = 0; i < count; i += size) {
      let row = (o.isLineSegments ? 'line' : 'mesh') + ':';
      for (let j = 0; j < size; j++) {
        const v = g.index ? g.index.getX(i + j) : i + j;
        for (const name of names) {
          const a = g.attributes[name]; row += name + ':';
          for (let k = 0; k < a.itemSize; k++) row += a.array[v * a.itemSize + k] + ',';
        }
      }
      records.push(row);
    }
  });
  records.sort();
  return { rows: records.length, sha256: createHash('sha256').update(records.join('\n')).digest('hex') };
}

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

  test('isolating the fallback retains every original city monument triangle, attribute and ink segment', () => {
    const full = createTiergartenMonuments(street, groundPayload)!;
    expect(geometryWords(full)).toEqual(originalGeometry.all);
    const fallback = full.getObjectByName('Peter Fechter original OSM stele fallback v352') as Group;
    expect(geometryWords(fallback)).toEqual(originalGeometry.fechter);
    expect(fallback.parent?.userData.schwellenraumGeschuetzt).toBe(true);
    expect(fallback.visible).toBe(true);
    const forged = full.clone(true);
    expect(setFechterFallbackHiddenV352(forged, true)).toBe(false);
    const foreign = createTiergartenMonuments({...street, monuments: street.monuments.filter((p: {osm_key: string}) => p.osm_key === 'node/3624148007').map((p: object) => ({...p, x_dm: 14393}))}, groundPayload)!;
    expect(setFechterFallbackHiddenV352(foreign, true)).toBe(false);
  });

  test('the real Drawn fallback is hidden only during exact supported Fechter admission and always restored', () => {
    const old = createTiergartenMonuments(street, groundPayload)!;
    const fallback = old.getObjectByName('Peter Fechter original OSM stele fallback v352')!;
    const [x,z] = WALL_MARKER_SITES_V352[0].anchor;
    const support = {ground: worldGroundSampler(groundPayload), water:()=>false, blocked:()=>false,
      setFechterFallbackHidden:(hidden:boolean)=>{setFechterFallbackHiddenV352(old,hidden);}};
    const c = createNamedGravesV347(); new Group().add(c.root);
    c.refresh(x,z,false,support); expect(fallback.visible).toBe(false);
    c.refresh(x,z,false,support); expect(fallback.visible).toBe(false);
    c.refresh(x,z,true,support); expect(fallback.visible).toBe(true);
    c.refresh(x,z,false,support); expect(fallback.visible).toBe(false);
    c.refresh(x,z,false,{...support,ground:()=>null}); expect(fallback.visible).toBe(true);
    c.refresh(x,z,false,support); c.refresh(x+181,z,false,support); expect(fallback.visible).toBe(true);
    c.refresh(x,z,false,support); c.release(); expect(fallback.visible).toBe(true);
    c.refresh(x,z,false,support); c.dispose(); expect(fallback.visible).toBe(true);
    const other = createNamedGravesV347();
    other.refresh(...NAMED_GRAVE_SITES_V347[0].anchor as [number,number],false,support);
    expect(fallback.visible).toBe(true); other.dispose();
  });

  test('Fechter fallback visibility does not invalidate the existing V322 exact Berlin/Pyramide transaction', async () => {
    const keys = ['berlin','pyramide','cadillacs','french','british'] as const;
    expect(await prepareMemorialPreviousV322(false,{keys,street,ground:groundPayload})).toBe(true);
    const old = createTiergartenMonuments({...street, monuments:street.monuments.filter((p:{osm_key:string})=>
      ['node/313826576','node/4224142271','node/3624148007'].includes(p.osm_key))},groundPayload)!;
    const parent = new Group(); parent.add(old);
    const before = geometryWords(old);
    const transaction = drain(createMemorialRuntimeV322Steps(old,false,{keys}));
    expect(transaction).not.toBeNull(); expect(transaction!.activate(parent)).toBe(true);
    expect(setFechterFallbackHiddenV352(old,true)).toBe(true); expect(transaction!.complete()).toBe(true);
    expect(setFechterFallbackHiddenV352(old,false)).toBe(true); expect(transaction!.complete()).toBe(true);
    transaction!.release(); expect(geometryWords(old)).toEqual(before);
  });
});
