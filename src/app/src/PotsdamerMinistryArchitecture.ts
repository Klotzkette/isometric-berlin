import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { GendarmenmarktFacadeBuilder as Builder, perimeterEdgeLength as length, type PerimeterFacadeEdge as Edge } from "./GendarmenmarktFacadeBuilder";
import { sourceMesh } from "./BebelplatzBuildingShells";
import { bebelplatzPartBounds, bebelplatzPartRoofAt } from "./bebelplatzBuildingProfile";
import { POTSDAMER_MINISTRY_BUILDINGS, type PotsdamerMinistryBuilding } from "./potsdamerMinistrySourceProfile";
import { hasPotsdamerUpperStoreys, POTSDAMER_UPPER_STOREYS, potsdamerPanoramaMaterialFor } from "./potsdamerPanoramaPalette";
import streetWingSource from "./potsdamerStreetWingSource.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const POTSDAMER_MINISTRY_GROUP_NAME = "Potsdamer Platz and Umweltministerium complete source architecture";
export const MINECRAFT_POTSDAMER_MINISTRY_GROUP_NAME = "Block-native Potsdamer Platz and Umweltministerium architecture";
export const POTSDAMER_STREET_WING_FACADES = streetWingSource;
type Style = { wall:number;trim:number;glass:number;roof:number;pitch:number;floors:number;kind:string };
const forumPalette=potsdamerPanoramaMaterialFor("TJkToj3v")!;
const hyattPalette=potsdamerPanoramaMaterialFor("eodYvh6c")!;
const styles:Record<string,Style>={
  ministryHistoric:{wall:0xe4e1d4,trim:0xaca28f,glass:0x485c62,roof:0x9fa5a0,pitch:3.45,floors:4,kind:"ministry"},
  ministryNorth:{wall:0xc5b39a,trim:0xd2c1a8,glass:0x4e6269,roof:0x8c9075,pitch:2.1,floors:6,kind:"modern"},
  ministrySouth:{wall:0xc5b39a,trim:0xd2c1a8,glass:0x4e6269,roof:0x8c9075,pitch:2.1,floors:6,kind:"modern"},
  ministryAtrium:{wall:0xbabfb5,trim:0xc6ccc3,glass:0x729da8,roof:0x9bb8c1,pitch:2.6,floors:1,kind:"atrium"},
  forumTower:{wall:forumPalette.facade,trim:0xb4b6a6,glass:0x89a8af,roof:forumPalette.roof,pitch:2.55,floors:19,kind:"piano"},
  hausHuth:{wall:0xb8b8a8,trim:0xd1cdb7,glass:0x506c71,roof:0x717b73,pitch:3.45,floors:5,kind:"huth"},
  grandHyatt:{wall:hyattPalette.facade,trim:0xd3cbb7,glass:0x668187,roof:hyattPalette.roof,pitch:4.5,floors:7,kind:"hyatt"},
};

