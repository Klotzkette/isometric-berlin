import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import { HBF_CIRCULATION_V291, hbfSlabCutAtV291, hbfLevelFloorContainsV291, hbfRailCurveAtV291, type HbfLevelIdV291 } from "./HbfCirculationV291";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { hbfGeometryComplementV291, hbfSlabOpeningsV291 } from "./HbfGeometryOpeningsV291";
import { indexGeometryExactly } from "./exactGeometryIndex";
import { MINECRAFT_ARCHITECTURAL_BLOCKS as NATIVE_BLOCK } from "./visual-modes/minecraft/palette";

type Point = [number, number, number];
type Batch = "structure" | "glazing" | "light";
type Member = { matrix: Matrix4; color: number; role: string; batch: Batch; shape?: "column" | "capital" };
type Shop = {
  id: string; text: string; levelId: "upper-gallery" | "ground-concourse" | "lower-gallery";
  edge: -1 | 1; z: number; widthM: number; field: number; ink: number;
  category: "food" | "coffee" | "pharmacy" | "supermarket" | "books" | "rental" | "bank" | "bakery";
  sourceSlug: string; locationEvidence: string;
};

/** The legacy four railway cues yield only to these complete independent
 * courses in the same required native-world transaction. Source rail data
 * and every drawn course remain owned by their original factories. */
export const HBF_NATIVE_RAIL_REPLACEMENT_V291 = {
  legacyRole:"four paired block tracks", legacyInstanceCount:328,
  retainedOriginalTrackCentresLocalZ:[-12,-4,4,12] as const,
  displayedTrackCentresLocalZ:HBF_CIRCULATION_V291.upperTrackCentresLocalZ,
  originalSampleHalfLengthM:160, originalPhysicalHalfLengthM:163.8,
  outerHalfLengthM:163.8, maximumCourseLengthM:1.25,
  halfGaugeM:.72, centreLocalY:10.53, thicknessM:.5, widthM:.7,
  colour:NATIVE_BLOCK.iron,
} as const;

/** Tenant identities and floors come from DB's current directory, checked
 * 2026-11-01. The small local bays fit the retained authored hall; they are
 * explicitly estimated placements, not a metric copy of DB's station plan. */
export const HBF_INTERIOR_V291 = {
  geometryStatus: "Current DB tenant identities and evidenced levels/exits; individual bays, stair fittings, lower-level columns and lights are bounded display estimates, not surveyed geometry.",
  shopSourceBase: "https://www.bahnhof.de/berlin-hauptbahnhof/einkaufen-und-essen/",
  nativeConstruction: "Independent world-orthogonal floor tiles, open square-ring shafts and pixel lettering; no rotated smooth-model duplicate.",
  textureFree: true, fullStaticDetailOnTouch: true,
  nativeRailReplacement:HBF_NATIVE_RAIL_REPLACEMENT_V291,
  deepColumnCentresLocalX: HBF_CIRCULATION_V291.deepColumnCentresLocalX,
  deepColumnCentresLocalZ: HBF_CIRCULATION_V291.deepColumnCentresLocalZ,
  deepColumnRadiusM: HBF_CIRCULATION_V291.deepColumnRadiusM,
  shops: [
    { id: "apotheke", text: "APOTHEKE", levelId: "upper-gallery", edge: -1, z: -67, widthM: 11.5, field: 0xf1eee7, ink: 0xc5212c, category: "pharmacy", sourceSlug: "apotheke", locationEvidence: "1. Obergeschoss, Ausgang Europaplatz" },
    { id: "starbucks", text: "STARBUCKS", levelId: "upper-gallery", edge: 1, z: 67, widthM: 11.5, field: 0x124d39, ink: 0xf1eee3, category: "coffee", sourceSlug: "starbucks", locationEvidence: "1. Obergeschoss, Ausgang Washingtonplatz" },
    { id: "reisebank", text: "REISEBANK", levelId: "upper-gallery", edge: 1, z: -28, widthM: 11.5, field: 0x1a4471, ink: 0xf4ca4b, category: "bank", sourceSlug: "reisebank", locationEvidence: "1. Obergeschoss, Zugang Gleis 13/14" },
    { id: "heberer", text: "HEBERER", levelId: "upper-gallery", edge: -1, z: 54, widthM: 11.5, field: 0x8b2528, ink: 0xf6e8ca, category: "bakery", sourceSlug: "wiener-feinbaecker-heberer", locationEvidence: "1. Obergeschoss; side not specified" },
    { id: "kamps-eg", text: "KAMPS", levelId: "ground-concourse", edge: -1, z: 67, widthM: 11.5, field: 0xe8b333, ink: 0x8c2935, category: "bakery", sourceSlug: "kamps-baeckerei", locationEvidence: "Erdgeschoss, Ausgang Washingtonplatz" },
    { id: "relay-eg", text: "RELAY", levelId: "ground-concourse", edge: 1, z: -67, widthM: 11.5, field: 0xa50e34, ink: 0xf4eee8, category: "books", sourceSlug: "relay", locationEvidence: "Erdgeschoss; side not specified" },
    { id: "doener", text: "FATIH SERVET DÖNER", levelId: "lower-gallery", edge: 1, z: -54, widthM: 11.5, field: 0x722725, ink: 0xffdfaa, category: "food", sourceSlug: "fatih-servet-doener", locationEvidence: "1. Untergeschoss, Richtung U-Bahn" },
    { id: "sixt", text: "SIXT", levelId: "lower-gallery", edge: -1, z: -41, widthM: 11.5, field: 0xed751c, ink: 0x171b1b, category: "rental", sourceSlug: "sixt", locationEvidence: "1. Untergeschoss, Richtung U-Bahn" },
    { id: "europcar", text: "EUROPCAR", levelId: "lower-gallery", edge: 1, z: -28, widthM: 11.5, field: 0x207542, ink: 0xf8e9c9, category: "rental", sourceSlug: "europcar", locationEvidence: "1. Untergeschoss, Richtung U-Bahn" },
    { id: "kamps-ug", text: "KAMPS BACKSTUBE", levelId: "lower-gallery", edge: -1, z: -67, widthM: 11.5, field: 0xe8b333, ink: 0x8c2935, category: "bakery", sourceSlug: "kamps-backstube", locationEvidence: "1. Untergeschoss, Richtung U-Bahn" },
    { id: "rewe", text: "REWE", levelId: "lower-gallery", edge: -1, z: 54, widthM: 11.5, field: 0xc51d30, ink: 0xf6f0e6, category: "supermarket", sourceSlug: "rewe", locationEvidence: "1. Untergeschoss, Richtung Parkhaus" },
    { id: "mcdonalds", text: "MCDONALD'S", levelId: "lower-gallery", edge: 1, z: 67, widthM: 11.5, field: 0x263d32, ink: 0xf3c542, category: "food", sourceSlug: "mcdonalds-mit-mccafe", locationEvidence: "1. Untergeschoss, Richtung Parkhaus" },
    { id: "relay-ug", text: "RELAY", levelId: "lower-gallery", edge: -1, z: 28, widthM: 11.5, field: 0xa50e34, ink: 0xf4eee8, category: "books", sourceSlug: "relay", locationEvidence: "1. Untergeschoss, Richtung Parkhaus" },
  ] satisfies Shop[],
} as const;

