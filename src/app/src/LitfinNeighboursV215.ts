import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2 } from "three";
import source from "./data/litfinNeighboursV215Source.json";
import { perimeterEdgeLength, perimeterFacadePoint, type PerimeterFacadeEdge } from "./GendarmenmarktFacadeBuilder";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const LITFIN_NEIGHBOURS_V215_PROFILE = {
  sourceUrls: ["http://www.maedebach-redeleit.de/projekt.jsp?projId=337",
    "https://www.stiftung-berliner-mauer.de/de/gedenkstaette-guenter-litfin"],
  ownerIds: source.buildings.map(b => b.ownerId),
  camera: { target: [-87, 17, -1649], position: [-145, 39, -1690] },
  nativeGridM: .5, sourceGeometryRetained: true,
  budget: { drawnBytes: 136_264, nativeBytes: 1_017_300, drawnCalls: 2, nativeCalls: 1 },
  recognition: ["Kieler 3: measured two projecting red oriels, tall openings, roof strip and rear balcony boxes",
    "Kieler 2: blue-grey plaster and black glazed angular bay with white dividing frames",
    "Kieler 2a: salmon courtyard front, white paired frames and light top-storey terrace"],
  displayEstimate: "Member sections and visible facade rhythm are recognition fits from architect and licensed photographs, not a window survey",
} as const;

type Wall = typeof source.buildings[number]["walls"][number];
type Member = { role: string; site: string; row: number[]; normal: number[] };
const C = { red: 0xab5143, redSide: 0x95463d, salmon: 0xcf9388, grey: 0xa6b2b6,
  glass: 0x667d89, dark: 0x34474e, white: 0xe3e6dd, steel: 0x7e8c91, slate: 0x525c63 };
const FRONT = [-.56, -.83];
const normal = (e: PerimeterFacadeEdge) => {
  const l=perimeterEdgeLength(e);
  return [-(e.endXZ[1]-e.startXZ[1])/l*e.outwardSide,(e.endXZ[0]-e.startXZ[0])/l*e.outwardSide];
};
const wallColor = (site: string, e: Wall) => site === "kieler3" ? (Math.abs(normal(e)[0]*FRONT[0]+normal(e)[1]*FRONT[1])<.7 ? C.redSide : C.red)
  : site === "kieler2" ? C.grey : C.salmon;

