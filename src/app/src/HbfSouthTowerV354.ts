/** Badges only on the retained south source owner. No replacement tower. */
import { CanvasTexture, DoubleSide, Group, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Texture } from 'three';

export const HBF_SOUTH_TOWER_V354 = Object.freeze({
  sourceId: 'dKfobOID', sourceSha256: '9d1d6991cdba04cbd1342d9d410cbb51533db569e1a1b161030d0501d407c4c1',
  badgeCentreY: 57.8, badgeWidthM: 4.25, badgeHeightM: 2.75,
  // Exact three long exterior edges of the unchanged source footprint, metres.
  edges: [ [[-164.3,-621.8],[-174.5,-622]], [[-172,-623.3],[-166.7,-632]], [[-166.9,-629.2],[-161.9,-620.2]] ] as const,
  sourceUrl: 'https://www.sbp.de/projekt/berlin-hauptbahnhof-abluftkamin/',
  logoSourceUrl: 'https://www.deutschebahn.com/resource/blob/6845784/b1aa1e1f1fd5f07e56767f62b1e2a541/TD-Hbf-Berlin-data.pdf',
  precision: 'source-bound positions; photo-informed badge size and height estimate',
});
export function hbfSouthTowerBadgeFacesV354() {
  return HBF_SOUTH_TOWER_V354.edges.map(([a,b]) => {
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const nx=dz/length,nz=-dx/length;
    return { x:(a[0]+b[0])/2+nx*.20, z:(a[1]+b[1])/2+nz*.20, nx,nz,yaw:Math.atan2(nx,nz) };
  });
}

/** These are fixed-world source details. Unsupported test/alternate station frames
 * cannot accidentally acquire a remote tower or badges. */
export function appendHbfSouthTowerBadgesV354(station: Group, anchor: readonly number[], rotationDegrees: number): void {
  if (anchor.length!==3 || anchor.some((v,i)=>v!==[-119.936,4.575,-683.307][i]) || rotationDegrees!==21.82) return;
  const group=new Group(); group.name='Washingtonplatz retained south tower DB badges v354';
  group.userData={sourceId:HBF_SOUTH_TOWER_V354.sourceId,precision:HBF_SOUTH_TOWER_V354.precision};
  const texture=createStationDbBadgeTexture();
  const material=new MeshBasicMaterial({color:0xfffdf8,map:texture,side:DoubleSide});
  const nightMaterial=new MeshBasicMaterial({color:0xfff4e8,map:texture,side:DoubleSide});
  const geometry=new PlaneGeometry(HBF_SOUTH_TOWER_V354.badgeWidthM,HBF_SOUTH_TOWER_V354.badgeHeightM);
  for(const [i,face] of hbfSouthTowerBadgeFacesV354().entries()){
    const mesh=new Mesh(geometry,material);mesh.name=`Washingtonplatz source dKfobOID DB badge ${i+1} v354`;
    mesh.position.set(face.x,HBF_SOUTH_TOWER_V354.badgeCentreY,face.z);mesh.rotation.y=face.yaw;
    mesh.userData={sourceId:HBF_SOUTH_TOWER_V354.sourceId,lettering:'DB',letteringFieldColor:'#fffdf8',letteringInkColor:'#d51f2a',preserveInkAtNight:true,dayMaterial:material,nightMaterial,sourceUrl:HBF_SOUTH_TOWER_V354.logoSourceUrl};
    group.add(mesh);
  }
  station.updateMatrix();group.applyMatrix4(station.matrix.clone().invert());station.add(group);
}

type NativeBadgeBlock = { position:[number,number,number]; size:[number,number,number]; red:boolean };
/** Independent cardinal plaque/letter blocks on the existing five-column voxel
 * silhouette. No rotated Drawn mesh, source-column edit or new tower is used. */
