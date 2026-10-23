import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import source from './data/chariteCampusV265.json';
import { chariteFacadePointExposed, chariteRingWalls, type ChariteFacadeWall } from './HistoricChariteCampus';
import { letteringStrokePaths } from './drawnLettering';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
type Point = [number, number, number];
export type ChariteCampusRecordV265 = { position: Point; size: Point; angle: number; tone: number; owner: string; role: string };
const WHITE=0xe2dfcf,BRICK=0xa65d48,STONE=0xd0c6b1,GLASS=0x435b60,BRONZE=0x65574b,PALE=0xe9dfc9;
export const CHARITE_CAMPUS_V265_PROFILE = {
  sourceSha256:source.sourceSha256,sourceParts:32,museumFrontOwner:'gwXjAt32',museumFrontEdges:[14,16],
  museumFrontBays:[4,3],upperStoreys:3,upperPanesPerBay:3,vitrineHeightM:source.museumVitrineHeightM,
  formerWindowGroupsReplaced:19,photographicTexture:false,dimensionPolicy:source.dimensionPolicy,
  cameras:{museum:{position:[296,38,-844],target:[230,15,-795]},ruska:{position:[403,28,-858],target:[454,15,-905]}},
} as const;

/** Construction-local rows; ordinary scenes retain neither rows nor evidence. */
export function chariteCampusRecordsV265(native=false):ChariteCampusRecordV265[] {
  const rows:ChariteCampusRecordV265[]=[];
  const emit=(owner:string,role:string,position:Point,size:Point,angle:number,tone:number)=>{
    if(!size.every(v=>v>0&&Number.isFinite(v)))throw new Error('Invalid Charité v265 fitting');
    rows.push({owner,role,position,size,angle,tone});
  };
  const panel=(owner:string,role:string,w:ChariteFacadeWall,u:number,y:number,width:number,height:number,depth:number,tone:number,out=.37)=>{
    if(!native)emit(owner,role,[w.x1+w.dirX*u+w.nx*out,y,w.z1+w.dirZ*u+w.nz*out],[width,height,depth],-Math.atan2(w.dirZ,w.dirX),tone);
    else {
      // Independent orthogonal facade cells rather than a rotated smooth double.
      const n=Math.max(1,Math.ceil(width/.4)),step=width/n;
      for(let i=0;i<n;i++){const a=u-width/2+(i+.5)*step;
        emit(owner,role,[w.x1+w.dirX*a+w.nx*out,y,w.z1+w.dirZ*a+w.nz*out],
          [Math.abs(w.dirX)*step+Math.abs(w.nx)*depth,height,Math.abs(w.dirZ)*step+Math.abs(w.nz)*depth],0,tone);}
    }
  };
  const segment=(owner:string,role:string,a:Point,b:Point,width:number,tone:number)=>{
    const d=b.map((v,i)=>v-a[i]),n=Math.max(1,Math.ceil(Math.hypot(...d)/.075));
    for(let i=0;i<n;i++)emit(owner,role,a.map((v,j)=>v+d[j]*(i+.5)/n) as Point,d.map(v=>Math.max(width,Math.abs(v)/n)) as Point,0,tone);
  };
  const label=(owner:string,w:ChariteFacadeWall,text:string,u:number,y:number,height:number,out:number)=>{
    const paths=letteringStrokePaths(text,height),points=paths.flat(),mid=(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2;
    const at=(x:number,yy:number):Point=>[w.x1+w.dirX*u+w.nx*out+w.nz*(x-mid),y+yy,w.z1+w.dirZ*u+w.nz*out-w.nx*(x-mid)];
    for(const p of paths)for(let i=1;i<p.length;i++)segment(owner,'museum-geometric-lettering',at(...p[i-1]),at(...p[i]),height*.065,WHITE);
  };
  const arched=(owner:string,role:string,w:ChariteFacadeWall,u:number,bottom:number,width:number,height:number,frame:number,out=.38)=>{
    const rise=Math.min(width*.31,.62),n=native?9:15,step=width/n;
    for(let i=0;i<n;i++){const dx=(i+.5)*step-width/2,top=bottom+height-rise+rise*Math.sqrt(Math.max(0,1-(dx/(width/2))**2));
      panel(owner,role+'-pane',w,u+dx,(bottom+top)/2,step+.012,top-bottom,.065,GLASS,out);
      panel(owner,role+'-arch',w,u+dx,top+.055,step+.025,.12,.12,frame,out+.095);}
    for(const du of [-width/2-.035,width/2+.035])panel(owner,role+'-jamb',w,u+du,bottom+(height-rise)/2,.10,height-rise+.10,.12,frame,out+.095);
    panel(owner,role+'-sill',w,u,bottom-.04,width+.20,.12,.21,frame,out+.07);
  };
  const museum=source.parts.find(p=>p.id==='gwXjAt32')!,walls=chariteRingWalls(museum.ring),ground=museum.y0_dm/10;
  for(const [index,edge] of source.museumFront.edges.entries()){
    const w=walls.find(w=>w.index===edge)!,bays=source.museumFront.bays[index],pitch=w.length/bays;
    for(let bay=0;bay<bays;bay++){
      const u=pitch*(bay+.5),width=edge===14?3.35:2.9;
      // Architect-published six-metre bronze vitrines. Only superseded exact
      // opening recipes yield; complete source shell, roof and masonry stay.
      arched(museum.id,'museum-bronze-vitrine',w,u,ground+.20,width,6,BRONZE,.40);
      panel(museum.id,'museum-vitrine-base',w,u,ground+.41,width,.34,.14,BRONZE,.54);
      const upperWidth=width+.15;
      for(let floor=0;floor<3;floor++){
        const bottom=ground+7.7+floor*(edge===14?4.65:3.55),paneHeight=edge===14?3.45:2.85;
        if(floor<2)panel(museum.id,'museum-pale-spandrel',w,u,bottom+paneHeight+.65,upperWidth+.23,edge===14?1.14:.62,.055,PALE,.27);
        for(let pane=0;pane<3;pane++){
          const paneWidth=(upperWidth-.40)/3,pu=u+(pane-1)*(paneWidth+.20);
          arched(museum.id,'museum-triple-upper',w,pu,bottom,paneWidth,paneHeight,BRICK);
          panel(museum.id,'museum-white-transom',w,pu,bottom+1.12,paneWidth,.070,.085,WHITE,.52);
          for(const du of [-paneWidth/2+.055,paneWidth/2-.055])panel(museum.id,'museum-white-frame',w,pu+du,bottom+(paneHeight-.41)/2,.075,paneHeight-.41,.085,WHITE,.52);
        }
        panel(museum.id,'museum-triple-sill',w,u,bottom-.16,upperWidth+.34,.14,.28,STONE,.47);
      }
      // Entry in the second main opening from the photographed right corner.
      if(edge===14&&bay===1){
        for(const du of [-width/2-.10,width/2+.10])panel(museum.id,'museum-projecting-bronze-door-cheek',w,u+du,ground+3.14,.15,5.9,1.1,BRONZE,.92);
        for(let i=0;i<15;i++){const dx=(i+.5)*width/15-width/2,y=ground+.2+6-.62+.62*Math.sqrt(Math.max(0,1-(dx/(width/2))**2));
          panel(museum.id,'museum-projecting-bronze-door-crown',w,u+dx,y+.12,width/15+.03,.17,1.10,BRONZE,.92);}
        for(const du of [-.72,.72]){
          panel(museum.id,'museum-entry-door-leaf',w,u+du,ground+1.53,1.28,2.61,.08,GLASS,1.43);
          for(const side of [-.62,.62])panel(museum.id,'museum-entry-door-frame',w,u+du+side,ground+1.53,.07,2.66,.08,BRONZE,1.50);
        }
        panel(museum.id,'museum-entry-transom',w,u,ground+2.89,2.85,.10,.09,BRONZE,1.5);
        label(museum.id,w,'MUSEUM',u,ground+3.18,.38,1.51);
      }
    }
    for(let u=.35;u<w.length-.2;u+=.72)panel(museum.id,'museum-cornice-dentil',w,u,26.22,.16,.22,.22,STONE,.33);
  }
  const ruska=source.parts.find(p=>p.id==='mEGhfy5X')!,rw=chariteRingWalls(ruska.ring),low=ruska.y0_dm/10,pf=(ruska.h_dm/10-1.6)/3;
  for(const w of rw.filter(w=>[2,3].includes(w.index))){
    const bays=Math.max(1,Math.floor((w.length-.8)/3.05)),pitch=(w.length-.8)/bays;
    for(let bay=0;bay<bays;bay++){
      const u=.4+pitch*(bay+.5);
      if(!chariteFacadePointExposed(ruska.id,w,u,low+.75,source.parts))continue;
      arched(ruska.id,'ruska-basement-light',w,u,low+.08,.82,.91,BRICK,.36);
      for(const du of [-.22,0,.22])panel(ruska.id,'ruska-basement-grille',w,u+du,low+.48,.035,.70,.045,0x6e7976,.51);
      if(bay%3===1){const y=low+2.4+2*pf+.64;
        panel(ruska.id,'ruska-partly-lowered-blind',w,u,y,1.29,.72,.045,0xc8c5b8,.37);
        for(let j=0;j<7;j++)panel(ruska.id,'ruska-blind-slat',w,u,y-.30+j*.10,1.28,.024,.025,0x9d9d93,.41);
      }
    }
    for(const u of [0.4+pitch*Math.round(bays/3),0.4+pitch*Math.round(bays*2/3)]){
      if(!chariteFacadePointExposed(ruska.id,w,u,low+9,source.parts))continue;
      panel(ruska.id,'ruska-rainwater-pipe',w,u,low+8.45,.085,16.5,.10,0x778481,.48);
      for(let j=0;j<5;j++)panel(ruska.id,'ruska-pipe-clamp',w,u,low+1.6+j*3.2,.17,.055,.15,0x596c69,.48);
    }
    for(let u=.36;u<w.length-.3;u+=.72)panel(ruska.id,'ruska-eaves-dentil',w,u,low+ruska.h_dm/10-.58,.16,.21,.16,BRICK,.31);
  }
  return rows;
}
export function createChariteCampusV265(native=false,options:{diagnostics?:boolean;mobileLike?:boolean}={}):Group{
  const root=new Group();root.name='Charite museum and Ruska architectural refinement v265';
  const rows=chariteCampusRecordsV265(native),geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute('uv');
  const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.84}),mesh=new InstancedMesh(geometry,day,0);
  const matrix=new Matrix4(),color=new Color(),quat=new Quaternion(),up=new Vector3(0,1,0),position=new Vector3(),scale=new Vector3();
  const matrices=new Float32Array(rows.length*16),colours=new Float32Array(rows.length*3);
  rows.forEach((r,i)=>{matrix.compose(position.set(...r.position),quat.setFromAxisAngle(up,r.angle),scale.set(...r.size));matrix.toArray(matrices,i*16);color.setHex(r.tone).toArray(colours,i*3);});
  mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colours,3);
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};
  mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  root.userData={...CHARITE_CAMPUS_V265_PROFILE,sourceEnvelopeRetained:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,instances:rows.length};
  if(options.diagnostics)root.userData.records=rows;
  return freezeStaticSceneTransforms(root);
}
