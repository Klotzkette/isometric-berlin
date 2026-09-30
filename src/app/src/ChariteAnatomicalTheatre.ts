import {
  BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import { chariteRingWalls, type ChariteSourcePrism } from "./HistoricChariteCampus";
import { sourceMesh } from "./BebelplatzBuildingShells";
import { createMinecraftChariteHistoricShells } from "./MinecraftChariteHistoricShells";
import type { BebelplatzSourcePart } from "./bebelplatzBuildingProfile";
import raw from "./chariteTheatreSource.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

import { CHARITE_THEATRE_PROFILE, chariteTheatreDomeY } from "./chariteTheatreProfile";
export { CHARITE_THEATRE_PROFILE } from "./chariteTheatreProfile";
const P = CHARITE_THEATRE_PROFILE;
const STONE = 0xe0d9c7, LIGHT = 0xeee5d2, SHADE = 0xb9b29f, GREEN = 0x728d82, GLASS = 0x40585c;
const UP = new Vector3(0, 1, 0);
type Point = [number, number, number];
type Box = { p: Point; s: Point; yaw: number; color: number; role: string };

/** Raises only the documented default-height body, preserving its complete plan. */
export function chariteTheatreBodyPart(): BebelplatzSourcePart {
  const source = raw.parts[1], ring = source.ring;
  return { ...source, ground_y_m: P.groundY, top_y_m: P.bodyTopY,
    height_m: P.bodyTopY - P.groundY, surfaces: [
      ...ring.map((a, i) => {
        const b = ring[(i + 1) % ring.length];
        return { kind: "WallSurface", rings: [[[a[0], P.groundY, a[1]], [b[0], P.groundY, b[1]],
          [b[0], P.bodyTopY, b[1]], [a[0], P.bodyTopY, a[1]]]] };
      }),
      { kind: "RoofSurface", rings: [ring.map(([x, z]) => [x, P.bodyTopY, z])] },
    ] };
}

/** Real source-plan square, circular light drum, patinated dome and Langhans bays. */
export function createChariteAnatomicalTheatre(native = false, diagnostic = false): Group {
  const root = new Group(); root.name = native ? "Block-native Tieranatomisches Theater" : "Tieranatomisches Theater source-bound architecture";
  const boxes: Box[] = [];
  const add = (p: Point, s: Point, color: number, role: string, yaw = 0) => boxes.push({ p, s, color, role, yaw });
  const shell = chariteTheatreBodyPart();
  const sourcePart: ChariteSourcePrism = { id: "uBD055gq", ring: shell.ring.map(([x,z]) => [x * 10,z * 10]), y0_dm: 52, h_dm: 94 };
  if (native) {
    const skin = createMinecraftChariteHistoricShells([sourcePart]);
    skin.traverse(o => { o.name = `Tieranatomisches Theater ${o.name}`; });
    root.add(skin);
  } else root.add(sourceMesh([shell], { wall: STONE, roof: 0x70716b, name: "Tieranatomisches Theater corrected body" }));
  for (const w of chariteRingWalls(sourcePart.ring)) {
    if (w.length < 4) continue;
    const yaw = -Math.atan2(w.dirZ, w.dirX);
    const box = (u: number, y: number, out: number, s: Point, color: number, role: string) =>
      add([w.x1 + w.dirX * u + w.nx * out, y, w.z1 + w.dirZ * u + w.nz * out], s, color, role, yaw);
    for (const [y, h, out] of [[5.8,1.1,.06],[13.95,.18,.15],[14.3,.22,.2],[14.58,.15,.27]]) box(w.length/2,y,out,[w.length,h,.22],y<6?SHADE:LIGHT,"classical-cornice");
    const bays = Math.max(1, Math.round(w.length / 4.3));
    for (let i = 0; i < bays; i++) {
      const u=(i+.5)*w.length/bays, width=1.65, spring=11.1;
      box(u,9.6,.11,[2.08,3.2,.14],SHADE,"arched-window-reveal");
      box(u,9.6,.23,[width,3.0,.08],GLASS,"tall-window");
      for (const side of [-1,1]) box(u+side*.92,9.55,.29,[.16,3.15,.18],LIGHT,"window-jamb");
      const count=native?7:17;
      for(let k=0;k<count;k++) {
        const a=(k+.5)/count*Math.PI;
        box(u+Math.cos(a)*.91,spring+Math.sin(a)*.91,.29,[.21,.2,.18],LIGHT,"semicircular-window-arch");
        const dx=width*((k+.5)/count-.5), h=Math.sqrt(Math.max(0,(width/2)**2-dx**2));
        box(u+dx,spring+h/2,.23,[width/count+.006,h,.08],GLASS,"arched-window-glass");
      }
      for (const y of [8.55,9.55,10.55]) box(u,y,.32,[width,.075,.055],LIGHT,"window-transom");
      for (const dx of [-.55,0,.55]) box(u+dx,9.6,.32,[.065,3,.055],LIGHT,"window-mullion");
      box(u,7.58,.18,[2.1,.72,.16],LIGHT,"baluster-panel");
      for (let k=0;k<6;k++) box(u+(k-2.5)*.28,7.58,.29,[.09,.53,.09],SHADE,"baluster-panel-relief");
      box(u,6.45,.22,[1.65,.9,.12],GLASS,"basement-window");
      for (const dx of [-.55,0,.55]) box(u+dx,6.45,.32,[.06,.9,.05],LIGHT,"basement-window-mullion");
      if(!native) {
        box(u,12.2,.23,[.33,.45,.19],LIGHT,"bucranium-recognition-relief");
        for(const side of [-1,1]) box(u+side*.27,12.32,.22,[.28,.1,.14],LIGHT,"bucranium-horn-relief");
      }
    }
    if(!native) for(let u=.3;u<w.length;u+=.55) box(u,13.79,.23,[.17,.16,.21],SHADE,"cornice-dentil");
  }
  const [cx,cz]=P.center, segments=native?56:P.domeSegments;
  const positions:number[]=[],colors:number[]=[];
  const tint=new Color();
  const quad=(a:Point,b:Point,c:Point,d:Point,color:number) => {tint.setHex(color);for(const p of [a,c,b,a,d,c]){positions.push(...p);colors.push(tint.r,tint.g,tint.b);}};
  // Closed thin drum and roof panels, no giant generic cylindrical tower.
  for(let i=0;i<segments;i++) {
    const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,m=(a+b)/2;
    if(native) add([cx+Math.cos(m)*7.86,16.3,cz+Math.sin(m)*7.86],[.95,3.4,.20],STONE,"native-light-drum",-m+Math.PI/2);
    else quad([cx+Math.cos(a)*8,14.6,cz+Math.sin(a)*8],[cx+Math.cos(b)*8,14.6,cz+Math.sin(b)*8],[cx+Math.cos(b)*8,18,cz+Math.sin(b)*8],[cx+Math.cos(a)*8,18,cz+Math.sin(a)*8],STONE);
    const rows=P.domeRows;
    for(let row=0;row<rows;row++) {
      const f0=row/rows,f1=(row+1)/rows;
      const radius=(f:number)=>P.domeRadius*Math.cos(f*Math.PI*.5);
      const y=(f:number)=>P.drumTopY+P.domeRise*Math.sin(f*Math.PI*.5);
      const color=[GREEN,0x7d9489,0x69877f,0x8d9f8d][Math.floor(i/(segments/12))%4];
      if(!native) quad([cx+Math.cos(a)*radius(f0),y(f0),cz+Math.sin(a)*radius(f0)],[cx+Math.cos(b)*radius(f0),y(f0),cz+Math.sin(b)*radius(f0)],[cx+Math.cos(b)*radius(f1),y(f1),cz+Math.sin(b)*radius(f1)],[cx+Math.cos(a)*radius(f1),y(f1),cz+Math.sin(a)*radius(f1)],color);
    }
  }
  if(native) {
    // Connected square roof skin, not isolated radial samples with open seams.
    const cell=P.nativeDomeCell, extent=Math.ceil(P.domeRadius/cell);
    for(let ix=-extent;ix<=extent;ix++)for(let iz=-extent;iz<=extent;iz++) {
      const x=ix*cell,z=iz*cell,r=Math.hypot(x,z);if(r>P.domeRadius)continue;
      const top=Math.min(P.drumTopY+P.domeRise,Math.ceil(chariteTheatreDomeY(r)/P.nativeDomeStep)*P.nativeDomeStep);
      const far=Math.hypot(Math.abs(x)+cell*.75,Math.abs(z)+cell*.75);
      const bottom=Math.max(17.88,Math.floor(chariteTheatreDomeY(far)/P.nativeDomeStep)*P.nativeDomeStep-.08);
      add([cx+x,(top+bottom)/2,cz+z],[cell+P.nativeDomeOverlap,top-bottom,cell+P.nativeDomeOverlap],
        [GREEN,0x7d9489,0x69877f,0x8d9f8d][Math.abs(ix+iz)%4],"native-dome-course");
    }
  }
  // Eight documented round-headed drum lights; bay subdivisions are estimates.
  for(let i=0;i<8;i++) {
    const a=i/8*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a), yaw=-a+Math.PI/2;
    add([cx+nx*8.035,16.1,cz+nz*8.035],[1.65,1.9,.08],GLASS,"drum-light",yaw);
    add([cx+nx*8.105,16.1,cz+nz*8.105],[.08,1.9,.05],LIGHT,"drum-light-mullion",yaw);
    for(let k=0;k<13;k++) {
      const t=(k+.5)/13*Math.PI,u=Math.cos(t)*.9,y=17.0+Math.sin(t)*.9;
      add([cx+nx*8.10-nz*u,y,cz+nz*8.10+nx*u],[.19,.19,.16],LIGHT,"drum-light-arch",yaw);
      const offset=1.65*((k+.5)/13-.5), h=Math.sqrt(Math.max(0,.825**2-offset**2));
      add([cx+nx*8.035-nz*offset,17+h/2,cz+nz*8.035+nx*offset],[1.65/13+.008,h,.08],GLASS,"drum-light-arched-glass",yaw);
    }
  }
  for(let i=0;i<32;i++) {
    const a=i/32*Math.PI*2;
    add([cx+Math.cos(a)*1.18,21.91,cz+Math.sin(a)*1.18],[.045,.9,.045],0x72847e,"oculus-railing");
  }
  add([cx,21.65,cz],[1.65,.28,1.65],GLASS,"central-rooflight");
  if(!native) {
    const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.setAttribute("color",new Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const day=new MeshBasicMaterial({vertexColors:true}), night=new MeshStandardMaterial({vertexColors:true,roughness:.75});
    const mesh=new Mesh(g,day);mesh.name="Langhans light drum and patinated dome";mesh.userData={dayMaterial:day,nightMaterial:night};root.add(mesh);
  }
  const geo=new BoxGeometry(1,1,1);geo.deleteAttribute("uv");const day=new MeshBasicMaterial(),night=new MeshStandardMaterial({roughness:.86});
  const mesh=new InstancedMesh(geo,day,0), matrix=new Matrix4(),q=new Quaternion();
  const matrices=new Float32Array(boxes.length*16),tints=new Float32Array(boxes.length*3);
  boxes.forEach((b,i)=>{matrix.compose(new Vector3(...b.p),q.setFromAxisAngle(UP,b.yaw),new Vector3(...b.s));matrices.set(matrix.elements,i*16);tint.setHex(b.color).toArray(tints,i*3);});
  mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(tints,3);mesh.count=boxes.length;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.name="Tieranatomisches Theater classical openings and cornices";mesh.userData={dayMaterial:day,nightMaterial:night};root.add(mesh);
  root.userData={textureFree:true,sourceIds:P.sourceIds,sourceParent:P.sourceParent,sourceFootprintRetained:true,nativeMinecraft:native,fullMobileIdentical:true,sourceHeightConflict:raw.display_conflict};
  if(diagnostic)root.userData.records=boxes;
  return freezeStaticSceneTransforms(root);
}
