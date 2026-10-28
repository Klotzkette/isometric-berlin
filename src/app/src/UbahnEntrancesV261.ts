import { Color, Group, InstancedBufferAttribute, Matrix4, Quaternion, Vector3 } from "three";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { UBAHN_STAIRS_V261, UBAHN_V261_GROUP } from "./ubahnEntrancesV261Profile";
import { appendModernTorSignsV281 } from "./transitSignsV281";

type P=[number,number,number];

/** Final-count static instancing, with no retained row objects on scene nodes. */
function batch(root:Group,rows:number[][],rods:number[][],native:boolean,name:string):void {
  const mesh=justicePalaceV183Boxes(rows,native);
  if(rods.length) {
    const matrices=new Float32Array((rows.length+rods.length)*16),colors=new Float32Array((rows.length+rods.length)*3);
    matrices.set(mesh.instanceMatrix.array);colors.set(mesh.instanceColor!.array);
    const a=new Vector3(),b=new Vector3(),d=new Vector3(),up=new Vector3(0,1,0),q=new Quaternion(),scale=new Vector3(),m=new Matrix4(),color=new Color();
    rods.forEach((r,i)=>{
      a.fromArray(r);b.fromArray(r,3);d.subVectors(b,a);const length=d.length();
      q.setFromUnitVectors(up,d.normalize());m.compose(a.add(b).multiplyScalar(.5),q,scale.set(r[6],length,r[6]));
      m.toArray(matrices,(rows.length+i)*16);color.setHex(r[7]).toArray(colors,(rows.length+i)*3);
    });
    mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.count=rows.length+rods.length;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();
  }
  mesh.name=name;mesh.userData.fullStaticDetailOnTouch=true;root.add(mesh);
}

/** Fit the complete name inside its existing plaque, including a 12 cm rim. */
export function ubahnStationLabelV261(name:string,boardWidth:number) {
  const text=name.toUpperCase();
  const capHeight=.12*Math.min(1,(boardWidth-.24)/letteringLayout(text,.12).totalWidthM);
  return {capHeight,paths:letteringStrokePaths(text,capHeight)};
}

