import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import source from './data/tachelesRailsV270.json';
import { altMittePaintHeightV206 } from './AltMitteTransportV206';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

/** Flush railheads below the existing contact system. The source roads, curbs,
 * markings and wires remain intact. Native paths use independent cardinal steps. */
export function createTachelesRailsV270(native = false): Group {
  const positions: number[] = [], indices: number[] = [];
  const rail = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx-ax,bz-az);
    if (len < 1e-7) return;
    const nx = -(bz-az)/len*.0375, nz = (bx-ax)/len*.0375;
    const ay = altMittePaintHeightV206(ax,az,native)+.01;
    const by = native ? ay : altMittePaintHeightV206(bx,bz,native)+.01;
    const q = [[ax+nx,ay,az+nz],[bx+nx,by,bz+nz],[bx-nx,by,bz-nz],[ax-nx,ay,az-nz]];
    const first=positions.length/3;
    for(const p of q)positions.push(...p);
    for(const i of [0,1,2,0,2,3])indices.push(first+i);
  };
  for(const track of source.tracks) for(let j=1;j<track.points.length;j++){
    const [x0,z0]=track.points[j-1].map(v=>v/10), [x1,z1]=track.points[j].map(v=>v/10);
    const dx=x1-x0,dz=z1-z0,len=Math.hypot(dx,dz), nx=-dz/len,nz=dx/len;
    for(const sign of [-1,1]){
      const ox=nx*source.gaugeM/2*sign,oz=nz*source.gaugeM/2*sign;
      // Short segments follow the actual road-height field; native geometry stays axis-aligned.
      const count=Math.ceil(len/(native?.5:1));
      for(let k=0;k<count;k++){
        const ax=x0+dx*k/count+ox,az=z0+dz*k/count+oz;
        const bx=x0+dx*(k+1)/count+ox,bz=z0+dz*(k+1)/count+oz;
        if(native){rail(ax,az,bx,az);rail(bx,az,bx,bz);}else rail(ax,az,bx,bz);
      }
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  // Unit normal components are exact for native horizontal treads.
  if(native){const normals=new Int8Array(positions.length);for(let i=1;i<normals.length;i+=3)normals[i]=127;geometry.setAttribute('normal',new BufferAttribute(normals,3,true));}
  const day=new MeshBasicMaterial({color:0x9ca8ac,side:DoubleSide});
  const night=new MeshStandardMaterial({color:0x9ca8ac,side:DoubleSide,roughness:.65});
  const mesh=new Mesh(geometry,day);mesh.name='Oranienburger mapped paired railheads';
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:native,nativeMinecraft:native};
  const root=new Group();root.name='Tacheles view retained Oranienburger tram rails';
  root.userData={textureFree:true,fullStaticDetailOnTouch:true,sourceTrackIds:source.tracks.map(t=>t.id),gaugeM:source.gaugeM};
  root.add(mesh);freezeStaticSceneTransforms(root);return root;
}