export type HbfInteriorPlacementV291 = {
  native?: boolean;
  /** Omit for the drawn station's already transformed local Group. Native
   * callers supply the retained station frame and attach the result to world. */
  anchorWorld?: readonly [number, number, number];
  rotationDegrees?: number;
};

/** Exact old generic storefront owner keys. The other 46 panels remain. */
export function replacesHbfShopfrontV291(x: number, y: number, z: number): boolean {
  // Its former generic pane would otherwise obscure the complete retained
  // Einstein fascia after the evidenced relocation to Europaplatz.
  if(Math.abs(x+19.55)<1e-6&&Math.abs(y-1.75)<1e-6&&Math.abs(z+54)<1e-6)return true;
  return HBF_INTERIOR_V291.shops.some((shop) => {
    const level = HBF_CIRCULATION_V291.levels.find((candidate) => candidate.id === shop.levelId);
    return level && Math.abs(x - shop.edge * 19.55) < 1e-6 &&
      Math.abs(y - (level.topLocalY - .25 + 1.75)) < 1e-6 && Math.abs(z - shop.z) < 1e-6;
  });
}

const PIXELS: Record<string, readonly string[]> = {
  A: ["010","101","111","101","101"], B: ["110","101","110","101","110"], C: ["011","100","100","100","011"],
  D: ["110","101","101","101","110"], E: ["111","100","110","100","111"], F: ["111","100","110","100","100"],
  G: ["011","100","101","101","011"], H: ["101","101","111","101","101"], I: ["111","010","010","010","111"],
  J: ["001","001","001","101","010"], K: ["101","101","110","101","101"], L: ["100","100","100","100","111"],
  M: ["10001","11011","10101","10001","10001"], N: ["1001","1101","1011","1001","1001"], O: ["010","101","101","101","010"],
  P: ["110","101","110","100","100"], Q: ["010","101","101","111","011"], R: ["110","101","110","101","101"],
  S: ["011","100","010","001","110"], T: ["111","010","010","010","010"], U: ["101","101","101","101","111"],
  V: ["101","101","101","101","010"], W: ["101","101","101","111","101"], X: ["101","101","010","101","101"],
  Y: ["101","101","010","010","010"], Z: ["111","001","010","100","111"],
  "0": ["111","101","101","101","111"], "1": ["010","110","010","010","111"], "2": ["110","001","010","100","111"],
  "3": ["110","001","010","001","110"], "4": ["101","101","111","001","001"], "5": ["111","100","110","001","110"],
  "6": ["011","100","111","101","111"], "7": ["111","001","010","010","010"], "8": ["111","101","111","101","111"],
  "9": ["111","101","111","001","110"], "-": ["000","000","111","000","000"],
  "'": ["1","1","0","0","0"], " ": ["00","00","00","00","00"],
};
PIXELS["Ö"] = ["101","000",...PIXELS.O];

