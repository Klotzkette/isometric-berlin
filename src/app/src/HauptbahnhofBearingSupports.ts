import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial } from "three";

export const HBF_BEARING_SUPPORT_PROFILE = {
  reference: "https://commons.wikimedia.org/wiki/File:Hauptbahnhof-berlin-abstuetzung-humboldthafenbruecke-2023.jpg",
  photographer: "Sven Okas", referenceDate: "2023-03-28",
  groundPlanCheck: "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
  deckBottomY: 13.575,
  // These are the existing derived rail-layer support stations, not a new
  // survey. Keep the intervention on land immediately beside the glass hall.
  piers: [[-44.4,-719.9],[-21.2,-719.8],[-35.9,-660.2],[-12,-663]] as const,
  geometryStatus: "Photo-guided rust-coloured paired steel bearing frames around the existing support stations at the western end of Humboldthafenbrücke. Support axes reuse the schematic rail layer; section sizes and current temporary construction details are display estimates. No fabricated bearing survey or structural assessment.",
} as const;
export type BearingBlock = { position:[number,number,number]; size:[number,number,number]; color:number; role:string };
export function isHbfBearingSupport(x:number,z:number):boolean {
  return HBF_BEARING_SUPPORT_PROFILE.piers.some(p => Math.hypot(p[0]-x,p[1]-z)<.15);
}
export function planHbfBearingSupport(x:number,z:number,foot:number,deckBottom:number=HBF_BEARING_SUPPORT_PROFILE.deckBottomY): BearingBlock[] {
  const blocks:BearingBlock[]=[];
  const add=(role:string,color:number,px:number,y:number,pz:number,w:number,h:number,d:number)=>{if(h>0)blocks.push({role,color,position:[px,y,pz],size:[w,h,d]});};
  const rust=0x755044,dark=0x4f3c35,edge=0x967361,steel=0x85938d;
  const plinthTop=foot+.5,head=deckBottom-1.05,height=head-plinthTop;
  add("concrete footing",0x999d94,x,foot+.25,z,3.9,.5,2.6);
  add("original grey bearing stem",steel,x,(plinthTop+deckBottom)/2,z,.82,deckBottom-plinthTop,.82);
  // Photograph: paired rolled-section columns beside the grey stem, a
  // broad bearing head with stiffeners, and inspection rails. No V trestle.
  for(const side of [-1,1]) {
    const px=x+side*.98;
    add("rust steel column web",dark,px,plinthTop+height/2,z,.13,height,.76);
    for(const end of [-1,1]) add("rust steel column flange",rust,px,plinthTop+height/2,z+end*.36,.5,height,.10);
    add("column base plate",edge,px,plinthTop+.08,z,.72,.16,1.02);
    for(const level of [plinthTop+.7,head-.5]) add("bolted column splice",edge,px,level,z+.43,.53,.6,.08);
    for(const dz of [-.28,.28]) add("bearing jack block",steel,px,deckBottom-.22,z+dz,.45,.42,.42);
  }
  for(const dz of [-.6,.6]) {
    add("bearing head web",dark,x,head+.3,z+dz,4.3,.8,.12);
    for(const y of [head-.1,head+.7]) add("bearing head flange",rust,x,y,z+dz,4.3,.12,.45);
    for(const dx of [-1.8,-1.2,-.6,0,.6,1.2,1.8]) add("bearing head stiffener",edge,x+dx,head+.3,z+dz,.10,.65,.42);
  }
  add("inspection landing",dark,x,head-.65,z,4.8,.17,2.5);
  for(const dz of [-1.2,1.2]) {
    for(const dx of [-2.25,-1.1,0,1.1,2.25]) add("inspection guard post",rust,x+dx,head-.12,z+dz,.09,1.08,.09);
    for(const y of [head+.39,head-.12]) add("inspection handrail",rust,x,y,z+dz,4.6,.07,.07);
  }
  return blocks;
}
export function createMinecraftHbfBearingSupports(sample:(x:number,z:number)=>number|null): Group {
  const blocks=HBF_BEARING_SUPPORT_PROFILE.piers.flatMap(([x,z])=>planHbfBearingSupport(x,z,sample(x,z)??5.1));
  const root=new Group();root.name="Minecraft Hauptbahnhof east bearing frames";
  root.userData.sourceProfile=HBF_BEARING_SUPPORT_PROFILE;
  // Instance colors work without a vertex color attribute on the shared cube.
  const mesh=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),blocks.length);
  mesh.name="Minecraft rust steel bearing blocks";
  const m=new Matrix4(),c=new Color();
  blocks.forEach((b,i)=>{m.makeScale(...b.size).setPosition(...b.position);mesh.setMatrixAt(i,m);mesh.setColorAt(i,c.setHex(b.color));});
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingBox();mesh.computeBoundingSphere();
  mesh.userData.approxInstanceTransferBytes=blocks.length*76;root.add(mesh);return root;
}
