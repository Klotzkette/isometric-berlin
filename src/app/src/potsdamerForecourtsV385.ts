import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Uint8BufferAttribute } from "three";
import source from "./data/potsdamerForecourtsV385.json";
import mall from "./data/mallWestForecourtV385.json";

// Berlin's measured pavement classes 04 small setts, 07 concrete flags and
// 08 natural stone slabs. Colours are approximations of the entrance photographs.
const tints: Record<number,Color> = {
  // The Mall's cadastral open square has no recorded material. Match its
  // adjoining district (#d4d0c3) and restored (#dcd8cc) pavement colours.
  0: new Color(0xd8d4c8), 4: new Color(0xa8a79e), 7: new Color(0xb6b5ae), 8: new Color(0xc4beb0),
};

export function createPotsdamerForecourtsV385(native: boolean): Group {
  return forecourt(source, native, "Kartierte Gehwege vor Ritz-Carlton und Kanadischer Botschaft");
}

export function createMallWestForecourtV385(native: boolean): Group {
  return forecourt(mall, native, "Gehweg am Westeingang der Mall of Berlin");
}

function forecourt(source: typeof mall, native:boolean, name:string): Group {
  const positions: number[] = [], colors: number[] = [];
  const indices: number[] = [];
  const put = (x:number,y:number,z:number,material:number) => {
    positions.push(x,y,z);
    const tint=tints[material];
    colors.push(Math.round(tint.r*255),Math.round(tint.g*255),Math.round(tint.b*255));
  };
  const side = (ax:number,az:number,ay:number,bx:number,bz:number,by:number,base:number,material:number) => {
    const start=positions.length/3;
    put(bx,by,bz,material); put(ax,ay,az,material);
    put(ax,base,az,material); put(bx,base,bz,material);
    indices.push(start,start+1,start+2,start,start+2,start+3);
  };
  if (native) {
    for (const [column,row,length,height,material] of source.native) {
      const x=320+column/4, z=980+row/4, y=height/1000, right=x+length/4;
      const start=positions.length/3;
      put(x,y,z,material);put(x,y,z+.25,material);put(right,y,z+.25,material);put(right,y,z,material);
      indices.push(start,start+1,start+2,start,start+2,start+3);
    }
    for (const [ax,az,bx,bz,top,base,material] of source.nativeSides)
      side(320+ax/4,980+az/4,top/1000,320+bx/4,980+bz/4,top/1000,base/1000,material);
  } else {
    for (const [x,z,level,,material] of source.vertices) put(320+x/1000,level/1000,980+z/1000,material);
    indices.push(...source.indices);
    for (const [a,b,base] of source.sides) {
      const [ax,az,ay,,material]=source.vertices[a], [bx,bz,by]=source.vertices[b];
      side(320+ax/1000,980+az/1000,ay/1000,320+bx/1000,980+bz/1000,by/1000,base/1000,material);
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(positions,3));
  geometry.setAttribute("color",new Uint8BufferAttribute(colors,3,true));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const day=new MeshBasicMaterial({vertexColors:true});
  const night=new MeshStandardMaterial({vertexColors:true,roughness:1});
  const mesh=new Mesh(geometry,day);
  mesh.name=name;
  mesh.userData={dayMaterial:day,nightMaterial:night,keepInMinecraft:native,nativeMinecraft:native};
  mesh.matrixAutoUpdate=false;
  const group=new Group();
  group.name=mesh.name;
  group.userData={keepInMinecraft:native,nativeMinecraft:native};
  group.add(mesh);
  return group;
}
