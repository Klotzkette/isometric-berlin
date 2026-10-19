import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Box3, BufferGeometry, InstancedMesh, Matrix4, Mesh } from "three";
import { createBebelplatzFacades, createMinecraftBebelplatzFacades } from "../src/BebelplatzFacades";
import { createBebelplatzBuildingShells, createMinecraftBebelplatzBuildingShells, appendVoxelEnvelope, type SourceEnvelopeBlock } from "../src/BebelplatzBuildingShells";
import { HOTEL_DE_ROME_V240 as P } from "../src/HotelDeRomeV240";
import { BEBELPLATZ_CIVIC_SOURCES } from "../src/bebelplatzBuildingProfile";
import source from "../src/bebelplatzBuildingSource.json";
import receipt from "../../../geo_data/regierungsviertel/hotel-de-rome-v240-evidence.json";
import type { VoxelPayload } from "../src/terrainPayload";
const ground=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/ground-context.json',import.meta.url),'utf8')) as VoxelPayload;
const hash=(data:string|Buffer):string=>createHash('sha256').update(data).digest('hex');

describe('Hotel de Rome v240 source and neighbouring-model preservation',()=>{
  test('preserves every HU/library drawn/native instance matrix and colour',()=>{
    for(const [name,fn] of [['drawn',createBebelplatzFacades],['native',createMinecraftBebelplatzFacades]] as const){
      const retained:unknown[]=[];let hotel=0;
      for(const child of fn(ground).children){const m=child as InstancedMesh;
        for(let i=0;i<m.count;i++){
          const matrix=Array.from(m.instanceMatrix.array.slice(i*16,i*16+16));
          const color=Array.from(m.instanceColor!.array.slice(i*3,i*3+3));
          if(matrix[14]<360)retained.push([m.geometry.type,matrix,color]);else hotel++;
        }
      }
      expect(retained.length).toBe(receipt.beforeRuntime[name].retainedCount);
      expect(hash(JSON.stringify(retained))).toBe(receipt.beforeRuntime[name].retainedSha256);
      expect(hotel).toBeGreaterThan(1200);expect(hotel).toBeLessThan(1400);
    }
  });
  test('preserves actual HU/library native source-shell matrices and colours',()=>{
    const retained:unknown[]=[];
    for(const child of createMinecraftBebelplatzBuildingShells().children){
      const m=child as InstancedMesh;
      for(let i=0;i<m.count;i++){
        const matrix=Array.from(m.instanceMatrix.array.slice(i*16,i*16+16));
        const color=Array.from(m.instanceColor!.array.slice(i*3,i*3+3));
        if(matrix[14]<360)retained.push([m.geometry.type,matrix,color]);
      }
    }
    expect(retained.length).toBe(receipt.nativeNeighbourShells.retainedCount);
    expect(hash(JSON.stringify(retained))).toBe(receipt.nativeNeighbourShells.retainedSha256);
  });
  test('retains all measured source positions/normals and both neighbour shell colours',()=>{
    const root=createBebelplatzBuildingShells();
    root.children.forEach((o,i)=>{const m=o as Mesh<BufferGeometry>;
      const attributes=['position','normal',...(i<2?['color']:[])];
      for(const key of attributes){
        const array=m.geometry.attributes[key].array;
        const expected=receipt.beforeRuntime.shells[i][`${key}Sha256` as 'positionSha256'|'normalSha256'|'colorSha256'];
        expect(hash(Buffer.from(array.buffer,array.byteOffset,array.byteLength))).toBe(expected);
      }
    });
    const hotel=source.profiles.hotelDeRome;
    expect(hotel.parent_id).toBe(P.parent);expect(hotel.parts.length).toBe(10);
    expect(hotel.parts.reduce((n,p)=>n+p.surfaces.length,0)).toBe(103);
    expect(new Box3().setFromObject(root.children[2]).max.y).toBeCloseTo(34.166,3);
  });
  test('fits the revised order below its measured front top, retaining exact projected axis',()=>{
    const front=source.profiles.hotelDeRome.parts.find(p=>p.id==='DEBE3DnOENcW0iq2')!;
    expect(front.ring).toContainEqual(P.axes[1].start);expect(front.ring).toContainEqual(P.axes[1].end);
    expect(P.columnTop).toBeLessThan(front.top_y_m);expect(P.balustradeTop).toBeLessThan(P.measuredStreetEave);
    expect(P.columnTop-P.columnBottom).toBeGreaterThan(10);
    expect(P.columnCount).toBe(6);expect(P.axes.map(a=>a.bays)).toEqual([2,5,2]);
  });
  test('clips only protruding native hotel wall cells while retaining every roof block',()=>{
    const old:SourceEnvelopeBlock[]=[],current:SourceEnvelopeBlock[]=[];
    for(const part of BEBELPLATZ_CIVIC_SOURCES[2].parts){
      appendVoxelEnvelope(part,{wall:P.wallTone,roof:P.roofTone,name:'unclipped prior Hotel'},old);
      appendVoxelEnvelope(part,{wall:P.wallTone,roof:P.roofTone,name:'Hotel de Rome'},current);
    }
    expect(current.filter(b=>b.color===P.roofTone)).toEqual(old.filter(b=>b.color===P.roofTone));
    expect(current.length).toBeLessThanOrEqual(old.length);
    expect(current.length).toBeGreaterThan(old.length*.90);
    for(const block of current.filter(b=>b.color===P.wallTone)){
      const [x,,z]=block.position,[w,,d]=block.size;
      if(x<1508||x>1546.447||z-d/2>375)continue;
      for(const a of P.axes){
        const lo=Math.max(x-w/2,a.start[0]),hi=Math.min(x+w/2,a.end[0]);
        if(lo>hi)continue;
        for(const px of [lo,hi]){
          const front=a.start[1]+(px-a.start[0])*(a.end[1]-a.start[1])/(a.end[0]-a.start[0]);
          expect(z-d/2).toBeGreaterThanOrEqual(front-1e-9);
        }
      }
    }
  });
  test('keeps every native hotel instance orthogonal and bounded on the street face',()=>{
    const root=createMinecraftBebelplatzFacades(ground),m=root.children[0] as InstancedMesh,matrix=new Matrix4();
    expect(root.children.length).toBe(1);expect(m.geometry.type).toBe('BoxGeometry');
    for(let i=0;i<m.count;i++){
      m.getMatrixAt(i,matrix);const e=matrix.elements;if(e[14]<360)continue;
      for(const j of [1,2,4,6,8,9])expect(e[j]).toBe(0);
      expect(e[12]).toBeGreaterThan(1507);expect(e[12]).toBeLessThan(1547);
      expect(e[14]).toBeGreaterThan(367);expect(e[14]).toBeLessThan(375);
      expect(e[13]+e[5]/2).toBeLessThan(24.4);expect(e[13]-e[5]/2).toBeGreaterThan(5.0);
    }
  });
});
