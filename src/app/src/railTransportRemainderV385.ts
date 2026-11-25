import { Color, InstancedBufferAttribute, InstancedMesh } from "three";
import navigation from "./data/railSseNavigationV307.json";
import ring from "./data/transportV378Ring.json";
import { railSseGroundOffsetV307 } from "./railSseNavigationV307";
import type { NorthernSolidV309 } from "./NorthernNavigationV309";
import { copyMinecraftMaterialPresentation, minecraftOriginalMaterialFor } from "./visual-modes/minecraft/materialMode";
import { schwellenraumMaterialFor } from "./visual-modes/schwellenraum/materialGrade";

const tactile = new Color(0xd9d6c4).toArray().map(Math.fround);
const stations = ring.stations.filter(s => s.name === "Gesundbrunnen" || s.name === "Landsberger Allee");
type Block = { ring?: number[][]; key: string; native: boolean; high?: number };
function carsAt(station: typeof stations[number], native: boolean) {
  return station.vehicles.flatMap(v => v.cars.map(([x1,z1,x2,z2]) => {
    const x = (x1+x2)/2, z = (z1+z2)/2;
    return { x1,z1,x2,z2,x,z,width:v.width,base:v.grade-.96,
      rise:railSseGroundOffsetV307(x,z,native) };
  }));
}

export function railTransportCarSolidsV385(native:boolean): NorthernSolidV309[] {
  return stations.flatMap(station => carsAt(station,native).map(car => {
    const len = Math.hypot(car.x2-car.x1,car.z2-car.z1);
    const dx = -(car.z2-car.z1)*car.width/(2*len), dz = (car.x2-car.x1)*car.width/(2*len);
    return {ring:[[car.x1+dx,car.z1+dz],[car.x2+dx,car.z2+dz],[car.x2-dx,car.z2-dz],[car.x1-dx,car.z1-dz]],
      minY:car.base+car.rise+.28,maxY:car.base+car.rise+(native?3.75:3.76)};
  }));
}

function interiorGrid(lo:number,hi:number) {
  const values:number[] = [];
  for (let v=4*(Math.floor(lo/4)+1); v<hi; v+=4) values.push(v);
  return values;
}

type Emit = (m:number[]) => void;

/** Subdivide the measured strip at the 4 m field triangles. A shear preserves
 * the vertical cross-section as the flat strip follows the platform plane. */
function drawnStrip(m:number[], emit:Emit) {
  const x=m[12], z=m[14], dx=m[0], dz=m[2];
  const joints=new Set<number>([-.5,.5]);
  for(const [centre,span] of [[x,dx],[z,dz],[x-z,dx-dz]]) {
    if(!span) continue;
    for(const boundary of interiorGrid(centre-Math.abs(span)/2,centre+Math.abs(span)/2))
      joints.add((boundary-centre)/span);
  }
  const cuts=Array.from(joints).sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++) {
    const a=cuts[i-1],b=cuts[i], t=(a+b)/2;
    if(b-a<.000001)continue;
    const row=m.slice();
    row[0]=dx*(b-a); row[2]=dz*(b-a);
    row[12]=x+dx*t; row[14]=z+dz*t;
    const first=railSseGroundOffsetV307(x+dx*a,z+dz*a,false);
    const last=railSseGroundOffsetV307(x+dx*b,z+dz*b,false);
    row[1]=last-first; row[13]+=(first+last)/2;
    row[9]=railSseGroundOffsetV307(row[12]+m[8]/2,row[14]+m[10]/2,false)
      -railSseGroundOffsetV307(row[12]-m[8]/2,row[14]-m[10]/2,false);
    emit(row);
  }
}

type Platform = { x1:number; z1:number; x2:number; z2:number; top:number };

/** The native platforms are the actual compiled 1.5 m source runs. Their top
 * can differ from the DTM sampled by an adjacent block in the track bed. */
