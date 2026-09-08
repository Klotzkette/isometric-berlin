import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import type { DeutschesTheaterVoxelPayload } from "./DeutschesTheater";

export const SACHSEN_ANHALT_FACADE_IDS:ReadonlySet<string>=new Set(["mIgrCTOY","7c76Dz9u","5WQW7BjX","T3KBPJfQ"]);
export const SACHSEN_ANHALT_FACADE_PROFILE={
  address:"Luisenstrasse 18",parent:"DEBE01YYK00002dn",sourcePart:"DEBE3DfrmIgrCTOY",
  start:[560.926,-333.489],end:[562.863,-309.704],ground:4.0,measuredHeight:19.03,
  facadeStoreys:3,facadeBays:9,facadeTop:19.35,
  status:"Exact retained LoD2 street edge, source height and footprint; three-storey ochre front, central 1874 oriel and local window/ornament subdivisions are photo-bounded display dimensions, not a facade survey. Party walls receive no invented window overlays.",
  sourceUrl:"https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095966",
  referenceUrl:"https://commons.wikimedia.org/wiki/File:Landesvertretung_Sachsen-Anhalt_in_Berlin.JPG",
} as const;
export type SachsenAnhaltFacadeOptions={mobileLike?:boolean;voxels?:DeutschesTheaterVoxelPayload;diagnostics?:boolean};
export type SachsenAnhaltFacadeBlock={position:[number,number,number];size:[number,number,number];quaternion:[number,number,number,number];color:number;role:string};
const C={ochre:0xe4be7d,stone:0xecc98d,shade:0xcaa569,frame:0xe7e7d7,glass:0x4b6971,iron:0x343b37};
const dx=SACHSEN_ANHALT_FACADE_PROFILE.end[0]-SACHSEN_ANHALT_FACADE_PROFILE.start[0],dz=SACHSEN_ANHALT_FACADE_PROFILE.end[1]-SACHSEN_ANHALT_FACADE_PROFILE.start[1],length=Math.hypot(dx,dz),ax=dx/length,az=dz/length,nx=az,nz=-ax;
const cx=(SACHSEN_ANHALT_FACADE_PROFILE.start[0]+SACHSEN_ANHALT_FACADE_PROFILE.end[0])/2,cz=(SACHSEN_ANHALT_FACADE_PROFILE.start[1]+SACHSEN_ANHALT_FACADE_PROFILE.end[1])/2;
const at=(u:number,y:number,o:number):[number,number,number]=>[cx+ax*u+nx*o,y,cz+az*u+nz*o];
function plan(minecraft:boolean,options:SachsenAnhaltFacadeOptions):SachsenAnhaltFacadeBlock[]{
  const blocks:SachsenAnhaltFacadeBlock[]=[],mobile=!!options.mobileLike,q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-Math.atan2(az,ax)).toArray();
  const add=(u:number,y:number,out:number,w:number,h:number,d:number,color:number,role:string)=>blocks.push({position:at(u,y,out),size:[w,h,d],quaternion:q,color,role});
  const pane=(u:number,bottom:number,w:number,h:number,out:number,role:string)=>{
    add(u,bottom+h/2,out,w+.3,h+.28,.1,C.stone,"window architrave");add(u,bottom+h/2,out+.08,w,h,.1,C.glass,role);
    add(u,bottom+h/2,out+.15,.07,h,.06,C.frame,"white sash mullion");add(u,bottom+h*.69,out+.15,w,.08,.06,C.frame,"white sash transom");add(u,bottom-.16,out+.12,w+.5,.14,.29,C.stone,"window sill");
  };
  add(0,11.6,.09,length,15.2,.13,C.ochre,"three-storey ochre facade");
  for(const y of [4.28,8.6,9.05,14.05,14.42,18.62,18.95,19.23])add(0,y,.23,length+.15,.14,.4,C.stone,"layered facade cornice");
  const bays=9,pitch=length/bays;
  for(let bay=0;bay<bays;bay++){
    const u=-length/2+(bay+.5)*pitch;
    if(bay!==4){pane(u,4.7,1.25,3.2,.2,"ground-floor glazing");pane(u,9.6,1.32,4.1,.2,"principal-floor glazing");
      add(u,14.0,.33,2.02,.2,.52,C.stone,"principal window hood");
      for(const side of [-1,1]){add(u+side*.79,13.52,.31,.17,.78,.27,C.stone,"window hood console");add(u+side*.8,13.75,.39,.24,.2,.26,C.shade,"hood volute shade");}
      add(u,8.85,.25,1.56,.48,.1,C.shade,"relief panel inset");
      for(let k=0;k<(mobile||minecraft?3:7);k++)add(u-.55+k*1.1/((mobile||minecraft?3:7)-1),8.86+Math.sin(k*Math.PI/2)*.06,.32,.16,.11,.075,C.stone,"bounded floral relief cue");
    }
    pane(u,15.13,1.34,3.05,.2,"upper-floor glazing");
    if(bay<bays-1)add(u+pitch/2,16.7,.23,.13,3.58,.16,C.stone,"upper-storey pilaster strip");
  }
  for(let i=0;i<(mobile||minecraft?32:56);i++){
    const u=-length/2+(i+.5)*length/(mobile||minecraft?32:56);
    add(u,18.82,.37,.2,.36,.42,C.stone,"eaves dentil console");
    if(!mobile&&!minecraft)add(u,18.64,.28,.12,.24,.19,C.shade,"dentil curved-shadow cue");
  }
  // The projecting room is a closed 1874 oriel above the middle portal,
  // not a balcony and not another full-height building volume.
  add(0,11.35,.84,3.3,4.95,1.45,C.ochre,"central 1874 oriel body");
  pane(0,9.62,2.65,4.0,1.62,"oriel front glazing");
  add(-.45,11.62,1.8,.08,4,.08,C.frame,"oriel paired sash");add(.45,11.62,1.8,.08,4,.08,C.frame,"oriel paired sash");
  for(const y of [8.84,9.12,13.83,14.1,14.3])add(0,y,1.0,3.85,.16,1.9,C.stone,"oriel projecting cornice");
  for(const u of [-1.36,1.36]){add(u,8.45,.87,.35,.88,1.05,C.stone,"oriel stone bracket");add(u,8.08,.63,.24,.32,.62,C.shade,"oriel bracket shadow");}
  // Dark central door and its fine metalwork remain a visual entrance only;
  // the existing LoD2 body and pedestrian collision are not cut open.
  add(0,6.25,.25,2.45,4.5,.16,C.iron,"central Luisenstrasse entrance");
  for(const u of [-1.4,1.4])add(u,6.4,.35,.24,4.8,.33,C.stone,"portal jamb");
  for(let i=0;i<(mobile||minecraft?7:13);i++)add(-1.05+i*2.1/((mobile||minecraft?7:13)-1),6.25,.37,.04,4.23,.04,0x777961,"entrance metal grille");
  for(const y of [4.22,7.4,8.33])add(0,y,.36,2.2,.055,.06,0x777961,"entrance grille tie");
  // Long fine joints subdivide plaster only; they are not a brick texture.
  if(!mobile&&!minecraft)for(let y=4.65;y<14;y+=.55){if(y>9.15&&y<13.8)continue;add(0,y,.167,length,.018,.012,C.shade,"plaster course joint");}
  if(minecraft&&options.voxels){const v=options.voxels,cols=new Map<string,[number,number]>();
    const insert=(x:number,z:number,lo:number,hi:number)=>{if(x*v.cell_m>535&&x*v.cell_m<575&&z*v.cell_m> -340&&z*v.cell_m< -302)cols.set(`${x},${z}`,[lo/10,hi/10]);};
    v.building_rows?.forEach((r,zi)=>{const z=v.grid.min_z_idx+zi;if(z*v.cell_m< -342||z*v.cell_m> -300)return;for(const [x,n,lo,hi]of r)for(let i=0;i<n;i++)insert(v.grid.min_x_idx+x+i,z,lo,hi);});
    for(const [x,z,lo,hi]of v.buildings??[])insert(x,z,lo,hi);
    let shift=0;
    for(const b of blocks)for(const du of [-b.size[0]*.45,0,b.size[0]*.45])for(const dy of [-b.size[1]*.4,0,b.size[1]*.4])for(let o=0;o<5.8;o+=.15){
      const x=b.position[0]+ax*du+nx*o,z=b.position[2]+az*du+nz*o,c=cols.get(`${Math.floor(x/v.cell_m)},${Math.floor(z/v.cell_m)}`);
      if(c&&b.position[1]+dy>=c[0]&&b.position[1]+dy<=c[1])shift=Math.max(shift,o+b.size[2]/2+.12);
    }
    for(const b of blocks){b.position[0]+=nx*shift;b.position[2]+=nz*shift;}
  }
  return blocks;
}
function make(minecraft:boolean,options:SachsenAnhaltFacadeOptions):Group {
  const blocks=plan(minecraft,options),root=new Group();root.name=minecraft?"Minecraft Sachsen-Anhalt Luisenstrasse facade":"Federal state representation sachsen-anhalt";
  const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.85});
  const mesh=new InstancedMesh(geometry,day,blocks.length),matrix=new Matrix4(),q=new Quaternion(),p=new Vector3(),s=new Vector3(),c=new Color();
  blocks.forEach((b,i)=>{mesh.setMatrixAt(i,matrix.compose(p.fromArray(b.position),q.fromArray(b.quaternion),s.fromArray(b.size)));mesh.setColorAt(i,c.setHex(b.color));});
  mesh.name=`${root.name} bodies`;mesh.userData.dayMaterial=day;mesh.userData.nightMaterial=night;mesh.userData.sourceBounded=true;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.computeBoundingBox();root.add(mesh);
  root.userData.architecturalProfile=SACHSEN_ANHALT_FACADE_PROFILE;root.userData.geometryStatus=SACHSEN_ANHALT_FACADE_PROFILE.status;
  root.userData.detailCounts={instances:blocks.length,storeys:3,bays:9,oriels:1};root.userData.minecraft=minecraft;root.userData.mobileLike=!!options.mobileLike;
  if(options.diagnostics)root.userData.blocks=blocks;
  freezeStaticSceneTransforms(root);return root;
}
export function createSachsenAnhaltFacade(options:SachsenAnhaltFacadeOptions={}):Group{return make(false,options);}
export function createMinecraftSachsenAnhaltFacade(options:SachsenAnhaltFacadeOptions={}):Group{return make(true,options);}
