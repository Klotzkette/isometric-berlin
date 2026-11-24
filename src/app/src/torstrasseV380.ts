import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Vector3,
} from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";

type Shelter = [string, number, number, number, number, number, number, number];
type Signal = [string, number, number, number, number, number, number, boolean];
export type TorstrassePacketV380 = {
  origin: [number, number]; vertices: number; faces: number;
  position: string; style: string; index: string; shelters: Shelter[]; signals: Signal[];
};

// Indexed in the survey material order retained by build_torstrasse_v380.py.
// The final pair are the rail groove and its narrower steel running face.
const finishes: [number, number][] = [
  [0x555453, 0], [0xb2aaa0, 0], [0xb3aa9d,.052], [0xa59d90,.098], [0x948e87,.18],
  [0xb4ab9f,.21], [0xbfbaae,.35], [0xc9c3b7,.72], [0xcec7b9,.94], [0x776653,0],
  [0x7e9066,0], [0xa69980,0], [0xa78070,.21], [0x77716c,.55],
  [0xb9b2a5,.37], [0xd5d1bd,.09], [0xa9a393,.11], [0xc0bcb3,0],
  [0xb1aea5,0], [0xd9d6c8,0], [0x383b3a,0], [0xb4b7b2,0],
];
const linear = finishes.map(([rgb]) => {
  const c = new Color(rgb);
  return [c.r,c.g,c.b].map(v => Math.round(v * 255));
});

function bytes(field: string, length: number) {
  const value = gunzipSync(decodeBase64Bytes(field));
  if (value.length !== length) throw Error("Unvollständige Torstraßen-Geometrie");
  return value;
}

function unpack(field: string, length: number) {
  const plane = bytes(field, length*2);
  const words = new Uint16Array(length);
  let last = 0;
  for (let i=0; i<length; i++) {
    last = (last + plane[i] + (plane[length+i] << 8)) & 65535;
    words[i] = last;
  }
  return words;
}

function paving(native: boolean, night: boolean) {
  const material = night ? new MeshStandardMaterial({vertexColors:true,roughness:.96})
    : new MeshBasicMaterial({vertexColors:true});
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>",
      "#include <common>\nattribute float jointSize; varying vec2 stoneUV; varying float stoneSize;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        stoneSize = jointSize*.01;
        // Main paving courses run parallel to the Torstraße on each side of
        // the bend. The geometrical borders themselves are from the survey.
        float wx = (modelMatrix * vec4(position,1.0)).x;
        float angle = mix(-.315,-.07,smoothstep(1700.,1880.,wx));
        angle = mix(angle,.315,smoothstep(2160.,2310.,wx));
        angle = mix(angle,.45,smoothstep(2690.,2840.,wx));
        float c=cos(angle), s=sin(angle);
        stoneUV=mat2(c,-s,s,c)*(modelMatrix*vec4(position,1.)).xz/max(stoneSize,.04);
      `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>",
      "#include <common>\nvarying vec2 stoneUV; varying float stoneSize;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec2 course=stoneUV;
        vec2 pixel=fwidth(course);
        course.x+=.5*mod(floor(course.y),2.);
        vec2 edge=.5-abs(fract(course)-.5);
        vec2 seam=1.-smoothstep(vec2(.018),vec2(.04)+pixel*.54,edge);
        float fade=1.-smoothstep(.20,.82,max(pixel.x,pixel.y));
        diffuseColor.rgb*=1.-step(.01,stoneSize)*max(seam.x,seam.y)*fade*${native ? ".15" : ".21"};
      `);
  };
  material.customProgramCacheKey = () => native ? "tor380-block" : "tor380-drawn";
  return material;
}

