import { BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, ShapeUtils, Vector2, Vector3 } from 'three';
import data from './data/campusNordV266.json';
import { chariteFacadePointExposed, chariteRingWalls, type ChariteFacadeWall, type ChariteSourcePrism } from './HistoricChariteCampus';
import { CHARITE_THEATRE_PROFILE as T, chariteTheatreRoofAt } from './chariteTheatreProfile';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
import { campusCanopySolidsV266 } from './CampusNordV266Profile';

type Point=[number,number,number];
export type CampusNordRowV266={position:Point;size:Point;angle:number;tone:number;role:string;owner:string;wall?:number;along?:number;outward?:number};
const BRICK=0xb66c50,PALE=0xc7a276,FRAME=0x646d66,GLASS=0x405b60,LIGHT=0xeee5d2;
const GREEN=[0x367269,0x9dad98,0x769b4b];

export const CAMPUS_NORD_V266_PROFILE={
  owners:[...data.mensa,...data.rhoda].map(p=>p.id),
  retainedTheatreOwners:['sFAYdHwz','uBD055gq'],
  sourceEnvelopeRetained:true,sourceReplacementCount:1,completeCanopyRoofRetained:true,fullMobileIdentical:true,
  geometryStatus:'Measured plans/heights retained; additive photo-estimated facade fittings and existing-theatre-bound detail only.',
};

/** All facade samples are outside this owner and outside every adjacent owner.
 * Window endpoints and vertical limits are checked too, not just the centre. */
const facadeNeighbours=data.neighbours.filter(p=>p.id!=='K0001xN5');
export function campusNordPanelExposedV266(owner:string,w:ChariteFacadeWall,u:number,y:number,width:number,height:number):boolean{
  return [-.48,0,.48].every(dx=>[-.48,0,.48].every(dy=>chariteFacadePointExposed(owner,w,u+dx*width,y+dy*height,facadeNeighbours,.36)));
}

