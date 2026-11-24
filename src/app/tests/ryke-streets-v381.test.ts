import {expect,test} from "bun:test";
import {createHash} from "node:crypto";
import {readFileSync,statSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {Group,InstancedMesh,Mesh,Raycaster,Vector3} from "three";
import {createPrenzlauerStreetsV380,type PrenzlauerStreetPacketV380} from "../src/prenzlauerStreetsV380";
import {attachRykeStreetsV381,createRykeStreetsV381} from "../src/rykeStreetsV381";
import {rykeStreetsHostsV381,rykeStreetsOpeningHostV381,rykeStreetsViewsV381} from "../src/rykeStreetsIndexV381";
import type {SurroundingChunkGeometry} from "../src/SurroundingCityGeometry";

const hosts=rykeStreetsHostsV381;
function path(id:string) {return new URL("../src/data/rykeStreetsV381/"+id.slice("ryke381-".length)+".json",import.meta.url);}
function read(id:string):PrenzlauerStreetPacketV380 {return JSON.parse(readFileSync(path(id),"utf8"));}

test("six local packets retain 583 municipal trunks, including all 57 along Rykestraße",()=>{
  const source=JSON.parse(gunzipSync(readFileSync(new URL("../../../geo_data/regierungsviertel/ryke-streets-v381-source.json.gz",import.meta.url))).toString());
  const places=new Set<string>(), trunks=new Set<string>(); let bytes=0;
  for(const {id} of hosts){
    const data=read(id);
    bytes+=statSync(path(id)).size;
    data.trees.forEach(([x,z,,h,w,girth,,index])=>{
      const [sourceId,street,,sourceH,sourceW,sourceGirth,x0,z0]=source.trees[index];
      expect([x,z,h,w,girth]).toEqual([x0,z0,sourceH,sourceW,sourceGirth]);
      expect(trunks.has(sourceId)).toBe(false);
      trunks.add(sourceId);
      if(street==="Rykestraße") places.add(sourceId);
    });
  }
  expect(hosts.length).toBe(6);expect(trunks.size).toBe(583);expect(places.size).toBe(57);
  expect(bytes).toBeLessThan(625000);
  expect(rykeStreetsOpeningHostV381("Hermannplatz")).toBeUndefined();
  for(const [name,{target}] of Object.entries(rykeStreetsViewsV381)){
    const row=hosts.find(h=>h.id===rykeStreetsOpeningHostV381(name))!;
    expect(target[0]).toBeGreaterThan(row.bounds[0]);expect(target[2]).toBeLessThan(row.bounds[3]);
  }
});

test("street ground covers the full Rykestraße and Knaack junction; park interiors have their own ground",()=>{
  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  for(const native of [false,true]){
    const surfaces=hosts.map(h=>createRykeStreetsV381(read(h.id),native).children[0] as Mesh);
    const hit=(x:number,z:number)=>{
      ray.ray.origin.set(x,12,z);
      return ray.intersectObjects(surfaces,false);
    };
    for(const [x,z] of [[3272.95,-1689.21],[3298,-1736],[3321,-1776],[3352.49,-1837.6],
      [3444.55,-2014.23],[3527,-2178],[3131.28,-1765.32],[3059.13,-1897.07],[3208.46,-1699.3],[3310.8,-1623.13]]){
      expect(hit(x,z).length).toBeGreaterThan(0);
    }
    for(const [x,z] of [[3135.82,-1839],[3195.17,-1574.46],[3138.63,-1862.15],[3191.59,-1565.94]]){
      expect(hit(x,z)).toHaveLength(0);
    }
    // Three low granite kerbs from the original survey in Rykestraße.
    for(const [x,z] of [[3316.34,-1783.37],[3409.78,-1938.79],[3424.52,-1967.18]]){
      const value=hit(x,z)[0];expect(value).toBeDefined();
      expect(Math.abs(value.point.y-3.321)).toBeLessThan(.025);
    }
  }
});

function instanceDigest(group:Group){
  const sums=new Map<string,ReturnType<typeof createHash>>();
  for(const mesh of group.children){
    if(!(mesh instanceof InstancedMesh))continue;
    for(const [name,attribute] of [["matrix",mesh.instanceMatrix],["colour",mesh.instanceColor]] as const){
      const key=mesh.name+" "+name, sum=sums.get(key)??createHash("sha256");
      const a=attribute!.array;
      sum.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));sums.set(key,sum);
    }
  }
  return [...sums].map(([key,sum])=>[key,sum.digest("hex")]);
}

test("128 m frustum groups preserve every original transform and colour in both tree styles",()=>{
  const data=read("ryke381-6_-4");
  for(const native of [false,true]){
    const original=createPrenzlauerStreetsV380(data,native),partitioned=createRykeStreetsV381(data,native);
    expect(instanceDigest(partitioned)).toEqual(instanceDigest(original));
    expect(partitioned.children.length).toBeGreaterThan(original.children.length);
    const trunks=partitioned.children.filter(c=>c instanceof InstancedMesh && c.name==="Katasterstämme und Äste") as InstancedMesh[];
    expect(new Set(trunks.map(m=>m.instanceMatrix.array.buffer)).size).toBe(1);
    expect(new Set(trunks.map(m=>m.geometry)).size).toBe(1);
    expect(trunks.every(m=>m.boundingSphere && m.boundingSphere.radius<150)).toBe(true);
  }
});

test("a cancelled stream publishes no geometry and a later successful load accounts for its buffers",async()=>{
  const entry={origin:[3072,0,-2048],root:new Group(),geometryBytes:0,bufferCount:0} as SurroundingChunkGeometry;
  await expect(attachRykeStreetsV381(entry,"ryke381-6_-4",false,AbortSignal.abort())).rejects.toThrow();
  expect(entry.root.children).toHaveLength(0);
  await attachRykeStreetsV381(entry,"ryke381-6_-4",false);
  expect(entry.root.children).toHaveLength(1);
  expect(entry.geometryBytes).toBeGreaterThan(500000);expect(entry.bufferCount).toBeGreaterThan(4);
});
