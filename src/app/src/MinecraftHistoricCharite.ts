import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import { ALTHOFF_STREET_ROOF, CHARITE_ALTHOFF_TOWER_ID, CHARITE_FRIEDRICH_ALTHOFF_IDS, CHARITE_MEDICAL_MUSEUM_IDS, HISTORIC_CHARITE_TONES as T, chariteAlthoffRoofY, chariteContainsRing, chariteFacadePointExposed, chariteRingWalls, historicChariteFacadeTop, historicChariteWindows, type ChariteFacadeWall, type ChariteSourcePrism } from "./HistoricChariteCampus";
import roofProfiles from "./chariteRoofProfile.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number, number];
type Block = { position: Point; size: Point; yaw: number; color: number; role: string; sourceId: string };
const ID_SET = new Set([...CHARITE_MEDICAL_MUSEUM_IDS, ...CHARITE_FRIEDRICH_ALTHOFF_IDS]);
const roofs: Record<string, (typeof roofProfiles)["t76KCSEh"]> = roofProfiles;

/** Only exact delivered heritage footprints replace coarse source columns. */
export function createHistoricChariteColumnTester(prisms: readonly ChariteSourcePrism[]) {
  const parts = prisms.filter(p => ID_SET.has(p.id)).map(part => ({ part,
    minX: Math.min(...part.ring.map(v=>v[0])) / 10, maxX: Math.max(...part.ring.map(v=>v[0])) / 10,
    minZ: Math.min(...part.ring.map(v=>v[1])) / 10, maxZ: Math.max(...part.ring.map(v=>v[1])) / 10,
  }));
  return (x: number, z: number): boolean => parts.some(({part,minX,maxX,minZ,maxZ}) =>
    x >= minX && x <= maxX && z >= minZ && z <= maxZ && chariteContainsRing(part.ring,x,z) &&
    !(part.holes ?? []).some(hole=>chariteContainsRing(hole,x,z)));
}

export function historicChariteBlockRoofY(part: ChariteSourcePrism, x: number, z: number): number {
  const top = (part.y0_dm + part.h_dm) / 10;
  if (part.id === CHARITE_ALTHOFF_TOWER_ID) return chariteAlthoffRoofY(x,z);
  const bottom = historicChariteFacadeTop(part), source = roofs[part.id];
  if (!source || Math.abs(top-bottom)<0.01) return top;
  const rect=source.rect, [ax,az]=rect.axis, [cx,cz]=rect.center;
  const u=(x-cx)*ax+(z-cz)*az, v=-(x-cx)*az+(z-cz)*ax;
  const flank = Math.max(0,1-Math.abs(v)/rect.halfWidth);
  if (source.roofCode===2100) return bottom+(top-bottom)*Math.max(0,Math.min(1,(v+rect.halfWidth)/(2*rect.halfWidth)));
  const hip = source.roofCode===3200 ? Math.max(0,Math.min(1,(rect.halfLength-Math.abs(u))/Math.min(rect.halfWidth,rect.halfLength*0.6))) : 1;
  return bottom+(top-bottom)*Math.min(flank,hip);
}

