import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape, ShapeGeometry } from "three";
import { GendarmenmarktFacadeBuilder as Builder } from "./GendarmenmarktFacadeBuilder";

/** Original polygon lettering, fitted to the owner's photograph, not a font/texture. */
export function createCattelanLetteringV217(width: number, native = false): Group {
  let root = new Group();
  root.name = "Cattelan pink broken-letter silhouette v217";
  const glyphs: Record<string, number[][][]> = {
    C: [[[.77,1.12],[.49,1.31],[.13,1.02],[0,.61],[.06,.23],[.32,.02],[.66,.06],[.85,.3],[.60,.19],[.34,.27],[.24,.60],[.30,.98],[.49,1.15],[.66,1.02]], [[.44,1.13],[.47,1.09],[.47,.37],[.40,.28],[.40,1.06]]],
    a: [[[.02,.8],[.23,1],[.62,.84],[.57,.67],[.22,.83],[.21,.18],[.35,.09],[.48,.23],[.48,.83],[.65,.89],[.65,.17],[.77,.12],[.61,0],[.48,.1],[.31,0],[.02,.18]],[[.2,.58],[.52,.4],[.59,.48],[.22,.71]]],
    t: [[[.25,1.18],[.45,1.4],[.42,.99],[.64,.99],[.52,.82],[.42,.82],[.42,.2],[.58,.12],[.42,0],[.23,.17],[.23,.82],[.06,.82],[.18,.99],[.25,.99]]],
    e: [[[.05,.81],[.3,1],[.62,.8],[.59,.65],[.23,.36],[.23,.19],[.43,.1],[.62,.25],[.64,.17],[.43,0],[.04,.2]],[[.21,.82],[.21,.48],[.47,.73],[.31,.87]]],
    l: [[[.15,1.18],[.35,1.39],[.39,.23],[.53,.14],[.36,0],[.15,.15],[.19,1.13],[.06,1.09]]],
    n: [[[.04,.86],[.20,1],[.37,.82],[.51,1],[.73,.84],[.73,.2],[.85,.12],[.68,0],[.54,.14],[.54,.78],[.43,.84],[.35,.71],[.35,.18],[.44,.12],[.27,0],[.11,.16],[.15,.79]]],
  };
  const advance: Record<string, number> = {C:1,a:.85,t:.64,e:.72,l:.58,n:.91};
  const positions: number[]=[];
  const total = [..."Cattelan"].reduce((s,c)=>s+advance[c],0);
  const scale = width / total;
  const blocks = native ? new Builder(true) : null;
  const inside=(u:number,v:number,ring:number[][]):boolean=>{
    let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[i],b=ring[j];if((a[1]>v)!==(b[1]>v)&&u<(b[0]-a[0])*(v-a[1])/(b[1]-a[1])+a[0])yes=!yes;
    }return yes;
  };
  let x=-total/2;
  for(const char of "Cattelan") {
    if(blocks){
      const step=.065;
      for(let u=step/2;u<advance[char];u+=step)for(let v=step/2;v<1.4;v+=step)
        if(glyphs[char].some(ring=>inside(u,v,ring)))blocks.box([(x+u)*scale,v*scale,0],[step*scale,step*scale,.025],0xe5a3c5);
      x+=advance[char];continue;
    }
    for(const ring of glyphs[char]) {
      const shape=new Shape();
      ring.forEach(([u,v],i)=>i?shape.lineTo((x+u)*scale,v*scale):shape.moveTo((x+u)*scale,v*scale));
      shape.closePath();
      const g=new ShapeGeometry(shape).toNonIndexed();
      positions.push(...g.getAttribute("position").array);
      g.dispose();
    }
    x+=advance[char];
  }
  if(blocks)root=blocks.finish("Cattelan native pink broken-letter silhouette v217");
  else {
  const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  const day=new MeshBasicMaterial({color:0xe5a3c5,side:DoubleSide});
  const night=new MeshStandardMaterial({color:0xe5a3c5,side:DoubleSide,emissive:0x4b263b,emissiveIntensity:.25,roughness:.8});
  const mesh=new Mesh(geometry,day);mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};root.add(mesh);
  }
  root.userData={cattelanLetteringV217:true,text:"Cattelan",photoFitted:true,textureFree:true,blockNative:native};
  return root;
}
