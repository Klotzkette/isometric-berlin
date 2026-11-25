import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshStandardMaterial, Uint8BufferAttribute } from 'three';

export type RitzVertex = [number,number,number];
export class RitzSurfacesV385 {
  private positions:number[]=[];
  private colors:number[]=[];
  private indices:number[]=[];
  private tint=new Color();
  quad(a:RitzVertex,b:RitzVertex,c:RitzVertex,d:RitzVertex,rgb:number) {
    const start=this.positions.length/3, col=this.tint.setHex(rgb);
    const r=Math.round(255*col.r),g=Math.round(255*col.g),bl=Math.round(255*col.b);
    for (const p of [a,b,c,d]) { this.positions.push(...p); this.colors.push(r,g,bl); }
    this.indices.push(start,start+1,start+2,start,start+2,start+3);
  }
  mesh(name:string,native:boolean) {
    const g=new BufferGeometry();
    g.setAttribute('position',new Float32BufferAttribute(this.positions,3));
    g.setAttribute('color',new Uint8BufferAttribute(this.colors,3,true));
    g.setIndex(this.indices); g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
    const day=new MeshBasicMaterial({side:DoubleSide,vertexColors:true});
    const night=new MeshStandardMaterial({side:DoubleSide,vertexColors:true,roughness:.85,metalness:0});
    const mesh=new Mesh(g,day);mesh.name=name; mesh.matrixAutoUpdate=false;
    mesh.userData={dayMaterial:day,nightMaterial:night,keepInMinecraft:native,nativeMinecraft:native};
    return mesh;
  }
}
