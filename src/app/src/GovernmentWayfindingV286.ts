import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export type GovernmentFingerboardV286 = "potsdamerTor" | "hauptbahnhofMoabit" | "reichstag" | "schoenebergSiegessaeule";
export type GovernmentWayfindingPlacementV286 = {
  native: boolean;
  /** Independently audited mast position, including its local ground datum. */
  anchorWorld: readonly [number, number, number];
  /** Three.js Y rotation from the mast towards each board tip (+local X). */
  directions: Readonly<Record<GovernmentFingerboardV286, number>>;
};
const WHITE = 0xe5e8df, GREEN = 0x2f765a, STEEL = 0x909b99, CAP = 0x434c49;
export const GOVERNMENT_WAYFINDING_V286 = {
  evidence: "government-approaches-owner-photos-v286",
  geometryStatus: "Exact owner-photo wording and four direction identities; mast placement comes from the separate site audit. Unmeasured sections, heights, board sizes and bearings are display estimates.",
  photographicPixelsBundled: false, textureFree: true, fullStaticDetailOnTouch: true,
  nativeConstruction: "Independent cardinal orthogonal panels and run-length pixel lettering; board headings snap to the nearest world cardinal axis.",
  estimatedPostHeightM: 4.26, estimatedBoardLengthM: 1.75, estimatedBoardHeightM: .39,
  instanceLimits: { drawn: 2_000, native: 2_500 },
  boards: [
    { key: "hauptbahnhofMoabit", heightM: 3.97, rows: [{ destination: "Hauptbahnhof", distance: "0,6" }, { destination: "Moabit", distance: "0,3" }] },
    { key: "potsdamerTor", heightM: 3.56, rows: [{ destination: "Potsdamer Platz", distance: "1,4" }, { destination: "Brandenburger Tor", distance: "0,8" }] },
    { key: "reichstag", heightM: 3.15, rows: [{ destination: "Reichstag", distance: "0,2" }] },
    { key: "schoenebergSiegessaeule", heightM: 2.74, rows: [{ destination: "Schöneberg", distance: "3,3" }, { destination: "Siegessäule", distance: "1,7" }] },
  ] as const,
} as const;
type Point = [number, number, number];
type Row = { position: Point; size: Point; color: number; yaw: number; roll: number; role: string };
type LabelAnchor = { boardKey: GovernmentFingerboardV286; kind: "destination" | "distance"; text: string; face: number; start: number; count: number };
const START = .075, LENGTH = GOVERNMENT_WAYFINDING_V286.estimatedBoardLengthM;
const CENTRE = START + LENGTH / 2, HEIGHT = GOVERNMENT_WAYFINDING_V286.estimatedBoardHeightM;
/** Independent native pixel alphabet, rather than rasterized drawn strokes. */
const PIXELS: Record<string, readonly string[]> = {
  A: ["010","101","111","101","101"], B: ["110","101","110","101","110"], C: ["011","100","100","100","011"],
  D: ["110","101","101","101","110"], E: ["111","100","110","100","111"], F: ["111","100","110","100","100"],
  G: ["011","100","101","101","011"], H: ["101","101","111","101","101"], I: ["111","010","010","010","111"],
  J: ["001","001","001","101","010"], K: ["101","101","110","101","101"], L: ["100","100","100","100","111"],
  M: ["10001","11011","10101","10001","10001"], N: ["1001","1101","1011","1001","1001"], O: ["010","101","101","101","010"],
  P: ["110","101","110","100","100"], Q: ["010","101","101","111","011"], R: ["110","101","110","101","101"],
  S: ["011","100","010","001","110"], T: ["111","010","010","010","010"], U: ["101","101","101","101","111"],
  V: ["101","101","101","101","010"], W: ["101","101","101","111","101"], X: ["101","101","010","101","101"],
  Y: ["101","101","010","010","010"], Z: ["111","001","010","100","111"], "0": ["111","101","101","101","111"],
  "1": ["010","110","010","010","111"], "2": ["110","001","010","100","111"], "3": ["110","001","010","001","110"],
  "4": ["101","101","111","001","001"], "5": ["111","100","110","001","110"], "6": ["011","100","111","101","111"],
  "7": ["111","001","010","010","010"], "8": ["111","101","111","101","111"], "9": ["111","101","111","001","110"],
  ",": ["000","000","000","010","100"], " ": ["00","00","00","00","00"],
};
PIXELS["Ö"] = ["101","000",...PIXELS.O]; PIXELS["Ä"] = ["101","000",...PIXELS.A]; PIXELS["Ü"] = ["101","000",...PIXELS.U];
function add(rows: Row[], yaw: number, role: string, position: Point, size: Point, color: number, roll = 0): void {
  rows.push({ position, size, color, yaw, roll, role });
}
function line(rows: Row[], yaw: number, role: string, a: Point, b: Point, color: number, thickness: number): void {
  add(rows, yaw, role, [(a[0]+b[0])/2,(a[1]+b[1])/2,a[2]], [Math.hypot(b[0]-a[0],b[1]-a[1]),thickness,.004], color, Math.atan2(b[1]-a[1],b[0]-a[0]));
}
function drawnText(rows: Row[], yaw: number, face: number, text: string, x: number, baseline: number, width: number): void {
  const cap = .105, scale = Math.min(1,width/letteringLayout(text.toUpperCase(),cap).totalWidthM), z = face*.033;
  for (const path of letteringStrokePaths(text.toUpperCase(),cap)) for (let i=1;i<path.length;i++)
    line(rows,yaw,"drawn destination lettering", [CENTRE+face*(x+path[i-1][0]*scale),baseline+path[i-1][1],z],
      [CENTRE+face*(x+path[i][0]*scale),baseline+path[i][1],z],GREEN,.008);
}
function nativeText(rows: Row[], yaw: number, face: number, text: string, x: number, baseline: number, width: number): void {
  const chars=[...text.toUpperCase().normalize("NFC")], cap=.105;
  const columns=chars.reduce((n,c)=>n+PIXELS[c][0].length+1,-1), unit=Math.min(.019,width/columns);
  let cursor=-columns*unit/2;
  for (const char of chars) {
    const glyph=PIXELS[char], pixelH=cap/glyph.length;
    for (let y=0;y<glyph.length;y++) for (let px=0;px<glyph[y].length;) {
      if (glyph[y][px]==="0") {px++;continue;}
      const start=px; while(px<glyph[y].length&&glyph[y][px]==="1")px++;
      add(rows,yaw,"native destination pixel run",[CENTRE+face*(x+cursor+(start+px)*unit/2),baseline+(glyph.length-y-.5)*pixelH,face*.049],
        [(px-start)*unit*.91,pixelH*.86,.012],GREEN);
    }
    cursor+=(glyph[0].length+1)*unit;
  }
}
function bicycle(rows: Row[], yaw: number, face: number, y: number, native: boolean): void {
  const cx=CENTRE+.61,z=face*(native?.049:.033);
  if(native) {
    const pixels=["000010110","001011000","010101010","101010101","101010101","010000010"];
    for(let row=0;row<pixels.length;row++)for(let col=0;col<pixels[row].length;col++)if(pixels[row][col]==="1")
      add(rows,yaw,"native bicycle pictogram",[cx+face*(col-4)*.017,y+(2.5-row)*.017,z],[.017,.017,.012],GREEN);
    return;
  }
  const p=(x:number,yy:number):Point=>[cx+face*x,y+yy,z];
  for(const wheel of[-.045,.045])for(let i=0;i<8;i++) {
    const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
    line(rows,yaw,"drawn bicycle wheel",p(wheel+.031*Math.cos(a),-.025+.031*Math.sin(a)),p(wheel+.031*Math.cos(b),-.025+.031*Math.sin(b)),GREEN,.006);
  }
  for(const[a,b]of[
    [[-.045,-.025],[-.015,.025]],[[-.015,.025],[.015,-.025]],[[.015,-.025],[-.045,-.025]],
    [[-.015,.025],[.032,.025]],[[.032,.025],[.015,-.025]],[[.032,.025],[.045,-.025]],
    [[.032,.025],[.025,.055]],[[.025,.055],[.048,.055]],[[-.026,.03],[-.006,.03]],
  ]as const)line(rows,yaw,"drawn bicycle frame",p(a[0],a[1]),p(b[0],b[1]),GREEN,.006);
}
function members(placement: GovernmentWayfindingPlacementV286) {
  const{native}=placement,rows:Row[]=[],labels:LabelAnchor[]=[],depth=native?.08:.05;
  add(rows,0,"galvanised mast",[0,2.13,0],[native?.14:.095,4.26,native?.14:.095],STEEL);
  add(rows,0,"dark mast cap",[0,4.285,0],[native?.15:.10,.05,native?.15:.10],CAP);
  for(const board of GOVERNMENT_WAYFINDING_V286.boards) {
    const yaw=placement.directions[board.key];
    add(rows,yaw,"white fingerboard",[CENTRE,board.heightM,0],[LENGTH,HEIGHT,depth],WHITE);
    add(rows,0,"mast board clamp",[0,board.heightM,0],[native?.18:.13,.065,native?.18:.13],CAP);
    for(const face of[-1,1]) {
      const z=face*(native?.045:.029);
      for(const side of[-1,1]) {
        add(rows,yaw,"green board border",[CENTRE,board.heightM+side*(HEIGHT/2-.014),z],[LENGTH-.022,.010,.005],GREEN);
        add(rows,yaw,"green board border",[CENTRE+side*(LENGTH/2-.014),board.heightM,z],[.010,HEIGHT-.026,.005],GREEN);
      }
      if(native)for(const side of[-1,1])for(let step=0;step<5;step++)
        add(rows,yaw,"native green chevron",[START+LENGTH-.12+step*.016,board.heightM+side*(.135-step*.027),face*.049],[.023,.032,.012],GREEN);
      else for(const side of[-1,1])line(rows,yaw,"drawn green chevron",[START+LENGTH-.12,board.heightM+side*.14,face*.033],[START+LENGTH-.035,board.heightM,face*.033],GREEN,.043);
      bicycle(rows,yaw,face,board.heightM,native);
      for(const[i,label]of board.rows.entries()) {
        const baseline=board.heightM+(board.rows.length===1?-.0525:i===0?.043:-.132), writer=native?nativeText:drawnText;
        for (const [kind,text,x,width] of [["destination",label.destination,face>0?-.23:.06,1.04],
          ["distance",label.distance,face>0?.40:.70,.19]] as const) {
          const start=rows.length;writer(rows,yaw,face,text,x,baseline,width);
          labels.push({boardKey:board.key,kind,text,face,start,count:rows.length-start});
        }
      }
    }
  }
  return {rows,labels};
}
/** Bake unit-box matrices and linear colours directly into the existing public
 * realm buffers. No geometry, material, draw call or runtime media is allocated. */