function facade(b:Builder, edge:Edge, style:Style, building:PotsdamerMinistryBuilding):void {
  const l=length(edge), base=Math.min(...building.officialParts.map(p=>p.ground_y_m))+building.displayYTranslationM;
  const top=edge.wallTopY, height=top-edge.wallBaseY;
  if(l<1.5||height<3)return;
  const mainGround=base+(style.kind==="hyatt"?7.4:style.kind==="huth"?5.5:4.8);
  const curtain=style.kind==="piano"&&edge.prismId==="TJkToj3v";
  const rooftop=edge.wallBaseY>base+8;
  b.face(edge,l/2,edge.wallBaseY+height/2,l,height,.085,curtain?style.glass:style.wall,.16,curtain?"glass":"stone");
  b.face(edge,l/2,top-.17,l,.23,.3,style.trim,.29);
  if(curtain){
    const floors=Math.max(1,Math.round((top-mainGround)/3.85));
    for(let i=0;i<=floors;i++){
      const y=mainGround+(top-mainGround)*i/floors;
      b.face(edge,l/2,y,l,.14,.22,style.trim,.34);
      if(!b.minecraft)b.face(edge,l/2,y+.36,l,.065,.12,0xd9d9c9,.34);
    }
    const bays=Math.max(2,Math.round(l/(b.minecraft?4.6:1.75)));
    for(let i=0;i<=bays;i++)b.face(edge,l*i/bays,(mainGround+top)/2,.095,top-mainGround,.17,style.trim,.33);
    return;
  }
  const bays=Math.max(1,Math.round(l/style.pitch)), pitch=l/bays;
  if(!rooftop){
    const arches=style.kind==="ministry"||style.kind==="huth";
    for(let i=0;i<bays;i++) b.window(edge,(i+.5)*pitch,base+2.35,pitch*.76,4.3,
      arches?0xa79c87:style.trim,0x4c5759,style.glass,arches,.32);
    b.face(edge,l/2,mainGround,l,style.kind==="ministry"?.48:.24,.36,style.trim,.32);
  }
  const floorPitch=style.kind==="piano"?3.85:style.kind==="modern"?3.8:
    style.kind==="hyatt"?3.65:style.kind==="huth"?4.05:3.46;
  const first=mainGround+floorPitch/2;
  const floors=Math.max(style.floors,Math.ceil((top-mainGround)/floorPitch));
  for(let floor=0;floor<floors;floor++){
    const y=first+floor*floorPitch, h=floorPitch*(style.kind==="modern"?.82:.70);
    if(y-h/2<edge.wallBaseY||y+h/2>top-.45)continue;
    for(let i=0;i<bays;i++){
      const u=(i+.5)*pitch;
      if(style.kind==="modern"){
        b.window(edge,u,y,pitch*.56,h,style.trim,0x666259,style.glass,false,.34);
        b.face(edge,u+pitch*.4,y,.24,floorPitch,.22,style.wall,.37);
      }else{
        b.window(edge,u,y,pitch*(style.kind==="hyatt"?.52:.66),h,style.trim,0x697676,style.glass,
          style.kind==="huth"&&floor===0,.35);
        if(style.kind==="huth"&&!b.minecraft){
          b.face(edge,u-pitch*.43,y,.22,floorPitch,.33,style.trim,.40);
          b.face(edge,u,y+h/2+.22,pitch*.76,.13,.38,style.trim,.43);
        }
      }
    }
    if(style.kind==="piano"){
      b.face(edge,l/2,y+h/2+.24,l,.14,.35,style.trim,.43);
      if(!b.minecraft)for(let j=1;j<5;j++) b.face(edge,l/2,y-h/2+j*floorPitch/5,l,.035,.1,0xab774c,.26);
    }
    if(style.kind==="hyatt"&&!b.minecraft){
      for(let j=0;j<6;j++)b.face(edge,l/2,y-floorPitch/2+j*floorPitch/6,l,.028,.06,0x815d51,.23);
    }
  }
}

function accents(b:Builder,building:PotsdamerMinistryBuilding):void{
  const fronts=building.streetFronts;
  if(building.key==="hausHuth"){
    const edge=fronts.find(e=>e.startXZ[0]<191&&e.endXZ[0]<201&&length(e)>8);
    if(edge)b.sign(edge,"HAUS HUTH",length(edge)/2,11.45,.74,Math.min(8,length(edge)-.7),0x353c39,0xb8b8a8,.46);
  }
  if(building.key==="grandHyatt"){
    const edge=fronts.find(e=>e.startXZ[0]<37&&e.endXZ[0]<29&&length(e)>35&&e.wallBaseY<8);
    if(edge)b.sign(edge,"HYATT",length(edge)*.54,edge.wallTopY+.35,1.4,11,0xd7c8b1,0xae7b68,.34);
  }
  if(building.key==="ministryHistoric"){
    const edge=fronts.find(e=>length(e)>60&&e.startXZ[0]>450&&e.endXZ[0]<420);
    if(edge){
      b.sign(edge,"BUNDESUMWELTMINISTERIUM",length(edge)*.47,8.9,.28,10.8,0x384145,0xb9ae9a,.47);
      const roofEdge={...edge,wallBaseY:edge.wallTopY,wallTopY:edge.wallTopY+5.3};
      for(const fraction of [.2,.5,.8]){
        const u=length(edge)*fraction;
        // Documented semicircular dormer silhouettes; local size is display-fit.
        b.window(roofEdge,u,edge.wallTopY+2.45,3.15,1.6,0xd2d7d0,0xb8c1bd,0x63838c,true,-1.0,true);
      }
    }
  }
}