export function litfinNeighboursV215Members(): Member[] {
  const rows: Member[]=[];
  for(const b of source.buildings) for(const e of b.walls){
    const site=b.key,n=normal(e),l=perimeterEdgeLength(e),h=e.wallTopY-e.wallBaseY;
    const face=(role:string,u:number,y:number,w:number,hh:number,d:number,c:number,out=.29)=>{
      rows.push({role,site,normal:n,row:[...perimeterFacadePoint(e,u,y,out),w,hh,d,
        -Math.atan2(e.endXZ[1]-e.startXZ[1],e.endXZ[0]-e.startXZ[0]),c]});
    };
    const window=(u:number,y:number,w:number,hh:number,frame:number,rail=false)=>{
      if(u-w/2<.05||u+w/2>l-.05||y-hh/2<e.wallBaseY+.05||y+hh/2>e.wallTopY-.10)return;
      face("window-reveal",u,y,w+.16,hh+.12,.08,frame,.30);
      face("paired-glass",u,y,w,hh,.06,C.glass,.36);
      face("centre-mullion",u,y,.07,hh,.07,frame,.41);
      if(site!=="kieler3")face("lower-transom",u,y-hh*.22,w,.065,.08,frame,.41);
      face("projecting-sill",u,y-hh/2-.05,w+.2,.1,.23,frame,.39);
      if(rail)for(const dy of [.13,.30,.47])face("three-course-French-rail",u,y-hh/2+dy,w+.04,.035,.055,C.dark,.51);
    };
    if(h<3||e.wallBaseY>5.3||l<.7)continue;
    const facing=n[0]*FRONT[0]+n[1]*FRONT[1];
    if(site==="kieler3"){
      // Both actual oriels are already separate measured parts. Their long
      // planes get the same aligned openings, their narrow returns stay solid.
      if(Math.abs(facing)<.8)continue;
      const front=facing>0;
      const bays=front?10:5,axis=[.8287,-.5597],origin=[-97.338,-1664.307];
      const centers:number[]=[];
      if(front){
        const dx=(e.endXZ[0]-e.startXZ[0])/l,dz=(e.endXZ[1]-e.startXZ[1])/l;
        const start=(e.startXZ[0]-origin[0])*axis[0]+(e.startXZ[1]-origin[1])*axis[1];
        const dir=dx*axis[0]+dz*axis[1];
        for(let j=0;j<bays;j++)centers.push(((j+.5)*1.923-start)/dir);
      }else for(let j=0;j<Math.round(l/3.1);j++)centers.push((j+.5)*l/Math.round(l/3.1));
      for(let floor=0;floor<6;floor++){
        const y=7.0+floor*3.28;
        for(const u of centers){
          window(u,y,front?1.08:1.56,floor===0?2.6:2.17,C.dark,front&&floor>0);
          if(!front&&floor>0&&floor<5&&u>1.05&&u<l-1.05){
            // Individually projecting open rear balconies, solid red parapets,
            // black rails and alternate side screens in the architect's photos.
            const out=1.05;
            face("rear-balcony-slab",u,y-1.22,2.20,.16,1.35,C.red,.84);
            face("red-balcony-parapet",u,y-.75,2.20,.8,.12,C.red,1.46);
            face("balcony-top-rail",u,y-.21,2.22,.055,.06,C.dark,1.48);
            face("balcony-side-screen",u+(floor%2?1.05:-1.05),y-.29,.1,1.74,1.35,C.red,.84);
            for(const du of [-1.05,1.05])face("balcony-upright",u+du,y+.04,.055,.56,.06,C.dark,1.48);
          }
        }
      }
      // The photograph shows roof-top guard rails on the two projecting oriels.
      if(front&&e.sourcePartId!=="DEBE3Dhe8vUulcce"){
        for(const dy of [.15,.48,.81])face("oriel-roof-guard",l/2,e.wallTopY+dy,l,.045,.055,C.dark,.28);
        for(let u=.1;u<l;u+=.85)face("oriel-roof-post",u,e.wallTopY+.45,.045,.9,.055,C.dark,.28);
      }
      if(front&&e.sourcePartId==="DEBE3Dhe8vUulcce"){
        face("roof-edge-metal",l/2,26.82,l,.11,.30,C.steel,.29);
        // Roof gallery sits against the retained roof pitch; no new roof mass.
        for(const u of centers)if(u>.6&&u<l-.6){
          face("roof-gallery-glazing",u,27.55,1.08,1.18,.09,C.glass,-.50);
          face("roof-gallery-vertical",u-.59,27.55,.075,1.30,.10,C.steel,-.40);
        }
      }
      continue;
    }
    if(site==="kieler2" && e.sourcePartId==="DEBE3DHvbbgY0ePN" && e.sourcePolygonId==="UUID_07248f52-809f-45c8-b447-a99f931ef24c"){
      // The measured angular bay facing the memorial: a continuous black
      // glazed volume with thin pale floor lines, not rows on an invented box.
      face("black-glazed-oriel",l/2,15.25,l,19.2,.065,C.dark,.29);
      for(let floor=0;floor<7;floor++){
        const y=6.73+floor*2.84;
        face("oriel-pane",l/2,y,l-.17,2.60,.08,C.glass,.36);
        face("oriel-white-storey-line",l/2,y+1.35,l,.085,.09,C.white,.44);
      }
      for(const u of [.035,l/2,l-.035])face("oriel-white-vertical",u,15.3,.07,19.8,.09,C.white,.44);
      continue;
    }
    // No windows are invented on the narrow junctions; the light top storey
    // and thin metal canopy remain recognisable around the existing courts.
    if(l<2)continue;
    const pitch=site==="kieler2"?3.40:3.16, bays=Math.max(1,Math.round(l/pitch));
    for(let floor=0;floor<6;floor++)for(let j=0;j<bays;j++)window((j+.5)*l/bays,7.02+floor*3.02,1.48,1.88,C.white);
    face("parapet-drip",l/2,e.wallTopY-.09,l,.14,.25,C.steel,.31);
    if(site==="kieler2a"&&facing>.8){
      // Light attic and horizontal pergola rails seen behind the watchtower.
      face("light-top-storey-band",l/2,e.wallTopY-.60,l,1.08,.05,C.white,.22);
      for(const dy of [.17,.91])face("terrace-rail",l/2,e.wallTopY+dy,l,.045,.06,C.steel,.25);
      for(let u=.15;u<l;u+=1.7)face("terrace-post",u,e.wallTopY+.55,.06,1.15,.08,C.steel,.25);
    }
  }
  return rows;
}

function pointInPolygon(p:number[],ring:number[][]):boolean{
  let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
}

