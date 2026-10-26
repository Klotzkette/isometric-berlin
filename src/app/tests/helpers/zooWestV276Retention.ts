import { expect } from 'bun:test';
import { Color, InstancedMesh, Matrix4, Vector3 } from 'three';
import source from '../../src/data/zooGroundsV165Source.json';

export function oldNativeZooRowsV276():number[][]{
 return [...source.nativeRows.filter(r=>r[6]!==0x758c86),...source.groundRuns].map(r=>[r[0],r[1],r[2],r[3],r[4],r[5],0,r[6]]);
}
export function originalNativeZooBuffersV276():{matrices:Float32Array;colors:Float32Array}{
 const rows=oldNativeZooRowsV276(),m=new Matrix4(),c=new Color(),matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3);
 rows.forEach((r,i)=>{m.makeRotationY(0);m.scale(new Vector3(r[3],r[4],r[5]));m.setPosition(r[0],r[1],r[2]);m.toArray(matrices,i*16);c.setHex(r[7]).toArray(colors,i*3);});return{matrices,colors};
}
/** Independent one-metre XZ cell multiset, with exact Float32 Y/height/colour.
 * Overlaps count separately; neither colour nor volume can disappear. */
export function expectCompleteNativeZooVolumeV276(mesh:InstancedMesh):void{
 const expected=new Map<string,number>(),actual=new Map<string,number>();
 function add(map:Map<string,number>,x:number,y:number,z:number,w:number,h:number,d:number,c:readonly number[]):void{
  expect(Number.isInteger(w)&&Number.isInteger(d)).toBe(true);
  expect(Number.isInteger(x-w/2)&&Number.isInteger(z-d/2)).toBe(true);
  for(let xx=x-w/2;xx<x+w/2;xx++)for(let zz=z-d/2;zz<z+d/2;zz++){
   const key=[xx,zz,y,h,...c].join('/');map.set(key,(map.get(key)??0)+1);
  }
 }
 const c=new Color();
 for(const r of oldNativeZooRowsV276()){const color=c.setHex(r[7]).toArray().map(Math.fround);add(expected,Math.fround(r[0]),Math.fround(r[1]),Math.fround(r[2]),Math.fround(r[3]),Math.fround(r[4]),Math.fround(r[5]),color);}
 for(let i=0;i<mesh.count;i++){const m=mesh.instanceMatrix.array.slice(i*16,i*16+16),cc=Array.from(mesh.instanceColor!.array.slice(i*3,i*3+3));for(const k of[1,2,4,6,8,9])expect(Math.abs(m[k])).toBe(0);add(actual,m[12],m[13],m[14],m[0],m[5],m[10],cc);}
 expect(actual.size).toBe(expected.size);for(const[k,v]of expected)expect(actual.get(k)).toBe(v);
}