/** Thin source-wall relief only: all 68 existing wing parts and roofs stay put. */
function streetWings(b:Builder):void{
  for(const building of streetWingSource.buildings)for(const edge of building.streetFronts){
    const palette=potsdamerPanoramaMaterialFor(edge.prismId)!;
    const l=length(edge),base=building.baseY,top=edge.wallTopY;
    const moneo=building.style==="moneo",floorPitch=moneo?3.9:3.5;
    const bayCount=Math.max(1,Math.round(l/(moneo?3.65:3.1))),pitch=l/bayCount;
    // The retained source windows and local subdivisions are recognition
    // estimates; no invented storey may extend beyond a measured wall plane.
    for(let y=base+6.6;y+1.2<top-.4;y+=floorPitch){
      if(y-1.2<edge.wallBaseY)continue;
      const upper=hasPotsdamerUpperStoreys(edge.prismId,top-base)&&y>base+POTSDAMER_UPPER_STOREYS.startM;
      const trim=upper?0xa4ada9:moneo?0xcbb89a:0xb6bcb5;
      const height=moneo?2.0:2.45,width=pitch*(moneo?.57:.7);
      for(let i=0;i<bayCount;i++){
        const u=(i+.5)*pitch;
        b.face(edge,u,y,width+.16,height+.16,.11,0x414c4c,.28);
        b.face(edge,u,y,width,height,.10,upper?0x779199:0x647c81,.35,"glass");
        b.face(edge,u,y-height/2-.06,width+.24,.12,.28,trim,.42);
        if(!b.minecraft)b.face(edge,u,y,.07,height,.08,trim,.42);
      }
      if(!moneo){
        b.face(edge,l/2,y+height/2+.22,l,.14,.20,upper?0xa5aba4:palette.facade,.30);
        if(!b.minecraft)b.face(edge,l/2,y-height/2-.30,l,.045,.10,0x775a49,.28);
      }
    }
    const groundTop=base+4.8;
    if(edge.wallBaseY<base+.7&&groundTop<top){
      const bays=Math.max(1,Math.round(l/4.7)),step=l/bays;
      for(let i=0;i<bays;i++){
        b.face(edge,(i+.5)*step,base+2.35,step*.82,4.3,.12,0x526467,.31,"glass");
        b.face(edge,i*step,base+2.35,.19,4.7,.28,0xa7ada5,.39);
      }
      b.face(edge,l/2,groundTop,l,.22,.40,0xa6aaa0,.40);
    }
  }
}

function facades(minecraft:boolean):Group{
  const b=new Builder(minecraft);
  for(const building of POTSDAMER_MINISTRY_BUILDINGS){
    for(const edge of building.streetFronts)facade(b,edge,styles[building.key],building);
    accents(b,building);
  }
  streetWings(b);
  return b.finish(minecraft?"Block-native Potsdamer ministry facades":"Potsdamer ministry source facade relief");
}