class Plan {
  readonly members: Member[] = [];
  readonly clippedFloors: {geometry:BufferGeometry;color:number;role:string}[]=[];
  readonly labels: { text: string; start: number; count: number; role: string }[] = [];
  private readonly world: Matrix4;
  private readonly yaw: number;
  constructor(readonly native: boolean, placement: HbfInteriorPlacementV291) {
    this.yaw = (placement.rotationDegrees ?? 0) * Math.PI / 180;
    this.world = new Matrix4().makeRotationY(this.yaw);
    this.world.setPosition(...(placement.anchorWorld ?? [0, 0, 0]));
  }
  box(position: Point, size: Point, color: number, role: string, batch: Batch = "structure"): void {
    if (size.some((n) => n <= 0 || !Number.isFinite(n)) || position.some((n) => !Number.isFinite(n))) throw new Error("Invalid Hauptbahnhof interior member");
    if (!this.native) {
      this.members.push({ matrix: new Matrix4().makeScale(...size).setPosition(...position).premultiply(this.world), color, role, batch });
      return;
    }
    const centre = new Vector3(...position).applyMatrix4(this.world);
    const c = Math.abs(Math.cos(this.yaw)), s = Math.abs(Math.sin(this.yaw));
    // Long strips use small cardinal courses along their actual rotated axis,
    // not the strip's full bounding box. Large floors use footprint tiles below.
    const axis = size[0] > size[2] ? 0 : 2;
    const n = Math.max(1, Math.ceil(size[axis] / 1.4));
    const part = [...size] as Point;
    part[axis] /= n;
    for (let i = 0; i < n; i++) {
      const local = [...position] as Point;
      local[axis] += (i + .5) * part[axis] - size[axis] / 2;
      const p = new Vector3(...local).applyMatrix4(this.world);
      const w = part[0] * c + part[2] * s, d = part[0] * s + part[2] * c;
      this.members.push({ matrix: new Matrix4().makeScale(w, size[1], d).setPosition(p.x, centre.y, p.z), color, role, batch });
    }
  }
  horizontalTread(position: Point, width: number, depth: number, yaw: number, color: number, role: string, thickness=.20): void {
    const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw);
    this.members.push({matrix:new Matrix4().compose(new Vector3(...position),q,new Vector3(width,thickness,depth)).premultiply(this.world),color,role,batch:"structure"});
  }
  roundColumn(position: Point, radius: number, height: number, color: number, role: string, shape: "column" | "capital"): void {
    this.members.push({matrix:new Matrix4().makeScale(radius,height,radius).setPosition(...position).premultiply(this.world),color,role,batch:"structure",shape});
  }
  /** Independent cardinal tiles clipped by their centre to the rotated source
   * rectangle. This intentionally remains a block interpretation. */
  floor(minX: number, maxX: number, minZ: number, maxZ: number, top: number, color: number, role: string, thickness = .5, contains?: (x:number,z:number,corners?:readonly (readonly [number,number])[])=>boolean, cell = 1.25): void {
    if (!this.native) {
      const source=new BoxGeometry(maxX-minX,thickness,maxZ-minZ).translate((minX+maxX)/2,top-thickness/2,(minZ+maxZ)/2);
      const clipped=hbfGeometryComplementV291(source,hbfSlabOpeningsV291(top-thickness,top));
      if(clipped===source){source.dispose();this.box([(minX+maxX)/2,top-thickness/2,(minZ+maxZ)/2],[maxX-minX,thickness,maxZ-minZ],color,role);return;}
      source.dispose();clipped.applyMatrix4(this.world);
      if(clipped.getAttribute("position").count)this.clippedFloors.push({geometry:clipped,color,role});else clipped.dispose();
      return;
    }
    const corners = [[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]].map(([x,z]) => new Vector3(x,top-thickness/2,z).applyMatrix4(this.world));
    const inverse = this.world.clone().invert();
    const firstX=Math.floor(Math.min(...corners.map(p=>p.x))/cell),lastX=Math.ceil(Math.max(...corners.map(p=>p.x))/cell);
    const firstZ=Math.floor(Math.min(...corners.map(p=>p.z))/cell),lastZ=Math.ceil(Math.max(...corners.map(p=>p.z))/cell);
    // Losslessly merge consecutive same-colour cardinal cells. A long run
    // occupies exactly the same binary-exact 1.25m cells as its individual
    // cubes, without hidden internal faces or one matrix per floor tile.
    for(let ix=firstX;ix<lastX;ix++) {
      let runStart: number | null=null;
      const emit=(end:number):void=>{
        if(runStart===null)return;
        this.members.push({matrix:new Matrix4().makeScale(cell,thickness,(end-runStart)*cell)
          .setPosition((ix+.5)*cell,corners[0].y,(runStart+end)*cell/2),color,role,batch:"structure"});
        runStart=null;
      };
      for(let iz=firstZ;iz<lastZ;iz++) {
        const p=new Vector3((ix+.5)*cell,corners[0].y,(iz+.5)*cell).applyMatrix4(inverse);
        const footprint=contains&&contains.length>=3?[-1,1].flatMap(dx=>[-1,1].map(dz=>[
          p.x+(dx*inverse.elements[0]+dz*inverse.elements[8])*cell/2,
          p.z+(dx*inverse.elements[2]+dz*inverse.elements[10])*cell/2,
        ] as const)):undefined;
        const present=p.x>=minX&&p.x<=maxX&&p.z>=minZ&&p.z<=maxZ&&
          (!contains||contains(p.x,p.z,footprint))&&!hbfSlabCutAtV291(p.x,p.z,top-thickness,top,true);
        if(present&&runStart===null)runStart=iz;
        if(!present)emit(iz);
      }
      emit(lastZ);
    }
  }
  rod(a: Point, b: Point, width: number, color: number, role: string, batch: Batch = "structure"): void {
    const start = new Vector3(...a), end = new Vector3(...b), delta=end.clone().sub(start), length=delta.length();
    if(length<.00001)return;
    if(this.native) {
      const count=Math.max(1,Math.ceil(length/Math.max(.12,width*1.7)));
      for(let i=0;i<count;i++)this.box(start.clone().lerp(end,(i+.5)/count).toArray() as Point,[width,width,width],color,role,batch);
    }else this.members.push({matrix:new Matrix4().compose(start.add(end).multiplyScalar(.5),new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.normalize()),new Vector3(width,length,width)).premultiply(this.world),color,role,batch});
  }
  text(text: string, centre: Point, widthM: number, heightM: number, color: number, role: string, along: "x" | "z", face = 1): void {
    const start=this.members.length;
    const p=(u:number,y:number):Point=>along==="z"?[centre[0],centre[1]+y,centre[2]+face*u]:[centre[0]+face*u,centre[1]+y,centre[2]];
    if(this.native) {
      const chars=[...text],columns=chars.reduce((n,c)=>n+PIXELS[c][0].length+1,-1), unit=Math.min(heightM/5,widthM/columns);
      let cursor=-columns*unit/2;
      for(const char of chars) {
        const glyph=PIXELS[char],h=heightM/glyph.length;
        for(let row=0;row<glyph.length;row++)for(let col=0;col<glyph[row].length;) {
          if(glyph[row][col]!=="1"){col++;continue;}
          const begin=col;while(col<glyph[row].length&&glyph[row][col]==="1")col++;
          this.box(p(cursor+(begin+col)*unit/2,(glyph.length-row-.5)*h),along==="z"?[.06,h*.86,(col-begin)*unit*.92]:[(col-begin)*unit*.92,h*.86,.06],color,role,"light");
        }
        cursor+=(glyph[0].length+1)*unit;
      }
    }else {
      const scale=Math.min(1,widthM/letteringLayout(text,heightM).totalWidthM);
      for(const path of letteringStrokePaths(text,heightM))for(let i=1;i<path.length;i++)this.rod(p(path[i-1][0]*scale,path[i-1][1]),p(path[i][0]*scale,path[i][1]),heightM*.085,color,role,"light");
    }
    this.labels.push({text,start,count:this.members.length-start,role});
  }
}

