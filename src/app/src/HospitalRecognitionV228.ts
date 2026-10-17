import { BoxGeometry, BufferAttribute, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import source from "./data/hospitalV228Profile.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Edge = { a: number[]; b: number[]; base: number; eave: number; normal: number[] };
type Part = { id: string; owner: string; ring: number[][]; holes: number[][][]; ground_y_m: number; top_y_m: number; wallEdges: Edge[] };
export type HospitalSiteV228 = { key: string; name: string; family: string; wall: number; roof: number; bounds: number[]; parts: Part[] };
type Window = { x: number; y: number; z: number; width: number; height: number; yaw: number };
type Row = number[];

function inside(ring: readonly number[][], x: number, z: number): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
function covered(site: HospitalSiteV228, part: Part, x: number, y: number, z: number): boolean {
  return site.parts.some(p => p !== part && y > p.ground_y_m && y < p.top_y_m - .05 &&
    inside(p.ring, x, z) && !p.holes.some(r => inside(r, x, z)));
}
/** Independently orthogonal native facade runs; never rotated display panels. */
function nativeRows(rows: readonly Row[]): Row[] {
  const result: Row[] = [];
  for (const [x,y,z,w,h,d,yaw,color] of rows) {
    const c=Math.cos(yaw),s=Math.sin(yaw),n=Math.max(1,Math.ceil(w/1.5));
    for(let i=0;i<n;i++) {
      const u=w*((i+.5)/n-.5);
      result.push([x+c*u,y,z-s*u,Math.max(.12,Math.abs(c)*w/n+Math.abs(s)*d),h,
        Math.max(.12,Math.abs(s)*w/n+Math.abs(c)*d),color]);
    }
  }
  return result;
}
/** Source-attached rhythm is estimated. No random facade, invented wing or sign. */
export function hospitalFittingsV228(site: HospitalSiteV228, native = false): { rows: Row[]; windows: Window[]; windowCount: number } {
  const rows: Row[] = [], windows: Window[] = [], nativeWindows: Row[] = [];
  const glass=site.family==="brick"?0x799294:0x74979c,trim=site.family==="brick"?0xd8cbb6:0xe1dfd2;
  let count=0;
  for(const part of site.parts) for(const edge of part.wallEdges) {
    const dx=edge.b[0]-edge.a[0],dz=edge.b[1]-edge.a[1],length=Math.hypot(dx,dz);
    if(length<2.2 || edge.eave-edge.base<2.5)continue;
    const ux=dx/length,uz=dz/length,[nx,nz]=edge.normal,yaw=-Math.atan2(uz,ux);
    const n=Math.max(1,Math.floor(length/(site.family==="screen"?3.4:3.1))),pitch=length/n;
    const panel=(u:number,y:number,w:number,h:number,color:number,out=.18,depth=.1)=>{
      rows.push([edge.a[0]+ux*u+nx*out,y,edge.a[1]+uz*u+nz*out,w,h,depth,yaw,color]);
    };
    for(let i=0;i<n;i++) {
      const u=(i+.5)*pitch,x=edge.a[0]+ux*u,z=edge.a[1]+uz*u;
      for(let y=edge.base+1.8;y+.9<edge.eave-.3;y+=3) {
        if(covered(site,part,x+nx*.35,y,z+nz*.35))continue;
        const width=Math.min(2.3,pitch*.7),height=1.65;
        // Lower-facade colour fields remain narrow and lie directly on an
        // existing wall. Charité's dedicated modern envelope stays untouched.
        if(site.key!=="charite-mitte") panel(u,y,pitch-.05,2.92,site.wall,.095,.055);
        if(native) {
          // Each native opening is two independently axis-aligned blocks,
          // preserving the reveal without tessellating one pane into slivers.
          const w=Math.max(.18,Math.abs(ux)*width+Math.abs(uz)*.13),d=Math.max(.18,Math.abs(uz)*width+Math.abs(ux)*.13);
          const extent=Math.abs(nx)>Math.abs(nz)?w:d,normal=Math.max(Math.abs(nx),Math.abs(nz));
          const out=Math.max(.13,((extent+.18-extent*.83)/2+.035)/normal);
          nativeWindows.push([x+nx*.25,y,z+nz*.25,w+.18,height+.18,d+.18,trim]);
          nativeWindows.push([x+nx*(.25+out),y,z+nz*(.25+out),w*.83,height*.84,d*.83,glass]);
        } else windows.push({x:x+nx*.22,y,z:z+nz*.22,width,height,yaw:Math.atan2(nx,nz)});
        // CBF's documented concrete screens are a distinct, restrained motif;
        // the measured/mapped ward geometry itself is not altered by the fins.
        if(site.family==="screen") {
          panel(u-pitch*.46,y,.19,2.9,trim,.36,.5);
          panel(u,y-.95,pitch-.1,.18,trim,.4,.55);
        }
        count++;
      }
      const cap=edge.eave-.22;
      if(!covered(site,part,x+nx*.35,cap,z+nz*.35)) panel(u,cap,pitch,.18,trim,.2,.25);
    }
  }
  return {rows:native?[...nativeRows(rows),...nativeWindows]:rows,windows,windowCount:count};
}

function windowGeometry(glass:number,trim:number) {
  const pieces: BoxGeometry[] = [], tint=new Color();
  const cube=(x:number,y:number,z:number,w:number,h:number,d:number,color:number)=>{
    const g=new BoxGeometry(w,h,d);g.translate(x,y,z);g.deleteAttribute("uv");
    const colors=new Float32Array(g.getAttribute("position").count*3);tint.setHex(color);
    for(let i=0;i<colors.length;i+=3)tint.toArray(colors,i);
    g.setAttribute("color",new BufferAttribute(colors,3));pieces.push(g);
  };
  cube(0,0,0,1,1,.05,glass);
  for(const side of [-1,1])cube(side*.51,0,.06,.055,1.05,.1,trim);
  cube(0,.51,.05,1.07,.055,.1,trim);cube(0,-.54,.08,1.15,.08,.25,trim);
  cube(0,0,.05,.04,1,.1,trim);cube(0,.18,.05,1,.035,.1,trim);
  const geometry=mergeGeometries(pieces,false)!;pieces.forEach(g=>g.dispose());return geometry;
}
export function createHospitalRecognitionV228(native=false): Group {
  const root=new Group();root.name=`Hospital campus recognition v228${native?" native":""}`;
  root.userData={hospitalRecognitionV228:true,textureFree:true,fullStaticDetailOnTouch:true,
    nativeMinecraft:native,blockNative:native,keepInMinecraft:native,sourceSuppressionIds:[],
    displayFittingsEstimated:true,sourceReceipt:"hospitals-source-v228.json"};
  for(const site of source.sites) {
    const {rows,windows,windowCount}=hospitalFittingsV228(site,native);
    if(rows.length) {
      const mesh=justicePalaceV183Boxes(rows,native);mesh.name=`${site.name} source-attached facade`;
      Object.assign(mesh.userData,{hospitalRecognitionV228:true,siteKey:site.key,windowCount,
        fullStaticDetailOnTouch:true,displayFittingsEstimated:true,nativeMinecraft:native});root.add(mesh);
    }
    if(windows.length) {
      const geometry=windowGeometry(site.family==="brick"?0x799294:0x74979c,site.family==="brick"?0xd8cbb6:0xe1dfd2);
      const day=new MeshBasicMaterial({vertexColors:true}),night=new MeshStandardMaterial({vertexColors:true,roughness:.88});
      const mesh=new InstancedMesh(geometry,day,0),matrix=new Matrix4(),scale=new Vector3(),matrices=new Float32Array(windows.length*16);
      windows.forEach((r,i)=>{matrix.makeRotationY(r.yaw).scale(scale.set(r.width,r.height,1));matrix.setPosition(r.x,r.y,r.z).toArray(matrices,i*16);});
      mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.count=windows.length;
      mesh.name=`${site.name} shared glazed windows`;mesh.userData={dayMaterial:day,nightMaterial:night,
        hospitalRecognitionV228:true,siteKey:site.key,fullStaticDetailOnTouch:true,displayFittingsEstimated:true};
      mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
    }
  }
  return freezeStaticSceneTransforms(root);
}