export function campusNordGeometryV266(native=false):CampusNordRowV266[]{
  const rows:CampusNordRowV266[]=[];
  const emit=(position:Point,size:Point,tone:number,role:string,owner:string,angle=0,wall?:number,along?:number,outward?:number)=>rows.push({position,size,tone,role,owner,angle,wall,along,outward});
  const panel=(p:ChariteSourcePrism,w:ChariteFacadeWall,u:number,y:number,width:number,height:number,out:number,depth:number,tone:number,role:string,check=true)=>{
    if(width<=0||height<=0||u-width/2<-.001||u+width/2>w.length+.001)return;
    const bottom=p.y0_dm/10,top=bottom+p.h_dm/10;
    if(y-height/2<bottom-.001||y+height/2>top+.001)return;
    const n=Math.max(1,Math.ceil(width/(native?.65:2.5))),step=width/n;
    for(let i=0;i<n;i++){
      const along=u-width/2+(i+.5)*step;
      if(check&&!campusNordPanelExposedV266(p.id,w,along,y,step,height))continue;
      const position:Point=[w.x1+w.dirX*along+w.nx*out,y,w.z1+w.dirZ*along+w.nz*out];
      const size:Point=native?[Math.abs(w.dirX)*step+Math.abs(w.nx)*depth,height,Math.abs(w.dirZ)*step+Math.abs(w.nz)*depth]:[step,height,depth];
      emit(position,size,tone,role,p.id,native?0:-Math.atan2(w.dirZ,w.dirX),w.index,along,out);
    }
  };
  // Source-defined walls stay underneath a thin facade skin. Neighbour-height
  // boundaries expose only the upper wall where a lower annex meets it.
  const skin=(p:ChariteSourcePrism,w:ChariteFacadeWall,tone:number,role:string)=>{
    const low=p.y0_dm/10,high=(p.y0_dm+p.h_dm)/10;
    const levels=[low,...new Set(data.neighbours.flatMap(n=>[n.y0_dm/10,(n.y0_dm+n.h_dm)/10]).filter(y=>y>low+.01&&y<high-.01)),high].sort((a,b)=>a-b);
    for(let i=1;i<levels.length;i++)panel(p,w,w.length/2,(levels[i]+levels[i-1])/2,w.length,levels[i]-levels[i-1],.12,.12,tone,role);
  };
  for(const p of data.mensa){
    const base=p.y0_dm/10,top=(p.y0_dm+p.h_dm)/10,tall=p.id==='cnd7L8ij',foyer=p.id==='4WsiIJCz';
    for(const w of chariteRingWalls(p.ring)){
      if(w.length<.5)continue;
      skin(p,w,foyer?GLASS:BRICK,foyer?'mensa-glass-foyer':'mensa-retained-washhouse-brick');
      if(foyer){
        panel(p,w,w.length/2,top-.15,w.length,.25,.20,.36,0xbbbdb5,'foyer-thin-concrete-roof-edge');
        const bays=Math.max(1,Math.round(w.length/1.65));
        for(let i=0;i<=bays;i++)panel(p,w,.06+i*(w.length-.12)/bays,(base+top-.28)/2,.09,top-base-.28,.29,.14,0x394e49,'foyer-slender-mullion');
        panel(p,w,w.length/2,base+3.8,w.length,.09,.29,.12,0x394e49,'foyer-transom');
        continue;
      }
      for(const offset of (tall?[.65,1.15,5.2,5.52,9.55,9.85,12.65]:[.65,1.15,5.7,6.15])){
        panel(p,w,w.length/2,base+offset,w.length,.13,.21,.08,PALE,'washhouse-pale-brick-band');
      }
      panel(p,w,w.length/2,top-.20,w.length,.22,.23,.24,PALE,'washhouse-parapet-coping');
      if(w.length<2.6)continue;
      const bays=Math.max(1,Math.round(w.length/3.6)),pitch=w.length/bays;
      for(let i=0;i<bays;i++){
        const u=(i+.5)*pitch,width=Math.min(1.75,pitch-.9);
        for(const y of (tall?[base+3.15,base+7.45]:[base+3.15])){
          const h=2.55;
          if(!campusNordPanelExposedV266(p.id,w,u,y,width+.30,h+.75))continue;
          panel(p,w,u,y,width+.24,h+.24,.23,.12,0x794e3e,'washhouse-window-reveal');
          panel(p,w,u,y,width,h,.31,.10,GLASS,'washhouse-segmental-window');
          for(const dx of [-width/2,0,width/2])panel(p,w,u+dx,y,.07,h,.39,.07,FRAME,'washhouse-window-mullion');
          panel(p,w,u,y+.62,width,.07,.39,.07,FRAME,'washhouse-window-transom');
          panel(p,w,u,y-h/2-.13,width+.28,.13,.32,.28,PALE,'washhouse-window-sill');
          // Shallow segmental arch, not a full semicircle imposed on the photo.
          for(let k=0;k<13;k++){
            const dx=(k-6)*width/12,arch=.27*Math.sqrt(Math.max(0,1-(dx/(width/2))**2));
            panel(p,w,u+dx,y+h/2+arch,.16,.16,.29,.14,PALE,'washhouse-segmental-arch');
            if(k>0&&k<12)panel(p,w,u+dx,y+h/2+arch/2,.14,Math.max(.03,arch),.31,.10,GLASS,'washhouse-segmental-glass');
          }
        }
        if(tall){
          const y=top-1.3;
          panel(p,w,u,y,1.18,.85,.28,.12,0x4e5b52,'washhouse-attic-grille');
          for(let j=0;j<5;j++)panel(p,w,u,y-.32+j*.16,1.16,.045,.37,.07,FRAME,'washhouse-attic-louvre');
        }
      }
    }
  }
  for(const p of data.rhoda){
    const base=p.y0_dm/10,top=(p.y0_dm+p.h_dm)/10,floors=p.h_dm<160?3:4,pitch=(top-base)/floors;
    for(const w of chariteRingWalls(p.ring)){
      skin(p,w,0xb3bfb1,'rhoda-source-bound-metal-skin');
      for(let floor=0;floor<floors;floor++){
        const bottom=base+floor*pitch;
        for(let band=0;band<3;band++)panel(p,w,w.length/2,bottom+.30+band*.38,w.length,.35,.23,.11,GREEN[(band+floor)%3],'rhoda-three-green-horizontal-bands');
        panel(p,w,w.length/2,bottom+2.45,w.length,1.82,.26,.10,GLASS,'rhoda-continuous-window-ribbon');
        panel(p,w,w.length/2,bottom+3.69,w.length,.36,.26,.10,0x556e69,'rhoda-upper-glazing-ribbon');
        for(const y of [bottom+1.5,bottom+3.38,bottom+3.93])panel(p,w,w.length/2,y,w.length,.10,.33,.09,0xcdd5c9,'rhoda-fine-horizontal-frame');
        const bays=Math.max(1,Math.round(w.length/1.45));
        for(let i=0;i<=bays;i++)panel(p,w,.045+i*Math.max(0,w.length-.09)/bays,bottom+2.45,.07,1.82,.34,.08,FRAME,'rhoda-ribbon-mullion');
      }
      panel(p,w,w.length/2,top-.12,w.length,.18,.26,.2,0xc6cec2,'rhoda-retained-roof-parapet');
    }
  }
  // v155 already owns the complete theatre. Fit only details it did not have.
  const theatre:ChariteSourcePrism={id:'uBD055gq',ring:data.theatreRing.map(([x,z])=>[x*10,z*10]),y0_dm:52,h_dm:94};
  for(const w of chariteRingWalls(theatre.ring)){
    if(w.length<4)continue;
    const bays=Math.max(1,Math.round(w.length/4.3));
    for(let i=0;i<bays;i++){
      const u=(i+.5)*w.length/bays;
      for(const angle of [Math.PI/4,Math.PI/2,Math.PI*3/4])for(let k=0;k<9;k++){
        const r=(k+.5)*.08;
        panel(theatre,w,u+Math.cos(angle)*r,11.1+Math.sin(angle)*r,.055,.065,.385,.055,LIGHT,'theatre-fanlight-radial-bar',false);
      }
      for(const dx of [-.23,0,.23])panel(theatre,w,u+dx,13.12,.08,.59,.28,.10,0xc0b8a6,'theatre-frieze-triglyph',false);
    }
  }
  for(let seam=0;seam<24;seam++)for(let j=0;j<30;j++){
    const a=seam*Math.PI/12,r=1.35+(j+.5)*(T.domeRadius-1.35)/30;
    const x=T.center[0]+Math.cos(a)*r,z=T.center[1]+Math.sin(a)*r;
    const y=chariteTheatreRoofAt(x,z,'sFAYdHwz',native)!;
    emit([x,y+.045,z],native?[.16,.09,.16]:[.10,.09,.27],0x5e7c72,'theatre-dome-standing-seam','sFAYdHwz',native?0:-a+Math.PI/2);
  }
  if(native){
    for(const s of campusCanopySolidsV266(true)){
      const a=s.ring[0],c=s.ring[2];
      emit([(a[0]+c[0])/2,(s.minY+s.maxY)/2,(a[1]+c[1])/2],[c[0]-a[0],s.maxY-s.minY,c[1]-a[1]],0xb8b9b2,'native-complete-canopy-roof','K0001xN5');
    }
  }
  return rows;
}