/** Only exposed facade cells, never filled building volumes. */
export function litfinNeighboursV215NativeRows(members=litfinNeighboursV215Members()):number[][]{
  const grid=.5,cells=new Map<string,number[]>();
  const cell=(x:number,y:number,z:number,c:number)=>{const a=[x,y,z].map(v=>Math.round(v/grid));cells.set(a.join(":"),[...a,c]);};
  for(const b of source.buildings)for(const e of b.walls){
    const l=perimeterEdgeLength(e),dx=(e.endXZ[0]-e.startXZ[0])/l,dz=(e.endXZ[1]-e.startXZ[1])/l;
    const ring=e.ring.map(p=>[(p[0]-e.startXZ[0])*dx+(p[2]-e.startXZ[1])*dz,p[1]]);
    const low=Math.min(...ring.map(p=>p[1])),high=Math.max(...ring.map(p=>p[1]));
    for(let u=grid/2;u<l;u+=grid)for(let y=low+grid/2;y<high;y+=grid)if(pointInPolygon([u,y],ring)){
      const p=perimeterFacadePoint(e,u,y,1.55);cell(p[0],y,p[2],wallColor(b.key,e));
    }
  }
  for(const {row:r,normal:n} of members){
    const nx=Math.max(1,Math.ceil(r[3]/grid)),ny=Math.max(1,Math.ceil(r[4]/grid)),nz=Math.max(1,Math.ceil(r[5]/grid));
    const c=Math.cos(r[6]),s=Math.sin(r[6]);
    for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++)for(let iz=0;iz<nz;iz++){
      const x=r[3]*((ix+.5)/nx-.5),z=r[5]*((iz+.5)/nz-.5);
      cell(r[0]+n[0]*1.55+x*c+z*s,r[1]+r[4]*((iy+.5)/ny-.5),r[2]+n[1]*1.55-x*s+z*c,r[7]);
    }
  }
  const sorted=[...cells.values()].sort((a,b)=>a[3]-b[3]||a[2]-b[2]||a[1]-b[1]||a[0]-b[0]),rows:number[][]=[];
  for(let i=0;i<sorted.length;){const [x,y,z,col]=sorted[i];let end=i+1;
    while(end<sorted.length&&sorted[end][3]===col&&sorted[end][2]===z&&sorted[end][1]===y&&sorted[end][0]===x+end-i)end++;
    const count=end-i;rows.push([(x+(count-1)/2)*grid,y*grid,z*grid,count*grid,grid,grid,col]);i=end;
  }return rows;
}

function facadeSkin():Mesh{
  const p:number[]=[],col:number[]=[],c=new Color();
  for(const b of source.buildings)for(const e of b.walls){
    const n=normal(e),l=perimeterEdgeLength(e),dx=(e.endXZ[0]-e.startXZ[0])/l,dz=(e.endXZ[1]-e.startXZ[1])/l;
    const contour=e.ring.map(v=>new Vector2((v[0]-e.startXZ[0])*dx+(v[2]-e.startXZ[1])*dz,v[1]));
    c.setHex(wallColor(b.key,e));
    for(const triangle of ShapeUtils.triangulateShape(contour,[]))for(const idx of triangle){const v=e.ring[idx];p.push(v[0]+n[0]*.205,v[1],v[2]+n[1]*.205);col.push(c.r,c.g,c.b);}
  }
  const g=new BufferGeometry();g.setAttribute("position",new BufferAttribute(new Float32Array(p),3));g.setAttribute("color",new BufferAttribute(new Float32Array(col),3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,roughness:.92,side:DoubleSide});
  const mesh=new Mesh(g,day);mesh.name="Three exact retained Litfin-neighbour facade skins";mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,sourceBound:true};return mesh;
}

export function createLitfinNeighboursV215(minecraft=false,_options:{mobileLike?:boolean}={}):Group{
  const root=new Group();root.name=minecraft?"Litfin neighbours v215 native":"Litfin neighbours v215";
  const members=litfinNeighboursV215Members();
  if(!minecraft)root.add(facadeSkin());
  root.add(justicePalaceV183Boxes(minecraft?litfinNeighboursV215NativeRows(members):members.map(m=>m.row),minecraft));
  root.userData={litfinNeighboursV215:true,sourceBound:true,sourceGeometryRetained:true,replacementOwners:[],
    preservedOwnerIds:LITFIN_NEIGHBOURS_V215_PROFILE.ownerIds,textureFree:true,facadeOnly:true,
    fullAndMobileIdentical:true,fullStaticDetailOnTouch:true,blockNative:minecraft,keepInMinecraft:minecraft,nativeMinecraft:minecraft};
  return freezeStaticSceneTransforms(root);
}