function appendShop(plan: Plan, shop: Shop): void {
  const level=HBF_CIRCULATION_V291.levels.find(candidate=>candidate.id===shop.levelId)!;
  const y=level.topLocalY,side=shop.edge,x=side*19.48;
  plan.box([x,y+1.72,shop.z],[.35,3.44,shop.widthM],0x343b3b,`shop:${shop.id}:recess`);
  // Framed panes have a wide central opening, with warm display counters and
  // shelving visible behind it. They stay outside the circulation lanes.
  for(const flank of[-1,1]) {
    plan.box([x-side*.23,y+1.25,shop.z+flank*3.9],[.10,2.35,3.1],0x657f7e,`shop:${shop.id}:window`,"glazing");
    plan.box([x-side*.30,y+.45,shop.z+flank*3.9],[.14,.62,3.1],0xb6a789,`shop:${shop.id}:display-counter`);
    for(const end of[-1,1])plan.box([x-side*.35,y+1.26,shop.z+flank*3.9+end*1.57],[.12,2.43,.10],0xb5bab3,`shop:${shop.id}:mullion`);
  }
  for(const yy of[.20,2.48])plan.box([x-side*.36,y+yy,shop.z],[.13,.10,shop.widthM-.1],0xb5bab3,`shop:${shop.id}:transom`);
  plan.box([x-side*.32,y+2.98,shop.z],[.18,.83,shop.widthM],shop.field,`shop:${shop.id}:fascia`);
  plan.text(shop.text,[x-side*.44,y+2.71,shop.z],shop.widthM-1,.53,shop.ink,`shop:${shop.id}:lettering`,"z",side);
  plan.box([x-side*.46,y+2.52,shop.z],[.07,.065,shop.widthM-.7],0xffe0a0,`shop:${shop.id}:light`,"light");
  if(shop.category==="pharmacy") {
    plan.box([x-side*.47,y+1.6,shop.z-3.9],[.07,.8,.22],0xc5212c,"pharmacy-cross","light");
    plan.box([x-side*.48,y+1.6,shop.z-3.9],[.08,.22,.8],0xc5212c,"pharmacy-cross","light");
  } else if(shop.category==="books"||shop.category==="supermarket"||shop.category==="bakery") {
    for(const flank of[-1,1])for(let i=0;i<6;i++)for(const shelf of[.89,1.42,1.95])
      plan.box([x-side*.34,y+shelf,shop.z+flank*3.9+(i-2.5)*.40],[.08,shop.category==="books"?.38:.20,.26],shop.category==="bakery"?0xc79755:[0x847454,0x983d36,0x54745e,0x596c92][i%4],`shop:${shop.id}:shelves`);
  } else if(shop.category==="rental"||shop.category==="bank") {
    for(const flank of[-1,1])plan.box([x-side*.4,y+.93,shop.z+flank*3.9],[.10,.42,.71],0x2c3438,`shop:${shop.id}:service-screen`);
  } else if(shop.category==="food"||shop.category==="coffee") {
    for(const flank of[-1,1])for(let i=0;i<3;i++)plan.box([x-side*.37,y+1.05,shop.z+flank*3.9+(i-1)*.73],[.10,.48,.43],i===1?0x554536:0xd6bc91,`shop:${shop.id}:menu`);
  }
}

function appendStairs(plan: Plan): void {
  for(const flight of HBF_CIRCULATION_V291.flights.filter(candidate=>candidate.kind==="stairs")) {
    const a=new Vector3(...flight.from),b=new Vector3(...flight.to),dx=b.x-a.x,dz=b.z-a.z,run=Math.hypot(dx,dz),nx=-dz/run,nz=dx/run;
    const count=Math.ceil(Math.abs(b.y-a.y)/.18),depth=run/count;
    for(let step=0;step<count;step++) {
      const t=(step+.5)/count,p=a.clone().lerp(b,t);
      const top=a.y+(b.y-a.y)*(step+.5)/count;
      // A broad tread is split along its true horizontal course in native;
      // drawn keeps the actual horizontal tread rather than a tilted plank.
      if(!plan.native) {
        plan.horizontalTread([p.x,top-.10,p.z],flight.widthM,depth+.015,-Math.atan2(nz,nx),0xc0c5bd,`stairs:${flight.id}:tread`);
      }else if(Math.abs(dx)<.001) {
        plan.box([p.x,top-.10,p.z],[flight.widthM,.20,depth+.015],0xc0c5bd,`stairs:${flight.id}:tread`);
        plan.box([p.x,top+.012,p.z-Math.sign(dz)*depth*.38],[flight.widthM,.025,.055],0xe5dfc8,`stairs:${flight.id}:nosing`);
      }else {
        const subdivisions=Math.max(1,Math.ceil(flight.widthM/.35));
        for(let cross=0;cross<subdivisions;cross++) {
          const u=((cross+.5)/subdivisions-.5)*flight.widthM;
          plan.box([p.x+nx*u,top-.10,p.z+nz*u],[Math.abs(nx)*flight.widthM/subdivisions+Math.abs(dx/run)*depth,.20,Math.abs(nz)*flight.widthM/subdivisions+Math.abs(dz/run)*depth],0xc0c5bd,`stairs:${flight.id}:tread`);
        }
      }
    }
    for(const flank of[-1,1]) {
      const u=flank*(flight.widthM/2+.09),offset=(p:Vector3,h:number):Point=>[p.x+nx*u,p.y+h,p.z+nz*u];
      plan.rod(offset(a,-.15),offset(b,-.15),.18,0x747e7e,`stairs:${flight.id}:stringer`);
      plan.rod(offset(a,1.08),offset(b,1.08),.085,0x9da8a5,`stairs:${flight.id}:handrail`);
      const posts=Math.ceil(run/1.7);
      for(let i=0;i<=posts;i++){const p=a.clone().lerp(b,i/posts);plan.rod(offset(p,.08),offset(p,1.08),.065,0x9da8a5,`stairs:${flight.id}:post`);}
    }
  }
  // Gallery strips and the six retained bridges already support the outside
  // parts of each landing. Add only its open-slot complement, so a new landing
  // never duplicates a coplanar slab top or bridges a railway platform.
  const published: Array<{x0:number;x1:number;z0:number;z1:number;y:number}>=[];
  for(const level of HBF_CIRCULATION_V291.levels)if("openHalfM" in level) {
    published.push({x0:-20,x1:-level.openHalfM,z0:-88,z1:88,y:level.topLocalY},
      {x0:level.openHalfM,x1:20,z0:-88,z1:88,y:level.topLocalY});
    for(const arm of[-1,1])published.push({x0:-level.openHalfM-.4,x1:level.openHalfM+.4,
      z0:arm*level.bridgeLocalZ-2.6,z1:arm*level.bridgeLocalZ+2.6,y:level.topLocalY});
    if(level.id==="ground-concourse")published.push({x0:-20,x1:20,z0:-20,z1:20,y:level.topLocalY},
      {x0:-20,x1:20,z0:-92.2,z1:-82,y:level.topLocalY},{x0:-20,x1:20,z0:82,z1:92.2,y:level.topLocalY},
      {x0:-4.8,x1:4.8,z0:29.9,z1:44.1,y:level.topLocalY});
  }
  for(const landing of HBF_CIRCULATION_V291.landings) {
    let pieces=[{x0:landing.minX,x1:landing.maxX,z0:landing.minZ,z1:landing.maxZ,y:landing.topLocalY}];
    for(const owner of published)if(Math.abs(owner.y-landing.topLocalY)<.001)pieces=pieces.flatMap(piece=>{
      const x0=Math.max(owner.x0,piece.x0),x1=Math.min(owner.x1,piece.x1),z0=Math.max(owner.z0,piece.z0),z1=Math.min(owner.z1,piece.z1);
      if(x0>=x1||z0>=z1)return[piece];
      return [
        {...piece,x1:x0},{...piece,x0:x1},
        {...piece,x0,x1,z1:z0},{...piece,x0,x1,z0:z1},
      ].filter(p=>p.x1-p.x0>.001&&p.z1-p.z0>.001);
    });
    for(const piece of pieces) {
      plan.floor(piece.x0,piece.x1,piece.z0,piece.z1,piece.y,0xbfc4bb,`landing:${landing.id}`,.28);
      published.push(piece);
    }
  }
}

