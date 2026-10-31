import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Box3, Group, InstancedMesh, Matrix4, Mesh } from 'three';
import profile from '../src/data/berlinHistoricCoreV288.json';
import owners from '../src/data/berlinHistoricCoreV288Ownership.json';
import navigation from '../src/data/berlinHistoricCoreV288Navigation.json';
import { createBerlinHistoricDomV288, hasCompleteBerlinHistoricDomV288, berlinHistoricCoreV288Rows,
  berlinHistoricDomPartsV288, berlinHistoricDomRemaindersV288, berlinHistoricCoreFacadeAnchorsV288 } from '../src/BerlinHistoricCoreV288';
import { BERLIN_HISTORIC_DOM_V288_IDS, matchesBerlinHistoricDomOwnersV288, matchesBerlinHistoricDomNativeV288,
  isBerlinHistoricDomColumnV288, isBerlinHistoricDomOldCoreV288 } from '../src/BerlinHistoricCoreV288Ownership';
import { berlinHistoricDomSolidsV288 } from '../src/BerlinHistoricCoreV288Navigation';
import { bebelplatzPartRoofAt, bebelplatzPartContains } from '../src/bebelplatzBuildingProfile';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const evidence = JSON.parse(read('geo_data/regierungsviertel/berlin-historic-core-v288-evidence.json').toString());
const publicPrisms = JSON.parse(read('src/app/public/mesh/regierungsviertel/lod2-prisms.json').toString()).buildings;
const native = JSON.parse(read('src/app/public/mesh/regierungsviertel/minecraft-voxels.json').toString());
const clone = <T>(v: T): T => structuredClone(v);
function bytes(group: Group): number {
  let result = 0;
  group.traverse(o => { if (o instanceof Mesh) {
    for (const a of Object.values(o.geometry.attributes)) result += a.array.byteLength;
    result += o.geometry.index?.array.byteLength ?? 0;
    if (o instanceof InstancedMesh) result += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
  } });
  return result;
}
function pointIn(x: number, z: number, ring: number[][]): boolean {
  let yes = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) { const a=ring[i],b=ring[j];
    if ((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) yes=!yes;
  }
  return yes;
}
function clippedArea(ring: number[][], x: number, z: number): number {
  let points=ring.map(v=>[v[0]/10,v[1]/10]);
  for(const [axis,edge,low] of [[0,x,true],[0,x+4,false],[1,z,true],[1,z+4,false]] as const) {
    const result:number[][]=[];
    for(let i=0;i<points.length;i++) {const a=points[i],b=points[(i+1)%points.length];
      const ia=low?a[axis]>=edge:a[axis]<=edge,ib=low?b[axis]>=edge:b[axis]<=edge;
      if(ia)result.push(a);
      if(ia!==ib){const t=(edge-a[axis])/(b[axis]-a[axis]);result.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
    } points=result;
  }
  return Math.abs(points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
}

describe('Historic core v288 complete source and fail-closed ownership', () => {
  test('32 Dom parts retain all 518 measured source sheets, holes, heights and file receipts', () => {
    const selected=profile.profiles.slice(0,3);
    expect(selected.map(p=>p.parts.length)).toEqual([18,12,2]);
    expect(berlinHistoricDomPartsV288().reduce((n,p)=>n+p.surfaces.length,0)).toBe(518);
    for(const p of profile.profiles) {
      const raw=read(p.sourcePath);
      expect(createHash('sha256').update(raw).digest('hex')).toBe(p.sourceSha256);
      const b=JSON.parse(gunzipSync(raw).toString()).buildings.find((b:any)=>b.id===p.parentId);
      expect(p.verticalTransform).toEqual(b.verticalTransform);
      for(const part of p.parts) {
        const original=b.parts.find((a:any)=>a.id===part.originalId);
        expect(part.surfaces).toEqual(original.surfaces);
        expect(part.ring).toEqual(original.footprintPolygons[0].ring);
        expect(part.holes).toEqual(original.footprintPolygons[0].holes);
        expect([part.ground_y_m,part.top_y_m]).toEqual([original.groundY,original.topY]);
      }
    }
    expect(profile.profiles.find(p=>p.id==='voltair')?.parts[0].surfaces.length).toBe(91);
  });

  test('all six complete old records match, foreign/changed/duplicate owners preserve the original family', () => {
    expect(BERLIN_HISTORIC_DOM_V288_IDS.slice().sort()).toEqual(['02156993','12706358','12706359','24351835','24351837','70855133']);
    expect(matchesBerlinHistoricDomOwnersV288(publicPrisms)).toBe(true);
    for(const p of owners.legacyPrisms) {
      expect(p).toEqual(publicPrisms.find((a:any)=>a.id===p.id));
      expect(isBerlinHistoricDomOldCoreV288(p)).toBe(true);
      expect(isBerlinHistoricDomOldCoreV288({...p,h_dm:p.h_dm+1})).toBe(false);
      expect(isBerlinHistoricDomOldCoreV288({...p,newForeignValue:1})).toBe(false);
    }
    const records=owners.nearbyPrisms;
    expect(matchesBerlinHistoricDomOwnersV288(records)).toBe(true);
    expect(matchesBerlinHistoricDomOwnersV288(records.slice(1))).toBe(false);
    expect(matchesBerlinHistoricDomOwnersV288([...records,records[0]])).toBe(false);
    expect(matchesBerlinHistoricDomOwnersV288([...records,{...records[0],id:'foreign'}])).toBe(false);
    const changed=clone(records);changed[0].ring[0][0]++;
    expect(matchesBerlinHistoricDomOwnersV288(changed)).toBe(false);
    const hole=clone(records);const withHole=hole.find(p=>p.holes.length)!;withHole.holes=[];
    expect(matchesBerlinHistoricDomOwnersV288(hole)).toBe(false);
  });

  test('owner and tuple guards do not call getters, including coordinate accessors', () => {
    let calls=0;
    const changed=clone(owners.nearbyPrisms);
    Object.defineProperty(changed[0].ring[0],'0',{enumerable:true,get(){calls++;return 1;}});
    expect(matchesBerlinHistoricDomOwnersV288(changed)).toBe(false);
    const part=clone(owners.legacyPrisms[0]);
    Object.defineProperty(part,'id',{enumerable:true,get(){calls++;return owners.legacyPrisms[0].id;}});
    expect(isBerlinHistoricDomOldCoreV288(part)).toBe(false);
    const foreign=clone(owners.legacyPrisms[0]) as any;foreign[Symbol('foreign')]=1;
    expect(isBerlinHistoricDomOldCoreV288(foreign)).toBe(false);
    const v={...native};Object.defineProperty(v,'building_rows',{enumerable:true,get(){calls++;return native.building_rows;}});
    expect(matchesBerlinHistoricDomNativeV288(v)).toBe(false);
    expect(calls).toBe(0);
  });

  test('576 native tuples are canonical and their complete 4m cells have zero foreign overlap', () => {
    expect(owners.nativeColumns.length).toBe(576);
    expect(matchesBerlinHistoricDomNativeV288(native)).toBe(true);
    const foreign=owners.nearbyPrisms.filter(p=>!BERLIN_HISTORIC_DOM_V288_IDS.includes(p.id));
    let max=0;
    for(const r of owners.nativeColumns) {
      expect(isBerlinHistoricDomColumnV288(...r as [number,number,number,number,number])).toBe(true);
      for(const p of foreign) max=Math.max(max,clippedArea(p.ring,r[0]*4,r[1]*4));
    }
    expect(max).toBeLessThan(1e-6);
    const [x,z,low,high,kind]=owners.nativeColumns[0];
    expect(isBerlinHistoricDomColumnV288(x,z,low,high+1,kind)).toBe(false);
    const altered={...native,building_rows:native.building_rows.slice()};
    const index=z-owners.gridOrigin[1];altered.building_rows[index]=clone(native.building_rows[index]);
    const run=altered.building_rows[index].find((r:number[])=>owners.gridOrigin[0]+r[0]<=x&&owners.gridOrigin[0]+r[0]+r[1]>x);run[3]++;
    expect(matchesBerlinHistoricDomNativeV288(altered)).toBe(false);
    expect(matchesBerlinHistoricDomNativeV288({...native,cell_m:2})).toBe(false);
  });

  test('all exact digitization slivers remain source-bound rather than discarded', () => {
    expect(berlinHistoricDomRemaindersV288().length).toBe(8);
    const area=berlinHistoricDomRemaindersV288().reduce((sum,p)=>sum+Math.abs(p.ring.reduce((n,a,i)=>{const b=p.ring[(i+1)%p.ring.length];return n+a[0]*b[1]-b[0]*a[1];},0))/2,0);
    expect(area).toBeCloseTo(84.099989315,5);
    for(const p of berlinHistoricDomRemaindersV288()) expect(p.surfaces.length).toBeGreaterThan(2);
  });
});

describe('Historic core v288 actual geometry and native visibility', () => {
  test('complete actual factories fit bounded buffers, all modes and source roof heights', () => {
    for(const n of [false,true]) {
      const r=createBerlinHistoricDomV288(n);
      expect(hasCompleteBerlinHistoricDomV288(r)).toBe(true);
      expect(r.children.length).toBe(n?1:4);
      expect(bytes(r)).toBeLessThan(n?1_300_000:800_000);
      expect(new Box3().setFromObject(r).max.y).toBeLessThan(39.35);
      let cardinal=true;
      r.traverse(o=>{if(!(o instanceof Mesh))return;
        for(const m of [o.userData.dayMaterial,o.userData.nightMaterial]) expect(m.map??null).toBeNull();
        if(n&&o instanceof InstancedMesh){const m=new Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);for(const j of [1,2,4,6,8,9])cardinal&&=m.elements[j]===0;}}
      });
      expect(cardinal).toBe(true);
      expect(r.userData.fullStaticDetailOnTouch).toBe(true);
      expect(r.userData.aquaDomReconstructed).toBe(false);
    }
  });

  test('actual buffer/count/material/transform/foreign-child mutations fail complete admission', () => {
    const r=createBerlinHistoricDomV288(true), m=r.children[0] as InstancedMesh;
    m.count--;expect(hasCompleteBerlinHistoricDomV288(r)).toBe(false);m.count++;
    const array=m.instanceMatrix.array, original=array[0];array[0]++;expect(hasCompleteBerlinHistoricDomV288(r)).toBe(false);array[0]=original;
    m.instanceMatrix.array=new Float32Array(array);expect(hasCompleteBerlinHistoricDomV288(r)).toBe(false);m.instanceMatrix.array=array;
    (m.material as any).transparent=true;expect(hasCompleteBerlinHistoricDomV288(r)).toBe(false);(m.material as any).transparent=false;
    m.matrix.elements[12]++;expect(hasCompleteBerlinHistoricDomV288(r)).toBe(false);m.matrix.elements[12]--;
    expect(hasCompleteBerlinHistoricDomV288(r)).toBe(true);
    r.add(new Group());expect(hasCompleteBerlinHistoricDomV288(r)).toBe(false);
    expect(hasCompleteBerlinHistoricDomV288(r.clone())).toBe(false);
  });

  test('outer native fittings are outside actual delivered 2m exterior faces, with full member bounds', () => {
    let checked=0;
    for(const fit of evidence.nativeOuterFits) {
      const [axis,sign,plane,lo,hi,low,high]=fit.nativeFace;
      for(const row of profile.nativeOuterRows.slice(fit.first,fit.first+fit.count)) {
        const half=row[axis===0?3:5]/2,along=2-axis,alongHalf=row[axis===0?5:3]/2;
        expect((row[axis]-plane)*sign-half).toBeGreaterThan(.02);
        expect(row[along]-alongHalf).toBeGreaterThanOrEqual(lo-.0001);
        expect(row[along]+alongHalf).toBeLessThanOrEqual(hi+.0001);
        expect(row[1]-row[4]/2).toBeGreaterThanOrEqual(low-.0001);
        expect(row[1]+row[4]/2).toBeLessThanOrEqual(high+.0001); checked++;
      }
    }
    expect(checked).toBe(profile.nativeOuterRows.length);
    expect(new Set(evidence.nativeOuterFits.map((f:any)=>f.profile))).toEqual(new Set(['klostergaerten','voltaireHotel','voltair']));
    for(const f of evidence.nativeOuterSource.files) expect(createHash('sha256').update(read(f.path)).digest('hex')).toBe(f.sha256);
  });

  test('original ruin mortar prefix remains on the actual retained surfaces', () => {
    expect(profile.nativeRuinRows.length).toBe(785);
    for(const fit of evidence.nativeRuinFits) {
      const row=profile.nativeRuinRows[fit.first],[axis,sign,plane,lo,hi,low,high]=fit.nativeFace;
      expect(row[4]).toBeLessThan(.04);
      expect((row[axis]-plane)*sign-row[axis===0?3:5]/2).toBeGreaterThan(.02);
      expect(row[1]).toBeGreaterThanOrEqual(low);expect(row[1]).toBeLessThanOrEqual(high);
    }
  });

  test('navigation holds only lightweight roof planes and preserves exact source roof/court tests', () => {
    const parts=[...berlinHistoricDomPartsV288(),...berlinHistoricDomRemaindersV288()], solids=berlinHistoricDomSolidsV288();
    expect(solids.length).toBe(40);
    expect(navigation.every(p=>!('surfaces' in p))).toBe(true);
    let compared=0, holes=0;
    for(let i=0;i<parts.length;i++) {
      const p=parts[i],s=solids[i];
      expect(s.ring).toEqual(p.ring);expect(s.holes).toEqual(p.holes);
      const minX=Math.min(...p.ring.map(v=>v[0])),maxX=Math.max(...p.ring.map(v=>v[0])),minZ=Math.min(...p.ring.map(v=>v[1])),maxZ=Math.max(...p.ring.map(v=>v[1]));
      for(let x=minX+.13;x<maxX;x+=3.1)for(let z=minZ+.17;z<maxZ;z+=3.1){
        const a=bebelplatzPartRoofAt(p,x,z),b=s.topAt(x,z);if(a===null)expect(b).toBeNull();else expect(b).toBeCloseTo(a,8);compared++;
        if(p.holes.some(h=>pointIn(x,z,h))){expect(b).toBeNull();holes++;}
      }
    }
    expect(compared).toBeGreaterThan(1000);expect(holes).toBeGreaterThan(10);
  });

  test('append-only rows remain bounded, finite and native orthogonal', () => {
    const drawn=berlinHistoricCoreV288Rows(),native=berlinHistoricCoreV288Rows(true);
    expect(createHash('sha256').update(JSON.stringify(drawn.slice(0,5399))).digest('hex')).toBe('0e4a13c25272bcd7cad56ddbeee4047bb018bd5491d2ffe4a7feff0d6c53145e');
    expect(createHash('sha256').update(JSON.stringify(native.slice(0,1879))).digest('hex')).toBe('ad48211f517cefb4ea44093d91668ce1bee9c5c0d9ce9cca70564f1cbec07ef6');
    expect(drawn.length).toBe(7311);expect(native.length).toBe(2074);
    expect(drawn.length*76).toBe(555_636);expect(native.length*76).toBe(157_624);
    expect(drawn.every(r=>r.length===8&&r.every(Number.isFinite))).toBe(true);
    expect(native.every(r=>r.length===7&&r.every(Number.isFinite))).toBe(true);
    expect(berlinHistoricCoreFacadeAnchorsV288().some(a=>a.profile==='voltair'&&a.row[7]===0x293d42)).toBe(true);
  });
});
