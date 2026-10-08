import {
  BoxGeometry, BufferAttribute, BufferGeometry, Camera, Color, DoubleSide,
  DynamicDrawUsage, Frustum, Group, IcosahedronGeometry, InstancedMesh,
  LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial,
  Quaternion, Sphere, Vector3,
} from "three";
import { terrainGroundAt } from "./weinbergTerrainV176";

/** Mapped summit/open lawn; people, kite patterns and common wind are illustrative. */
export const DRACHENBERG_KITES_V195 = Object.freeze({
  summit: [-8403.524, 1642.2395] as const, lawnOwner: "way/15700939",
  wind: [.8, -.6] as const, frameIntervalMs: 50, people: 4,
  lineCounts: [1, 1, 2, 2] as const, tetherLengths: [29, 36, 34, 42] as const,
  offsets: [[-14, -5], [-5, 8], [8, -4], [15, 10]] as const,
  maxBufferBytes: 130_000,
});
type Vertex = { kite: number; u: number; v: number; tail: number; side: number };
type Kite = {
  x: number; y: number; z: number; width: number; height: number; length: number;
  centre: Vector3; right: Vector3; up: Vector3; normal: Vector3;
};
const TAIL_LENGTHS = [10, 13, 11, 15];
const PALETTES = [
  [0xe4523e, 0xf5c945, 0x37a8bd, 0xf1e4ac],
  [0x7351ab, 0xe96e9a, 0x38b5b0, 0xf5ca49],
  [0x168fab, 0xf1d050, 0xf46b41, 0x2378b5],
  [0xf17c38, 0xda3b72, 0x7250ad, 0x36b5b0, 0xf1d55e],
];