export function createMinecraftHistoricCharite(sourcePrisms: readonly ChariteSourcePrism[], detailProfile: "full" | "mobile" = "full", diagnostics = false): Group {
  const root = new Group();root.name = "Historic Charite native architectural blocks";
  const parts=sourcePrisms.filter(p=>ID_SET.has(p.id)), blocks: Block[]=[];
  const mobile=detailProfile==="mobile", q=mobile?2.25:1.5;
  const add=(sourceId:string, role:string, position:Point, size:Point, color:number, yaw=0) => {
    if(size.every(n=>Number.isFinite(n)&&n>0)) blocks.push({sourceId,role,position,size,color,yaw});
  };
  const wallBox=(part:ChariteSourcePrism,wall:ChariteFacadeWall,role:string,u:number,y:number,out:number,w:number,h:number,d:number,color:number) =>
    add(part.id,role,[wall.x1+wall.dirX*u+wall.nx*out,y,wall.z1+wall.dirZ*u+wall.nz*out],[w,h,d],color,-Math.atan2(wall.dirZ,wall.dirX));
  let windowCount=0, pairedWindows=0;
  for(const part of parts) {
    const bottom=part.y0_dm/10, eave=historicChariteFacadeTop(part);
    const tone=CHARITE_FRIEDRICH_ALTHOFF_IDS.has(part.id)?T.althoffFacade:T.museumFacade;
    for(const wall of chariteRingWalls(part.ring)) {
      const bays=Math.ceil(wall.length/q);
      for(let bay=0;bay<bays;bay++) {
        const along=(bay+0.5)*wall.length/bays;
        // Wall strips retain the oblique plane without interior voxel fill.
        wallBox(part,wall,"source-wall",along,(bottom+eave)/2,-0.18,wall.length/bays,eave-bottom,0.36,tone);
      }
      if(wall.length<2.5)continue;
      for(const [y,h,color] of [[bottom+0.36,0.68,0xa7a18e],[eave-0.22,0.28,T.stone]] as const) {
        if(chariteFacadePointExposed(part.id,wall,wall.length/2,y,parts)) wallBox(part,wall,"stone-course",wall.length/2,y,0.07,wall.length,h,0.2,color);
      }
    }
    const profile=roofs[part.id];
    if(profile) {
      const {rect}=profile, [ax,az]=rect.axis, [cx,cz]=rect.center;
      const cols=Math.ceil(rect.halfLength*2/q), rows=Math.ceil(rect.halfWidth*2/q), dx=rect.halfLength*2/cols, dz=rect.halfWidth*2/rows;
      for(let col=0;col<cols;col++)for(let row=0;row<rows;row++) {
        const u=-rect.halfLength+(col+0.5)*dx,v=-rect.halfWidth+(row+0.5)*dz;
        const x=cx+ax*u-az*v,z=cz+az*u+ax*v;
        if(!chariteContainsRing(part.ring,x,z)||(part.holes??[]).some(h=>chariteContainsRing(h,x,z)))continue;
        const roofY=historicChariteBlockRoofY(part,x,z);
        // Stepped roof shells meet on the steep photographed Althoff slope.
        const upper=Math.min((part.y0_dm+part.h_dm)/10,Math.ceil(roofY*3)/3), lower=Math.max(eave-0.18,upper-q*1.8);
        add(part.id,"source-roof",[x,(upper+lower)/2,z],[dx,Math.max(0.18,upper-lower),dz],T.slate,-Math.atan2(az,ax));
      }
    }
    const windows=historicChariteWindows(part,parts);
    const upperStreet=windows.filter(w=>w.streetAlthoff&&w.floor===2);
    if(upperStreet.length) {
      const wall=upperStreet[0].wall;
      wallBox(part,wall,"Althoff upper plaster band",wall.length/2,eave-.94,.03,wall.length-.4,1.32,.04,T.plaster);
      for(const w of upperStreet)for(const side of [-1,1]) {
        // Stepped reading of the same photographed ogee crown; no smooth
        // facade double and no added window/floor rhythm.
        const shoulderDrop=Math.min((w.width-.15)*.17,w.height*.2);
        const points=[[0,.58],[.15,.29],[.42,.12],[.5,-shoulderDrop]];
        for(let i=0;i<points.length-1;i++) {
          const [x,y]=points[i], [xx,yy]=points[i+1];
          wallBox(part,wall,"Althoff stepped brick crown",w.along+side*(x+xx)*w.width/2,w.bottom+w.height+(y+yy)/2+.05,.115,(xx-x)*w.width,Math.abs(yy-y)+.105,.13,T.brickDark);
        }
      }
    }
    for(const w of windows) {
      windowCount++;if(w.paired)pairedWindows++;
      const {wall,along,bottom,width,height}=w;
      if(w.museumStreet&&w.floor===1&&wall.index===14) wallBox(part,wall,"museum-plaster-panel",along,bottom-3.0,0.045,width,5.75,0.08,T.plaster);
      if(w.towerWindow&&w.floor<2) wallBox(part,wall,"tower-plaster",along,bottom+height+0.6,0.045,width+0.16,1.18,0.08,T.plaster);
      if(w.streetAlthoff&&w.floor===1) wallBox(part,wall,"plaster-spandrel",along,bottom+height+0.62,0.045,width-0.05,1.24,0.08,T.plaster);
      const count=w.paired?2:1;
      for(let piece=0;piece<count;piece++) {
        const ww=w.paired?(width-0.15)/2:width, u=along+(w.paired?(piece-0.5)*(width/2+0.075):0);
        wallBox(part,wall,"brick-arch-frame",u,bottom+height/2,0.10,ww,height,0.13,T.brickDark);
        wallBox(part,wall,w.blind?"blind-window":"window",u,bottom+height*0.46,0.215,ww-0.24,height*0.82,0.08,w.blind?T.plaster:T.glassDark);
        if(!mobile) wallBox(part,wall,"arch-step",u,bottom+height*0.91,0.215,Math.max(0.16,ww-0.44),height*0.14,0.08,w.blind?T.plaster:T.glassDark);
        if(!w.blind) {
          wallBox(part,wall,"window-transom",u,bottom+height*0.61,0.285,ww-0.24,0.09,0.06,T.stone);
          if(!w.paired&&!mobile) wallBox(part,wall,"window-mullion",u,bottom+height*0.46,0.285,0.085,height*0.78,0.06,T.stone);
        }
      }
      wallBox(part,wall,"window-sill",along,bottom-0.05,0.21,width+0.2,0.16,0.3,T.stone);
    }
    if(part.id===CHARITE_ALTHOFF_TOWER_ID) {
      const wall=chariteRingWalls(part.ring).find(w=>w.index===0)!;
      for(let i=0;i<ALTHOFF_STREET_ROOF.dormerCount;i++) {
        const u=wall.length*(i+0.5)/4;
        wallBox(part,wall,"dormer",u,22.3,-1.7,2.7,2.0,1.8,T.slate);
        wallBox(part,wall,"dormer-frame",u,22.2,-0.76,2.35,1.62,0.14,T.stone);
        wallBox(part,wall,"dormer-pane",u,22.2,-0.64,2.12,1.36,0.08,T.glassDark);
        wallBox(part,wall,"dormer-divider",u,22.2,-0.55,0.16,1.36,0.08,T.stone);
      }
      const cx=483.75,cz=-494.55,step=mobile?1.15:0.8;
      for(let level=0;level<7;level++) {
        const y=20.1+(level+0.5)*0.98,r=5.25*(1-(level+0.5)/7);
        for(let x=-r;x<=r;x+=step)for(let z=-r;z<=r;z+=step) {
          const radius=Math.hypot(x,z);
          if(radius>r||radius<Math.max(0,r-step*1.5))continue;
          add(part.id,"tower-helm",[cx+x,y,cz+z],[step,0.99,step],T.slate);
        }
      }
      add(part.id,"tower-finial",[cx,27.115,cz],[0.2,0.46,0.2],0x78857c);
    }
  }
  if(blocks.length) {
    const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
    const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,flatShading:true,roughness:0.9});
    const mesh=new InstancedMesh(geometry,day,blocks.length),matrix=new Matrix4(),position=new Vector3(),scale=new Vector3(),color=new Color();
    blocks.forEach((block,index)=>{matrix.makeRotationY(block.yaw);matrix.scale(scale.set(...block.size));matrix.setPosition(position.set(...block.position));mesh.setMatrixAt(index,matrix);mesh.setColorAt(index,color.setHex(block.color));});
    mesh.name="Historic Charite facade and roof blocks";
    Object.assign(mesh.userData,{dayMaterial:day,nightMaterial:night,textureFree:true});mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  }
  Object.assign(root.userData,{blockNative:true,textureFree:true,keepInMinecraft:true,detailProfile,sourcePrismIds:parts.map(p=>p.id),sourcePrisms:parts.length,
    detailCounts:{blocks:blocks.length,windows:windowCount,pairedWindows,althoffDormers:parts.some(p=>p.id===CHARITE_ALTHOFF_TOWER_ID)?4:0,althoffUpperCrowns:parts.some(p=>p.id===CHARITE_ALTHOFF_TOWER_ID)?7:0},
    geometryStatus:"source-bound thin wall/roof shell; exact LoD2 footprint/height anchors, procedural block quantisation and photo-bounded unsurveyed facade detail"});
  if(diagnostics) root.userData.blockRecords=blocks;
  return freezeStaticSceneTransforms(root);
}
