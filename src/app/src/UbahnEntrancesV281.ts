import { Color, Group, InstancedBufferAttribute, Matrix4, Quaternion, Vector3 } from "three";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { appendHistoricPortalV281 } from "./transitSignsV281";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { UBAHN_STAIRS_V281, UBAHN_V281_GROUP } from "./ubahnEntrancesV281Profile";

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

export function createUbahnEntrancesV281(native=false):Group {
  const root=new Group();root.name=UBAHN_V281_GROUP;
  root.userData={textureFree:true,fullStaticDetailOnTouch:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native,sourceGeometryRetained:true,entranceCount:3};
  for(const s of UBAHN_STAIRS_V281) {
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
          Math.max(.08,Math.abs(s.ux)*w/along+Math.abs(s.nx)*d/across)+.002,h,
          Math.max(.08,Math.abs(s.uz)*w/along+Math.abs(s.nz)*d/across)+.002,color]);
      }
    };
    const rail=0x47665D;
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
    appendHistoricPortalV281(rows,rods,{...s,base},native);
    batch(root,rows,rods,native,`${s.name} ${s.ref} ${s.osmWay}: ${s.stepCount} steps and finite landing v281`);
  }
  return freezeStaticSceneTransforms(root);
}
