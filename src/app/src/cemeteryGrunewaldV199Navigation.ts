import source from "./data/cemeteryGrunewaldV199Navigation.json";

/** Only added physical walls/posts/markers, leaving the mapped entrance open. */
export function cemeteryGrunewaldV199SolidAt(x:number,y:number,z:number,radius=0,native=false):boolean {
  const b=source.drawn.bounds;
  if(x<b[0]-3-radius||x>b[2]+3+radius||z<b[1]-3-radius||z>b[3]+3+radius)return false;
  const selected=native?source.native:source.drawn;
  for(const [cx,cy,cz,w,h,d,yaw]of selected.solids){
    if(Math.abs(y-cy)>h/2)continue;
    const dx=x-cx,dz=z-cz,c=Math.cos(yaw),s=Math.sin(yaw);
    if(Math.abs(c*dx-s*dz)<=w/2+radius&&Math.abs(s*dx+c*dz)<=d/2+radius)return true;
  }
  return false;
}
