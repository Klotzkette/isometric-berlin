import { Group } from 'three';
import { RitzSurfacesV385, type RitzVertex } from './RitzSurfacesV385';

type XZ = [number,number];
const stone=0xddd4c4, shadow=0xa99f8b, limestone=0xe9e2d6, bronze=0x655747;
const glass=0x67777a, recess=0x414a4c;

/** All three elevations are registered on outside edges of the original building parts. */
export function createRitzPortalsV385(native:boolean): Group {
  const mesh=new RitzSurfacesV385();
  function front(a:XZ,b:XZ,bays:number,kind:'hotel'|'tower'|'east') {
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz), ux=dx/len, uz=dz/len;
    const nx=-uz,nz=ux,acrossZ=kind==='east';
    const face=(u:number,y:number,depth:number,voxelPlane?:number):RitzVertex=>{
      const x=a[0]+ux*u,z=a[1]+uz*u;
      if(voxelPlane!==undefined) return acrossZ?[voxelPlane+depth,y,z]:[x,y,voxelPlane+depth];
      return [x+nx*depth,y,z+nz*depth];
    };
    function panel(l:number,r:number,lo:number,hi:number,depth:number,tone:number) {
      const splits=[l];
      if(native) {
        const start=acrossZ?a[1]:a[0], step=acrossZ?uz:ux;
        const v0=start+l*step,v1=start+r*step;
        for(let coordinate=4*Math.ceil(Math.min(v0,v1)/4);coordinate<Math.max(v0,v1);coordinate+=4) {
          const u=(coordinate-start)/step;
          if(u>l+1e-7 && u<r-1e-7) splits.push(u);
        }
      }
      splits.push(r);splits.sort((p,q)=>p-q);
      for(let i=1;i<splits.length;i++) {
        const left=splits[i-1],right=splits[i], mid=(left+right)/2;
        // South and east ends of the existing 4 m native columns. Adjacent
        // storefront panels share the same vertical face as the retained block.
        const cell=Math.floor((acrossZ?a[1]+uz*mid:a[0]+ux*mid)/4);
        const plane=native?(acrossZ?(cell===243?272:268):(cell<66?980:976)):undefined;
        mesh.quad(face(left,lo,depth,plane),face(right,lo,depth,plane),face(right,hi,depth,plane),face(left,hi,depth,plane),tone);
      }
    }
    const base=5.4, hotel=kind==='hotel';
    const top=hotel?41.761:kind==='east'?72.296:71.813;
    panel(0,len,base+.09,top-.02,.065,stone);
    const pitch=len/bays, first=base+10.78;
    const windows=(u:number,y:number,w:number,h:number,upper=false)=>{
      panel(u-w/2-.10,u+w/2+.10,y-.10,y+h+.12,.13,limestone);
      panel(u-w/2,u+w/2,y,y+h,.175,recess);
      panel(u-w/2+.10,u+w/2-.10,y+.09,y+h-.10,.19,glass);
      panel(u-.047,u+.047,y+.055,y+h-.035,.225,bronze);
      panel(u-w/2,u+w/2,y+.14,y+.205,.23,shadow);
      if(upper)panel(u-w/2+.08,u+w/2-.08,y+h-.35,y+h-.28,.23,bronze);
    };
    for(let col=0;col<bays;col++) {
      // Both front façades have four bays. The eight paired east bays are
      // also legible on the orthorectified historical façade above the offices.
      const centre=(col+.5)*pitch;
      for(let floor=0;floor<(hotel?8:9);floor++) windows(centre,first+3.11*floor,pitch*.50,2.23);
      if(!hotel) for(let floor=0;floor<7;floor++) windows(centre,base+40.00+3.81*floor,pitch*.54,2.87,true);
      if(col) {
        const u=col*pitch;
        panel(u-.13,u+.13,first-.6,top-.63,.16,limestone);
        panel(u+.075,u+.145,first-.6,top-.63,.19,shadow);
      }
    }
    panel(.05,len-.05,top-.38,top-.19,.20,shadow);
    panel(.05,len-.05,top-.20,top-.03,.25,limestone);
    if(acrossZ) {
      for(let i=0;i<bays;i++) windows((i+.5)*pitch,base+.55,pitch*.49,6.55);
      return;
    }
    // The main hotel door is independently mapped by OSM 7077890144. The
    // apartment entry belongs to the middle of the narrower tower podium.
    const u=hotel?(246.13-a[0])*ux+(979.02-a[1])*uz:len*.50;
    const half=hotel?3.40:2.10, ht=hotel?6.9:8.2;
    for(const side of [-1,1]) {
      const pos=hotel?(side<0?2.55:len-1.62):len*(side<0?.135:.865);
      windows(pos,base+.52,hotel?2.45:1.75,hotel?3.76:6.75);
      if(hotel)windows(pos,base+5.46,2.10,2.69);
      const jamb=u+side*(half+.17);
      panel(jamb-.14,jamb+.14,base+.06,base+ht+.45,.27,limestone);
      panel(jamb+.06,jamb+.14,base+.07,base+ht+.40,.29,shadow);
    }
    panel(u-half,u+half,base+.04,base+ht,.22,recess);
    panel(u-half+.17,u+half-.17,base+.16,base+ht-.18,.24,0x776f5c);
    const columns=hotel?5:3, w=(2*half-.32)/columns;
    for(let j=0;j<columns;j++) {
      const left=u-half+.16+j*w;
      panel(left+.055,left+w-.055,base+.38,base+ht*.70,.285,0x5e6867);
      panel(left+.055,left+w-.055,base+ht*.70+.12,base+ht-.20,.285,0x89918c);
      panel(left+.055,left+w-.055,base+.50,base+.62,.30,0xb8a470);
    }
    if(hotel) for(const side of [-1,1]) {
      const x=u+side*(half+.65);
      panel(x-.10,x+.10,base+1.65,base+3.17,.34,bronze);
      panel(x-.065,x+.065,base+1.82,base+3.01,.36,0xf4eacb);
    }
  }
  front([235.6,980.2],[252.2,978.6],4,'hotel');
  front([252.8,979.0],[270.0,977.4],4,'tower');
  front([270.3,974.9],[267.1,942.1],8,'east');
  const group=new Group();group.name='Ritz-Carlton und Tower Apartments · Platz- und Ostfassaden';
  group.userData={nativeMinecraft:native,keepInMinecraft:native,lod2ParentId:'DEBE01YYK0002R6G'};
  group.add(mesh.mesh(group.name,native));group.matrixAutoUpdate=false;
  return group;
}
