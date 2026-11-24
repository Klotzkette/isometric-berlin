import {
  DataTexture, Group, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace,
} from "three";
import {gunzipSync} from "three/examples/jsm/libs/fflate.module.js";
import {attachWorldSpaceDetail} from "./attachWorldSpaceDetail";
import {decodeBase64Bytes} from "./decodeBase64Bytes";
import {createLocalColourGeometry, type LocalColourPacket} from "./localColourGeometryV381";
import type {SurroundingChunkGeometry} from "./SurroundingCityGeometry";

type Plaque = {f: number[]; y:number; w:number; h:number; ink:string};
type Column = [id:string,x:number,z:number,radius:number,base:number,height:number];
type Packet = LocalColourPacket & {columns:Column[]; plaque?:Plaque};

function createPlaque(p: Plaque, native: boolean) {
  const width=208, height=150;
  const tones=[[230,175,67],[167,160,142],[48,43,34],[110,109,98]];
  const packed=gunzipSync(decodeBase64Bytes(p.ink));
  if (packed.length !== width*height/4) throw new Error("Unvollständige Schrifttafel");
  const pixels=new Uint8Array(width*height*4);
  for (let i=0;i<width*height;i++) {
    const color=tones[(packed[i>>2]>>(6-2*(i%4)))&3];
    pixels[i*4]=color[0]; pixels[i*4+1]=color[1]; pixels[i*4+2]=color[2]; pixels[i*4+3]=255;
  }
  const texture=new DataTexture(pixels,width,height);
  texture.flipY=true;
  texture.colorSpace=SRGBColorSpace;
  texture.generateMipmaps=true;
  texture.minFilter=LinearMipmapLinearFilter;
  texture.magFilter=LinearFilter;
  texture.needsUpdate=true;
  const material=new MeshBasicMaterial({map:texture});
  material.addEventListener("dispose",()=>texture.dispose());
  const mesh=new Mesh(new PlaneGeometry(p.w,p.h),material);
  const [x,z,nx,nz]=p.f;
  mesh.rotation.y=Math.atan2(nx,nz);
  mesh.position.set(x+.13*nx,p.y+p.h/2,z+.13*nz);
  mesh.name="Kollwitzstraße 56a · Gedenktafel für Käthe und Karl Kollwitz";
  mesh.userData={dayMaterial:material,nightMaterial:material,keepInMinecraft:native};
  return mesh;
}

export async function attachKollwitzStreetFurnitureV381(entry:SurroundingChunkGeometry,id:string,native:boolean,signal:AbortSignal) {
  const key=(native?"native_":"drawn_")+id;
  const {default:p}=await import(`./data/kollwitzStreetFurnitureV381/${key}.json`) as {default:Packet};
  signal.throwIfAborted();
  if (entry.root.userData.kollwitzStreetFurnitureV381) return;
  const group=new Group();
  group.add(createLocalColourGeometry("Historische Litfaßsäulen am Kollwitzplatz",native,p,24000));
  if (p.plaque) {
    group.add(createPlaque(p.plaque,native));
    entry.geometryBytes+=208*150*4;
  }
  const columns=p.columns.map(([sourceId,x,z,radius,base,height]) => {
    const ring=Array.from({length:12},(_,i) => {
      const angle=i*Math.PI/6;
      return [x-entry.origin[0]+radius*Math.cos(angle),z-entry.origin[2]+radius*Math.sin(angle)];
    });
    const minHeight = base-entry.nav.groundY;
    return {sourceId,ring,holes:[],minHeight,height:minHeight+height};
  });
  entry.nav={...entry.nav,buildings:[...entry.nav.buildings,...columns]};
  attachWorldSpaceDetail(entry,group);
  entry.root.userData.kollwitzStreetFurnitureV381=true;
}