function appendCombs(plan:Plan):void {
  for(const comb of HBF_CIRCULATION_V291.combs) {
    if(!plan.native&&comb.kind!=="stairs")continue;
    const p:[number,number,number]=[comb.centre[0],comb.centre[1]-.09,comb.centre[2]],role=`comb:${comb.id}`;
    if(plan.native)plan.box(p,[Math.abs(comb.unitZ)*comb.widthM+Math.abs(comb.unitX)*comb.lengthM,.18,Math.abs(comb.unitX)*comb.widthM+Math.abs(comb.unitZ)*comb.lengthM],0xb9bdb3,role);
    else plan.horizontalTread(p,comb.widthM,comb.lengthM,-Math.atan2(comb.unitX,-comb.unitZ),0xc0c5bd,role,.18);
  }
}

function appendDeepDetails(plan: Plan): void {
  const top=HBF_CIRCULATION_V291.levels.find(level=>level.id==="deep-rail")!.topLocalY;
  const platforms=[-28.5,-9.5,9.5,28.5];
  platforms.forEach((x,island)=>{
    for(const side of[-1,1]) {
      plan.box([x+side*4.05,top+.025,0],[.46,.05,166],0xe3ddbf,"deep-platform-tactile-edge");
      for(let z=-80;z<=80;z+=2)plan.box([x+side*4.05,top+.055,z],[.40,.022,.035],0xa3a598,"deep-platform-tactile-ridge");
    }
    for(const z of[-56,56]) {
      plan.box([x,-10.15,z],[4.9,.86,.19],0x174d8d,"deep-platform-number-field");
      plan.text(`${island*2+1} - ${island*2+2}`,[x,-10.41,z-.12],4.35,.50,0xf2f3e6,"deep-platform-number-lettering","x",-1);
      plan.text(`${island*2+1} - ${island*2+2}`,[x,-10.41,z+.12],4.35,.50,0xf2f3e6,"deep-platform-number-lettering","x",1);
      for(const side of[-1,1])plan.box([x+side*1.65,-7.86,z],[.065,3.72,.065],0xa6afab,"deep-platform-sign-hanger");
    }
    const columnX=HBF_INTERIOR_V291.deepColumnCentresLocalX[island],columnTop=HBF_CIRCULATION_V291.deepColumnTopLocalY,columnHeight=columnTop-top,columnY=(columnTop+top)/2;
    for(const z of HBF_INTERIOR_V291.deepColumnCentresLocalZ) {
      // The official DB lower-platform photo shows round concrete columns,
      // flared capitals and a teal circular annulus in the panelled ceiling.
      // Their unmeasured dimensions and spacing are display estimates.
      const facets=plan.native?4:16;
      if(plan.native) {
        for(let i=0;i<facets;i++) {
          const angle=i*Math.PI*2/facets;
          plan.box([columnX+Math.cos(angle)*.34,columnY,z+Math.sin(angle)*.34],[.48,columnHeight,.48],0xa8b1a6,"deep-platform-round-support-column");
        }
        for(let ring=0;ring<4;ring++)for(let i=0;i<facets;i++) {
          const angle=i*Math.PI*2/facets,radius=.38+ring*.31,y=-6.64+ring*.14;
          plan.box([columnX+Math.cos(angle)*radius,y,z+Math.sin(angle)*radius],[.64,.20,.64],0xb5bcb0,"deep-platform-flared-capital");
        }
      } else {
        plan.roundColumn([columnX,columnY,z],HBF_INTERIOR_V291.deepColumnRadiusM,columnHeight,0xa8b1a6,"deep-platform-round-support-column","column");
        plan.roundColumn([columnX,-6.36,z],1.48,.66,0xb5bcb0,"deep-platform-flared-capital","capital");
      }
      for(let i=0;i<facets;i++) {
        const angle=i*Math.PI*2/facets;
        plan.box([columnX+Math.cos(angle)*1.46,-6.14,z+Math.sin(angle)*1.46],
          plan.native?[.70,.085,.70]:[.48,.085,.48],0x4d8588,"deep-platform-teal-ceiling-annulus","glazing");
      }
    }
    for(const side of Math.abs(x)>20?[-1,1]:[Math.sign(x)]) {
      const lightX=x+side*2.55;
      plan.box([lightX,-6.46,0],[.18,.12,164],0xfff0ca,"deep-platform-continuous-light","light");
      for(let z=-80;z<=80;z+=20)plan.box([lightX,-6.20,z],[.055,.40,.055],0x9da8a1,"deep-platform-light-hanger");
    }
    for(const z of[-39,39]) {
      plan.box([x+.5,top+.49,z],[.55,.18,3.8],0x969d98,"deep-platform-bench-seat");
      plan.box([x+.72,top+.78,z],[.16,.55,3.8],0x87958e,"deep-platform-bench-back");
      for(const end of[-1,1])plan.box([x+.5,top+.22,z+end*1.3],[.35,.45,.14],0x77837e,"deep-platform-bench-leg");
    }
  });
  // Only the outside wings are roofed; the existing daylight slot remains open.
  // The inner edge also clears the complete 2.6m fixed stair and its rail at
  // x12.8, rather than embedding the last few centimetres of that new fitting.
  for(const side of[-1,1]) {
    plan.floor(side<0?-38:14.4,side<0?-14.4:38,-90,90,-5.65,0x9ba6a0,"deep-outside-wing-ceiling",.35);
    for(let z=-88;z<90;z+=4)plan.box([side*26.2,-6.012,z],[23.6,.018,.025],0x818f87,"deep-ceiling-panel-seam");
    for(const x of[side*18,side*26,side*34])plan.box([x,-6.012,0],[.025,.018,180],0x818f87,"deep-ceiling-panel-seam");
  }
}

