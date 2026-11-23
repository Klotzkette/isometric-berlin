import { BufferAttribute, BufferGeometry, Color, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import survey from "./data/cityWestFrontsV379.json";

type Opening = [number, number, number, number, number, number];
type Front = [number, number, number, number, number, number, number, Opening[]];
const fronts = survey as unknown as Record<string, Front[]>;

export function hasCityWestFrontV379(id: string | undefined | null): boolean {
  return id != null && Object.hasOwn(fronts, id);
}

type ProfilePlane = { x: number; z: number; dx: number; dz: number; scale: number; start: number; low: number; high: number; end: number };

/** Measurements retain their distance along the photograph's registered source wall.
 * On the block grid the same span is projected onto the exposed cardinal face. */
export class CityWestFrontBatchV379 {
  private positions: number[] = [];
  private colors: number[] = [];
  private normals: number[] = [];
  private indices: number[] = [];
  private tone = new Color();
  private owners = new Set<string>();

  private write(front: Front, plane: ProfilePlane): void {
    const { x,z,dx,dz,scale,start,end,low,high } = plane;
    const nx = dz, nz = -dx;
    const quad = (u: number,v: number,u1: number,v1: number,depth: number,paint: number) => {
      const a = Math.max(u,start), b = Math.min(u1,end);
      const y = Math.max(v,low), top = Math.min(v1,high);
      if (a >= b || y >= top) return;
      const i = this.positions.length / 3;
      this.tone.setHex(paint);
      for (const [s,h] of [[a,y],[a,top],[b,top],[b,y]]) {
        this.positions.push(x+dx*(s-start)/scale+nx*depth,h,z+dz*(s-start)/scale+nz*depth);
        this.normals.push(Math.round(nx*127),0,Math.round(nz*127));
        this.colors.push(Math.round(this.tone.r*65535),Math.round(this.tone.g*65535),Math.round(this.tone.b*65535));
      }
      // The source ring gives the outward normal on its right-hand side.
      this.indices.push(i,i+1,i+2,i,i+2,i+3);
    };
    for (const [a,b,y0,y1,kind,color] of front[7]) {
      const from=a/10,to=b/10,bottom=front[4]+y0/10,top=front[4]+y1/10;
      if (from>=end || to<=start || bottom>=high || top<=low) continue;
      if (kind===2) {
        quad(from,bottom,to,top,.15,color);
      } else {
        // The aperture and its colour are measured. The narrow reveal and sill
        // are illustrative, scaled to the opening so small panes remain legible.
        const reveal=Math.min(.11,(to-from)*.09,(top-bottom)*.09);
        quad(from,bottom,to,top,.16,front[6]);
        quad(from+reveal,bottom+reveal,to-reveal,top-reveal,.18,color);
        if (kind===0) quad(from,bottom,to,bottom+reveal*.7,.20,front[6]);
      }
    }
  }

  addDrawn(id: string, base: number, wallTop: number): void {
    if (!hasCityWestFrontV379(id)) return;
    const before=this.indices.length;
    for (const f of fronts[id]) {
      if (Math.abs(base-f[4])>.02) continue;
      const length=Math.hypot(f[2]-f[0],f[3]-f[1]);
      this.write(f,{x:f[0],z:f[1],dx:(f[2]-f[0])/length,dz:(f[3]-f[1])/length,
        scale:1,start:0,end:length,low:base,high:Math.min(wallTop,base+f[5])});
    }
    if (this.indices.length>before) this.owners.add(id);
  }

  addNative(id: string, x: number,z: number,nx: number,nz: number,side: number,low: number,high: number): boolean {
    if (!hasCityWestFrontV379(id) || high<=low) return false;
    const before=this.indices.length;
    const dx=-nz,dz=nx;
    const leftX=x-dx*side/2,leftZ=z-dz*side/2;
    for (const f of fronts[id]) {
      const length=Math.hypot(f[2]-f[0],f[3]-f[1]);
      const ux=(f[2]-f[0])/length,uz=(f[3]-f[1])/length;
      const cosine=dx*ux+dz*uz;
      if (cosine<.40 || Math.abs((x-f[0])*uz-(z-f[1])*ux)>side*.74) continue;
      const start=(leftX-f[0])*ux+(leftZ-f[1])*uz;
      this.write(f,{x:leftX,z:leftZ,dx,dz,scale:cosine,start,end:start+side*cosine,low,high});
    }
    if (this.indices.length>before) this.owners.add(id);
    return this.indices.length > before;
  }

  mesh(native: boolean): Mesh | undefined {
    if (!this.indices.length) return;
    const geometry=new BufferGeometry();
    geometry.setAttribute("position",new BufferAttribute(new Float32Array(this.positions),3));
    geometry.setAttribute("normal",new BufferAttribute(new Int8Array(this.normals),3,true));
    geometry.setAttribute("color",new BufferAttribute(new Uint16Array(this.colors),3,true));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    const day=new MeshBasicMaterial({vertexColors:true});
    const night=native ? day : new MeshStandardMaterial({vertexColors:true,roughness:.85});
    const mesh=new Mesh(geometry,day);
    mesh.name=native ? "City West · fotografierte Fassaden auf Blockwänden" : "City West · fotografierte Fassaden";
    mesh.userData={dayMaterial:day,nightMaterial:night,keepInMinecraft:native,cityWestFrontOwnersV379:[...this.owners]};
    return mesh;
  }
}
