import { ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, Shape } from "three";
import { GendarmenmarktFacadeBuilder as Builder } from "./GendarmenmarktFacadeBuilder";
import source from "./data/spreeLandmarksV183Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

// Source fixes the three plate axes; the artist's published 30 m fixes scale.
// Independently drawn anatomy and hole spacing are recognition estimates.
export const MOLECULE_V183_OUTLINE = [[0,19],[2.1,20.4],[3.2,23.5],[2.5,25.8],[2.6,28.5],[3.6,30],[5,29.8],[6,28.1],[5.9,25.6],[5.1,24.4],[7,22.1],[7.8,17.2],[7.2,13],[9.8,7.3],[13,1],[12.6,0],[9.9,0],[6.9,6.4],[5.1,10.6],[3.5,5.1],[2.7,.3],[0,.3],[.3,1.7],[1.4,7.8],[3.2,14.1],[3.4,19],[1.8,17.8],[0,17.9]];
const sourceRing = source.features.find(f => f.name === "Molecule Man")!.ring;
export const MOLECULE_V183_CENTER = [1,4,8].map(i=>sourceRing[i]).reduce((a,p)=>[a[0]+p[0]/3,a[1]+p[1]/3],[0,0]);
export const MOLECULE_V183_AXES = [0,2,5].map(i=>sourceRing[i].map((v,j)=>v-MOLECULE_V183_CENTER[j]));
function inside(x:number,y:number){let hit=false;const r=MOLECULE_V183_OUTLINE;
  for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>y)!==(r[j][1]>y)&&x<(r[j][0]-r[i][0])*(y-r[i][1])/(r[j][1]-r[i][1])+r[i][0])hit=!hit;return hit;}
export const MOLECULE_V183_HOLES: number[][]=[];
for(let row=0;row<37;row++)for(let col=0;col<17;col++){
  const x=.3+col*.75+(row%2)*.375,y=.55+row*.78,r=.23;
  if(Array.from({length:12},(_,i)=>inside(x+Math.cos(i*Math.PI/6)*(r+.09),y+Math.sin(i*Math.PI/6)*(r+.09))).every(Boolean))MOLECULE_V183_HOLES.push([x,y,r]);
}
export function createSpreeLandmarksV183(native=false){
  const root=new Group(),b=new Builder(native),base=3.05;
  for(const [index,axis] of MOLECULE_V183_AXES.entries()){
    const length=Math.hypot(...axis),dx=axis[0]/length,dz=axis[1]/length,scale=length/13;
    if(native){
      const step=.32;
      for(let y=step/2;y<30;y+=step)for(let x=step/2;x<13;x+=step){
        if(!inside(x,y)||MOLECULE_V183_HOLES.some(([hx,hy,r])=>(x-hx)**2+(y-hy)**2<r*r))continue;
        b.box([MOLECULE_V183_CENTER[0]+dx*x*scale,base+y,MOLECULE_V183_CENTER[1]+dz*x*scale],[step*.95,step,step*.95],0xb7c4c9);
      }
    }else{
      const shape=new Shape();MOLECULE_V183_OUTLINE.forEach(([x,y],i)=>i?shape.lineTo(x*scale,y):shape.moveTo(x*scale,y));shape.closePath();
      for(const [x,y,r] of MOLECULE_V183_HOLES){const hole=new Path();hole.absellipse(x*scale,y,r*scale,r,0,Math.PI*2,true);shape.holes.push(hole);}
      const geometry=new ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false,curveSegments:5});geometry.translate(0,0,-.08);geometry.rotateY(-Math.atan2(dz,dx));geometry.translate(MOLECULE_V183_CENTER[0],base,MOLECULE_V183_CENTER[1]);geometry.deleteAttribute("uv");
      const day=new MeshBasicMaterial({color:0xb7c4c9}),night=new MeshStandardMaterial({color:0xb7c4c9,metalness:.5,roughness:.48});
      const mesh=new Mesh(geometry,day);mesh.name=`Molecule Man perforated plate ${index+1}`;mesh.userData={dayMaterial:day,nightMaterial:night};root.add(mesh);
    }
  }
  if(native)root.add(b.finish("Molecule Man native perforated plates"));
  root.name="Molecule Man source-aligned three figures v183";
  root.userData={nativeMinecraft:native,blockNative:native,keepInMinecraft:native,textureFree:true,figureCount:3,heightM:30,holesPerPlate:MOLECULE_V183_HOLES.length,sourceId:"way/166268035",silhouetteStatus:"photo-aligned recognition estimate"};
  return freezeStaticSceneTransforms(root);
}
