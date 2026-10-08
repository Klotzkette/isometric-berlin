import { ExtrudeGeometry, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape } from "three";
import { GendarmenmarktFacadeBuilder as Builder } from "./GendarmenmarktFacadeBuilder";
import { NATIONALGALERIE_V183 as P } from "./neueNationalgalerieV183Profile";
import source from "./data/neueNationalgalerieV183Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Source-centred open hall. Native slabs are scanline runs, never hidden fill. */
export function createNeueNationalgalerieV183(native = false) {
  const b = new Builder(native), c = Math.cos(P.yaw), s = Math.sin(P.yaw);
  const point = (x: number, y: number, z: number): [number, number, number] =>
    [P.center[0] + c * x + s * z, y, P.center[1] - s * x + c * z];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number, glass = false) => {
    if (!native) { b.box(point(x, y, z), [w, h, d], color, P.yaw, glass ? "glass" : "stone"); return; }
    const corners = [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,e])=>point(x+a,y,z+e));
    const lo = Math.min(...corners.map(p=>p[2])), hi = Math.max(...corners.map(p=>p[2]));
    const rows = Math.max(1, Math.ceil((hi-lo)/.9)), depth = (hi-lo)/rows;
    for(let row=0;row<rows;row++) {
      const rz=lo+(row+.5)*depth, xs:number[]=[];
      for(let j=0;j<4;j++){const a=corners[j],e=corners[(j+1)%4];
        if((a[2]>rz)!==(e[2]>rz))xs.push(a[0]+(e[0]-a[0])*(rz-a[2])/(e[2]-a[2]));}
      if(xs.length===2)b.box([(xs[0]+xs[1])/2,y,rz],[Math.max(.1,Math.abs(xs[1]-xs[0])),h,depth],color,0,glass?"glass":"stone");
    }
  };
  // Original terrace envelope, retained as its polygon rather than a larger square.
  const terrace=source.parts.find(p=>p.id==="MSMgX8rD")!;
  const ring=terrace.ring.map(p=>[p[0]/10,p[1]/10]);
  const minZ=Math.min(...ring.map(p=>p[1])),maxZ=Math.max(...ring.map(p=>p[1]));
  const step=.9;
  if(native)for(let z=minZ;z<maxZ;z+=step){const depth=Math.min(step,maxZ-z),mid=z+depth/2,xs:number[]=[];
    for(let i=0;i<ring.length;i++){const a=ring[i],e=ring[(i+1)%ring.length];if((a[1]>mid)!==(e[1]>mid))xs.push(a[0]+(e[0]-a[0])*(mid-a[1])/(e[1]-a[1]));}
    xs.sort((a,e)=>a-e);for(let i=0;i+1<xs.length;i+=2)b.box([(xs[i]+xs[i+1])/2,7.5,mid],[xs[i+1]-xs[i],4.6,depth],0xb4b0a5);
  }
  const top=P.floorY+P.columnHeight;
  box(0,top+P.roofThickness/2,0,P.roofWidth,P.roofThickness,P.roofWidth,0x13191a);
  for(let u=-28.8;u<=28.8001;u+=P.grid){
    box(u,top-.14,0,.22,.3,64.0,0x090e0f);box(0,top-.14,u,64.0,.3,.22,0x090e0f);
  }
  for(const along of [-14.4,14.4])for(const side of [-1,1])for(const [x,z] of [[along,side*28.8],[side*28.8,along]]) {
    // Cross-shaped columns taper towards the articulated roof bearing.
    for(let course=0;course<4;course++){const f=1-course*.10,y=P.floorY+(course+.5)*P.columnHeight/4;
      box(x,y,z,.25*f,P.columnHeight/4,1.05*f,0x151b1c);box(x,y,z,1.05*f,P.columnHeight/4,.25*f,0x151b1c);}
    box(x,top-.07,z,.55,.14,.55,0x080c0d);
  }
  for(const side of [-1,1]){
    box(0,P.floorY+P.columnHeight/2,side*25.2,50.4,P.columnHeight-.22,.10,0x92b7bd,true);
    box(side*25.2,P.floorY+P.columnHeight/2,0,.10,P.columnHeight-.22,50.4,0x92b7bd,true);
    for(let u=-25.2;u<=25.2001;u+=P.grid){
      box(u,P.floorY+P.columnHeight/2,side*25.26,.11,P.columnHeight,.18,0x182021);
      box(side*25.26,P.floorY+P.columnHeight/2,u,.18,P.columnHeight,.11,0x182021);
    }
    for(const y of [P.floorY+.05,top-.15]){
      box(0,y,side*25.26,50.5,.12,.2,0x182021);box(side*25.26,y,0,.2,.12,50.5,0x182021);
    }
  }
  // Door leaves, rails and handles remain legible through the glazing.
  for(const side of [-1,1])for(const u of [-1.8,0,1.8]) {
    box(u,P.floorY+1.5,side*25.4,.10,3,.12,0x182021);
    box(u+.6,P.floorY+1.2,side*25.48,.08,.65,.10,0x565f5e);
  }
  for(let i=0;i<22;i++)box(0,5.305+i*.21,61.26-i*.33,30,.21,.66,0xb8b4aa);
  const root=b.finish(native?"Nationalgalerie native open pavilion v183":"Nationalgalerie open steel and glass pavilion v183");
  if(!native){
    const outline=new Shape();ring.forEach(([x,z],i)=>i?outline.lineTo(x,-z):outline.moveTo(x,-z));outline.closePath();
    const geometry=new ExtrudeGeometry(outline,{depth:4.6,bevelEnabled:false});geometry.rotateX(-Math.PI/2);geometry.translate(0,5.2,0);geometry.deleteAttribute("uv");
    const day=new MeshBasicMaterial({color:0xb4b0a5}),night=new MeshStandardMaterial({color:0xb4b0a5,roughness:.95,flatShading:true});
    const mesh=new Mesh(geometry,day);mesh.name="Exact retained Nationalgalerie terrace footprint";mesh.userData={dayMaterial:day,nightMaterial:night};root.add(mesh);
  }
  root.traverse(o=>{if(!o.name.endsWith(" glass"))return;const mesh=o as Mesh;
    for(const m of [mesh.userData.dayMaterial,mesh.userData.nightMaterial] as Material[]){m.transparent=true;m.opacity=.18;m.depthWrite=false;}
    mesh.renderOrder=2;
  });
  root.userData={...root.userData,columnCount:8,roofWidthM:P.roofWidth,sourceIds:source.parts.map(p=>p.id),transparentHall:true,estimatedVerticalSubdivisions:true};
  return freezeStaticSceneTransforms(root);
}
