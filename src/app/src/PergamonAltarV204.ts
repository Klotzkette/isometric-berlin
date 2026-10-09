import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
type P=[number,number,number];
type Kind='stone'|'shaft'|'round'|'figure';
/** Berlin's reconstructed west front, not an invented complete ancient temple.
 * Architectural subdivisions and relief figures are display interpretations;
 * see docs/pergamon-altar-v204.md for evidence and accuracy limits. */
export const PERGAMON_ALTAR_V204 = {width:35.64, depth:18.4, stairWidth:20, stairCount:28, podiumTop:5.28, columnCount:42, textureFree:true} as const;
function shaft():BufferGeometry{
  const p:number[]=[],indices:number[]=[],n=96;
  for(let j=0;j<5;j++)for(let i=0;i<=n;i++){
    const t=j/4,a=i*2*Math.PI/n;
    const r=(.5-.045*t+.012*Math.sin(t*Math.PI))*(.95+.05*Math.cos(a*24));
    p.push(r*Math.cos(a),t-.5,r*Math.sin(a));
  }
  for(let j=0;j<4;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;indices.push(a,b,a+1,a+1,b,b+1);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function shaded(g:BufferGeometry):BufferGeometry{
  g.deleteAttribute('uv');const n=g.getAttribute('normal'),colors=new Float32Array(n.count*3);
  for(let i=0;i<n.count;i++){const light=.76+.24*Math.max(0,n.getX(i)*-.38+n.getY(i)*.82+n.getZ(i)*.43);colors.set([light,light,light],i*3);}
  g.setAttribute('color',new Float32BufferAttribute(colors,3));return g;
}
export function createPergamonAltarV204():Group{
  const root=new Group();root.name='Pergamon Altar — white marble west front';root.userData={...PERGAMON_ALTAR_V204,pergamonAltar:true,keepInMinecraft:true};
  const rows=new Map<Kind,{matrix:number[];color:number}[]>(),q=new Quaternion(),m=new Matrix4();
  const add=(kind:Kind,p:P,s:P,color=0xf5f2e9,rotation=new Quaternion())=>{
    const a=rows.get(kind)??[];a.push({matrix:m.compose(new Vector3(...p),rotation,new Vector3(...s)).toArray(),color});rows.set(kind,a);
  };
  const box=(p:P,s:P,color=0xf5f2e9)=>add('stone',p,s,color);
  const bead=(p:P,s:P,color=0xeeeae0)=>add('figure',p,s,color);
  const beam=(a:P,b:P,w:number,color=0xe5e0d5)=>{
    const d=new Vector3(...b).sub(new Vector3(...a));const len=d.length();
    add('round',a.map((v,k)=>(v+b[k])/2) as P,[w,len,w],color,q.setFromUnitVectors(new Vector3(0,1,0),d.normalize()));
  };
  // Low presentation slab and five continuous shallow foundation courses.
  box([0,.09,0],[36.3,.18,18.8],0xe0ddd4);
  for(let i=0;i<5;i++){
    const y=.18+(i+.5)*.16,w=35.64-i*.19,d=18.4-i*.17;
    for(const sign of[-1,1])box([sign*(10+(w-20)/4),y,0],[(w-20)/2,.16,d]);
    box([0,y,-7.7],[20,.16,2.3]);
  }
  // Broad stair opens between the two relief-clad projecting wings.
  for(let i=0;i<28;i++){
    const h=(5.28-.18)/28,front=9.2-i*.425,back=-3.0;
    box([0,.18+(i+.5)*h,(front+back)/2],[20,h,front-back],i%4===0?0xf6f3eb:0xf1ede3);
    box([0,.18+(i+1)*h+.016,front+.032],[20,.030,.054],0xffffff);
  }
  box([0,5.14,-5.85],[34.5,.28,5.7]);
  // Wing bodies, socles, projecting cornices and upper colonnade platforms.
  for(const sign of[-1,1]){
    const x=sign*13.5;
    box([x,2.97,.1],[7,4.06,16.8],0xe4e0d5);
    for(const[y,w,h,d]of[[1.04,7.55,.18,17.3],[1.23,7.4,.12,17.2],[1.46,7.3,.25,17.1],[2.0,7.47,.16,17.15],[2.13,7.25,.12,17],[4.47,7.3,.16,17.05],[4.65,7.56,.2,17.3],[4.85,7.88,.14,17.55],[5.07,7.35,.3,17.0]])box([x,y,.1],[w,h,d]);
    // Fine horizontal masonry joints in the otherwise quiet plinth.
    for(const y of[1.7,1.88])box([x,y,8.51],[7,.016,.018],0xc5c0b4);
    for(let i=0;i<5;i++)box([x-3+i*1.5,1.64,8.52],[.018,.32,.018],0xc8c2b6);
  }
  const columnPositions:P[]=[];
  for(const sign of[-1,1]){
    for(let i=0;i<4;i++)columnPositions.push([sign*(10.55+i*1.97),7.45,7.96]);
    for(let i=0;i<6;i++){
      columnPositions.push([sign*10.55,7.45,5.8-i*2.16]);
      columnPositions.push([sign*16.46,7.45,5.8-i*2.16]);
    }
  }
  // Back cross-colonnade ends join the return columns above the stairs.
  for(let i=0;i<10;i++)columnPositions.push([-9.25+i*(18.5/9),7.45,-5.0]);
  for(const[x,y,z]of columnPositions){
    add('shaft',[x,y,z],[.69,4.05,.69]);
    for(const[cy,w,h]of[[5.32,.98,.14],[5.45,.87,.12],[5.56,.77,.11],[9.51,.76,.12],[9.64,.86,.12]])add('round',[x,cy,z],[w,h,w]);
    box([x,9.81,z],[1.15,.16,.88]);
    for(const sign of[-1,1]){
      // Raised spiral volutes, open to the front and rear of the Ionic capital.
      for(const face of[-1,1])for(let i=0;i<18;i++){
        const a=i*.42,b=(i+1)*.42,r=.19*(1-i/22),rr=.19*(1-(i+1)/22),cx=x+sign*.39;
        beam([cx+r*Math.cos(a),9.65+r*Math.sin(a),z+face*.38],[cx+rr*Math.cos(b),9.65+rr*Math.sin(b),z+face*.38],.054);
      }
    }
  }
  const entablature=(x:number,z:number,w:number,d:number)=>{
    for(const[y,h,o]of[[9.99,.19,0],[10.18,.15,.12],[10.36,.23,.04],[10.56,.13,.25],[10.72,.18,.32]])box([x,y,z],[w+o,h,d+o]);
    const along=w>d,length=along?w:d,count=Math.floor(length/.28);
    for(let i=0;i<count;i++){const offset=-length/2+(i+.5)*length/count;for(const sign of[-1,1])box([x+(along?offset:sign*w/2),10.46,z+(along?sign*d/2:offset)],[.12,.15,.12],0xe0dace);}
  };
  entablature(0,-5,33.4,1.23);
  for(const sign of[-1,1]){
    entablature(sign*13.5,7.96,7.75,1.23);
    entablature(sign*10.55,1.48,1.23,13.0);
    entablature(sign*16.46,1.48,1.23,13.0);
    // Coffered ceiling boards over each wing; the centre remains open.
    box([sign*13.5,10.03,1.48],[5.65,.13,12.2],0xdcd6c9);
    for(let i=0;i<6;i++)box([sign*13.5,9.9,6.9-i*2.12],[5.7,.12,.16]);
    for(let i=0;i<3;i++)box([sign*(11.6+i*1.9),9.9,1.48],[.14,.12,12.2]);
  }
  // Figurative high relief, varied poses and drapery in a continuous frieze.
  // Deliberately no invented named mythological identifications.
  let figures=0;
  const relief=(x:number,z:number,yaw:number,index:number,small=false)=>{
    const c=Math.cos(yaw),s=Math.sin(yaw),scale=small?.72:1;
    const at=(u:number,y:number,v:number):P=>[x+(c*u+s*v)*scale,2.19+y*scale,z+(-s*u+c*v)*scale];
    const lean=Math.sin(index*2.7)*.17;
    const sculpt=(u:number,y:number,v:number,w:number,h:number,d:number,color=0xe6e1d5)=>bead(at(u,y,v),[w*scale,h*scale,d*scale],color);
    const limb=(a:P,b:P,w:number)=>beam(at(...a),at(...b),w*scale,0xece6da);
    sculpt(lean,1.79,.21,.23,.29,.24); // head, nose and curled hair
    sculpt(lean+.02,1.73,.34,.075,.10,.075,0xf8f4ec);
    for(let j=0;j<7;j++){const a=j*Math.PI/4;sculpt(lean+.105*Math.cos(a),1.86+.09*Math.sin(a),.205,.075,.07,.07,0xd5cdbf);}
    sculpt(0,1.24,.20,.41,.72,.29);sculpt(.05,.88,.18,.43,.28,.29);
    const swing=index%3;
    limb([-.15,1.53,.19],[-.41,1.36+swing*.17,.26],.13);
    limb([-.41,1.36+swing*.17,.26],[-.56,1.57+swing*.13,.28],.105);
    limb([.15,1.52,.19],[.35,1.65-swing*.24,.30],.125);
    limb([.35,1.65-swing*.24,.30],[.54,1.92-swing*.33,.31],.095);
    limb([-.11,.87,.19],[-.22,.45,.28],.19);limb([-.22,.45,.28],[-.37,.11,.31],.135);
    limb([.15,.86,.17],[.29,.52,.30],.18);limb([.29,.52,.30],[.18,.10,.33],.13);
    sculpt(-.4,.07,.34,.25,.10,.18);sculpt(.23,.065,.37,.24,.09,.16);
    for(let j=0;j<7;j++)limb([-.23+j*.075,.98,.35],[-.36+j*.12,.25+.12*Math.sin(j),.34],.035);
    if(index%4===0)for(let j=0;j<5;j++)limb([.11,1.45,.08],[.56+j*.065,1.83-j*.13,.04],.07);
    figures++;
  };
  for(const sign of[-1,1]){
    for(let i=0;i<8;i++)relief(sign*13.5-3.08+i*.88,8.56,0,i+(sign>0?3:0));
    for(let i=0;i<16;i++)relief(sign*17.02,-7.1+i*.99,sign*Math.PI/2,i+5);
    // Inside the stair cheeks the relief follows the ascending stair.
    for(let i=0;i<7;i++)relief(sign*9.98,7.8-i*.69,-sign*Math.PI/2,i+11,true);
  }
  // Small roof acroteria at the four projecting corners.
  for(const sign of[-1,1])for(const x of[10.55,16.46]){
    const cx=sign*x;box([cx,10.9,7.96],[.62,.18,.6]);
    bead([cx,11.56,7.96],[.48,1.02,.35]);bead([cx,12.12,7.96],[.24,.27,.24]);
    for(const side of[-1,1])beam([cx+side*.17,11.8,7.96],[cx+side*.27,11.3,8.02],.105);
    for(let i=0;i<5;i++)beam([cx-.15+i*.075,11.75,8.12],[cx-.23+i*.115,11.1,8.14],.024,0xc9c2b5);
  }
  const geometries:Record<Kind,BufferGeometry>={stone:new BoxGeometry(),shaft:shaft(),round:new CylinderGeometry(.5,.5,1,12),figure:new IcosahedronGeometry(.5,1)};
  const material=new MeshBasicMaterial({vertexColors:true,toneMapped:false});
  for(const[kind,data]of rows){
    const mesh=new InstancedMesh(shaded(geometries[kind]),material,0),matrix=new Float32Array(data.length*16),color=new Float32Array(data.length*3),c=new Color();
    data.forEach((r,i)=>{matrix.set(r.matrix,i*16);c.setHex(r.color).toArray(color,i*3);});
    mesh.instanceMatrix=new InstancedBufferAttribute(matrix,16);mesh.instanceColor=new InstancedBufferAttribute(color,3);mesh.count=data.length;
    mesh.name=`Pergamon altar ${kind}`;mesh.userData.textureFree=true;mesh.computeBoundingSphere();mesh.computeBoundingBox();root.add(mesh);
  }
  root.userData.columnCount=columnPositions.length;root.userData.reliefFigureCount=figures;
  return freezeStaticSceneTransforms(root);
}
