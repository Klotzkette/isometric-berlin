import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import source from "./data/viktoriaparkV194.json";
import { viktoriaparkWaterAtV194 } from "./viktoriaparkWaterV194";
import { parkReliefAt } from "./parkReliefV182";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const VIKTORIAPARK_V194_GROUP = "Kreuzberg measured hill, Schinkel iron monument and mapped cascade v194";
const IRON = 0x426b5b, EDGE = 0x749484, DARK = 0x263d35, STONE = 0xaaa28c;
type Point = number[];

/** No second hill: this small layer follows the retained official DGM field. */
export function createViktoriaparkV194(native = false): Group {
  const root = new Group(); root.name = VIKTORIAPARK_V194_GROUP;
  root.userData = { nativeMinecraft: native, keepInMinecraft: native, blockNative: native, textureFree: true, fullStaticDetailOnTouch: true, sourceOwnerIds: [source.parentId], measuredHillRetained: true };
  const [cx, cz] = source.anchor, base = source.baseTopY;
  const matrices: number[] = [], boxColors: number[] = [], rockMatrices: number[] = [], rockColors: number[] = [];
  const positions: number[] = [], colors: number[] = [];
  const m = new Matrix4(), q = new Quaternion(), tint = new Color(), up = new Vector3(0, 1, 0);
  const ground = (x: number, z: number) => parkReliefAt(x, z, 3, native);
  const put = (x: number, y: number, z: number, w: number, h: number, d: number, color: number, yaw = 0, rock = false) => {
    if(native&&yaw){const c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw));[w,d]=[c*w+s*d,s*w+c*d];}
    q.setFromAxisAngle(up, native ? 0 : yaw);
    m.compose(new Vector3(x,y,z),q,new Vector3(w,h,d));
    const mat = rock && !native ? rockMatrices : matrices, col = rock && !native ? rockColors : boxColors;
    m.toArray(mat,mat.length); tint.setHex(color); tint.toArray(col,col.length);
  };
  const beam = (a: Point, b: Point, width: number, color: number) => {
    const v = new Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]), length = v.length();
    if (!length) return;
    if (native) {
      const count = Math.max(1,Math.ceil(length / Math.max(.3,width)));
      for(let i=0;i<count;i++){const t=(i+.5)/count;put(a[0]+v.x*t,a[1]+v.y*t,a[2]+v.z*t,Math.max(width,.18),Math.max(width,.28),Math.max(width,.18),color);}
    } else {
      q.setFromUnitVectors(up,v.normalize());m.compose(new Vector3((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2),q,new Vector3(width,length,width));
      m.toArray(matrices,matrices.length);tint.setHex(color).toArray(boxColors,boxColors.length);
    }
  };
  const tri = (points: Point[], color: number) => {
    tint.setHex(color);
    for(const p of points){positions.push(...p);colors.push(tint.r,tint.g,tint.b);}
  };
  const nativeCells = new Map<string,number[]>();
  const blockSurface = (triangle: Point[], color: number, step = .75) => {
    const [a,b,c]=triangle, span=Math.max(Math.hypot(...a.map((v,i)=>v-b[i])),Math.hypot(...a.map((v,i)=>v-c[i])),Math.hypot(...b.map((v,i)=>v-c[i])));
    const n=Math.max(1,Math.ceil(span/step*1.8));
    for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++){
      const p=a.map((v,k)=>Math.floor((v+(b[k]-v)*i/n+(c[k]-v)*j/n)/step)*step+step/2);
      nativeCells.set(p.join(","),[...p,color,step]);
    }
  };
  // Full official base wall/roof sheets replace only the exact coarse octagon.
  for(const surface of source.surfaces) {
    if(surface.kind === "GroundSurface")continue;
    const color=surface.kind==='RoofSurface'?0xb5ad97:STONE;
    for(const triangle of surface.triangles)if(native)blockSurface(triangle,color);else tri(triangle,color);
  }
  for(const r of nativeCells.values())put(r[0],r[1],r[2],r[4],r[4],r[4],r[3]);
  // Gentle rustication on the measured vertical sides; no false windows.
  for(const s of source.surfaces.filter(s=>s.kind==='WallSurface')) {
    const ring=s.rings[0], low=Math.min(...ring.map(p=>p[1])), high=Math.min(...ring.filter(p=>p[1]>low+.1).map(p=>p[1]));
    const a=ring.reduce((v,p)=>p[1]<v[1]?p:v),b=ring.reduce((v,p)=>Math.hypot(p[0]-a[0],p[2]-a[2])>Math.hypot(v[0]-a[0],v[2]-a[2])?p:v);
    if(!Number.isFinite(high)||high-low<2)continue;
    for(let y=low+.6;y<high-.2;y+=.65)beam([a[0],y,a[2]],[b[0],y,b[2]],.055,0x918b77);
  }
  // Twelve-sided cross plan with twelve niches; the iron crown is 18m, not a
  // second proxy-sized pedestal. Subdivisions are photographic estimates.
  const yaw=.229, rotate=(x:number,z:number):number[]=>[cx+Math.cos(yaw)*x+Math.sin(yaw)*z,cz-Math.sin(yaw)*x+Math.cos(yaw)*z];
  const local=(x:number,y:number,z:number):number[]=>{const p=rotate(x,z);return[p[0],base+y,p[1]];};
  const cross=[[-1.5,-4.1],[1.5,-4.1],[1.5,-1.5],[4.1,-1.5],[4.1,1.5],[1.5,1.5],[1.5,4.1],[-1.5,4.1],[-1.5,1.5],[-4.1,1.5],[-4.1,-1.5],[-1.5,-1.5]];
  for(const [w,d] of [[8.7,3.5],[3.5,8.7]])put(cx,base+.35,cz,w,.7,d,IRON,native?0:yaw);
  // Central shaft and taper, with pronounced ribs and crockets.
  put(cx,base+6.8,cz,2.6,12.1,2.6,IRON,native?0:yaw);
  const pyramid=(x:number,z:number,y:number,r:number,h:number,color:number)=>{
    if(native){const n=Math.ceil(h/.4);for(let j=0;j<n;j++){const w=Math.max(.18,2*r*(1-(j+.5)/n));put(x,y+h*(j+.5)/n,z,w,h/n,w,color);}return;}
    const corners=[[x-r,y,z-r],[x+r,y,z-r],[x+r,y,z+r],[x-r,y,z+r]];
    for(let i=0;i<4;i++)tri([corners[i],corners[(i+1)%4],[x,y+h,z]],color);
  };
  pyramid(cx,cz,base+12.85,1.42,4.05,IRON);
  for(const sx of [-1,1])for(const sz of [-1,1]){
    beam(local(sx*1.32,1,sz*1.32),local(sx*1.32,12.8,sz*1.32),.11,EDGE);
    beam(local(sx*1.35,12.85,sz*1.35),local(0,16.9,0),.12,EDGE);
    for(let j=0;j<9;j++){const t=j/9;const p=local(sx*1.35*(1-t),12.9+t*4,sz*1.35*(1-t));put(p[0],p[1],p[2],.22,.15,.22,EDGE);}
  }
  let figures=0;
  for(let i=0;i<cross.length;i++){
    const a=cross[i],b=cross[(i+1)%cross.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=dz/len,nz=-dx/len;
    const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,angle=yaw-Math.atan2(dz,dx),p=rotate(x,z);
    put(p[0],base+3.4,p[1],len-.13,5.15,.35,IRON,angle);
    const niche=rotate(x+nx*.22,z+nz*.22);put(niche[0],base+3.8,niche[1],1.16,3.25,.10,DARK,angle);
    const end0=local(x-dx/len*.67+nx*.33,5.43,z-dz/len*.67+nz*.33),end1=local(x+dx/len*.67+nx*.33,5.43,z+dz/len*.67+nz*.33),peak=local(x+nx*.33,6.65,z+nz*.33);
    beam(end0,peak,.12,EDGE);beam(end1,peak,.12,EDGE);
    for(const sign of [-1,1])beam(local(x+dx/len*.68*sign+nx*.3,1.2,z+dz/len*.68*sign+nz*.3),local(x+dx/len*.68*sign+nx*.3,5.5,z+dz/len*.68*sign+nz*.3),.11,EDGE);
    // Over-life-size draped genii, with paired wings and distinct arm gestures.
    const figure=local(x+nx*.5,3.5,z+nz*.5);
    put(figure[0],figure[1],figure[2],.53,1.7,.35,0x648578,angle);
    put(figure[0],figure[1]+1.04,figure[2],.42,.49,.4,0x789588,angle,true);
    for(const sign of [-1,1]){
      const shoulder=local(x+nx*.52+dx/len*.22*sign,4.05,z+nz*.52+dz/len*.22*sign),hand=local(x+nx*.62+dx/len*.47*sign,sign<0&&i%3===0?4.83:3.45,z+nz*.62+dz/len*.47*sign);
      beam(shoulder,hand,.16,0x638879);
      beam(local(x+nx*.37,3.8,z+nz*.37),local(x+nx*.31+dx/len*.57*sign,4.75,z+nz*.31+dz/len*.57*sign),.20,0x547c68);
    }
    for(const sign of [-1,1]){const f=local(x+dx/len*.23*sign+nx*.52,2.27,z+dz/len*.23*sign+nz*.52);put(f[0],f[1],f[2],.22,.62,.34,IRON,angle);}
    const plaque=local(x+nx*.23,1.25,z+nz*.23);put(plaque[0],plaque[1],plaque[2],1.34,.63,.08,i%3===0?0xaaa073:0x527463,angle);
    const pin=local(a[0],6.25,a[1]);put(pin[0],pin[1]+1.12,pin[2],.32,2.25,.32,IRON);pyramid(pin[0],pin[2],pin[1]+2.25,.25,1.15,EDGE);
    figures++;
  }
  // Iron-cross silhouette, four flared arms, kept distinct from a Latin cross.
  put(cx,base+17.4,cz,.23,1.2,.15,EDGE,yaw);put(cx,base+17.4,cz,1.2,.23,.15,EDGE,yaw);
  for(const [x,y,w,h] of [[0,17.91,.55,.16],[0,16.89,.55,.16],[-.53,17.4,.16,.55],[.53,17.4,.16,.55]]){const p=local(x,y,0);put(p[0],p[1],p[2],w,h,.17,EDGE,yaw);}
  root.userData.genii=figures;root.userData.ironHeightM=18;
  const lines=source.features.filter(f=>f.geometry.type==='LineString');
  const stairLevels: Record<string, [number,number]> = {
    "way/760733285":[39.073,36.359], "way/30038755":[40.939,39.073], "way/30038756":[40.939,39.073],
    "way/30038751":[42.805,40.939], "way/30038752":[42.805,40.939], "way/51012620":[42.805,46.073],
  };
  for(const feature of lines) {
    const pts=feature.geometry.coordinates as number[][];
    if(feature.id==='way/51166738') {
      for(let i=1;i<pts.length;i++){
        const a=pts[i-1],b=pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
        for(const y of [.25,1.2])beam([a[0],base+y,a[1]],[b[0],base+y,b[1]],.055,IRON);
        const n=Math.ceil(len/.42);for(let j=0;j<n;j++){const t=j/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;put(x,base+.74,z,.065,1.45,.065,IRON);pyramid(x,z,base+1.45,.09,.22,IRON);}
      }continue;
    }
    if(feature.tags.highway==='steps') {
      const count=Number(feature.tags.step_count),length=pts.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-pts[i][0],p[1]-pts[i][1]),0);
      let passed=0;
      for(let j=0;j<count;j++){
        const distance=(j+.5)*length/count;let left=distance,index=0;
        while(index<pts.length-2&&left>Math.hypot(pts[index+1][0]-pts[index][0],pts[index+1][1]-pts[index][1])){left-=Math.hypot(pts[index+1][0]-pts[index][0],pts[index+1][1]-pts[index][1]);index++;}
        const a=pts[index],b=pts[index+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]),t=left/l,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
        // North double stair: measured base roof, bounded source-axis grading.
        const endpoints=stairLevels[feature.id];
        const y=endpoints?endpoints[0]+(endpoints[1]-endpoints[0])*distance/length:ground(x,z);
        put(x,y+.06,z,2.15,.12,length/count,0xa9a28d,-Math.atan2(b[1]-a[1],b[0]-a[0])+Math.PI/2);
        passed++;
      }
      root.userData.mappedSteps=(root.userData.mappedSteps??0)+passed;
    }
  }
  // Two short mapped north stair landings, joining the paired eleven-step flights.
  for (const [a,b] of [[[601.81,3465.6],[601.11,3468.4]],[[614.78,3468.77],[614.09,3471.58]]]) {
    put((a[0]+b[0])/2,40.999,(a[1]+b[1])/2,2.15,.12,Math.hypot(b[0]-a[0],b[1]-a[1]),0xa9a28d,-Math.atan2(b[1]-a[1],b[0]-a[0])+Math.PI/2);
  }
  // Water route is mapped, rock sizes/foam are visual subdivisions of it.
  const channel=lines.find(f=>f.id==='way/33284443')!.geometry.coordinates as number[][];
  for(let i=1;i<channel.length;i++){
    const a=channel[i-1],b=channel[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(length/3));
    for(let j=0;j<n;j++){
      const t=(j+.5)/n,x=a[0]+dx*t,z=a[1]+dz*t,y=viktoriaparkWaterAtV194(x,z,native),k=i*17+j;
      for(const sign of [-1,1]){
        const spread=1.35+(k%3)*.30,rx=x-dz/length*spread*sign,rz=z+dx/length*spread*sign;
        put(rx,ground(rx,rz)+.45,rz,1.6+(k%3)*.25,1.15+(k%2)*.45,1.7,sign>0?0x8f8877:0xa59a83,(k%7)*.3,true);
      }
      const xx=x+(k%3-1)*.35;
      put(xx,y+.14,z,.5+(k%4)*.18,.07,.35,0xd4e7df,0);
      if(k%2===0)put(x,y+.20,z,.18,.08,.9,0xa5c8c7,0);
    }
  }
  // The retained water holes need their narrow bank sheets when each pond
  // returns to its own level. Exact source union rings, no terrain infill.
  for(const ring of source.waterRings)for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(length/(native?.65:2)));
    for(let j=0;j<n;j++){
      const p=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],r=[a[0]+(b[0]-a[0])*(j+1)/n,a[1]+(b[1]-a[1])*(j+1)/n];
      if(native){const x=(p[0]+r[0])/2,z=(p[1]+r[1])/2,wy=viktoriaparkWaterAtV194(x,z,true),gy=ground(x,z),low=Math.min(wy,gy)-.08,high=Math.max(wy,gy)+.08;
        put(x,(low+high)/2,z,Math.max(.24,Math.abs(r[0]-p[0])+.1),high-low,Math.max(.24,Math.abs(r[1]-p[1])+.1),0x8f9278);
      }else{const pa=[p[0],ground(...p as [number,number])+.035,p[1]],pb=[p[0],viktoriaparkWaterAtV194(...p as [number,number])-.08,p[1]],ra=[r[0],ground(...r as [number,number])+.035,r[1]],rb=[r[0],viktoriaparkWaterAtV194(...r as [number,number])-.08,r[1]];
        tri([pa,pb,ra],0x8f9278);tri([ra,pb,rb],0x8f9278);
      }
    }
  }
  const makeInstances=(mat:number[],col:number[],rocks:boolean)=>{
    if(!col.length)return;
    const geo=rocks?new IcosahedronGeometry(.5,0):new BoxGeometry(1,1,1);geo.deleteAttribute('uv');
    const day=new MeshBasicMaterial(),night=new MeshStandardMaterial({roughness:.87,flatShading:true}),mesh=new InstancedMesh(geo,day,0);
    mesh.count=col.length/3;mesh.instanceMatrix=new InstancedBufferAttribute(new Float32Array(mat),16);mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(col),3);mesh.computeBoundingBox();mesh.computeBoundingSphere();
    mesh.name=rocks?'Viktoriapark angular cascade rocks and genii heads':'Viktoriapark iron tracery, niches, mapped steps and rails';mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,nativeMinecraft:native,keepInMinecraft:native};root.add(mesh);
  };
  makeInstances(matrices,boxColors,false);makeInstances(rockMatrices,rockColors,true);
  if(positions.length){const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(positions,3));geo.setAttribute('color',new Float32BufferAttribute(colors,3));geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.87}),mesh=new Mesh(geo,day);mesh.name='Complete measured octagonal base with tapered Gothic finials';mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};root.add(mesh);}
  return freezeStaticSceneTransforms(root);
}
