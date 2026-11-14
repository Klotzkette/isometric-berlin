import { Group } from "three";
import type { PrismBuilding } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";
import { GendarmenmarktFacadeBuilder, perimeterEdgeLength, type PerimeterFacadeEdge } from "./GendarmenmarktFacadeBuilder";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import receipt from "./data/bauakademieExteriorV344.json";

type Record = typeof receipt.records[number];
const BRICK = 0x98543F, TERRACOTTA = 0xB16F50, MORTAR = 0xAE8066;
const FRAME = 0xD6D2BB, GLASS = 0x9BAEAB;

function admitted(prisms: readonly PrismBuilding[], record: Record): boolean {
  const found = prisms.filter(p => p.id === record.source.id), p = found[0], s = record.source;
  return found.length === 1 && p.y0_dm === s.y0_dm && p.h_dm === s.h_dm && p.class === s.class &&
    p.roof === s.roof && JSON.stringify(p.ring) === JSON.stringify(s.ring) &&
    JSON.stringify(p.holes ?? []) === JSON.stringify(s.holes) && JSON.stringify(p.tone) === JSON.stringify(s.tone);
}

function sourceEdges(record: Record): PerimeterFacadeEdge[] {
  const {ring, y0_dm, h_dm, id} = record.source;
  const area = ring.reduce((s, [x,z], i) => {const [a,b] = ring[(i+1)%ring.length];return s+x*b-z*a;}, 0);
  return ring.map((p,i) => ({startXZ:p.map(v=>v/10),endXZ:ring[(i+1)%ring.length].map(v=>v/10),
    outwardSide:area>0?-1:1,wallBaseY:y0_dm/10,wallTopY:(y0_dm+h_dm)/10,street:record.name,prismId:id}));
}

function brickWall(b: GendarmenmarktFacadeBuilder, e: PerimeterFacadeEdge): void {
  const length = perimeterEdgeLength(e), height = e.wallTopY-e.wallBaseY;
  b.face(e,length/2,(e.wallTopY+e.wallBaseY)/2,length-.01,height,.20,BRICK,.14);
  // Restrained true geometry masonry: sparse mortar remains visible at close
  // range without importing a photograph or a material texture.
  for(let row=0,y=e.wallBaseY+.32;y<e.wallTopY-.12;y+=.32,row++) {
    b.face(e,length/2,y,length-.025,.022,.022,MORTAR,.249);
    for(let u=.4+(row%2)*.40;u<length-.15;u+=.8)
      b.face(e,u,y-.16,.020,.29,.022,MORTAR,.249);
  }
}

function pane(b:GendarmenmarktFacadeBuilder,e:PerimeterFacadeEdge,u:number,y:number,w:number,h:number,arch=false):void {
  b.window(e,u,y,w,h,TERRACOTTA,FRAME,GLASS,arch&&!b.minecraft,.34,arch);
  for(const t of [-1/6,1/6]) b.face(e,u+w*t,y,.065,h,.11,FRAME,.47);
  for(const t of [-.25,0,.25]) b.face(e,u,y+h*t,w,.055,.11,FRAME,.47);
  if(arch&&b.minecraft) for(let i=0;i<4;i++)
    b.face(e,u,y+h/2-i*.10,w*(1-i*.10),.10,.12,TERRACOTTA,.48);
}

function corner(b:GendarmenmarktFacadeBuilder,e:PerimeterFacadeEdge,displayFront:boolean):void {
  const length=perimeterEdgeLength(e),base=e.wallBaseY,scale=(e.wallTopY-base)/21;
  brickWall(b,e);
  for(const level of [.45,4.9,10.9,16.45,20.15,20.75])
    b.face(e,length/2,base+level*scale,length+.08,.18*scale,.36,TERRACOTTA,.26);
  b.face(e,length/2,e.wallTopY-.04,length+.26,.16,.52,0x65645B,.23);
  if(!displayFront) return; // The diagonal source backing is not a third historic facade.
  for(const side of [.38,length-.38]) {
    b.face(e,side,base+10.6*scale,.48,20.2*scale,.32,TERRACOTTA,.24);
    for(let y=base+1;y<e.wallTopY-.8;y+=.7)
      b.face(e,side,y,.55,.10,.38,0xBF8B6D,.28);
  }
  const width=Math.min(3.25,length*.58),u=length/2;
  pane(b,e,u,base+2.65*scale,width,3.1*scale,true);
  pane(b,e,u,base+7.95*scale,width,4.0*scale);
  pane(b,e,u,base+13.5*scale,width,3.65*scale);
  for(const offset of [-1,0,1]) pane(b,e,u+offset*width*.31,base+18.45*scale,width*.23,1.28*scale);
  // Terra-cotta relief panels beneath the upper window groups are schematic.
  for(const y of [5.1,11.1]) for(let i=0;i<3;i++) {
    b.face(e,u+(i-1)*width*.29,base+(y+.48)*scale,width*.25,.48*scale,.14,0x70493A,.36);
    b.face(e,u+(i-1)*width*.29,base+(y+.48)*scale,width*.14,.09,.06,TERRACOTTA,.46);
  }
}