export function campusCanopyRoofTrianglesV266():Point[][]{
  const ring=data.canopy.roof[0].rings[0] as Point[];
  return ShapeUtils.triangulateShape(ring.map(p=>new Vector2(p[0],p[2])),[]).map(t=>t.map(i=>ring[i]));
}

export function createCampusNordV266(native=false,options:{mobileLike?:boolean;diagnostics?:boolean}={}):Group{
  const root=new Group();root.name='Campus Nord washhouse, Rhoda-Erdmann-Haus and Langhans details v266';
  const rows=campusNordGeometryV266(native),geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute('uv');
  const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.83});
  const mesh=new InstancedMesh(geometry,day,0),matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3);
  const matrix=new Matrix4(),q=new Quaternion(),up=new Vector3(0,1,0),p=new Vector3(),s=new Vector3(),tint=new Color();
  rows.forEach((r,i)=>{matrix.compose(p.set(...r.position),q.setFromAxisAngle(up,r.angle),s.set(...r.size));matrix.toArray(matrices,i*16);tint.setHex(r.tone).toArray(colors,i*3);});
  mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.computeBoundingBox();mesh.computeBoundingSphere();
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};root.add(mesh);
  if(!native){
    const points=campusCanopyRoofTrianglesV266().flat(),g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(points.flat()),3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    const d=new MeshBasicMaterial({color:0xb8b9b2,side:DoubleSide}),n=new MeshStandardMaterial({color:0xb8b9b2,side:DoubleSide,roughness:.85});
    const roof=new Mesh(g,d);roof.name='Complete measured Mensa canopy roof, original vertices';roof.userData={dayMaterial:d,nightMaterial:n,textureFree:true};root.add(roof);
  }
  root.userData={...CAMPUS_NORD_V266_PROFILE,instances:rows.length,textureFree:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};
  if(options.diagnostics)root.userData.records=rows;
  return freezeStaticSceneTransforms(root);
}