function nativeStrip(m:number[], platforms:Platform[], base:number, emit:Emit) {
  const x1=m[12]-m[0]/2, x2=m[12]+m[0]/2, z1=m[14]-m[10]/2, z2=m[14]+m[10]/2;
  const nearby=platforms.filter(p=>p.x1<x2 && p.x2>x1 && p.z1<z2 && p.z2>z1);
  const cuts=(lo:number,hi:number,pairs:number[])=>[...new Set([lo,...interiorGrid(lo,hi),
    ...pairs.filter(v=>v>lo && v<hi),hi])].sort((a,b)=>a-b);
  const xs=cuts(x1,x2,nearby.flatMap(p=>[p.x1,p.x2]));
  const zs=cuts(z1,z2,nearby.flatMap(p=>[p.z1,p.z2]));
  for(let j=1; j<zs.length;j++) for(let i=1;i<xs.length;i++) {
    const row=m.slice(),x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2;
    const over=nearby.find(p=>p.x1<=x && x<=p.x2 && p.z1<=z && z<=p.z2);
    const ground=railSseGroundOffsetV307(x,z,true);
    // A raster cell can straddle the surveyed platform boundary. Its outside
    // retains the same architectural lift as the graded original accent.
    row[0]=xs[i]-xs[i-1]; row[10]=zs[j]-zs[j-1]; row[12]=x; row[14]=z;
    row[13]+=over?Math.max(over.top-base,3+ground-base):ground;
    emit(row);
  }
}

/** A sibling of the single authenticated station batch. The station owns all
 * materials and cube geometry; the remainder owns only its instance buffers. */
export function createRailTransportRemainderV385(child:InstancedMesh, stationName:string,
  native:boolean, start:number):InstancedMesh {
  const station=stations.find(s=>s.name===stationName);
  const paint=child.instanceColor;
  if(!station || !paint || !Number.isInteger(start) || start<0 || start>=child.count)
    throw Error("Missing surveyed station transport span");
  const cars=carsAt(station,native);
  const platforms:Platform[]=[];
  if(native) for(const p of navigation.records as Block[]) {
    if(!p.native || !p.key.startsWith(stationName+"-native-platform-") || !p.ring || p.high===undefined) continue;
    platforms.push({x1:p.ring[0][0],z1:p.ring[0][1],x2:p.ring[2][0],z2:p.ring[2][1],top:p.high});
  }
  const matrices:number[]=[],colours:number[]=[];
  for(let i=start;i<child.count;i++) {
    const m=Array.from(child.instanceMatrix.array.subarray(16*i,16*i+16));
    const rgb=paint.array.subarray(3*i,3*i+3);
    const emit=(row:number[])=>{matrices.push(...row);colours.push(...rgb);};
    if(tactile.every((v,k)=>v===rgb[k])) {
      if(native)nativeStrip(m,platforms,station.tactile[0].grade,emit);
      else drawnStrip(m,emit);
    } else {
      // Livery, panes and underframe all use one rigid transform per car.
      const nearest=cars.reduce((a,b)=>Math.hypot(a.x-m[12],a.z-m[14])<Math.hypot(b.x-m[12],b.z-m[14])?a:b);
      m[13]+=nearest.rise;emit(m);
    }
  }
  const sourceMaterial=minecraftOriginalMaterialFor(child)??child.material;
  const mesh=new InstancedMesh(child.geometry,sourceMaterial,0);
  mesh.instanceMatrix=new InstancedBufferAttribute(new Float32Array(matrices),16);
  mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(colours),3);
  mesh.count=colours.length/3;
  mesh.name=stationName+" · Ringbahn-Leitstreifen"+(cars.length?" und Fahrzeuge":"");
  const day=child.userData.dayMaterial;
  mesh.userData={textureFree:true, nativeMinecraft:native,blockNative:native,keepInMinecraft:native,
    dayMaterial:day,nightMaterial:child.userData.nightMaterial,
    schwellenraumMaterial:schwellenraumMaterialFor(child,day)};
  mesh.position.copy(child.position);mesh.quaternion.copy(child.quaternion);mesh.scale.copy(child.scale);
  mesh.matrix.copy(child.matrix);mesh.matrixAutoUpdate=child.matrixAutoUpdate;
  mesh.matrixWorldAutoUpdate=child.matrixWorldAutoUpdate;mesh.renderOrder=child.renderOrder;
  mesh.layers.mask=child.layers.mask;mesh.castShadow=child.castShadow;mesh.receiveShadow=child.receiveShadow;
  mesh.computeBoundingBox();mesh.computeBoundingSphere();
  if(minecraftOriginalMaterialFor(child))copyMinecraftMaterialPresentation(child,mesh);
  return mesh;
}
