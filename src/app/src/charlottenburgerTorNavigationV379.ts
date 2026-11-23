import data from "./data/charlottenburgerTorV379Solids.json";

type Solid = [number, number, number[][]];
const solids=(data as Solid[]).map(([bottom,top,ring])=>({
  bottom,top,ring,minX:Math.min(...ring.map(p=>p[0])),maxX:Math.max(...ring.map(p=>p[0])),
  minZ:Math.min(...ring.map(p=>p[1])),maxZ:Math.max(...ring.map(p=>p[1])),
}));
export function charlottenburgerTorSolidAtV379(x:number,y:number,z:number,radius=0,native=false): boolean {
  if (x < -2815 || x > -2710 || z < 500 || z > 630 || y < 5 || y > 28) return false;
  // Half a cell accounts for the independently occupied cardinal outer faces.
  const reach=radius+(native?.16:0);
  for (const {bottom,top,ring,minX,minZ,maxX,maxZ} of solids) {
    if (y<bottom || y>top || x<minX-reach || x>maxX+reach || z<minZ-reach || z>maxZ+reach) continue;
    let inside=false;
    for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const [ax,az]=ring[j], [bx,bz]=ring[i], dx=bx-ax, dz=bz-az;
      if ((az>z)!==(bz>z) && x < ax+(z-az)*dx/dz) inside=!inside;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz || 1)));
      if ((x-ax-t*dx)**2+(z-az-t*dz)**2<=reach**2) return true;
    }
    if (inside) return true;
  }
  return false;
}
