import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape } from "three";
import { CHANCELLERY_LAWN_RINGS, chancelleryLawnContains } from "./ChancelleryEntranceProfile";
import { reichstagGrassAtV318 } from "./ReichstagLawnV318";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Patch = { site: string; x: number; y: number; z: number; seed: number };
const gardens = [[500.7,334.1,74.3,22.6],[494.2,254.9,75,23]];
const yaw = -1.337 * Math.PI / 180;
const turn = (x:number,z:number,a:number):[number,number] => [x*Math.cos(a)+z*Math.sin(a),-x*Math.sin(a)+z*Math.cos(a)];
const random = (x:number,z:number) => {const a=Math.sin(x*31.7+z*79.3)*43758.54;return a-Math.floor(a);};
const corners = [[-.32,-.32],[.32,-.32],[.32,.32],[-.32,.32]];

/** Same quadratic outlines as the retained drawn Ehrenhof plates. No new
 * planting boundary, paving, terrain or collision is authored here. */
function smoothRing(ring:typeof CHANCELLERY_LAWN_RINGS[number]):[number,number][] {
  const shape=new Shape(),last=ring[ring.length-1],first=ring[0];
  shape.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);
  ring.forEach(([x,z],i)=>{const next=ring[(i+1)%ring.length];shape.quadraticCurveTo(x,z,(x+next[0])/2,(z+next[1])/2);});
  shape.closePath();return shape.getPoints(12).map(p=>[p.x,p.y]);
}

export function civicGardenPatchesV341(groundAt:(x:number,z:number)=>number|null,native=false):Patch[] {
  const patches:Patch[]=[];
  const add=(site:string,x:number,y:number,z:number)=>patches.push({site,x,y,z,seed:random(x,z)});
  for(const ring of CHANCELLERY_LAWN_RINGS){
    const boundary=smoothRing(ring),xs=ring.map(v=>v[0]),zs=ring.map(v=>v[1]);
    // Native centres sit on its existing 2 m lawn cubes, not on sampled drawn blades.
    for(let x=Math.floor(Math.min(...xs)/2)*2+1;x<Math.max(...xs);x+=2)for(let z=Math.floor(Math.min(...zs)/2)*2+1;z<Math.max(...zs);z+=2){
      if(!corners.every(([dx,dz])=>chancelleryLawnContains(boundary,x+dx,z+dz)))continue;
      const [xx,zz]=turn(x,z,yaw);add("Ehrenhof",xx-220.236,native?5.44:5.36,zz-145.806);
    }
  }
  for(const [cx,cz,w,d] of gardens)for(let x=-w/2+3.3;x<w/2-3.3;x+=1.5)for(let z=-d/2+3.3;z<d/2-3.3;z+=1.5){
    if(Math.hypot(x,z)<6.3||[-4.35,4.35].some(az=>Math.hypot(x-(-w/2+8.2),z-az)<2.4))continue;
    const [xx,zz]=turn(x,z,.087);add("Pariser Platz",xx+cx,5.08,zz+cz);
  }
  // Complement the existing coarse v318 lawn tufts with a finer offset grid.
  // Its retained path polygons and corner inset remain authoritative.
  for(let x=-29.25;x<168;x+=3.6)for(let z=-39.25;z<112;z+=3.6){
    if(!reichstagGrassAtV318(x,z))continue;
    const y=groundAt(x,z);if(y!==null&&Number.isFinite(y))add("Platz der Republik",x,y+.09,z);
  }
  return patches;
}

/** Estimated 6–13 cm summer lawn texture; no imagery, animation, loading or
 * mobile detail downgrade. Each family is built directly from patch supports. */
export function createCivicGardenReliefV341(groundAt:(x:number,z:number)=>number|null,native=false):Group{
  const root=new Group();root.name="Government quarter fine summer lawns v341";
  const patches=civicGardenPatchesV341(groundAt,native),positions:number[]=[],colors:number[]=[],matrices:number[]=[],matrix=new Matrix4(),color=new Color();
  for(const {x,y,z,seed} of patches){
    color.setHex([0x719260,0x809d6b,0x91a978,0x668752][Math.floor(seed*4)]);
    const h=.06+seed*.07;
    if(native){matrix.makeScale(.28,h,.28);matrix.setPosition(x,y+h/2+.004,z);matrices.push(...matrix.elements);color.toArray(colors,colors.length);}
    else for(let k=0;k<3;k++){
      const a=seed*Math.PI*2+k*2.094,dx=Math.cos(a)*.23,dz=Math.sin(a)*.23;
      positions.push(x-dx,y+.004,z-dz,x+dx,y+.004,z+dz,x+dx*.35,y+h,z+dz*.35);
      for(let i=0;i<3;i++)color.toArray(colors,colors.length);
    }
  }
  const day=new MeshBasicMaterial({color:0xffffff,side:DoubleSide}),night=new MeshStandardMaterial({color:0xffffff,side:DoubleSide,roughness:1});let mesh:Mesh;
  if(native){const geometry=new BoxGeometry();geometry.deleteAttribute("uv");const part=new InstancedMesh(geometry,day,0);part.instanceMatrix=new InstancedBufferAttribute(new Float32Array(matrices),16);part.instanceColor=new InstancedBufferAttribute(new Float32Array(colors),3);part.count=patches.length;part.computeBoundingBox();part.computeBoundingSphere();mesh=part;}
  else{const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.setAttribute("color",new Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();day.vertexColors=true;night.vertexColors=true;mesh=new Mesh(geometry,day);}
  mesh.userData={dayMaterial:day,nightMaterial:night};root.add(mesh);root.userData={native,textureFree:true,fullStaticDetailOnTouch:true,estimatedMownGrass:true,patches:patches.length,sites:[...new Set(patches.map(p=>p.site))]};return freezeStaticSceneTransforms(root);
}
