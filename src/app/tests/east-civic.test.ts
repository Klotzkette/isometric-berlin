import { expect, test } from 'bun:test';
import { BufferGeometry, InstancedMesh, Mesh, Raycaster, Vector3 } from 'three';
import { createEastCivicArchitecture, createMinecraftEastCivicArchitecture } from '../src/EastCivicArchitecture';
import { EAST_CIVIC_SOURCES as S, EAST_CIVIC_PRISM_IDS, FRIEDRICHSWERDER_TOWER_IDS, eastCivicPartRoofAt, eastCivicWalkableAt, eastCivicSupportSolidAt, isEastCivicReplacementColumn } from '../src/eastCivicProfile';
const drawn=createEastCivicArchitecture(),native=createMinecraftEastCivicArchitecture();drawn.updateMatrixWorld(true);native.updateMatrixWorld(true);
test('both church towers retain their original height above the nave',()=>{
 expect(S.map(s=>s.parts.length)).toEqual([3,14,40]);expect([...EAST_CIVIC_PRISM_IDS]).toEqual(['24044937','15933949','15933948','on-57390']);
 for(const id of FRIEDRICHSWERDER_TOWER_IDS){const p=S[0].parts.find(p=>p.id===id)!;expect(p.top_y_m).toBeGreaterThan(42);const x=p.ring.reduce((n,p)=>n+p[0],0)/p.ring.length,z=p.ring.reduce((n,p)=>n+p[1],0)/p.ring.length;expect(eastCivicPartRoofAt(p,x,z)).toBeCloseTo(p.top_y_m);for(const root of[drawn,native]){const hits=new Raycaster(new Vector3(x,50,z),new Vector3(0,-1,0),0,15).intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);expect(hits[0].point.y).toBeGreaterThan(42);}}
});
test('replacement leaves neighbouring streets and original uncovered courts free',()=>{
 expect(isEastCivicReplacementColumn(1763,402)).toBeTrue();expect(isEastCivicReplacementColumn(1735,402)).toBeFalse();expect(isEastCivicReplacementColumn(1800,390)).toBeFalse();
 const old=S[2].previous_display_prisms[0];for(const hole of old.holes){const x=hole.reduce((n,p)=>n+p[0],0)/hole.length/10,z=hole.reduce((n,p)=>n+p[1],0)/hole.length/10;if(!S[2].parts.some(p=>eastCivicPartRoofAt(p,x,z)!==null))expect(isEastCivicReplacementColumn(x,z)).toBeFalse();}
});
test('east loggia is open below its roof and actual support posts collide',()=>{
 expect(eastCivicWalkableAt(1914,7,436)).toBeTrue();expect(eastCivicSupportSolidAt(1910.22,419.3,7)).toBeTrue();expect(eastCivicWalkableAt(1910.22,7,419.3)).toBeFalse();expect(eastCivicWalkableAt(1914,29,436)).toBeFalse();
 for(const root of[drawn,native]){const ray=new Raycaster(new Vector3(1920,7,434),new Vector3(-1,0,0),0,7);expect(ray.intersectObject(root,true)).toHaveLength(0);}
});
test('full static source detail stays image-free and Minecraft has one bounded surface batch',()=>{
 const budgets=[];for(const root of[drawn,native]){let bytes=0,draws=0,instances=0;const seen=new Set<BufferGeometry>();root.traverse(o=>{if(!(o instanceof Mesh))return;draws++;expect(o.matrixAutoUpdate).toBeFalse();expect(o.userData.dayMaterial.map).toBeNull();expect(o.userData.nightMaterial.map).toBeNull();if(!seen.has(o.geometry)){seen.add(o.geometry);for(const a of Object.values(o.geometry.attributes)){bytes+=a.array.byteLength;expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();}bytes+=o.geometry.index?.array.byteLength??0;}if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}});budgets.push({draws,instances,bytes});expect(bytes).toBeLessThan(3_000_000);expect(root.userData.sourcePartIds.length).toBe(57);expect(root.userData.fullStaticDetailOnTouch).toBeTrue();}
 expect(budgets[0].draws).toBeLessThanOrEqual(7);expect(budgets[1].draws).toBe(1);expect(native.userData.hiddenSolidInfill).toBeFalse();expect((native.children[0] as Mesh).geometry.getAttribute('position').count).toBe(24);console.log('east-civic-v148 budgets',budgets);
});

test('the lower measured glass atrium is visible instead of hidden by the overlapping coarse parent roof',()=>{
 const p=S[1].parts.find(p=>p.id==='DEBE3DJrlFgy3FFk')!;expect(eastCivicPartRoofAt(S[1].parts[0],1884,436)).toBeNull();const exact=eastCivicPartRoofAt(p,1884,436)!;expect(exact).toBeGreaterThan(26);expect(exact).toBeLessThan(26.6);
 for(const root of[drawn,native]){const hits=new Raycaster(new Vector3(1884,40,436),new Vector3(0,-1,0),0,20).intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);expect(hits[0].point.y).toBeLessThan(27);expect(hits[0].point.y).toBeGreaterThan(26);}
});