/** Four bounded kites; no extra timer, simulation history or per-update allocation. */
export function createDrachenbergKitesV195(native = false): Group {
  const root = new Group();
  root.name = "Drachenberg four kite fliers v195";
  root.userData = { textureFree: true, nativeMinecraft: native, illustrativeOccupancy: true };
  const [cx, cz] = DRACHENBERG_KITES_V195.summit;
  const wx=.8,wz=-.6,rx=.6,rz=.8;
  const kites: Kite[] = DRACHENBERG_KITES_V195.offsets.map(([dx,dz],i) => {
    const x=cx+dx,z=cz+dz;
    return { x,y:terrainGroundAt(x,z,3,native),z,width:[1.5,1.8,2.8,3.5][i],
      height:[2.05,2.4,1.8,1.3][i],length:DRACHENBERG_KITES_V195.tetherLengths[i],
      centre:new Vector3(),right:new Vector3(),up:new Vector3(),normal:new Vector3() };
  });
  const bodyGeometry=new BoxGeometry(1,1,1);bodyGeometry.deleteAttribute("uv");
  const bodyDay=new MeshBasicMaterial({color:0xffffff}),bodyNight=new MeshBasicMaterial({color:0x687583});
  const bodies: {matrix:Matrix4;color:number}[]=[],heads:{point:Vector3;color:number}[]=[];
  const matrix=new Matrix4(),rotation=new Quaternion(),a=new Vector3(),b=new Vector3();
  const direction=new Vector3(),midpoint=new Vector3(),size=new Vector3(),vertical=new Vector3(0,1,0);
  const local=(kite:Kite,u:number,y:number,v:number,p:Vector3) => p.set(kite.x+rx*u+wx*v,kite.y+y,kite.z+rz*u+wz*v);
  const box=(p:Vector3,w:number,h:number,d:number,color:number) => {
    matrix.makeScale(w,h,d).setPosition(p);bodies.push({matrix:matrix.clone(),color});
  };
  const limb=(kite:Kite,from:number[],to:number[],thickness:number,color:number) => {
    local(kite,from[0],from[1],from[2],a);local(kite,to[0],to[1],to[2],b);
    direction.subVectors(b,a);const length=direction.length();
    if(native){const count=Math.ceil(length/.14);
      for(let j=0;j<count;j++)box(midpoint.lerpVectors(a,b,(j+.5)/count),thickness,.17,thickness,color);
    }else{
      rotation.setFromUnitVectors(vertical,direction.normalize());
      matrix.compose(midpoint.addVectors(a,b).multiplyScalar(.5),rotation,size.set(thickness,length,thickness));
      bodies.push({matrix:matrix.clone(),color});
    }
  };
  kites.forEach((kite,i)=>{
    const shirt=[0xde7854,0x3f8dba,0x8f66ad,0xd8b643][i],skin=[0xdba77c,0x976746,0xe5b48c,0xc6936c][i];
    box(local(kite,0,1.06,0,a),.40,.56,.24,shirt);
    box(local(kite,0,1.405,.02,a),.13,.15,.13,skin);
    for(const side of [-1,1]){
      limb(kite,[side*.12,.83,0],[side*.15,.42,side*.035],.14,0x354955);
      limb(kite,[side*.15,.42,side*.035],[side*.17,.12,.05],.13,0x354955);
      box(local(kite,side*.17,.07,.10,a),.17,.13,.28,0x363b3b);
      limb(kite,[side*.22,1.29,0],[side*.31,1.12,.27],.13,shirt);
      limb(kite,[side*.31,1.12,.27],[side*.26,1.37,.49],.105,skin);
      box(local(kite,side*.26,1.37,.49,a),.12,.13,.12,skin);
    }
    limb(kite,[-.26,1.37,.49],[.26,1.37,.49],.055,0x444f58);
    const point=local(kite,0,1.57,.02,a).clone();
    if(native)box(point,.25,.27,.25,skin);else heads.push({point,color:skin});
    box(local(kite,0,1.72,.02,a),.29,.085,.31,[0x515a61,0x65543e,0xc75e3e,0x466980][i]);
  });
  const color=new Color(),bodyMesh=new InstancedMesh(bodyGeometry,bodyDay,bodies.length);
  bodies.forEach((body,i)=>{bodyMesh.setMatrixAt(i,body.matrix);bodyMesh.setColorAt(i,color.setHex(body.color));});
  bodyMesh.name="Four fliers holding kite handles";
  bodyMesh.userData={dayMaterial:bodyDay,nightMaterial:bodyNight,textureFree:true};
  bodyMesh.computeBoundingBox();bodyMesh.computeBoundingSphere();root.add(bodyMesh);
  if(heads.length){
    const geometry=new IcosahedronGeometry(.14,1);geometry.deleteAttribute("uv");
    const mesh=new InstancedMesh(geometry,bodyDay,heads.length);
    heads.forEach((head,i)=>{mesh.setMatrixAt(i,matrix.makeTranslation(head.point.x,head.point.y,head.point.z));mesh.setColorAt(i,color.setHex(head.color));});
    mesh.name="Faceted heads";mesh.userData={dayMaterial:bodyDay,nightMaterial:bodyNight};
    mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  }
  const vertices:Vertex[]=[],colors:number[]=[];
  const vertex=(kite:number,u:number,v:number,tail:number,side:number,hex:number)=>{
    vertices.push({kite,u,v,tail,side});color.setHex(hex);colors.push(color.r,color.g,color.b);
  };
  const panel=(i:number,u:number,v:number):[number,number]=>{
    if(i<2)return[u*(1-Math.abs(v)),v];
    if(i===2)return[u*(1-v)/2,v];
    return[u,v+.34*(1-u*u)];
  };
  for(let i=0;i<kites.length;i++){
    const columns=native?10:8,rows=native?10:6;
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const u0=column*2/columns-1,u1=(column+1)*2/columns-1,v0=row*2/rows-1,v1=(row+1)*2/rows-1;
      const um=(u0+u1)/2,vm=(v0+v1)/2;
      if(native&&(i<2?Math.abs(um)+Math.abs(vm)>1:i===2&&Math.abs(um)>(1-vm)/2))continue;
      const points=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>native?[u,v]:panel(i,u,v));
      const hex=PALETTES[i][(column+(i<2?Math.floor(row/2):0))%PALETTES[i].length];
      for(const index of [0,1,2,0,2,3])vertex(i,points[index][0],points[index][1],-1,0,hex);
    }
    const tails=i<2?1:2,segments=24;
    for(let tail=0;tail<tails;tail++){
      const attach=tails===1?0:tail?.72:-.72;
      for(let j=0;j<segments;j++){
        const t0=j/segments,t1=(j+1)/segments;
        for(const [t,side]of[[t0,-1],[t0,1],[t1,1],[t0,-1],[t1,1],[t1,-1]])
          vertex(i,attach,t,tail,side,PALETTES[i][Math.floor(j/3)%PALETTES[i].length]);
        if(i<2&&j>0&&j%4===0)for(const side of[-1,1])
          for(const[t,s]of[[t0,0],[t0-.017,side*3.2],[t0+.017,side*3.2]])
            vertex(i,attach,t,tail,s,PALETTES[i][j%PALETTES[i].length]);
      }
    }
  }
  const cloth=new BufferGeometry();
  const clothPosition=new BufferAttribute(new Float32Array(vertices.length*3),3).setUsage(DynamicDrawUsage);
  cloth.setAttribute("position",clothPosition);cloth.setAttribute("color",new BufferAttribute(new Float32Array(colors),3));
  const clothDay=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const clothNight=new MeshBasicMaterial({vertexColors:true,color:0x8b97a5,side:DoubleSide});
  const sails=new Mesh(cloth,clothDay);sails.name=native?"Stepped native kites and ribbon tails":"Colourful kite cloth and ribbon tails";
  sails.userData={dayMaterial:clothDay,nightMaterial:clothNight,textureFree:true};root.add(sails);
  const segments=20,lineCount=DRACHENBERG_KITES_V195.lineCounts.reduce((a,b)=>a+b,0);
  const linesGeometry=new BufferGeometry();
  const linePosition=new BufferAttribute(new Float32Array(lineCount*segments*2*3),3).setUsage(DynamicDrawUsage);
  linesGeometry.setAttribute("position",linePosition);
  const lineDay=new LineBasicMaterial({color:0x5d635c}),lineNight=new LineBasicMaterial({color:0xc3c6ae});
  const lines=new LineSegments(linesGeometry,lineDay);lines.name="Six continuously tethered kite lines";
  lines.userData={dayMaterial:lineDay,nightMaterial:lineNight};root.add(lines);
  const bounds=new Sphere(new Vector3(cx+18,kites[0].y+17,cz-10),85);
  cloth.boundingSphere=bounds.clone();linesGeometry.boundingSphere=bounds.clone();
  const projection=new Matrix4(),frustum=new Frustum(),point=new Vector3(),attachment=new Vector3(),hand=new Vector3();
  let lastFrame=-Infinity;
  const clothPoint=(kite:Kite,i:number,u:number,v:number,seconds:number,target:Vector3)=>{
    const flutter=.11*Math.sin(seconds*3.2+u*4.3+v*3+i)*(Math.abs(u)+.15);
    return target.copy(kite.centre).addScaledVector(kite.right,u*kite.width)
      .addScaledVector(kite.up,v*kite.height).addScaledVector(kite.normal,flutter);
  };
  const writePose=(seconds:number)=>{
    for(let i=0;i<kites.length;i++){
      const kite=kites[i],phase=i*1.73,sway=Math.sin(seconds*.42+phase)*2+Math.sin(seconds*.87)*.6;
      const elevation=.81+.035*Math.sin(seconds*.55+phase),distance=Math.sqrt(kite.length*kite.length-sway*sway);
      kite.centre.set(kite.x+wx*distance*Math.cos(elevation)+rx*sway,
        kite.y+1.37+distance*Math.sin(elevation),kite.z+wz*distance*Math.cos(elevation)+rz*sway);
      const bank=.075*Math.sin(seconds*.63+phase),c=Math.cos(bank),s=Math.sin(bank);
      kite.right.set(rx*c,s,rz*c);kite.up.set(-rx*s,c,-rz*s);kite.normal.set(wx,0,wz);
    }
    for(let j=0;j<vertices.length;j++){
      const v=vertices[j],kite=kites[v.kite];
      if(v.tail<0)clothPoint(kite,v.kite,v.u,v.v,seconds,point);
      else{
        const attachY=native?-1:v.kite===3?-1+.34*(1-v.u*v.u):-1;
        clothPoint(kite,v.kite,v.u,attachY,seconds,point);
        const t=v.v,length=TAIL_LENGTHS[v.kite];
        const sway=t*(.7*Math.sin(seconds*1.9-t*8+v.kite)+.22*Math.sin(seconds*3.4-t*17));
        point.addScaledVector(kite.normal,t*length*.62).addScaledVector(kite.up,-t*length*.66)
          .addScaledVector(kite.right,sway+v.side*.10*(1-.45*t));
      }
      clothPosition.setXYZ(j,point.x,point.y,point.z);
    }
    let at=0;
    for(let i=0;i<kites.length;i++){
      const kite=kites[i],count=DRACHENBERG_KITES_V195.lineCounts[i];
      for(let strand=0;strand<count;strand++){
        const side=count===1?0:strand?1:-1;
        local(kite,side*.26,1.37,.49,hand);clothPoint(kite,i,side*.55,-.10,seconds,attachment);
        for(let j=0;j<segments;j++)for(let end=0;end<2;end++){
          const t=(j+end)/segments;point.lerpVectors(hand,attachment,t);point.y-=.65*Math.sin(Math.PI*t);
          linePosition.setXYZ(at++,point.x,point.y,point.z);
        }
      }
    }
    clothPosition.needsUpdate=true;linePosition.needsUpdate=true;
  };
  writePose(0);
  // Invoked by the existing RAF before its passive-frame return; no offscreen work.
  root.userData.update=(timestamp:number,camera:Camera,reducedMotion=false):boolean=>{
    if(!root.visible||reducedMotion||timestamp-lastFrame<DRACHENBERG_KITES_V195.frameIntervalMs)return false;
    projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    if(!frustum.setFromProjectionMatrix(projection).intersectsSphere(bounds))return false;
    lastFrame=timestamp;writePose(timestamp/1000);return true;
  };
  root.userData.kiteData=kites.map((k,i)=>({anchor:[k.x,k.y,k.z],lines:DRACHENBERG_KITES_V195.lineCounts[i],length:k.length}));
  root.userData.clothVertices=vertices.length;
  root.updateMatrixWorld(true);root.traverse(object=>{object.matrixAutoUpdate=false;});
  return root;
}
