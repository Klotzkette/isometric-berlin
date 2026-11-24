import { expect,test } from "bun:test";
import { Box3, Color, Group, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { attachWittenbergQuartierV383 } from "../src/WittenbergQuartierV383";
import { wittenbergQuartierHostsV383, wittenbergQuartierOpeningHostV383, wittenbergQuartierViewsV383 } from "../src/wittenbergQuartierIndexV383";
import { CityWestFrontBatchV379, hasCityWestFrontV379 } from "../src/cityWestFrontsV379";
import originalFronts from "../src/data/cityWestFrontsV379.json";
import additionalFronts from "../src/data/wittenbergFrontsV383.json";
import type { SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";

test("The western elevations bind to additional retained building shells",()=>{
  const drawn=new CityWestFrontBatchV379(),native=new CityWestFrontBatchV379();
  const keys=Object.keys(additionalFronts);
  expect(keys.length).toBe(30);
  for(const [id,faces] of Object.entries(additionalFronts)) {
    expect(hasCityWestFrontV379(id)).toBe(true);
    expect(Object.hasOwn(originalFronts,id)).toBe(false);
    for(const face of faces) {
      const [x1,z1,x2,z2,y,height]=face as number[];
      drawn.addDrawn(id,y,y+height);
      const dx=x2-x1,dz=z2-z1, n=Math.ceil(Math.hypot(dx,dz)/1.5);
      for(let i=0;i<n;i++) {
        const f=(i+.5)/n,x=x1+f*dx,z=z1+f*dz;
        if(Math.abs(dx)>=Math.abs(dz)) native.addNative(id,x,z,0,-Math.sign(dx),2,y,y+height);
        else native.addNative(id,x,z,Math.sign(dz),0,2,y,y+height);
      }
    }
  }
  for(const [batch,mode] of [[drawn,false],[native,true]] as const)
    expect(new Set(batch.mesh(mode)?.userData.cityWestFrontOwnersV379)).toEqual(new Set(keys));
});

for(const native of [false,true]) test("Regional Wittenberg surface, fountains and trees "+(native?"native":"drawn"),async()=>{
  const signal=new AbortController().signal, placed=new Set<string>();
  let trees=0;
  for(const {id} of wittenbergQuartierHostsV383) {
    const entry:SurroundingChunkGeometry={root:new Group(),origin:[0,0,0],geometryBytes:0,bufferCount:0,
      nav:{ground:[],water:[],buildings:[],groundY:5.2}};
    await Promise.all([attachWittenbergQuartierV383(entry,id,native,signal),attachWittenbergQuartierV383(entry,id,native,signal)]);
    expect(entry.root.children.length).toBe(1);
    expect(entry.geometryBytes).toBeGreaterThan(0);
    const station=entry.root.getObjectByName("Bahnhof Wittenbergplatz · Vorplätze, Oberlichter und Portale");
    expect(Boolean(station)).toBe(id==="wit383--4_3");
    if(station instanceof Mesh) {
      entry.root.updateMatrixWorld(true);
      const surface=entry.root.getObjectByName("Vermessene Gehwege und Bordsteine · -4_3") as Mesh;
      const streetHit=(x:number,z:number)=>new Raycaster(new Vector3(x,32,z),new Vector3(0,-1,0))
        .intersectObject(surface)[0];
      const swatch=(x:number,z:number)=>{
        const face=streetHit(x,z)!.face!;
        const paint=surface.geometry.getAttribute("color");
        return [paint.getX(face.a),paint.getY(face.a),paint.getZ(face.a)].map(q=>Math.round(q*255));
      };
      const bytes=(hex:number)=>new Color(hex).toArray().map(q=>Math.round(q*255));
      // Formerly exposed orange and pale terrain cells in the northern and southern loops.
      for(const [x,z] of [[-1934.24,1837.28],[-1930.76,1844.87],[-1968.95,1824.91],
        [-1960.44,1888.34],[-1955.64,1889.28],[-2018.73,1810.89],[-2035.68,1843.49],
        [-1924.12,1885.70],[-1913.26,1860.52]]) {
        expect(streetHit(x,z)?.point.y).toBeCloseTo(5.63,2);
        expect(swatch(x,z)).toEqual(bytes(0x696b6a));
      }
      for(const [x,z] of [[-1955.83,1827.24],[-1955.82,1825.25],[-1948.22,1829.16],[-1943.38,1830.7]]){
        expect(streetHit(x,z)?.point.y).toBeCloseTo(5.63,2);
        expect(swatch(x,z)).toEqual(bytes(0xb0aea6));
      }
      for(const [x,z] of [[-1946.286,1888.425],[-2002.399,1817.85]]){
        expect(streetHit(x,z)?.point.y).toBeCloseTo(5.65,2);
        expect(swatch(x,z)).toEqual(bytes(0xd7d3c4));
      }
      expect(streetHit(-2038.20,1836.97)?.point.y).toBeCloseTo(5.76,2);
      expect(streetHit(-2022.31,1839.78)?.point.y).toBeCloseTo(5.74,2);
      const cast=(d:number,u:number)=>{
        const x=-1974.806+d*Math.sin(1.218)+u*Math.cos(1.218);
        const z=1854.717+d*Math.cos(1.218)-u*Math.sin(1.218);
        return new Raycaster(new Vector3(x,32,z),new Vector3(0,-1,0)).intersectObject(station);
      };
      for(const [d,u] of [[-43.7,.35],[28.0,1.8],[44.0,8.3]])expect(cast(d,u)[0]?.point.y).toBeCloseTo(5.79,2);
      for(const [d,u] of [[25,12],[26,-12],[-18,13]])expect(cast(d,u).length).toBe(0);
      for(const u of [-13,13])expect(cast(-2.0,u)[0]?.point.y).toBeGreaterThan(12);
    }
    entry.root.traverse(obj=>{
      if(obj.userData.surveyedTreeCount) trees+=obj.userData.surveyedTreeCount;
      if(Object.hasOwn(wittenbergQuartierViewsV383,obj.name)) {
        expect(placed.has(obj.name)).toBe(false);placed.add(obj.name);
        const bounds=new Box3().setFromObject(obj);
        expect(bounds.max.y-bounds.min.y).toBeGreaterThan(3);
        expect(wittenbergQuartierOpeningHostV383(obj.name)).toBe(id);
        if(native) {
          let cardinal=true;
          const mat=new Matrix4();
          obj.traverse(part=>{
            if(!(part instanceof InstancedMesh))return;
            for(let i=0;i<part.count;i++){
              part.getMatrixAt(i,mat);
              for(const col of [0,4,8]) if(mat.elements.slice(col,col+3).filter(v=>Math.abs(v)>1e-6).length!==1)cardinal=false;
            }
          });
          expect(cardinal).toBe(true);
        }
      }
    });
  }
  expect(trees).toBe(71);
  expect(placed.size).toBe(2);
});
