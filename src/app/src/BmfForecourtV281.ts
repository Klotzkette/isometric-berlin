import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import source from './data/bmfForecourtV281.json';
import { justicePalaceV183Boxes } from './justicePalaceV183Batches';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

type P = number[];
export const BMF_FORECOURT_V281 = source;
const square = source.square.ring, memorial = source.memorial.ring;
const a = memorial[0], b = memorial[1], length = Math.hypot(b[0]-a[0],b[1]-a[1]);
const ux = (b[0]-a[0])/length, uz = (b[1]-a[1])/length;
const width = Math.hypot(memorial[2][0]-b[0],memorial[2][1]-b[1]);
const vx = (memorial[2][0]-b[0])/width, vz = (memorial[2][1]-b[1])/width;
function inside(r: P[], x:number,z:number):boolean {
  let yes=false;
  for(let i=0,j=r.length-1;i<r.length;j=i++) {
    if((r[i][1]>z)!==(r[j][1]>z)&&x<(r[j][0]-r[i][0])*(z-r[i][1])/(r[j][1]-r[i][1])+r[i][0])yes=!yes;
  } return yes;
}
export function bmfGroundV281(x:number,z:number):number {
  const g=source.ground, fx=(x-g.origin[0])/g.step, fz=(z-g.origin[1])/g.step;
  const ix=Math.max(0,Math.min(g.cols-2,Math.floor(fx))), iz=Math.max(0,Math.min(g.rows-2,Math.floor(fz)));
  const tx=Math.max(0,Math.min(1,fx-ix)),tz=Math.max(0,Math.min(1,fz-iz));
  const at=(i:number,j:number)=>g.heights[j*g.cols+i];
  return (at(ix,iz)*(1-tx)+at(ix+1,iz)*tx)*(1-tz)+(at(ix,iz+1)*(1-tx)+at(ix+1,iz+1)*tx)*tz;
}
function local(x:number,z:number):P { const dx=x-a[0],dz=z-a[1];return[dx*ux+dz*uz,dx*vx+dz*vz]; }
function fineCellAt(x:number,z:number):boolean { const [u,v]=local(Math.floor(x)+.5,Math.floor(z)+.5);return u> -1.5&&u<length+1.5&&v> -1.5&&v<width+1.5; }
function borderAt(x:number,z:number):boolean {
  const [u,v]=local(x,z);return u>=-.18&&u<=length+.18&&v>=-.18&&v<=width+.18&&(u<0||u>length||v<0||v>width);
}
function colourAt(x:number,z:number):number {
  if(borderAt(x,z))return 0xbab8a8;
  if(inside(memorial,x,z)) {
    const [u,v]=local(x,z),cell=u/1.37,du=cell-Math.floor(cell)-.5;
    // Abstract tonal marks suggest the etched historical image, not invented
    // likenesses or a photographic texture. The glazed plate remains flat.
    const head=du*du+(v/width-.25)**2<.028;
    const torso=Math.abs(du)<.18&&v/width>.38&&v/width<.7;
    const arms=Math.abs(v/width-.42)<.045&&Math.abs(du)<.47;
    const legs=v/width>.7&&v/width<.9&&Math.abs(Math.abs(du)-.12)<.065;
    if(head||torso||arms||legs)return 0xa5b5ac;
    return Math.abs(u/1.25-Math.round(u/1.25))<.012?0x8faaa2:0x354e4a;
  }
  const [u,v]=local(x,z),row=Math.floor(v/1.3),offset=(row%2)*1.2;
  return Math.abs((u+offset)/2.4-Math.round((u+offset)/2.4))<.012||Math.abs(v/1.3-Math.round(v/1.3))<.018?0x999b91:0xc1c0af;
}
export function bmfForecourtFloorV281(x:number,z:number,native=false):number|null {
  if(x<796||x>840||z<1021||z>1049)return null;
  const step=fineCellAt(x,z)?.25:1;
  const cx=Math.floor(x/step)*step+step/2,cz=Math.floor(z/step)*step+step/2;
  const sx=native?cx:x,sz=native?cz:z;
  if(!inside(square,sx,sz))return null;
  // The mesh assigns its finish by cell centre in both modes. Sampling the
  // query's border instead produced invisible 9.5–14.5 cm walking steps.
  const top=bmfGroundV281(sx,sz)+(borderAt(cx,cz)?.18:inside(memorial,cx,cz)?.085:.035);
  if(!native)return top;
  // Existing native slabs use the whole source run's nearest sample, not
  // the bilinear local ground. Keep them intact and clear their actual top.
  let retained=-Infinity;
  for(const r of source.retainedGroundRuns)if(cx>=r[0]&&cx<r[2]&&cz>=r[1]&&cz<r[3])retained=Math.max(retained,r[4]);
  return Math.max(top,retained+.005);
}
function clip(r:P[],axis:number,value:number,keepGreater:boolean):P[] {
  const out:P[]=[];
  for(let i=0;i<r.length;i++) {
    const a=r[i],b=r[(i+1)%r.length],ia=keepGreater?a[axis]>=value:a[axis]<=value,ib=keepGreater?b[axis]>=value:b[axis]<=value;
    if(ia)out.push(a);
    if(ia!==ib){const t=(value-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }return out;
}
/** Both modes retain the exact mapped site. Native uses independent cardinal
 * cells; drawn cells are clipped to every original perimeter segment. */
export function createBmfForecourtV281(native=false,_options:{mobileLike?:boolean}={}):Group {
  const root=new Group();root.name='BMF 17 June glass memorial forecourt v281';
  const rows:number[][]=[],positions:number[]=[],colors:number[]=[],color=new Color();
  const cells:number[][]=[];
  for(let z=1021;z<1049;z++)for(let x=796;x<840;x++) {
    const step=fineCellAt(x,z)?.25:1;
    for(let dz=0;dz<1;dz+=step)for(let dx=0;dx<1;dx+=step)cells.push([x+dx,z+dz,step]);
  }
  for(const [x,z,step] of cells) {
    const cx=x+step/2,cz=z+step/2;if(!inside(square,cx,cz)&&native)continue;
    const y=bmfForecourtFloorV281(cx,cz,native);if(y===null&&native)continue;
    const c=step<1?colourAt(cx,cz):((Math.floor(local(cx,cz)[0]/2.4)+Math.floor(local(cx,cz)[1]/1.3))%3===0?0xbcbcae:0xc1c0af);
    if(native){rows.push([cx,y!-.025,cz,step,.05,step,c]);continue;}
    let r=clip(clip(clip(clip(square.slice(0,-1),0,x,true),0,x+step,false),1,z,true),1,z+step,false);
    if(r.length<3)continue;
    color.setHex(c);
    for(let i=1;i<r.length-1;i++)for(const p of [r[0],r[i+1],r[i]]) {
      positions.push(p[0],bmfGroundV281(p[0],p[1])+(borderAt(cx,cz)?.18:inside(memorial,cx,cz)?.085:.035),p[1]);colors.push(color.r,color.g,color.b);
    }
  }
  if(native){
    // Lossless adjacent equal-height/colour packing is deliberately left to
    // the existing final-count batch; no alternate low-detail mobile path.
    const mesh=justicePalaceV183Boxes(rows,true);mesh.name='Native BMF paving and glass memorial';root.add(mesh);
  }else{
    const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));geometry.setAttribute('color',new BufferAttribute(new Float32Array(colors),3));geometry.computeVertexNormals();
    const day=new MeshBasicMaterial({vertexColors:true}),night=new MeshStandardMaterial({vertexColors:true,roughness:.7});
    const mesh=new Mesh(geometry,day);mesh.name='Source-clipped BMF paving and glass memorial';mesh.userData={dayMaterial:day,nightMaterial:night};root.add(mesh);
  }
  root.userData={keepInMinecraft:native,blockNative:native,textureFree:true,sourceIds:[47161406,48118825],groundPreserved:true,photographReproduced:false,schwellenraumGeschuetzt:true};
  freezeStaticSceneTransforms(root);return root;
}
