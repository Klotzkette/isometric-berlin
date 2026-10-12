import { BoxGeometry, Color, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { GendarmenmarktFacadeBuilder as Builder } from "./GendarmenmarktFacadeBuilder";
import { createCattelanLetteringV217 } from "./cattelanLetteringV217";
import { createCattelanExhibitsV217, createCattelanRooftopFigureV217 } from "./CattelanExhibitsV217";
import { NATIONALGALERIE_V183 as P } from "./neueNationalgalerieV183Profile";
import { NNG_ROOM_WALLS_V217, NNG_MARBLE_PIERS_V217 } from "./neueNationalgalerieWalkV217";

/** Bounded owner-photo reading of NIGHT, not a measured exhibition floor plan. */
export function createCattelanExhibitionV217(native = false): Group {
  const b=new Builder(native);
  const stone=0xbeb5a0, wood=0x825d45, iron=0x28312f;
  b.box([0,-.01,0],[50.35,.02,50.35],stone);
  for(let t=-24;t<=24;t+=2.4){
    b.box([t,.016,0],[.018,.009,50.3],0x8e887b);
    b.box([0,.016,t],[50.3,.009,.018],0x8e887b);
  }
  for(const p of NNG_ROOM_WALLS_V217) {
    b.box([p.x,p.height/2,p.z],[p.width,p.height,p.depth],wood);
    const length=Math.max(p.width,p.depth), count=Math.floor(length/1.2);
    for(let i=1;i<count;i++) {
      const u=-length/2+i*length/count;
      b.box([p.x+(p.width>p.depth?u:0),p.height/2,p.z+(p.depth>p.width?u:0)],
        p.width>p.depth?[.018,p.height,.195]:[.195,p.height,.018],0x614b3d);
    }
  }
  // Green Tinos-marble cores; pale veins are graphic recognition estimates.
  for(const p of NNG_MARBLE_PIERS_V217) {
    b.box([p.x,p.height/2,p.z],[p.width,p.height,p.depth],0x405951);
    for(let i=0;i<18;i++)for(const side of [-1,1])
      b.box([p.x+side*(p.width/2+.008),.3+i*.44,p.z+Math.sin(i*2.1)*1.2],
        [.018,.025,.48],0x87998e);
  }
  // Thin ceiling coffers and small warm apertures reuse static opaque batches.
  for(let u=-24.6;u<=24.7;u+=.6){
    b.box([u,8.16,0],[.025,.025,49.8],0x697371);
    b.box([0,8.16,u],[49.8,.025,.025],0x697371);
  }
  for(let u=-21.6;u<23;u+=7.2)for(let v=-21.6;v<23;v+=7.2)
    b.box([u,8.13,v],[.21,.025,.21],0xffe4a3);
  // Fine pleats keep the outside readable, rather than replacing glass with walls.
  for(let u=-24.8;u<25;u+=.8){
    b.box([-24.9,4.1,u],[.04,8.05,.14],0xd3d5cb,0,"glass");
    for(const side of [-1,1])if(Math.abs(u)>3)
      b.box([u,4.1,side*24.9],[.14,8.05,.04],0xd3d5cb,0,"glass");
  }
  // Dark title panel and entry furniture leave the central approach clear.
  b.box([-15,1.7,9.105],[7.95,3.35,.035],0x26363e);
  b.box([-16,1.45,9.2],[.9,.035,.4],iron);
  const room=b.finish("Cattelan photo-fitted exhibition room v217");
  const title=createCattelanLetteringV217(4.8,native);title.position.set(-15,1.05,9.14);room.add(title);
  const outer=createCattelanLetteringV217(19,native);outer.position.set(25.39,4.1,0);outer.rotation.y=Math.PI/2;room.add(outer);
  // Street-side charcoal poster; photograph/portrait is deliberately not loaded.
  const poster=new Builder(native);
  poster.box([32,2.4,19],[.12,3.2,7],0x24272b);
  for(const z of [16.8,21.2])poster.box([32,.9,z],[.16,1.8,.16],iron);
  const board=poster.finish("Cattelan street exhibition board v217");
  const boardTitle=createCattelanLetteringV217(5.2,native);boardTitle.position.set(32.08,2,19);boardTitle.rotation.y=Math.PI/2;board.add(boardTitle);room.add(board);
  room.add(createCattelanExhibitsV217(native));
  const drummer=createCattelanRooftopFigureV217(native);drummer.position.set(32.2,10.2,0);drummer.rotation.y=Math.PI/2;drummer.updateMatrix();room.add(drummer);
  room.add(pigeons(native));
  room.traverse(o=>{if(!o.name.endsWith(" glass"))return;for(const material of [o.userData.dayMaterial,o.userData.nightMaterial]){material.transparent=true;material.opacity=.22;material.depthWrite=false;}});
  room.position.set(P.center[0],P.floorY,P.center[1]);room.rotation.y=P.yaw;
  room.userData={...room.userData,cattelanExhibitionV217:true,exhibition:"Maurizio Cattelan. NIGHT",dateRange:["2026-09-10","2027-03-07"],photoBased:true,layoutEstimated:true,textureFree:true,fullAndMobileIdentical:true};
  return room;
}

function pigeons(native: boolean): Group {
  const root=new Group();root.name="Cattelan roof and coffer pigeons v217";
  const places:number[][]=[];
  for(let t=-30;t<=30;t+=2.4)for(const side of [-1,1]) {
    places.push([side*32.15,10.27,t],[t,10.27,side*32.15]);
    places.push([side*32.24,8.49,t]);
  }
  for(let x=-21.6;x<=21.7;x+=7.2)for(let z=-21.6;z<=21.7;z+=3.6)
    places.push([x+.25,8.12,z]);
  const geo=native?new BoxGeometry(1,1,1):new IcosahedronGeometry(1,1);geo.deleteAttribute("uv");
  const day=new MeshBasicMaterial({color:0xffffff});
  const night=new MeshStandardMaterial({color:0xffffff,roughness:.95,flatShading:true});
  const mesh=new InstancedMesh(geo,day,places.length*3),matrix=new Matrix4(),q=new Quaternion(),pos=new Vector3(),scale=new Vector3(),tint=new Color();
  places.forEach(([x,y,z],i)=>{
    const size=native?1:0.5;
    const parts=[[x,y+.11,z,.18,.22,.34],[x,y+.29,z-.12,.105,.11,.12],[x,y+.08,z+.21,.12,.07,.21]];
    for(let j=0;j<3;j++){
      const p=parts[j];matrix.compose(pos.set(p[0],p[1],p[2]),q,scale.set(p[3]*size,p[4]*size,p[5]*size));
      mesh.setMatrixAt(i*3+j,matrix);mesh.setColorAt(i*3+j,tint.setHex(j===1?0x5b6260:[0x788381,0x8c908d,0x686f74,0xaca9a0][i%4]));
    }
  });
  mesh.name=root.name;mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};mesh.computeBoundingSphere();root.add(mesh);
  root.userData={cattelanPigeonsV217:true,count:places.length};return root;
}
