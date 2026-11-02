import { describe, expect, test } from 'bun:test';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import source from '../src/data/friedrichshainV303.json';
import { captureSourceQuarterPacketV303, prepareSourceQuarterPacketV303, sourceQuarterNavigationV303, sourceQuarterOwnersV303, type SourceQuarterSourceV303 } from '../src/SourceQuarterPacketV303';
import { prepareSurroundingQuarterPredecessorV303, type SurroundingCityChunk } from '../src/SurroundingCityGeometry';

function done<T>(g: Generator<void,T>):T { let r=g.next();while(!r.done)r=g.next();return r.value; }
const data=source as unknown as SourceQuarterSourceV303;
const keys=Object.keys(source.packets).filter(k=>'preparedRecords' in source.packets[k as keyof typeof source.packets]);
const ownership={neighbourhoodV300:true,westKiezV302:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,tachelesFrontsV270:true};
const packet=(id:string,native:boolean):SurroundingCityChunk=>JSON.parse(gunzipSync(readFileSync(resolve(import.meta.dir,`../public/mesh/surrounding-berlin-v159/${id}.${native?'minecraft':'drawn'}.json.gz`))).toString());

describe('finite full Friedrichshain source transfers v303',()=>{
  test('all four real prepared packets admit complete body, ink and granular navigation together',()=>{
    expect(keys.length).toBe(4);
    for(const key of keys){
      const [mode,id]=key.split(':'),native=mode==='minecraft',raw=packet(id,native);
      const ticket=done(captureSourceQuarterPacketV303(raw,id,native,true,data,'friedrichshain-v303'));
      expect(ticket).toBeDefined();
      const previous=done(prepareSurroundingQuarterPredecessorV303(raw,id,native,ownership));
      const next=done(prepareSourceQuarterPacketV303(previous,ticket));
      expect(next.meshes.length).toBe(previous.meshes.length+1);
      const plan=data.packets[key];
      expect(sourceQuarterOwnersV303(next)).toEqual(plan.owners);
      const nav=sourceQuarterNavigationV303(next,next.nav);
      expect(nav.ground).toBe(next.nav.ground);
      expect(nav.water).toBe(next.nav.water);
      const outside=next.nav.buildings.filter(b=>!plan.retireNav.some(old=>JSON.stringify(old)===JSON.stringify(b)));
      expect(nav.buildings.slice(0,outside.length)).toEqual(outside);
      expect(nav.buildings.slice(outside.length)).toEqual(plan.appendNav);
      expect(nav.buildings.some(b=>plan.owners.includes(b.sourceId))).toBe(false);
      expect(plan.appendNav.every(b=>native?!!b.nativeRoofCaps:!!b.roofTriangles)).toBe(true);
    }
  });
  test('false defaults and a changed full raw predecessor retain every old owner',()=>{
    const key=keys[0],[mode,id]=key.split(':'),native=mode==='minecraft';
    const raw=packet(id,native);
    expect(done(captureSourceQuarterPacketV303(raw,id,native,false,data,'friedrichshain-v303'))).toBeUndefined();
    const altered=structuredClone(raw);
    altered.meshes[0].colors=altered.meshes[0].colors.slice(0,-4)+'AAAA';
    expect(done(captureSourceQuarterPacketV303(altered,id,native,true,data,'friedrichshain-v303'))).toBeUndefined();
    expect(sourceQuarterNavigationV303(altered,altered.nav)).toBe(altered.nav);
    expect(sourceQuarterOwnersV303(altered)).toEqual([]);
  });
});