function appendCentralFloors(plan: Plan): void {
  for(const level of HBF_CIRCULATION_V291.levels)if("openHalfM" in level&&level.id!=="ground-concourse")
    for(const edge of[-1,1])plan.floor(edge<0?-20:level.openHalfM,edge<0?-level.openHalfM:20,-20,20,level.topLocalY,0xb6beb5,`central-${level.id}-gallery`);
  const ground=HBF_CIRCULATION_V291.levels.find(level=>level.id==="ground-concourse")!.topLocalY;
  plan.floor(-20,20,-20,20,ground,0xb6beb5,"ground-crossing-floor");
}

function appendWayfinding(plan: Plan): void {
  for(const level of HBF_CIRCULATION_V291.levels)if("bridgeLocalZ" in level)for(const arm of[-1,1]) {
    const text=level.id==="upper-gallery"?"GLEIS 11 - 16":"GLEIS 1 - 8";
    for(const face of[-1,1])plan.text(text,[0,level.topLocalY+1.79,arm*level.bridgeLocalZ+face*.075],4.35,.32,0xf3f1dc,"gallery-platform-wayfinding","x",face);
  }
  for(const arm of[-1,1]) {
    plan.box([0,3.43,arm*85],[10.7,.84,.16],0x164d8d,"exit-wayfinding-field");
    plan.text(arm<0?"EUROPAPLATZ":"WASHINGTONPLATZ",[0,3.17,arm*85-arm*.10],9.9,.48,0xf1f2e7,"exit-wayfinding-lettering","x",-arm);
  }
}

/** The same landing/flight gaps used by navigation, with half a native member
 * of end clearance so cardinal rail courses do not protrude into the opening. */
export function hbfNativeGalleryRailRunsV291(levelId: HbfLevelIdV291, x: number, minZ: number, maxZ: number): [number,number][] {
  const level=HBF_CIRCULATION_V291.levels.find(candidate=>candidate.id===levelId)!;
  const cuts: [number,number][]=[];
  for(const landing of HBF_CIRCULATION_V291.landings)if(landing.levelId===levelId&&x>=landing.minX-.2&&x<=landing.maxX+.2)
    cuts.push([landing.minZ-.45,landing.maxZ+.45]);
  if("bridgeLocalZ" in level)for(const arm of[-1,1])cuts.push([arm*level.bridgeLocalZ-3.05,arm*level.bridgeLocalZ+3.05]);
  for(const flight of HBF_CIRCULATION_V291.flights) {
    const dx=flight.to[0]-flight.from[0],dz=flight.to[2]-flight.from[2],dy=flight.to[1]-flight.from[1],length2=dx*dx+dz*dz,length=Math.sqrt(length2);
    const ta=dz/length2,tb=((x-flight.from[0])*dx-flight.from[2]*dz)/length2;
    let lo=minZ,hi=maxZ;
    const constrain=(a:number,b:number,min:number,max:number):void=>{
      if(Math.abs(a)<1e-12){if(b<min||b>max){lo=1;hi=0;}return;}
      const first=(min-b)/a,last=(max-b)/a;lo=Math.max(lo,Math.min(first,last));hi=Math.min(hi,Math.max(first,last));
    };
    constrain(ta,tb,0,1);
    constrain(-dx/length,((x-flight.from[0])*dz+flight.from[2]*dx)/length,-flight.widthM/2-.2,flight.widthM/2+.2);
    constrain(dy*ta,flight.from[1]+dy*tb,level.topLocalY-.5-2.9,level.topLocalY+.3);
    if(lo<hi)cuts.push([lo-.45,hi+.45]);
  }
  let runs:[number,number][]=[[minZ,maxZ]];
  for(const [a,b] of cuts)runs=runs.flatMap(([lo,hi])=>a>=hi||b<=lo?[[lo,hi] as [number,number]]:
    [[lo,Math.max(lo,a)],[Math.min(hi,b),hi]].filter(([x0,x1])=>x1-x0>.001) as [number,number][]);
  return runs;
}