export function createPotsdamerMinistryArchitecture():Group{
  const root=new Group();root.name=POTSDAMER_MINISTRY_GROUP_NAME;
  for(const building of POTSDAMER_MINISTRY_BUILDINGS){
    const style=styles[building.key];
    const mesh=sourceMesh(building.officialParts,{wall:style.wall,roof:style.roof,name:building.name});
    mesh.position.y=building.displayYTranslationM;mesh.userData.buildingKey=building.key;
    root.add(mesh);
  }
  root.add(facades(false));
  root.userData={textureFree:true,sourceBound:true,fullAndMobileIdentical:true,completeOfficialParts:45,
    retainedFacadeOnlyParts:streetWingSource.buildings.flatMap(b=>b.prismIds).length};
  return freezeStaticSceneTransforms(root);
}

/** One surface-only block batch preserves actual roofs and leaves source courts open. */
export function createMinecraftPotsdamerMinistryArchitecture():Group{
  const root=new Group();root.name=MINECRAFT_POTSDAMER_MINISTRY_GROUP_NAME;
  const cell=2.5,matrix=new Matrix4(),tint=new Color(),matrices:number[]=[],colors:number[]=[];
  const add=(x:number,y:number,z:number,w:number,h:number,d:number,color:number)=>{
    matrix.makeScale(w,h,d).setPosition(x,y,z);matrices.push(...matrix.elements);tint.setHex(color).toArray(colors,colors.length);
  };
  for(const building of POTSDAMER_MINISTRY_BUILDINGS){
    const bounds=building.officialParts.map(bebelplatzPartBounds), style=styles[building.key];
    const x0=Math.floor(Math.min(...bounds.map(b=>b[0]))/cell),x1=Math.ceil(Math.max(...bounds.map(b=>b[2]))/cell);
    const z0=Math.floor(Math.min(...bounds.map(b=>b[1]))/cell),z1=Math.ceil(Math.max(...bounds.map(b=>b[3]))/cell);
    const columns=new Map<string,{top:number;bottom:number}>();
    for(let ix=x0;ix<x1;ix++)for(let iz=z0;iz<z1;iz++){
      let top=-Infinity,bottom=Infinity;
      for(const part of building.officialParts){
        const roof=bebelplatzPartRoofAt(part,(ix+.5)*cell,(iz+.5)*cell);if(roof===null)continue;
        const base=part.surfaces.some(s=>s.kind==="WallSurface")?part.ground_y_m:
          Math.min(...part.surfaces.flatMap(s=>s.rings.flatMap(r=>r.map(p=>p[1]))))-.2;
        top=Math.max(top,roof+building.displayYTranslationM);bottom=Math.min(bottom,base+building.displayYTranslationM);
      }
      if(top>bottom)columns.set(`${ix},${iz}`,{top,bottom});
    }
    for(const [key,{top,bottom}]of columns){
      const[ix,iz]=key.split(",").map(Number),x=(ix+.5)*cell,z=(iz+.5)*cell,roof=Math.min(.55,top-bottom);
      add(x,top-roof/2,z,cell,roof,cell,style.roof);
      const neighbor=Math.min(...[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>columns.get(`${ix+dx},${iz+dz}`)?.top??bottom));
      const low=Math.max(bottom,neighbor),h=top-roof-low;
      if(h>.1){const n=Math.ceil(h/3.8);for(let i=0;i<n;i++)add(x,low+(i+.5)*h/n,z,cell,h/n,cell,style.wall);}
    }
  }
  const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
  const dayMaterial=new MeshBasicMaterial({color:0xffffff}),nightMaterial=new MeshStandardMaterial({color:0xffffff,roughness:.87,flatShading:true});
  const mesh=new InstancedMesh(geometry,dayMaterial,0);mesh.instanceMatrix=new InstancedBufferAttribute(new Float32Array(matrices),16);
  mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(colors),3);mesh.count=matrices.length/16;
  mesh.name="Potsdamer ministry original roof and exposed wall blocks";mesh.userData={dayMaterial,nightMaterial,textureFree:true,surfaceOnly:true};
  mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh,facades(true));
  root.userData={textureFree:true,sourceBound:true,keepInMinecraft:true,blockNative:true,surfaceOnly:true,hiddenSolidInfill:false};
  return freezeStaticSceneTransforms(root);
}
