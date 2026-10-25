import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import data from './data/dorotheenstadtV266.json';
import { justicePalaceV183Boxes } from './justicePalaceV183Batches';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
import { terrainGroundAt } from './weinbergTerrainV176';

export const DOROTHEENSTADT_V266_PROFILE = {
  ...data.profile, textureFree: true, fullStaticDetailOnTouch: true,
  cameras: {
    brecht: { position: [977,33,-1051], target: [934,13,-1090] },
    vertretung: { position: [1048,42,-963], target: [1010,17,-870] },
    cemetery: { position: [1087,127,-1188], target: [859,5,-1001] },
    hannoversche: { position: [991,39,-842], target: [918,20,-886] },
  },
} as const;

function decoded(value: string): ArrayBuffer {
  const text = atob(value), bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes.buffer;
}

/** Anonymous cemetery cues avoid all mapped graves, paths, trees and buildings.
 * Native markers are authored orthogonal forms, never a smooth-mesh conversion. */
export function dorotheenstadtGraveRowsV266(native = false): number[][] {
  const rows: number[][] = [];
  for (const [x,z,variant] of data.graves) {
    const ground = terrainGroundAt(x,z,data.profile.graveGroundY,native), colour = [0xb5b3a3,0x969b91,0xc5bda5,0x7f8c84][variant];
    const put = (u: number,y: number,v: number,w: number,h: number,d: number,c: number) =>
      rows.push([x+u,ground+y,z+v,w,h,d,...(native?[]:[0]),c]);
    put(0,.12,0,1.60,.22,2.10,0x9d9e8d);
    put(0,.25,.12,1.27,.07,1.43,0x6d7c59);
    if (variant === 0) {
      put(0,.72,-.71,1.02,1.08,.25,colour);
      put(0,1.32,-.71,1.13,.13,.31,colour);
    } else if (variant === 1) {
      put(0,.54,-.70,.80,.70,.31,colour);
      put(0,1.07,-.70,.54,.36,.27,colour);
      put(0,1.37,-.70,.27,.24,.22,colour);
    } else if (variant === 2) {
      put(0,.61,-.73,.86,.87,.24,colour);
      put(0,1.15,-.73,.19,.49,.20,colour);
      put(0,1.22,-.73,.61,.15,.20,colour);
    } else {
      put(0,.36,0,1.25,.27,1.85,colour);
      put(0,.53,-.62,.98,.10,.40,0xc5c4b4);
    }
  }
  return rows;
}

/** Required complete facade reading; the four exact old aperture sheets may
 * yield only when this root is present. Every measured body/roof stays rendered. */
export function createDorotheenstadtV266(native = false, options: { mobileLike?: boolean } = {}): Group {
  void options;
  const root = new Group(); root.name = 'Dorotheenstadt cemetery, Brecht-Haus and former Permanent Representation v266';
  root.userData = { ...DOROTHEENSTADT_V266_PROFILE, dorotheenstadtV266: true,
    sourceGeometryRetained: true, blockNative: native, nativeMinecraft: native,
    keepInMinecraft: native, sourceReceipt: 'dorotheenstadt-v266-evidence.json.gz' };
  const packet = data[native ? 'minecraft' : 'drawn'];
  for (const part of packet.meshes) {
    const quantized = new Uint16Array(decoded(part.positions));
    const positions = new Float32Array(quantized.length);
    for (let i = 0; i < positions.length; i++) positions[i] = quantized[i] / 100;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(positions,3));
    geometry.setAttribute('color',new BufferAttribute(new Uint8Array(decoded(part.colors)),3,true));
    geometry.setIndex(new BufferAttribute(new Uint32Array(decoded(part.indices)),1));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day = new MeshBasicMaterial({vertexColors:true});
    const night = new MeshStandardMaterial({vertexColors:true,roughness:.86,flatShading:true});
    const mesh = new Mesh(geometry,day);mesh.position.fromArray(packet.origin);
    mesh.name = native ? 'Independent orthogonal source-skin facade fittings' : 'Brecht classical front, paired StäV bays and terracotta atelier ribbon';
    mesh.userData = {dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native};root.add(mesh);
  }
  const graves = justicePalaceV183Boxes(dorotheenstadtGraveRowsV266(native),native);
  graves.name = 'Ninety anonymous dispersed grave groups within retained cemetery';
  graves.userData.nativeMinecraft = native;root.add(graves);
  return freezeStaticSceneTransforms(root);
}