/** Only the exposed edge between the retained 37m quantised deck and the
 * source-fitted outer ballast envelope. The inner five old bays stay owned. */
export function hbfNativeOuterDeckMarginAtV291(x:number,z:number):boolean {
  if(Math.abs(x)>163.8)return false;
  const sourceX=Math.max(-160,Math.min(160,Math.round(x/8)*8));
  const oldBow=Math.round(hbfRailCurveAtV291(sourceX)/4)*4,curve=hbfRailCurveAtV291(x);
  return z>oldBow+18.5+.001&&z<curve+19.8-.001 || z<oldBow-18.5-.001&&z>curve-19.8+.001;
}

function appendNativeStructure(plan: Plan): void {
  // Preserve the four old cues' complete physical end reach, then add the
  // two evidenced outer courses. Exact original iron/gauge/heights stay;
  // only the independent cardinal sampling becomes continuous and finer.
  const rail=HBF_NATIVE_RAIL_REPLACEMENT_V291;
  for(const trackZ of rail.displayedTrackCentresLocalZ)for(const railSide of[-1,1]) {
    const halfLength=rail.originalPhysicalHalfLengthM;
    for(let start=-halfLength;start<halfLength;start+=rail.maximumCourseLengthM) {
      const end=Math.min(halfLength,start+rail.maximumCourseLengthM),a=hbfRailCurveAtV291(start),b=hbfRailCurveAtV291(end);
      plan.box([(start+end)/2,rail.centreLocalY,trackZ+railSide*rail.halfGaugeM+(a+b)/2],
        [end-start,rail.thicknessM,rail.widthM+Math.abs(b-a)],rail.colour,"native-upper-rail");
    }
  }
  // Small cardinal cells are wholly inside the missing edge, so their top
  // faces never overlap an original rotated deck bay. Keep its 9.8m centre.
  plan.floor(-163.8,163.8,-40,82,10.35,0xd4d4b7,"native-added-outer-deck-margin",1.1,
    (x,z,corners)=>hbfNativeOuterDeckMarginAtV291(x,z)&&corners!.every(([xx,zz])=>hbfNativeOuterDeckMarginAtV291(xx,zz)),.5);
  const upper=HBF_CIRCULATION_V291.levels.find(level=>level.id==="upper-rail")!.topLocalY;
  plan.floor(-113,113,-34,54,upper,0xb8c2b6,"native-upper-island-platform",.95,
    (x,z)=>hbfLevelFloorContainsV291("upper-rail",x,z,true));
  const galleries=HBF_CIRCULATION_V291.levels.filter(level=>"openHalfM" in level&&level.openHalfM!==undefined);
  for(const level of galleries) {
    const inner=level.openHalfM!;
    for(const arm of[-1,1]) {
      const near=20,far=level.id==="ground-concourse"?82:88;
      for(const edge of[-1,1]) {
        plan.floor(edge<0?-20:inner,edge<0?-inner:20,arm<0?-far:near,arm<0?-near:far,level.topLocalY,0xb6beb5,`native-${level.id}-gallery`);
        for(const [a,b] of hbfNativeGalleryRailRunsV291(level.id,edge*inner,arm<0?-far:near,arm<0?-near:far)) {
          plan.box([edge*inner,level.topLocalY+.64,(a+b)/2],[.19,1.2,b-a],0x6d8988,`native-${level.id}-balustrade`,"glazing");
          plan.box([edge*inner,level.topLocalY+1.27,(a+b)/2],[.16,.12,b-a],0xa7afaa,`native-${level.id}-handrail`);
        }
      }
      const bridgeZ=arm*(level.id==="upper-gallery"?28:level.id==="ground-concourse"?49.5:71);
      plan.floor(-inner-.4,inner+.4,bridgeZ-2.6,bridgeZ+2.6,level.topLocalY,0xb6beb5,`native-${level.id}-crossbridge`);
    }
  }
  const ground=HBF_CIRCULATION_V291.levels.find(level=>level.id==="ground-concourse")!.topLocalY;
  for(const arm of[-1,1])plan.floor(-20,20,arm<0?-92.2:82,arm<0?-82:92.2,ground,0xb6beb5,"native-entrance-foyer");
  const deep=HBF_CIRCULATION_V291.levels.find(level=>level.id==="deep-rail")!.topLocalY;
  plan.floor(-38,38,-90,90,-15,0x7f8c88,"native-deep-tunnel-floor",.6);
  for(const x of[-28.5,-9.5,9.5,28.5])plan.floor(x-4.8,x+4.8,-84,84,deep,0xb2bcb2,"native-deep-island-platform",.95);
  for(const side of[-1,1])plan.box([side*38.6,-10.9,0],[1.2,9.4,180],0x929e99,"native-deep-sidewall");
  for(const shaft of HBF_CIRCULATION_V291.shafts) {
    const height=shaft.topLocalY-shaft.bottomLocalY;
    for(const side of[-1,1]) {
      plan.box([shaft.x+side*1.75,shaft.bottomLocalY+height/2,shaft.z],[.16,height,3.35],0x6b8788,"native-panoramic-lift-glazing","glazing");
      plan.box([shaft.x,shaft.bottomLocalY+height/2,shaft.z+side*1.75],[3.35,height,.16],0x6b8788,"native-panoramic-lift-glazing","glazing");
      for(const cross of[-1,1])plan.box([shaft.x+side*1.72,shaft.bottomLocalY+height/2,shaft.z+cross*1.72],[.18,height,.18],0xa8b3ae,"native-panoramic-lift-upright");
    }
    for(let y=shaft.bottomLocalY;y<=shaft.topLocalY;y+=1.55)for(const side of[-1,1]) {
      plan.box([shaft.x+side*1.79,y,shaft.z],[.17,.13,3.55],0xa8b3ae,"native-panoramic-lift-ring");
      plan.box([shaft.x,y,shaft.z+side*1.79],[3.55,.13,.17],0xa8b3ae,"native-panoramic-lift-ring");
    }
    for(const level of HBF_CIRCULATION_V291.levels)for(const side of[-1,1])plan.box([shaft.x+side*.53,level.topLocalY+1.1,shaft.z-1.85],[1.0,2.2,.10],0x9eb2ad,"native-panoramic-lift-landing-door","glazing");
  }
}