export function bakeGovernmentWayfindingV286(placement: GovernmentWayfindingPlacementV286) {
  const values=[...placement.anchorWorld,...GOVERNMENT_WAYFINDING_V286.boards.map(board=>placement.directions[board.key])];
  if(values.length!==7||Object.keys(placement.directions).length!==4||values.some(value=>!Number.isFinite(value)))throw new Error("Government wayfinding requires a finite audited anchor and all four bearings");
  const {rows,labels}=members(placement),limit=GOVERNMENT_WAYFINDING_V286.instanceLimits[placement.native?"native":"drawn"];
  if(rows.length>limit)throw new Error("Government wayfinding exceeded its fixed instance allowance");
  const matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3);
  const matrix=new Matrix4(),frame=new Matrix4(),q=new Quaternion(),color=new Color();
  rows.forEach((row,i)=>{
    if(placement.native) {
      const quadrant=((Math.round(row.yaw/(Math.PI/2))%4)+4)%4,c=[1,0,-1,0][quadrant],s=[0,1,0,-1][quadrant];
      const[x,y,z]=row.position,[w,h,d]=row.size;
      matrix.makeScale(quadrant%2?d:w,h,quadrant%2?w:d).setPosition(c*x+s*z,y,-s*x+c*z);
    }else {
      q.setFromAxisAngle(new Vector3(0,0,1),row.roll);matrix.compose(new Vector3(...row.position),q,new Vector3(...row.size));
      frame.makeRotationY(row.yaw);matrix.premultiply(frame);
    }
    matrix.elements[12]+=placement.anchorWorld[0];matrix.elements[13]+=placement.anchorWorld[1];matrix.elements[14]+=placement.anchorWorld[2];
    matrix.toArray(matrices,i*16);color.setHex(row.color).toArray(colors,i*3);
  });
  return {matrices,colors,metadata:{profile:GOVERNMENT_WAYFINDING_V286,native:placement.native,
    keepInMinecraft:placement.native,blockNative:placement.native,fullStaticDetailOnTouch:true,textureFree:true,
    sourcePositionProvided:true,directions:{...placement.directions},anchorWorld:[...placement.anchorWorld],labels,roles:rows.map(row=>row.role)}};
}

/** Standalone review wrapper; production can append the baked buffers to its
 * existing batch and preserve the current public-space draw-call count. */
export function createGovernmentWayfindingV286(placement: GovernmentWayfindingPlacementV286): Group {
  const baked=bakeGovernmentWayfindingV286(placement),group=new Group();group.name="Government corner cycleway fingerpost v286";
  const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
  const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.85,metalness:.1});
  const mesh=new InstancedMesh(geometry,day,0);
  mesh.instanceMatrix=new InstancedBufferAttribute(baked.matrices,16);mesh.instanceColor=new InstancedBufferAttribute(baked.colors,3);mesh.count=baked.colors.length/3;
  mesh.name=placement.native?"Native orthogonal fingerpost, pixel text and bicycles":"Drawn fingerpost, line text and bicycles";
  mesh.userData={dayMaterial:day,nightMaterial:night,keepInMinecraft:placement.native,blockNative:placement.native,textureFree:true};
  mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);group.userData=baked.metadata;
  return freezeStaticSceneTransforms(group);
}
