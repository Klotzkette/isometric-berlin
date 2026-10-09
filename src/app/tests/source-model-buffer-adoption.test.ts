import { createHash } from 'node:crypto';
import { expect, test } from 'bun:test';
import * as tu from '../src/TuWaterV168.ts';
import * as cinema from '../src/CityWestCinemasV166.ts';
import * as synagogue from '../src/NeueSynagogeV167.ts';
import * as zoo from '../src/ZooStationV165.ts';
import { createZooEntranceDetailsV192 } from '../src/StationDetailsV192.ts';
// Exact v1.0.71 geometry, instance, transform, draw-range and visibility digest.
const PUBLISHED = [
  {
    "name": "tu",
    "calls": 2,
    "bytes": 4089800,
    "hash": "ce68ab67ad5e1919847f2a271169d8e3722d6aeaa42d0c037387597ae53fab1d"
  },
  {
    "name": "tu-mobile",
    "calls": 2,
    "bytes": 4089800,
    "hash": "ce68ab67ad5e1919847f2a271169d8e3722d6aeaa42d0c037387597ae53fab1d"
  },
  {
    "name": "tu-native",
    "calls": 2,
    "bytes": 4861420,
    "hash": "8ea571ca57dc9201598a2e32e7705815ecef8440026ac8c724182a8bfff3d77c"
  },
  {
    "name": "cinema",
    "calls": 3,
    "bytes": 1514568,
    "hash": "7ddcd304ad0d0c6df904748d81d0d0cad15fbe18ba4f5244da3951210278e812"
  },
  {
    "name": "cinema-mobile",
    "calls": 3,
    "bytes": 1514568,
    "hash": "7ddcd304ad0d0c6df904748d81d0d0cad15fbe18ba4f5244da3951210278e812"
  },
  {
    "name": "cinema-native",
    "calls": 1,
    "bytes": 1806560,
    "hash": "975cf6f92e4c097b9caac717564e99966696b2bce35a4e621045b19dd3ad1531"
  },
  {
    "name": "synagogue",
    "calls": 3,
    "bytes": 1613524,
    "hash": "acf9181556e2b79c821868adca5122642371605ea61007fbebc551c8c7b5229d"
  },
  {
    "name": "synagogue-mobile",
    "calls": 3,
    "bytes": 1613524,
    "hash": "acf9181556e2b79c821868adca5122642371605ea61007fbebc551c8c7b5229d"
  },
  {
    "name": "synagogue-native",
    "calls": 1,
    "bytes": 1272204,
    "hash": "9d437f7fb8244f96fe34df88b10a2134fa3dc40b2c14661e423cd632e2d0ee88"
  },
  {
    "name": "zoo",
    "calls": 3,
    "bytes": 900296,
    "hash": "9dc51af6ef378ccf9704bfad97ef4b9f8620b0033376e35a245bda665504deb1"
  },
  {
    "name": "zoo-mobile",
    "calls": 3,
    "bytes": 900296,
    "hash": "9dc51af6ef378ccf9704bfad97ef4b9f8620b0033376e35a245bda665504deb1"
  },
  {
    "name": "zoo-native",
    "calls": 2,
    "bytes": 5073080,
    "hash": "db4df8e7f2fe4dfb248ec2627ff42e19ecf06272e90b17726318c705494308f1"
  }
];
for (const [name,factory,options] of [
 ['tu',tu.createTuWaterV168,{}], ['tu-mobile',tu.createTuWaterV168,{mobileLike:true}],['tu-native',tu.createMinecraftTuWaterV168,{}],
 ['cinema',cinema.createCityWestCinemasV166,{}],['cinema-mobile',cinema.createCityWestCinemasV166,{mobileLike:true}],['cinema-native',cinema.createMinecraftCityWestCinemasV166,{}],
 ['synagogue',synagogue.createNeueSynagogeV167,{}],['synagogue-mobile',synagogue.createNeueSynagogeV167,{mobileLike:true}],['synagogue-native',synagogue.createMinecraftNeueSynagogeV167,{}],
 ['zoo',zoo.createZooStationV165,{}],['zoo-mobile',zoo.createZooStationV165,{detailProfile:'mobile'}],['zoo-native',zoo.createMinecraftZooStationV165,{}],
] as const) {
 test(`published ${name} attributes survive buffer adoption byte for byte`, () => {
 const root=factory(options as any);
 // The mapped U-entrance was added in v192. Verify it independently, then
 // compare every pre-existing station buffer to the immutable v171 digest.
 const additions = name.startsWith('zoo')
   ? root.children.filter(o => o.name === 'Hardenbergplatz mapped U entrance O v192') : [];
 if (name.startsWith('zoo')) {
   expect(additions).toHaveLength(1);
   const reference = createZooEntranceDetailsV192(name.endsWith('-native'));
   expect(digest(additions[0])).toEqual(digest(reference));
   reference.traverse((o:any)=>{o.geometry?.dispose();for(const m of new Set([o.material,o.userData.dayMaterial,o.userData.nightMaterial]))if(m&&!Array.isArray(m))m.dispose();});
 }
 const omitted = new Set<any>();
 for (const addition of additions) addition.traverse(o=>omitted.add(o));
 expect({name,...digest(root, omitted)}).toEqual(PUBLISHED.find(row=>row.name===name));
 root.traverse((o:any)=>{if(o.geometry)o.geometry.dispose();for(const m of new Set([o.material,o.userData.dayMaterial,o.userData.nightMaterial]))if(m&&!Array.isArray(m))m.dispose();});
 });
}

function digest(root:any, omitted = new Set<any>()) {
 const hash=createHash('sha256');let bytes=0,calls=0;
 root.traverse((o:any)=>{
  if(!o.geometry || omitted.has(o))return;calls++;
  hash.update(JSON.stringify({name:o.name,drawRange:o.geometry.drawRange,groups:o.geometry.groups,matrix:o.matrix.toArray(),visible:o.visible}));
  for(const [attribute,a] of Object.entries({...o.geometry.attributes,index:o.geometry.index,instanceMatrix:o.instanceMatrix,instanceColor:o.instanceColor}) as any){
   if(!a)continue;
   hash.update(JSON.stringify({attribute,itemSize:a.itemSize,normalized:a.normalized,type:a.array.constructor.name}));
   const data=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);hash.update(data);bytes+=data.byteLength;
  }
 });
 return {calls,bytes,hash:hash.digest('hex')};
}
