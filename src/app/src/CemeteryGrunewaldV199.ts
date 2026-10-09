import {BufferAttribute,BufferGeometry,DoubleSide,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial} from "three";
import drawn from "./data/cemeteryGrunewaldV199Drawn.json";
import blocks from "./data/cemeteryGrunewaldV199Native.json";
import navigation from "./data/cemeteryGrunewaldV199Navigation.json";
import {justicePalaceV183Boxes} from "./justicePalaceV183Batches";
import {letteringLayout,letteringStrokePaths} from "./drawnLettering";
import {freezeStaticSceneTransforms} from "./staticSceneTransforms";

/** Full source-bound detail on touch and pointer; no textures or old packet edits. */
export function createCemeteryGrunewaldV199(native=false):Group {
  const root=new Group();root.name="Friedhof Grunewald-Forst and Nico grave v199";
  root.userData={cemeteryGrunewaldV199:true,textureFree:true,additiveOnly:true,fullStaticDetailOnTouch:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native};
  const source=native?blocks:drawn;
  const batch=(rows:number[][],name:string)=>{
    const mesh=justicePalaceV183Boxes(rows,native),colors=mesh.instanceColor!.array;
    // Match retained Grunewald source/display bytes, without global colour changes.
    for(let i=0;i<rows.length;i++){const rgb=rows[i][native?6:7];colors[i*3]=((rgb>>16)&255)/255;colors[i*3+1]=((rgb>>8)&255)/255;colors[i*3+2]=(rgb&255)/255;}
    mesh.name=name;root.add(mesh);
  };
  batch(source.boxes,"Grunewald-Forst mapped walls, paths and grave markers");
  if(!native&&drawn.positions.length){
    const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(new Float32Array(drawn.positions),3));geometry.setAttribute("color",new BufferAttribute(new Uint8Array(drawn.colors),3,true));
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.9});
    const mesh=new Mesh(geometry,day);mesh.name="Grunewald-Forst true arched portal opening";mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};root.add(mesh);
  }
  const nav=native?navigation.native:navigation.drawn,g=nav.graves.find(g=>g.id==="node/277933694")!;
  const [x,z]=g.point,c=Math.cos(g.yaw),s=Math.sin(g.yaw),rows:number[][]=[];
  const at=(u:number,y:number)=>[x+c*u+s*.091,y,z-s*u+c*.091];
  // Factual personal names/dates, geometric strokes only; no copied font/photo.
  for(const [label,y,height]of [["MARGARETE PÄFFGEN",.94,.054],["1910-1970",.82,.055],["NICO",.56,.10],["CHRISTA PÄFFGEN",.39,.055],["1938-1988",.25,.055]] as const){
    const cap=Math.min(height,height*.76/letteringLayout(label,height).totalWidthM);
    for(const path of letteringStrokePaths(label,cap))for(let i=1;i<path.length;i++){
      const a=at(path[i-1][0],g.groundY+y+path[i-1][1]),b=at(path[i][0],g.groundY+y+path[i][1]);
      // Small orthogonal strokes also remain truly native, not a smooth double.
      const length=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),n=Math.max(1,Math.ceil(length/.008));
      for(let j=0;j<n;j++){
        const p=a.map((v,k)=>v+(b[k]-v)*(j+.5)/n),size=[Math.max(.0045,Math.abs(b[0]-a[0])/n+.002),Math.max(.0045,Math.abs(b[1]-a[1])/n+.002),Math.max(.0045,Math.abs(b[2]-a[2])/n+.002)];
        rows.push([...p,...size,...(native?[]:[0]),0xe6e2d6]);
      }
    }
  }
  batch(rows,"Nico and Margarete Päffgen factual grave inscription");
  return freezeStaticSceneTransforms(root);
}