/** Required, bounded station refinement. Root motion owns the existing doors,
 * escalators and cabins; this factory adds no timer or animation subscription. */
export function createHbfInteriorV291(placement: HbfInteriorPlacementV291 = {}): Group {
  const native=placement.native??false,plan=new Plan(native,placement),root=new Group();
  root.name=native?"Hauptbahnhof independent native interior v291":"Hauptbahnhof connected interior v291";
  if(native)appendNativeStructure(plan);
  appendCentralFloors(plan);
  appendCombs(plan);
  appendStairs(plan);
  for(const shop of HBF_INTERIOR_V291.shops)appendShop(plan,shop);
  if(native)appendShop(plan,{id:"einstein",text:"EINSTEIN KAFFEE",levelId:"ground-concourse",edge:-1,z:-51.3,widthM:13.8,field:0x24292a,ink:0xfff1bd,category:"coffee",sourceSlug:"einstein-kaffee",locationEvidence:"Erdgeschoss, Ausgang Europaplatz"});
  appendDeepDetails(plan);
  appendWayfinding(plan);
  // Preserve the existing complete Einstein storefront, relocated to the
  // evidenced northern exit by the integration owner. Only a geometry label
  // is added here, so its original glass, fascia and mullions do not duplicate.
  if(!native)plan.text("EINSTEIN KAFFEE",[-19.45,.25+2.7,-51.3],13.1,.56,0xffefc2,"retained-einstein-vector-lettering","z",-1);
  const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.82,metalness:.08});
  const glassDay=new MeshBasicMaterial({color:0xffffff,transparent:true,opacity:native?.42:.28,depthWrite:false});
  const glassNight=new MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.32,depthWrite:false,roughness:.26,metalness:.08});
  const lightDay=new MeshBasicMaterial({color:0xffffff}),lightNight=new MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:.3,roughness:.65});
  const materials={structure:[day,night],glazing:[glassDay,glassNight],light:[lightDay,lightNight]} as const;
  let renderBytes=0;
  for(const [batch,shape] of [["structure","box"],["glazing","box"],["light","box"],["structure","column"],["structure","capital"]] as const) {
    const rows=plan.members.filter(member=>member.batch===batch&&(member.shape??"box")===shape);if(!rows.length)continue;
    const geometry=shape==="box"?new BoxGeometry(1,1,1):new CylinderGeometry(1,shape==="capital"?.25:1,1,16);geometry.deleteAttribute("uv");
    const mesh=new InstancedMesh(geometry,materials[batch][0],0),matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3),color=new Color();
    rows.forEach((row,index)=>{row.matrix.toArray(matrices,index*16);color.setHex(row.color).toArray(colors,index*3);});
    mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);
    mesh.name=`Hauptbahnhof v291 ${native?"native ":""}${batch}${shape==="box"?"":` ${shape}`}`;
    mesh.userData={dayMaterial:materials[batch][0],nightMaterial:materials[batch][1],textureFree:true,blockNative:native,keepInMinecraft:native,fullStaticDetailOnTouch:true,roles:rows.map(row=>row.role)};
    mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.castShadow=batch==="structure";mesh.receiveShadow=batch==="structure";root.add(mesh);
    renderBytes+=matrices.byteLength+colors.byteLength+(geometry.index?.array.byteLength??0);
    for(const attribute of Object.values(geometry.attributes))renderBytes+=attribute.array.byteLength;
  }
  if(plan.clippedFloors.length) {
    const size=plan.clippedFloors.reduce((n,row)=>n+row.geometry.getAttribute("position").count,0),positions=new Float32Array(size*3),normals=new Float32Array(size*3),colors=new Float32Array(size*3),color=new Color();
    let cursor=0;
    for(const row of plan.clippedFloors) {
      const p=row.geometry.getAttribute("position"),n=row.geometry.getAttribute("normal");color.setHex(row.color);
      for(let i=0;i<p.count;i++){positions.set([p.getX(i),p.getY(i),p.getZ(i)],cursor*3);normals.set([n.getX(i),n.getY(i),n.getZ(i)],cursor*3);color.toArray(colors,cursor*3);cursor++;}
      row.geometry.dispose();
    }
    const geometry=new BufferGeometry().setAttribute("position",new Float32BufferAttribute(positions,3)).setAttribute("normal",new Float32BufferAttribute(normals,3)).setAttribute("color",new Float32BufferAttribute(colors,3));
    indexGeometryExactly(geometry);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const floorDay=new MeshBasicMaterial({color:0xffffff,vertexColors:true}),floorNight=new MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.82,metalness:.08});
    const mesh=new Mesh(geometry,floorDay);mesh.name="Hauptbahnhof v291 closed floor complements";mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData={dayMaterial:floorDay,nightMaterial:floorNight,textureFree:true,fullStaticDetailOnTouch:true,hbfFloorComplementsV291:true,owners:plan.clippedFloors.map(row=>row.role)};root.add(mesh);
    renderBytes+=geometry.index?.array.byteLength??0;
    for(const attribute of Object.values(geometry.attributes))renderBytes+=attribute.array.byteLength;
  }
  Object.assign(root.userData,{profile:HBF_INTERIOR_V291,nativeMinecraft:native,keepInMinecraft:native,blockNative:native,textureFree:true,fullStaticDetailOnTouch:true,shops:HBF_INTERIOR_V291.shops.map(shop=>({...shop,sourceUrl:HBF_INTERIOR_V291.shopSourceBase+shop.sourceSlug,placementStatus:"Individual bay and side are display estimates within the evidenced level/exit."})),labels:plan.labels,memberCount:plan.members.length,renderBytes});
  return freezeStaticSceneTransforms(root);
}
