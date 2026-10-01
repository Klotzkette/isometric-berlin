import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import { addBox, addCylinder, createBuilder, finishDrawnGroup, paintGeometry } from "./drawnKit";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import source from "./data/spanishEmbassyV164Source.json";

export const SPANISH_EMBASSY_V164_GROUP = "Spanische Botschaft complete source architecture";
export const SPANISH_EMBASSY_V164_NATIVE_GROUP = "Spanische Botschaft independent native blocks";
export const SPANISH_EMBASSY_V164_PROFILE = Object.freeze({
  parentId: "DEBE01YYK0002NgP", landmarkPartId: "DEBE3DCzDC13dOb2", heritageId: "09050276",
  frontCenter: [-1782.2995, 892.328] as const,
  frontYaw: -Math.atan2(2.234, 20.559),
  columnCount: 4,
  state: "Present embassy: current Spanish crowned shield, retained historic facade and 1998–2003 rebuilt chancery wing.",
  detailStatus: "Measured five-part source shell; finite window, joint, four-column balcony, heraldic relief and flag proportions are display estimates from heritage description and licensed photographs.",
});

function instances(rows: readonly number[][], native = false, fixedSize = 0): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .88, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0), matrix = new Matrix4(), tint = new Color();
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  rows.forEach((r,i) => {
    if (fixedSize) matrix.makeScale(fixedSize,fixedSize,fixedSize);
    else { matrix.makeRotationY(native ? 0 : r[6]); matrix.scale(new Vector3(r[3],r[4],r[5])); }
    matrix.setPosition(r[0],r[1],r[2]);matrix.toArray(matrices,i*16);
    tint.setHex(r[fixedSize ? 3 : 7]).toArray(colors,i*3);
  });
  mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:native,nativeMinecraft:native};
  mesh.computeBoundingBox();mesh.computeBoundingSphere();return mesh;
}

function sourceShell(): Mesh {
  const size=source.surfaces.reduce((sum,s)=>sum+s.triangles.length*9,0);
  const positions=new Float32Array(size),colors=new Float32Array(size),color=new Color();let i=0;
  for(const s of source.surfaces){color.setHex(s.color);for(const t of s.triangles)for(const p of t){positions.set(p,i);colors.set([color.r,color.g,color.b],i);i+=3;}}
  const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.setAttribute("color",new Float32BufferAttribute(colors,3));
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.91,flatShading:true});
  const mesh=new Mesh(geometry,day);mesh.name="Five complete official embassy parts including rear roofs";mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return mesh;
}

