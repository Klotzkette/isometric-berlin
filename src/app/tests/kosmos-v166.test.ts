import {expect,test} from "bun:test";
import {InstancedMesh,Mesh} from "three";
import {createKosmosV166,createMinecraftKosmosV166} from "../src/KosmosV166";
import {KOSMOS_V166_PROFILE,KOSMOS_V166_PARTS,kosmosV166RoofAt,kosmosV166Contains,kosmosV166SourceColumn} from "../src/kosmosV166Profile";
import nav from "../src/data/kosmosV166Navigation.json";

test("KOSMOS has verified event identity and retains every measured part",()=>{
 expect(KOSMOS_V166_PROFILE.osmWayId).toBe("606479961");expect(KOSMOS_V166_PROFILE.monumentId).toBe("09085140");expect(KOSMOS_V166_PROFILE.currentUse).toContain("event venue");expect(KOSMOS_V166_PROFILE.userNameMatch).toBe("uncertain");expect(KOSMOS_V166_PARTS).toHaveLength(8);expect(kosmosV166SourceColumn(5310,344,3,15)).toBe(false);expect(kosmosV166Contains(5315,344)).toBe(true);expect(kosmosV166Contains(5280,344)).toBe(false);
 for(const [a,b,c] of nav.roofTriangles){const x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3;const area=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);if(Math.abs(area)>.001)expect(kosmosV166RoofAt(x,z)!).toBeGreaterThanOrEqual((a[1]+b[1]+c[1])/3-.001);}
 for(const [x,z,y] of nav.nativeRoofCells)expect(kosmosV166RoofAt(x,z,true)).toBe(y);
});
function bytes(mesh:Mesh):number{return Object.values(mesh.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(mesh.geometry.index?.array.byteLength??0)+(mesh instanceof InstancedMesh?mesh.instanceMatrix.array.byteLength+(mesh.instanceColor?.array.byteLength??0):0);}
test("KOSMOS has compact instanced full-touch drawn parity",()=>{
 const a=createKosmosV166(),b=createKosmosV166({mobileLike:true});expect(a.children).toHaveLength(2);let total=0;
 for(let i=0;i<a.children.length;i++){const x=a.children[i] as Mesh,y=b.children[i] as Mesh;total+=bytes(x);expect(x.matrixAutoUpdate).toBe(false);expect(x.geometry.getAttribute("position").array).toEqual(y.geometry.getAttribute("position").array);if(x instanceof InstancedMesh && y instanceof InstancedMesh)expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);}
 expect(total).toBeLessThan(250000);console.log({kosmosDrawnBytes:total,drawnBatches:2});
});
test("KOSMOS native model is an independent single orthogonal batch",()=>{
 const a=createMinecraftKosmosV166(),b=createMinecraftKosmosV166({mobileLike:true});expect(a.children).toHaveLength(1);const x=a.children[0] as InstancedMesh,y=b.children[0] as InstancedMesh;expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);expect(x.matrixAutoUpdate).toBe(false);expect(x.count).toBeLessThan(7000);expect(x.count).toBeGreaterThan(2529);expect(bytes(x)).toBeLessThan(600000);for(let i=0;i<x.count;i++){const m=x.instanceMatrix.array;expect([m[i*16+1],m[i*16+2],m[i*16+4],m[i*16+6],m[i*16+8],m[i*16+9]]).toEqual([0,0,0,0,0,0]);}console.log({kosmosNativeBytes:bytes(x),blocks:x.count});
});
