import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { Box3, InstancedMesh, Mesh, Vector3 } from 'three';
import { createWestSquaresV163, createMinecraftWestSquaresV163, WEST_SQUARES_V163_PROFILE, WEST_SQUARES_V188_PROFILE } from '../src/WestSquaresV163';
import source from '../src/data/westSquaresV163Source.json';
import navigation from '../src/data/westSquaresV163Navigation.json';

function signature(root: ReturnType<typeof createWestSquaresV163>): string {
  const hash=createHash('sha256');
  root.traverse(o=>{if(o instanceof Mesh){
    for(const key of Object.keys(o.geometry.attributes).sort()) hash.update(Buffer.from(o.geometry.attributes[key].array.buffer));
    if(o.geometry.index)hash.update(Buffer.from(o.geometry.index.array.buffer));
    if(o instanceof InstancedMesh){hash.update(Buffer.from(o.instanceMatrix.array.buffer));if(o.instanceColor)hash.update(Buffer.from(o.instanceColor.array.buffer));}
  }});return hash.digest('hex');
}

describe('source-bound West squares',()=>{
  it('keeps all nine measured parts and exactly the four replaced legacy shells',()=>{
    expect(source.parts.length).toBe(9);expect(source.surfaces.length).toBe(190);
    expect(source.legacyPrisms.map(p=>p.id).sort()).toEqual(['-5396409','-5396410','26369724','40452037'].sort());
    expect(navigation.parts.map(p=>p.id)).toEqual(source.parts.map(p=>p.id));
    for(const part of source.parts){expect(part.sourceSurfaces.some(s=>s.kind==='GroundSurface')).toBe(true);expect(part.topY).toBeGreaterThan(part.groundY);}
    expect(navigation.roofTriangles.length).toBe(source.surfaces.filter(s=>s.kind==='RoofSurface').flatMap(s=>s.triangles).length);
  });
  it('has identical complete static geometry on mobile and pointer devices',()=>{
    expect(signature(createWestSquaresV163())).toBe(signature(createWestSquaresV163({mobileLike:true})));
    expect(signature(createMinecraftWestSquaresV163())).toBe(signature(createMinecraftWestSquaresV163({mobileLike:true})));
  });
  it('retains precise mapped fountains, current memorial and eight mapped benches',()=>{
    expect(source.osm['4598245'].rings[0].length).toBe(6);
    expect(source.osm['42023136'].rings[0].length).toBe(4);
    expect(WEST_SQUARES_V163_PROFILE.ernstReuter.smallJets).toBe(41);
    expect(WEST_SQUARES_V163_PROFILE.ernstReuter.mainJetHeightM).toBe(15);
    expect(source.memorial.osmNode).toBe('7912441064');
    expect(source.benches.length).toBe(8);
    expect(WEST_SQUARES_V163_PROFILE.memorial.destinations).toEqual(['AUSCHWITZ','STUTTHOF','MAIDANEK','TREBLINKA','THERESIENSTADT','BUCHENWALD','DACHAU','SACHSENHAUSEN','RAVENSBRÜCK','BERGEN-BELSEN','TROSTENEZ','FLOSSENBÜRG']);
  });
  it('uses only bounded native block batches and no smooth Minecraft duplicate',()=>{
    const root=createMinecraftWestSquaresV163();let batches=0,blocks=0;
    root.traverse(o=>{if(o instanceof Mesh){expect(o).toBeInstanceOf(InstancedMesh);expect(o.userData.blockNative).toBe(true);expect(o.geometry.type).toBe('BoxGeometry');batches++;blocks+=(o as InstancedMesh).count;}});
    expect(batches).toBe(4);expect(blocks).toBeLessThan(WEST_SQUARES_V188_PROFILE.maxNativeBlocks);
  });
  it('stays texture-free and freezes complete static transforms with seven drawn batches',()=>{
    const root=createWestSquaresV163();let calls=0;
    root.traverse(o=>{expect(o.matrixAutoUpdate).toBe(false);if(o instanceof Mesh){calls++;for(const mat of [o.userData.dayMaterial,o.userData.nightMaterial]){expect(mat).toBeDefined();expect(mat.map).toBeNull();}}});
    expect(calls).toBe(7);
    const bounds=new Box3().setFromObject(root);expect(bounds.getSize(new Vector3()).x).toBeLessThan(1800);expect(bounds.max.y).toBeLessThan(90);
  });
  it('keeps exact source triangles as the only building envelope',()=>{
    const root=createWestSquaresV163();
    for(const b of source.buildings){const mesh=root.getObjectByName(b.name+' complete official LoD2 surfaces') as Mesh;expect(mesh).toBeDefined();const ids=new Set(source.parts.filter(p=>p.parentId===b.id).map(p=>p.id));const expected=source.surfaces.filter(s=>ids.has(s.partId)).flatMap(s=>s.triangles).flat(2);expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(Array.from(new Float32Array(expected)));}
  });
});

import { WEST_SQUARES_V163_PRISM_IDS, WEST_SQUARES_V163_SOURCE_BOUNDS, westSquaresV163RoofAt, westSquaresV163SourceColumn } from '../src/westSquaresV163Profile';
describe('West-square navigation ownership',()=>{
  it('has explicit four identities and conservative part bounds',()=>{
    expect([...WEST_SQUARES_V163_PRISM_IDS].sort()).toEqual(source.legacyPrisms.map(p=>p.id).sort());
    for(const b of WEST_SQUARES_V163_SOURCE_BOUNDS) for(const [x,z] of b.part.rings.flat()) {
      expect(x).toBeGreaterThanOrEqual(b.minX);expect(x).toBeLessThanOrEqual(b.maxX);
      expect(z).toBeGreaterThanOrEqual(b.minZ);expect(z).toBeLessThanOrEqual(b.maxZ);
    }
  });
  it('returns every native exterior roof cell including straddling edge cells',()=>{
    for(const [x,z,y] of navigation.nativeRoofCells) expect(westSquaresV163RoofAt(x,z,true)).toBe(y);
    expect(westSquaresV163RoofAt(0,0,true)).toBeNull();expect(westSquaresV163RoofAt(0,0)).toBeNull();
  });
  it('interpolates source roof planes and matches only exact legacy column heights',()=>{
    for(const triangle of navigation.roofTriangles){
      const x=triangle.reduce((s,p)=>s+p[0],0)/3,z=triangle.reduce((s,p)=>s+p[2],0)/3,y=triangle.reduce((s,p)=>s+p[1],0)/3;
      const roof=westSquaresV163RoofAt(x,z);if(roof!==null)expect(roof).toBeGreaterThanOrEqual(y-.001);
    }
    const p=source.legacyPrisms.find(p=>p.id==='26369724')!;
    const x=-1974.8,z=1854.7,base=p.y0_dm/10,top=base+Math.ceil(p.h_dm/40)*4;
    expect(westSquaresV163SourceColumn(x,z,base,top)).toBe(true);
    expect(westSquaresV163SourceColumn(x,z,base,top+4)).toBe(false);
    expect(westSquaresV163SourceColumn(x,z,base+4,top+4)).toBe(false);
  });
});
