import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { InstancedMesh, Matrix4, Mesh } from 'three';
import data from '../src/data/campusNordV266.json';
import previous from '../src/data/campusNordV266AltMittePrevious.json';
import { campusCanopyRoofTrianglesV266, campusNordGeometryV266, createCampusNordV266 } from '../src/CampusNordV266';
import { campusCanopySolidsV266, createCampusCanopyColumnTesterV266, isCampusCanopyPreviousPartV266, isCampusCanopySourceV266, transferCampusCanopyTrianglesV266 } from '../src/CampusNordV266Profile';
import type { SurroundingPackedMesh } from '../src/SurroundingCityGeometry';

describe('Campus Nord architecture v266',()=>{
  test('correct source identities, complete original canopy roof and unchanged neighbour controls',()=>{
    expect(data.mensa.length).toBe(11);expect(data.rhoda.length).toBe(3);
    const vertices=new Set(campusCanopyRoofTrianglesV266().flat().map(p=>p.join('/')));
    for(const p of data.canopy.roof[0].rings[0])expect(vertices.has(p.join('/'))).toBe(true);
    expect(isCampusCanopySourceV266(data.canopy.previousPrism)).toBe(true);
    expect(isCampusCanopySourceV266({...data.canopy.previousPrism,h_dm:61})).toBe(false);
    const actual=JSON.parse(readFileSync('public/mesh/regierungsviertel/lod2-prisms.json','utf8')).buildings;
    const tester=createCampusCanopyColumnTesterV266(actual,data.canopy.cellM);
    // Conservative runtime boxes may retain a corner-ambiguous source column.
    expect(data.canopy.columns.some(c=>tester(...c as [number,number,number,number,number]))).toBe(true);
    expect(tester(0,0,52,112,3)).toBe(false);
    const c=data.canopy.columns[0],x=c[0]*40,z=c[1]*40;
    const changed=createCampusCanopyColumnTesterV266([...actual,{id:'future-owner',ring:[[x,z],[x+40,z],[x+40,z+40],[x,z+40]]}],4);
    expect(changed(...c as [number,number,number,number,number])).toBe(false);
    for(const p of previous.previousNavigationParts){expect(isCampusCanopyPreviousPartV266(p)).toBe(true);expect(isCampusCanopyPreviousPartV266({...p,topY:p.topY+.1})).toBe(false);}
  });
  test('open canopy ground and matching elevated native roof collision',()=>{
    for(const native of [false,true])for(const solid of campusCanopySolidsV266(native)){
      expect(solid.minY).toBeGreaterThan(10.3);expect(solid.maxY).toBeCloseTo(10.547,5);
    }
    const rows=campusNordGeometryV266(true).filter(r=>r.role==='native-complete-canopy-roof');
    const solids=campusCanopySolidsV266(true);expect(rows.length).toBe(solids.length);
    rows.forEach((r,i)=>{expect(r.position[1]+r.size[1]/2).toBeCloseTo(solids[i].maxY,8);});
    expect(campusNordGeometryV266().filter(r=>r.role==='foyer-slender-mullion').length).toBeGreaterThan(20);
  });
  test('exact packet receipts transfer only audited triangles and fail closed on changed payload',()=>{
    const source=JSON.parse(readFileSync('src/data/altMitteDrawnV169Source.json','utf8'));
    const receipt=previous.records.find(r=>r.layer==='drawn')!;
    const file=source.chunkFiles.find((r:{id:string})=>'alt-mitte-v169-'+r.id===receipt.tile).file;
    const packet=JSON.parse(readFileSync('src/data/'+file,'utf8'));
    let transferred=0;
    for(const part of packet.meshes as SurroundingPackedMesh[]){
      const raw=Buffer.from(part.indices,'base64'),original=new Uint32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
      const result=original.slice(),g=transferCampusCanopyTrianglesV266(true,receipt.tile,false,part,result,0);let step=g.next();while(!step.done)step=g.next();transferred+=step.value;
      const altered=original.slice(),bad=transferCampusCanopyTrianglesV266(true,receipt.tile,false,{...part,colors:part.colors+'A'},altered,0);let stop=bad.next();while(!stop.done)stop=bad.next();expect(stop.value).toBe(0);expect(altered).toEqual(original);
      for(let i=0;i<result.length;i++)if(!receipt.triangles.includes(Math.floor(i/3)))expect(result[i]).toBe(original[i]);
    }
    expect(transferred).toBe(previous.counts.drawn);
  });
  test('equal mobile detail, bounded buffers and genuinely orthogonal independent native instances',()=>{
    for(const native of [false,true]){
      const a=createCampusNordV266(native,{diagnostics:true}),b=createCampusNordV266(native,{mobileLike:true,diagnostics:true});
      expect(a.userData.records).toEqual(b.userData.records);expect(a.userData.instances).toBeLessThan(native?26000:11000);
      const roles=new Set(campusNordGeometryV266(native).map(r=>r.role));
      for(const role of ['washhouse-segmental-window','washhouse-attic-grille','rhoda-three-green-horizontal-bands','rhoda-continuous-window-ribbon','theatre-fanlight-radial-bar','theatre-dome-standing-seam'])expect(roles.has(role)).toBe(true);
      const matrix=new Matrix4();a.traverse(o=>{
        expect(o.matrixAutoUpdate).toBe(false);
        if(o instanceof Mesh)expect(o.geometry.getAttribute('uv')).toBeUndefined();
        if(o instanceof InstancedMesh)for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);expect(matrix.elements.every(Number.isFinite)).toBe(true);if(native)for(const j of [1,2,4,6,8,9])expect(matrix.elements[j]).toBe(0);}
      });
      for(const g of [a,b])g.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const m of [o.material,o.userData.dayMaterial,o.userData.nightMaterial].flat())m?.dispose();}});
    }
  });
});