export function hbfSouthTowerNativeBadgesV354(): NativeBadgeBlock[] {
  const result:NativeBadgeBlock[]=[];
  const d=['11110','10001','10001','10001','10001','10001','11110'];
  const b=['11110','10001','10001','11110','10001','10001','11110'];
  const faces=[{x:-170,z:-619.8,nx:0,nz:1,width:4.25}, {x:-176.2,z:-622,nx:-1,nz:0,width:3.6}, {x:-163.8,z:-624,nx:1,nz:0,width:4.25}];
  for(const f of faces){
    const height=f.width*2.75/4.25;
    const add=(u:number,v:number,w:number,h:number,red:boolean)=>{
      const outward=red?.13:0;
      result.push({position:[f.x+f.nz*u+f.nx*outward,HBF_SOUTH_TOWER_V354.badgeCentreY+v,f.z-f.nx*u+f.nz*outward],size:[f.nz?w:.12,h,f.nx?w:.12],red});
    };
    add(0,0,f.width,height,false);
    const edge=.12;
    add(0,(height-edge)/2,f.width,edge,true);add(0,-(height-edge)/2,f.width,edge,true);
    add((f.width-edge)/2,0,edge,height-edge*2,true);add(-(f.width-edge)/2,0,edge,height-edge*2,true);
    const cell=f.width/17;
    for(const [letter,glyph] of [d,b].entries())for(let row=0;row<7;row++){
      for(let start=0;start<5;){
        if(glyph[row][start]!=='1'){start++;continue;}
        let end=start+1;while(end<5&&glyph[row][end]==='1')end++;
        add((-5.5+letter*6+(start+end)/2)*cell,(3-row)*cell,(end-start)*cell,cell,true);start=end;
      }
    }
  }
  return result;
}

function createStationDbBadgeTexture(): Texture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1560;
  canvas.height = 1020;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const roundedRectangle = (
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void => {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height,
    );
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  };

  // One mipmapped image holds the frame and the filled glyphs. The old four
  // frame bars plus monoline letters vanished independently at overview zoom;
  // this closed mark averages to DB red instead of a nearly white pixel.
  context.fillStyle = "#d51f2a";
  roundedRectangle(16, 16, 1528, 988, 68);
  context.fill();
  context.fillStyle = "#fffdf8";
  roundedRectangle(70, 70, 1420, 880, 34);
  context.fill();

  context.fillStyle = "#d51f2a";
  context.beginPath();
  context.moveTo(250, 250);
  context.lineTo(505, 250);
  context.bezierCurveTo(690, 250, 785, 345, 785, 510);
  context.bezierCurveTo(785, 675, 690, 770, 505, 770);
  context.lineTo(250, 770);
  context.closePath();
  context.fill();
  context.fillStyle = "#fffdf8";
  context.beginPath();
  context.moveTo(385, 355);
  context.lineTo(495, 355);
  context.bezierCurveTo(600, 355, 650, 405, 650, 510);
  context.bezierCurveTo(650, 615, 600, 665, 495, 665);
  context.lineTo(385, 665);
  context.closePath();
  context.fill();

  context.fillStyle = "#d51f2a";
  context.beginPath();
  context.moveTo(815, 250);
  context.lineTo(1080, 250);
  context.bezierCurveTo(1225, 250, 1305, 310, 1305, 395);
  context.bezierCurveTo(1305, 455, 1265, 490, 1210, 510);
  context.bezierCurveTo(1275, 530, 1320, 575, 1320, 650);
  context.bezierCurveTo(1320, 730, 1230, 770, 1080, 770);
  context.lineTo(815, 770);
  context.closePath();
  context.fill();
  context.fillStyle = "#fffdf8";
  for (const [top, bottom, right] of [
    [350, 465, 1175],
    [555, 675, 1190],
  ] as const) {
    context.beginPath();
    context.moveTo(945, top);
    context.lineTo(1070, top);
    context.bezierCurveTo(right, top, right, bottom, 1070, bottom);
    context.lineTo(945, bottom);
    context.closePath();
    context.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.name = "Hauptbahnhof DB pylon filled logo texture";
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