function hall(b:GendarmenmarktFacadeBuilder,e:PerimeterFacadeEdge):void {
  const length=perimeterEdgeLength(e),base=e.wallBaseY,height=e.wallTopY-base;
  brickWall(b,e);
  const bays=b.minecraft?1:Math.max(1,Math.round(length/5.5));
  for(let i=0;i<bays;i++) {
    const u=(i+.5)*length/bays,w=Math.min(b.minecraft?2.65:4.25,length/bays*.74);
    pane(b,e,u,base+height*.47,w,height*.72);
  }
  b.face(e,length/2,base+.25,length+.04,.30,.34,0x705348,.23);
  b.face(e,length/2,e.wallTopY-.22,length+.08,.25,.45,0xAD8972,.25);
  b.face(e,length/2,e.wallTopY-.05,length+.15,.14,.48,0x535D5B,.26);
}

function columnExists(voxels:VoxelPayload, [x,z,lo,hi,kind]:number[]):boolean {
  if(voxels.building_rows) return voxels.building_rows[z-voxels.grid.min_z_idx]?.some(([start,count,a,c,k])=>
    x-voxels.grid.min_x_idx>=start&&x-voxels.grid.min_x_idx<start+count&&a===lo&&c===hi&&k===kind)??false;
  return voxels.buildings?.some(r=>r[0]===x&&r[1]===z&&r[2]===lo&&r[3]===hi&&r[4]===kind)??false;
}

/** Present two remnants only. No complete future building, old canvas facade,
 * source removal, terrain change or replacement navigation is introduced. */
export function createBauakademieExteriorV344(prisms:readonly PrismBuilding[],voxels?:VoxelPayload):Group {
  const builder=new GendarmenmarktFacadeBuilder(Boolean(voxels),false,0),admittedIds:string[]=[];
  for(const record of receipt.records) {
    if(!admitted(prisms,record)) continue;
    const isCorner=record.source.id==="45095631";
    if(!voxels) sourceEdges(record).forEach((edge,i)=>isCorner?corner(builder,edge,i<2):hall(builder,edge));
    else {
      if(voxels.cell_m!==4||!record.nativeColumns.every(c=>columnExists(voxels,c))) continue;
      const keys=new Set(record.nativeColumns.map(([x,z])=>`${x}/${z}`));
      for(const [x,z,lo,hi] of record.nativeColumns) {
        for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          if(keys.has(`${x+dx}/${z+dz}`)) continue;
          const cx=(x+.5+dx/2)*4,cz=(z+.5+dz/2)*4;
          const edge:PerimeterFacadeEdge={startXZ:[cx-dz*2,cz+dx*2],endXZ:[cx+dz*2,cz-dx*2],
            outwardSide:1,wallBaseY:lo/10,wallTopY:hi/10,street:record.name,prismId:record.source.id};
          // Only the real north and east corner fronts carry historic windows.
          if(isCorner) corner(builder,edge,dx>0||dz<0);else hall(builder,edge);
        }
      }
    }
    admittedIds.push(record.source.id);
  }
  const group=builder.finish("Bauakademie existing brick corner and Roter Saal v344");
  Object.assign(group.userData,{bauakademieExteriorV344:true,admittedIds,originalSourcePreserved:true,
    futureReconstruction:false,fullMobileIdentical:true,textureFree:true,nativeSourceHeightPreserved:Boolean(voxels)});
  return freezeStaticSceneTransforms(group);
}
