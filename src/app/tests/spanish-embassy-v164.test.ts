import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { Box3, InstancedMesh, Mesh, Vector3 } from 'three';
import { createSpanishEmbassyV164, createMinecraftSpanishEmbassyV164, SPANISH_EMBASSY_V164_PROFILE } from '../src/SpanishEmbassyV164';
import { SPANISH_EMBASSY_V164_PRISM_IDS, spanishEmbassyV164RoofAt, spanishEmbassyV164SourceColumn } from '../src/spanishEmbassyV164Profile';
import source from '../src/data/spanishEmbassyV164Source.json';
import nav from '../src/data/spanishEmbassyV164Navigation.json';
function signature(root:ReturnType<typeof createSpanishEmbassyV164>):string {
  const hash=createHash('sha256');root.traverse(o=>{if(o instanceof Mesh){for(const a of Object.values(o.geometry.attributes))hash.update(Buffer.from(a.array.buffer));if(o.geometry.index)hash.update(Buffer.from(o.geometry.index.array.buffer));if(o instanceof InstancedMesh){hash.update(Buffer.from(o.instanceMatrix.array.buffer));if(o.instanceColor)hash.update(Buffer.from(o.instanceColor.array.buffer));}}});return hash.digest('hex');
}
describe('Spanish Embassy source geometry',()=>{
  it('retains the complete measured shell instead of the short tour-anchor part alone',()=>{
    const root=createSpanishEmbassyV164();const mesh=root.getObjectByName('Five complete official embassy parts including rear roofs') as Mesh;
    expect(source.parts).toHaveLength(5);expect(root.userData.sourcePartIds).toEqual(source.parts.map(p=>p.id));
    expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(Array.from(new Float32Array(source.surfaces.flatMap(s=>s.triangles).flat(2))));
    expect(SPANISH_EMBASSY_V164_PROFILE.columnCount).toBe(4);
    expect(root.getObjectByName('Four-column embassy portico current coat of arms and balcony')?.userData.currentCoatOfArms).toBe(true);
  });
  it('keeps full detail identical on pointer and touch with frozen transforms',()=>{
    expect(signature(createSpanishEmbassyV164())).toBe(signature(createSpanishEmbassyV164({mobileLike:true})));
    expect(signature(createMinecraftSpanishEmbassyV164())).toBe(signature(createMinecraftSpanishEmbassyV164({mobileLike:true})));
    for(const root of [createSpanishEmbassyV164(),createMinecraftSpanishEmbassyV164()])root.traverse(o=>expect(o.matrixAutoUpdate).toBe(false));
  });
  it('uses three texture-free drawn batches and two independent axis-aligned native batches',()=>{
    let calls=0;createSpanishEmbassyV164().traverse(o=>{if(o instanceof Mesh){calls++;expect(o.userData.dayMaterial.map).toBeNull();expect(o.userData.nightMaterial.map).toBeNull();}});expect(calls).toBe(3);
    let blocks=0,nativeCalls=0;createMinecraftSpanishEmbassyV164().traverse(o=>{if(o instanceof Mesh){expect(o).toBeInstanceOf(InstancedMesh);expect(o.geometry.type).toBe('BoxGeometry');expect(o.userData.blockNative).toBe(true);const m=o as InstancedMesh;blocks+=m.count;nativeCalls++;for(let i=0;i<m.count;i++){const a=m.instanceMatrix.array;for(const offset of [1,2,4,6,8,9])expect(Math.abs(a[i*16+offset])).toBe(0);}}});expect(nativeCalls).toBe(2);expect(blocks).toBeLessThan(6200);
    const b=new Box3().setFromObject(createSpanishEmbassyV164());expect(b.getSize(new Vector3()).x).toBeLessThan(70);expect(b.getSize(new Vector3()).z).toBeLessThan(68);expect(b.max.y).toBeCloseTo(30.86,2);
  });
  it('retains five complete parts plus the exact open-portico owner and checks full source/native roofs',()=>{
    expect([...SPANISH_EMBASSY_V164_PRISM_IDS].sort()).toEqual(source.legacyPrisms.map(p=>p.id).sort());
    for(const [x,z,y] of nav.nativeRoofCells)expect(spanishEmbassyV164RoofAt(x,z,true)).toBe(y);
    for(const [a,b,c] of nav.roofTriangles){const x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3,y=(a[1]+b[1]+c[1])/3;const roof=spanishEmbassyV164RoofAt(x,z);if(roof!==null)expect(roof).toBeGreaterThanOrEqual(y-.001);}
    expect(spanishEmbassyV164RoofAt(0,0)).toBeNull();expect(spanishEmbassyV164SourceColumn(0,0,5.2,33.2)).toBe(false);
    const p=source.legacyPrisms.find(p=>p.id==='DC13dOb2')!,base=p.y0_dm/10,top=base+Math.ceil(p.h_dm/40)*4;
    expect(spanishEmbassyV164SourceColumn(-1787,927,base,top)).toBe(true);expect(spanishEmbassyV164SourceColumn(-1787,927,base,top+4)).toBe(false);
    expect(source.replacedPorticoEnvelope.legacyId).toBe('K0003Ul3');
    expect(source.replacedPorticoEnvelope.sourceSurfaces).toHaveLength(6);
    const portico=source.legacyPrisms.find(p=>p.id==='K0003Ul3')!,porchBase=portico.y0_dm/10,porchTop=porchBase+Math.ceil(portico.h_dm/40)*4;
    expect(SPANISH_EMBASSY_V164_PRISM_IDS.has(portico.id)).toBe(true);
    expect(spanishEmbassyV164SourceColumn(-1782,890,porchBase,porchTop)).toBe(true);
    expect(spanishEmbassyV164SourceColumn(-1782,890,porchBase,porchTop+4)).toBe(false);
    expect(spanishEmbassyV164SourceColumn(-1782,884,porchBase,porchTop)).toBe(false);
  });
});
