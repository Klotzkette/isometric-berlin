import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import source from "./data/fritzParkV366.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { FRITZ_COURSE_PAINT } from "./fritzCourseV366";

function boulder(x:number, z:number, y:number): Mesh {
  // Narrow irregular crown and a broad, flat inscription face on the erratic.
  const profile = [[-.60,-.35],[.37,-.4],[.58,-.17],[.49,.31],[-.44,.39],[-.57,.16]];
  const rings = [[0,1,0],[.34,.88,-.025],[1.28,.59,-.08],[1.57,.39,-.10],[1.63,.25,-.12]];
  const vertices:number[]=[], colours:number[]=[], color=new Color();
  const point=(ring:number,side:number)=>{
    const [h,scale,shift]=rings[ring], [dx,dz]=profile[side%profile.length];
    return [x+scale*dx+shift,y+h,z+scale*dz];
  };
  const triangle=(a:number[],b:number[],c:number[],shade:number)=>{
    color.setHex(shade);vertices.push(...a,...b,...c);for(let i=0;i<3;i++)colours.push(color.r,color.g,color.b);
  };
  const shades=[0x837c7a,0x8d8180,0x9c8f89,0x998d88,0x8e8482,0x867b77];
  for(let r=0;r<rings.length-1;r++)for(let s=0;s<profile.length;s++){
    const a=point(r,s),b=point(r,s+1),c=point(r+1,s+1),d=point(r+1,s);
    triangle(a,d,b,shades[s]);triangle(b,d,c,shades[s]);
  }
  for(let s=1;s<profile.length-1;s++)triangle(point(4,0),point(4,s+1),point(4,s),0xa39893);
  const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(vertices,3));
  g.setAttribute("color",new Float32BufferAttribute(colours,3));g.computeVertexNormals();g.computeBoundingSphere();
  const day=new MeshBasicMaterial({vertexColors:true}),night=new MeshStandardMaterial({vertexColors:true,roughness:.97});
  const mesh=new Mesh(g,day);mesh.name="Gedenkstein Dr. Fritz Schloß";mesh.userData={dayMaterial:day,nightMaterial:night,fullStaticDetailOnTouch:true,textureFree:true};return mesh;
}

export function addFritzParkV366(root:Group,native:boolean):void {
  const [limestone,granite]=source.memorials;
  const [x,z]=limestone, y=limestone[native?3:2];
  const blocks=[
    [x,y+.065,z,1.64,.13,1.64,0xaaa291],
    [x,y+.21,z,.77,.16,.77,0x8c8578],
    [x,y+.795,z,1.01,1.01,1.01,0xc1b39a],
  ];
  // Four short incised lines on the inscription panel, in the same stone.
  for(const [i,w] of [.21,.76,.21,.29].entries()) blocks.push([x,y+1.015-i*.109,z+.512,w,.024,.014,0x837b6c]);
  const marker=justicePalaceV183Boxes(native ? blocks : blocks.map(r => [...r.slice(0,6), 0, r[6]]),native);marker.userData.fullStaticDetailOnTouch=true;
  marker.name="Den Notstandsarbeitern zum Dank";root.add(marker);
  if(!native){root.add(boulder(granite[0],granite[1],granite[2]));return;}

  const nativeStone=[];
  for (const [dy,w,d,shift] of [[.17,1.12,.74,0],[.51,.95,.63,-.025],[.85,.81,.55,-.045],[1.19,.64,.45,-.075],[1.48,.43,.31,-.105]]) {
    nativeStone.push([granite[0]+shift,granite[3]+dy,granite[1],w,.34,d,0x938783]);
  }
  const stone=justicePalaceV183Boxes(nativeStone,true);stone.userData.fullStaticDetailOnTouch=true;
  stone.name="Gedenkstein Dr. Fritz Schloß";root.add(stone);
  // Run-length encoded one-metre native cells sampled from the complete OSM ways
  // and the same height grid as the native Fritz relief. Tile per 128m for culling.
  const tiles=new Map<string,number[][]>();
  for(const [left,north,width,dm,compacted] of source.courseRuns){
    const key=Math.floor(left/128)+"/"+Math.floor(north/128), rows=tiles.get(key)??[];
    if(!tiles.has(key))tiles.set(key,rows);
    rows.push([left+width/2,dm/10+.052,north+.5,width,.104,1,FRITZ_COURSE_PAINT[compacted]]);
  }
  for(const [key,rows] of tiles){
    const mesh=justicePalaceV183Boxes(rows,true);mesh.name="Fritz-Schloß-Park Laufstrecke "+key;
    mesh.userData.fullStaticDetailOnTouch=true;root.add(mesh);
  }
}