/** Authored detail is local to the measured chamfered corner, not a rotated generic block. */
function entrance(native: boolean): Group {
  const builder=createBuilder(), rows:number[][]=[];
  const [cx,cz]=SPANISH_EMBASSY_V164_PROFILE.frontCenter,yaw=SPANISH_EMBASSY_V164_PROFILE.frontYaw;
  const at=(u:number,y:number,d:number):[number,number,number]=>[cx+Math.cos(yaw)*u-Math.sin(yaw)*d,y,cz-Math.sin(yaw)*u-Math.cos(yaw)*d];
  function box(color:number,u:number,y:number,d:number,w:number,h:number,depth:number):void {
    const [x,yy,z]=at(u,y,d);
    if(!native){addBox(builder,color,x,yy,z,w,h,depth,yaw,false);return;}
    // Surface-only axis-aligned blocks; source walls use the separate two-metre grid.
    const nx=Math.max(1,Math.ceil(w/.55)),ny=Math.max(1,Math.ceil(h/.55)),nz=Math.max(1,Math.ceil(depth/.55));
    for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++)for(let iz=0;iz<nz;iz++){
      if(ix>0&&ix<nx-1&&iy>0&&iy<ny-1&&iz>0&&iz<nz-1)continue;
      const q=at(u+(ix+.5)*w/nx-w/2,y+(iy+.5)*h/ny-h/2,d+(iz+.5)*depth/nz-depth/2);
      rows.push([...q,Math.max(.05,w/nx),Math.max(.05,h/ny),Math.max(.05,depth/nz),0,color]);
    }
  }
  function column(color:number,u:number,y:number,d:number,r:number,h:number):void {
    if(native){box(color,u,y,d,r*1.7,h,r*1.7);return;}
    const p=at(u,y,d);addCylinder(builder,color,p[0],p[1],p[2],r,h,12,false);
  }
  function line(color:number,a:number[],b:number[],width:number):void {
    const aa=at(a[0],a[1],a[2]),bb=at(b[0],b[1],b[2]);
    const delta=new Vector3(bb[0]-aa[0],bb[1]-aa[1],bb[2]-aa[2]),length=delta.length();if(length<1e-5)return;
    if(native){const n=Math.ceil(length/Math.max(width,.15));for(let j=0;j<=n;j++)rows.push([aa[0]+delta.x*j/n,aa[1]+delta.y*j/n,aa[2]+delta.z*j/n,width,width,width,0,color]);return;}
    const g=new BoxGeometry(width,length,width),up=new Vector3(0,1,0),direction=delta.clone().normalize(),axis=new Vector3().crossVectors(up,direction);
    if(axis.lengthSq()>1e-10)g.applyMatrix4(new Matrix4().makeRotationAxis(axis.normalize(),Math.acos(up.dot(direction))));else if(direction.y<0)g.rotateX(Math.PI);
    g.translate((aa[0]+bb[0])/2,(aa[1]+bb[1])/2,(aa[2]+bb[2])/2);paintGeometry(g,color);builder.parts.push(g);
  }
  const stone=0xC6C0AE,trim=0xD0C9B8,shade=0x9A9587,glass=0x303B36;
  // Three actual corner door/window axes behind the projecting four-column balcony.
  for(const u of [-3.9,0,3.9]){
    box(glass,u,10.65,.13,2.25,4.35,.12);
    box(trim,u,8.36,.23,2.65,.18,.35);
    box(trim,u,12.95,.23,2.65,.22,.32);
    for(const du of [-1.21,1.21])box(trim,u+du,10.65,.21,.17,4.65,.28);
    box(0x747D73,u,10.65,.25,.07,4.32,.10);
    box(0x747D73,u,11.55,.25,2.24,.07,.10);
    box(glass,u,17.2,.14,2.55,3.9,.14);
    for(const du of [-1.46,1.46])box(trim,u+du,17.2,.30,.25,4.3,.45);
    box(trim,u,19.38,.34,3.13,.23,.50);
    box(0x969C90,u,17.2,.26,.07,3.88,.12);
    box(0x969C90,u,17.5,.26,2.5,.07,.12);
  }
  for(const u of [-5.55,-1.85,1.85,5.55]){
    box(shade,u,5.53,3.0,1.15,.52,1.15);
    box(trim,u,5.89,3.0,1.05,.21,1.05);
    column(stone,u,9.5,3.0,.44,7.0);
    column(trim,u,6.08,3.0,.51,.2);
    column(trim,u,12.87,3.0,.50,.22);
    box(trim,u,13.18,3.0,1.02,.4,.94);
    // Small carved volute/leaf suggestion stays a finite vector relief.
    for(const du of [-.29,.29])column(shade,u+du,13.15,3.32,.105,.25);
    box(trim,u,13.44,3.0,1.24,.18,1.14);
  }
  box(shade,0,13.62,1.65,12.7,.22,3.7);
  box(stone,0,13.9,1.67,13.1,.37,4.0);
  box(trim,0,14.2,1.67,13.6,.18,4.18);
  for(const u of [-6.22,6.22])box(trim,u,14.85,3.59,.45,1.15,.42);
  for(let i=0;i<29;i++){
    const u=-5.93+i*11.86/28;column(stone,u,14.80,3.6,.078,.99);column(trim,u,14.58,3.6,.115,.34);
  }
  box(trim,0,15.39,3.6,13.0,.14,.47);
  for(const side of [-1,1]){
    for(let i=1;i<7;i++)column(stone,side*6.23,14.82,i*.5,.08,1.0);
    box(trim,side*6.23,15.39,1.85,.42,.14,3.5);
  }
  box(shade,0,19.70,.4,13.0,.2,.5);box(trim,0,19.92,.43,12.8,.24,.66);
  for(const u of [-5.55,-1.85,1.85,5.55]){
    box(trim,u,19.3,.40,.68,.69,.38);
    for(let i=0;i<6;i++){const angle=i*Math.PI/3;box(shade,u+Math.cos(angle)*.18,19.3+Math.sin(angle)*.18,.63,.12,.12,.09);}
  }
  // Present-day arms: crowned quartered shield plus two pillars, not the former eagle.
  box(stone,0,22.0,.22,4.2,4.35,.16);
  box(trim,0,21.65,.39,1.83,2.35,.2);
  for(const side of [-1,1]){
    column(trim,side*1.58,21.55,.47,.19,2.25);
    box(trim,side*1.58,20.32,.47,.72,.18,.36);box(trim,side*1.58,22.83,.47,.58,.19,.36);
    line(shade,[side*1.84,21.25,.65],[side*1.30,21.70,.65],.12);
  }
  for(const u of [-.54,-.26,0,.26,.54])box(shade,u,21.13,.53,.07,.9,.06);
  box(shade,0,21.66,.56,1.66,.055,.07);box(shade,0,21.65,.56,.055,2.24,.07);
  box(shade,-.43,22.14,.57,.48,.6,.07);
  for(const u of [-.63,-.43,-.23])box(trim,u,22.47,.64,.12,.13,.06);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;line(shade,[.40,21.11,.58],[.40+Math.cos(a)*.31,21.11+Math.sin(a)*.35,.58],.055);}
  line(shade,[.3,21.89,.61],[.63,22.31,.61],.12);line(shade,[.63,22.31,.61],[.38,22.58,.61],.10);
  box(trim,0,23.0,.44,1.94,.2,.30);
  for(let i=0;i<5;i++){
    const u=-.85+i*.425;line(trim,[u,23.05,.47],[u*.72,23.55+(.3-Math.abs(u)*.35),.47],.105);
  }
  box(trim,0,24.04,.47,.10,.39,.16);box(trim,0,24.07,.47,.29,.095,.16);
  // Poles and restrained folded flag silhouettes follow the two photographed poles.
  for(const [u,kind] of [[-8.0,0],[-6.9,1]] as const){
    column(0xA8AAA0,u,10.1,4.7,.047,9.7);
    const width=1.25,height=2.4,top=14.3;
    for(let ix=0;ix<10;ix++){
      const x=u+(ix+.5)*width/10,depth=4.7+Math.sin(ix/10*Math.PI*1.3)*.18;
      for(let stripe=0;stripe<4;stripe++)box(kind?0x264783:(stripe===0||stripe===3?0xA22E2A:0xD8B647),x,top-(stripe+.5)*height/4,depth,width/10+.005,height/4,.035);
    }
    if(kind)for(let i=0;i<12;i++){const a=i*Math.PI/6;box(0xD5BC58,u+width*.55+Math.cos(a)*.32,top-height/2+Math.sin(a)*.45,4.93,.065,.075,.04);}
  }
  const root=new Group();root.name="Four-column embassy portico current coat of arms and balcony";
  root.userData={columnCount:4,displayEstimate:true,sourceHeritageId:"09050276",currentCoatOfArms:true};
  if(native){root.add(instances(rows,true));root.userData.nativeBlockCount=rows.length;}
  else root.add(finishDrawnGroup(builder,{name:"Embassy carved entrance recognition"})!);
  return root;
}

export function createSpanishEmbassyV164(_options:{mobileLike?:boolean}={}):Group {
  const root=new Group();root.name=SPANISH_EMBASSY_V164_GROUP;
  root.userData={sourcePartIds:source.parts.map(p=>p.id),textureFree:true};
  const details=instances(source.facadeBoxes);details.name="Embassy source-clipped window surrounds and stone courses";
  root.add(sourceShell(),details,entrance(false));return freezeStaticSceneTransforms(root);
}
export function createMinecraftSpanishEmbassyV164(_options:{mobileLike?:boolean}={}):Group {
  const root=new Group();root.name=SPANISH_EMBASSY_V164_NATIVE_GROUP;
  root.userData={sourcePartIds:source.parts.map(p=>p.id),textureFree:true,blockNative:true,keepInMinecraft:true};
  root.add(instances(source.nativeBlocks,true,2),entrance(true));return freezeStaticSceneTransforms(root);
}