function addStreetFurniture(part: Group, sites: Shelter[], signals: Signal[], native: boolean) {
  const rows: number[][] = [];
  for (const [,x,z,drawnY,nativeY,length,depth,angle] of sites) {
    const base = native ? nativeY : drawnY;
    const c=Math.cos(angle), s=Math.sin(angle);
    const add=(u:number,v:number,y:number,w:number,d:number,h:number,color:number) =>
      rows.push([x+c*u-s*v,base+y,z+s*u+c*v,w,h,d,angle,color]);
    // Measured OSM perimeter, open long sides, narrow steel supports and a
    // shaded bench. The fittings' vertical dimensions are representative.
    add(0,0,2.56,length,depth,.115,0x82928e);
    for (const v of [-1,1]) add(0,v*(depth/2-.045),2.515,length,.09,.16,0x565a59);
    const bays=Math.max(1,Math.round(length/3));
    for (let i=0;i<=bays;i++) {
      const u=(i/bays-.5)*(length-.45);
      for (const v of [-1,1]) add(u,v*(depth/2-.18),1.25,.095,.095,2.5,0x656d69);
    }
    add(0,-depth*.20,.49,length*.67,.39,.11,0x9d8670);
    for (const side of [-1,1]) add(side*length*.22,-depth*.20,.24,.09,.31,.48,0x666a66);
  }
  for (const [,x,z,drawnY,nativeY,height,angle,button] of signals) {
    const y=native ? nativeY : drawnY, c=Math.cos(angle), s=Math.sin(angle);
    const add=(out:number,up:number,w:number,h:number,d:number,tone:number) =>
      rows.push([x+c*out,y+up,z+s*out,w,h,d,angle,tone]);
    add(0,height/2,.115,height,.115,0x838984);
    add(.135,height-.44,.19,.64,.29,0x373d39);
    for (const dy of [-.14,.11]) {
      add(.25,height-.44+dy,.045,.15,.16,0x585c50);
      add(.30,height-.34+dy,.16,.03,.19,0x313835);
    }
    if (button) add(.10,1.01,.15,.21,.13,0xb39042);
  }
  if (!rows.length) return;
  const day=new MeshBasicMaterial(), night=new MeshStandardMaterial({roughness:.85});
  const seats=new InstancedMesh(new BoxGeometry(),day,rows.length);
  const matrix=new Matrix4(), scale=new Vector3(), color=new Color();
  rows.forEach(([x,y,z,w,h,d,angle,tone],i) => {
    matrix.makeRotationY(-angle).scale(scale.set(w,h,d)).setPosition(x,y,z);
    seats.setMatrixAt(i,matrix);
    seats.setColorAt(i,color.setHex(tone));
  });
  seats.name="Wartehallen und vermessene Fußgängerampeln an der Torstraße";
  seats.userData={dayMaterial:day,nightMaterial:night};
  seats.computeBoundingSphere();
  part.add(seats);
}

export function createTorstrasseV380(packet: TorstrassePacketV380, native: boolean) {
  const n=packet.vertices, count=packet.faces*3;
  if (!Number.isInteger(n) || n<1 || n>65535 || !Number.isInteger(count) || count<3 || count>300000)
    throw Error("Ungültige Paketgröße an der Torstraße");
  const words=unpack(packet.position,n*4), styles=bytes(packet.style,n), indices=unpack(packet.index,count);
  const pos=new Uint16Array(n*3), colors=new Uint8Array(n*3), joints=new Uint8Array(n);
  for (let i=0;i<n;i++) {
    const finish=styles[i];
    if (finish>=finishes.length) throw Error("Unbekannter Straßenbelag an der Torstraße");
    pos[3*i]=words[i];
    pos[3*i+1]=words[(native ? 3 : 2)*n+i];
    pos[3*i+2]=words[n+i];
    colors.set(linear[finish],i*3);
    joints[i]=Math.round(finishes[finish][1]*100);
  }
  for (const index of indices) if (index>=n) throw Error("Ungültiger Flächenindex an der Torstraße");
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new BufferAttribute(pos,3));
  geometry.setAttribute("color",new BufferAttribute(colors,3,true));
  geometry.setAttribute("jointSize",new BufferAttribute(joints,1));
  geometry.setIndex(new BufferAttribute(indices,1));
  geometry.computeVertexNormals();
  // All ground fits the same unsigned-centimetre convention as the packed
  // outer-city meshes. Quantised unit normals suffice for the night material.
  const smooth=geometry.getAttribute("normal").array;
  const normals=Int8Array.from(smooth, value=>Math.round(value*127));
  geometry.setAttribute("normal",new BufferAttribute(normals,3,true));
  geometry.computeBoundingSphere();
  const day=paving(native,false), night=paving(native,true);
  const mesh=new Mesh(geometry,day);
  mesh.name="Torstraße – vermessene Straßenflächen, Bordsteine und Straßenbahngleise";
  mesh.userData={dayMaterial:day,nightMaterial:night};
  mesh.position.set(packet.origin[0],0,packet.origin[1]);
  mesh.scale.setScalar(.01);
  const part=new Group();
  part.name="Torstraße und Rosenthaler Platz";
  part.userData={torstrasseV380:true,nativeMinecraft:native,keepInMinecraft:native};
  part.add(mesh);
  addStreetFurniture(part,packet.shelters,packet.signals,native);
  return part;
}

export async function attachTorstrasseV380(entry: SurroundingChunkGeometry,id:string,native:boolean,signal?:AbortSignal) {
  const tile=id.slice("tor380-".length);
  const {default:data}=await import(`./data/torstrasseV380-${tile}.json`) as {default:TorstrassePacketV380};
  signal?.throwIfAborted();
  attachWorldSpaceDetail(entry,createTorstrasseV380(data,native));
}