export function createUbahnEntrancesV261(native=false):Group {
  const root=new Group();root.name=UBAHN_V261_GROUP;
  root.userData={textureFree:true,fullStaticDetailOnTouch:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native,sourceGeometryRetained:true,entranceCount:7};
  for(const s of UBAHN_STAIRS_V261) {
    const rows:number[][]=[],rods:number[][]=[],base=native?s.nativeSurfaceY:s.surfaceY,yaw=-Math.atan2(s.uz,s.ux);
    const at=(u:number,v:number,y:number):P=>[s.top[0]+s.ux*u+s.nx*v,y,s.top[1]+s.uz*u+s.nz*v];
    const box=(u:number,v:number,y:number,w:number,h:number,d:number,color:number)=>{
      if(!native)rows.push([...at(u,v,y),w,h,d,yaw,color]);
      else {
        // Short axis-aligned blocks follow the measured run, never one broad
        // rotated AABB that closes its adjacent pavement or stair opening.
        const along=Math.max(1,Math.ceil(w/.32)),across=Math.max(1,Math.ceil(d/.32));
        for(let i=0;i<along;i++)for(let j=0;j<across;j++)rows.push([
          ...at(u-w/2+(i+.5)*w/along,v-d/2+(j+.5)*d/across,y),
          Math.max(.08,Math.abs(s.ux)*w/along+Math.abs(s.nx)*d/across),h,
          Math.max(.08,Math.abs(s.uz)*w/along+Math.abs(s.nz)*d/across),color]);
      }
    };
    const tor=s.station === "brandenburger-tor", rail=tor?0x858F90:0x47665D;
    const run=s.length-s.landing,tread=run/s.stepCount,rise=s.descent/s.stepCount;
    for(let i=0;i<s.stepCount;i++) {
      box((i+.5)*tread,0,base-i*rise-.09,tread+.012,.18,s.width,0xB4B2A7);
      if(!native)box(i*tread+.027,0,base-i*rise+.008,.045,.016,s.width-.08,0xDDD9C9);
    }
    box(run+s.landing/2,0,base-s.descent-.10,s.landing,.20,s.width,0x858B86);
    for(const side of [-1,1]) {
      const v=side*(s.width/2+.11);
      box(s.length/2,v,base-s.descent/2,s.length,s.descent,.20,0xA7A99D);
      box(s.length/2,v,base+.13,s.length,.26,.25,0xAEB5A7);
      box(s.length/2,v,base+1.04,s.length,.075,.075,rail);
      const posts=Math.ceil(s.length/.85);
      for(let i=0;i<=posts;i++)box(i*s.length/posts,v,base+.62,.065,.82,.065,rail);
      if(!native)rods.push([...at(.12,side*(s.width/2-.12),base+.80),...at(run,side*(s.width/2-.12),base-s.descent+.80),.055,0x707E75]);
      else for(let i=0;i<s.stepCount;i++)box((i+.5)*tread,side*(s.width/2-.12),base-(i+.5)*rise+.80,tread,.10,.10,0x707E75);
    }
    box(s.length+.11,0,base-s.descent/2+.55,.20,s.descent+1.10,s.width+.40,0xA7A99D);
    if(tor) {
      // S-Bahn Berlin reference: stainless rail and glass infill, small side U.
      // Light opaque glass avoids layered alpha sorting on mobile.
      for(const side of [-1,1])box(s.length/2,side*(s.width/2+.11),base+.65,s.length-.14,.66,.035,0xAABDBA);
    }
    if(tor) appendModernTorSignsV281(rows,rods,native,{...s,base});
    else {
    const signU=-.14, signV=0, signY=base+3.22;
    const centre=at(signU,signV,signY);
    // Native signs have their own cardinal construction. Their letters are
    // not swallowed by a broad AABB around the rotated source board.
    const nu=native?(Math.abs(s.ux)>Math.abs(s.uz)?[Math.sign(s.ux),0]:[0,Math.sign(s.uz)]):[s.ux,s.uz];
    const nv=[-nu[1],nu[0]];
    const sp=(u:number,v:number,y:number):P=>[centre[0]+nu[0]*u+nv[0]*v,centre[1]+y,centre[2]+nu[1]*u+nv[1]*v];
    const sb=(u:number,v:number,y:number,w:number,h:number,d:number,color:number)=>{
      const p=sp(u,v,y);
      if(native)rows.push([...p,Math.abs(nu[0])*w+Math.abs(nv[0])*d,h,Math.abs(nu[1])*w+Math.abs(nv[1])*d,color]);
      else rows.push([...p,w,h,d,yaw,color]);
    };
    const boardWidth=s.width+.36, label=ubahnStationLabelV261(s.name,boardWidth);
    {
      for(const side of [-1,1])box(-.14,side*(s.width/2+.18),base+1.57,.09,3.14,.09,0x3D6559);
      if(native)box(-.14,0,base+2.76,.08,.08,s.width+.36,rail);
      sb(0,0,-.46,.12,.30,boardWidth,0xDEDCCB);
    }
    sb(0,0,0,.14,.76,.76,0x23508C);
    for(const face of [-1,1]) {
      for(const side of [-1,1])sb(face*.09,side*.20,.045,.025,.40,.10,0xF2EBCE);
      sb(face*.09,0,-.18,.025,.10,.40,0xF2EBCE);
      // Looking inward from +normal, screen-right is -nv (and vice versa).
      const textY=-.46-label.capHeight/2;
      for(const path of label.paths)for(let i=1;i<path.length;i++) {
        const a=sp(face*.08,-face*path[i-1][0],textY+path[i-1][1]);
        const b=sp(face*.08,-face*path[i][0],textY+path[i][1]);
        if(!native)rods.push([...a,...b,.014,0x31464D]);
        else {
          const count=Math.max(1,Math.ceil(Math.hypot(...a.map((v,k)=>b[k]-v))/.025));
          for(let j=0;j<count;j++){const t=(j+.5)/count;rows.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,.021,.021,.021,0x31464D]);}
        }
      }
    }
    }
    batch(root,rows,rods,native,`${s.name} ${s.ref} ${s.osmWay}: ${s.stepCount} steps and finite landing v261`);
  }
  return freezeStaticSceneTransforms(root);
}
