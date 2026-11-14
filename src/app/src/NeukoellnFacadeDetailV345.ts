/** Small relief remains inside the already admitted, complete facade members.
 * These are photographed material/section estimates, never new building mass.
 * In Native, every member is built on the actual cardinal predecessor panel;
 * no rotated Drawn facade is enlarged into a bounding box. */
export type FacadeRowV345 = readonly number[];
export type FacadeMemberV345 = { row: number[]; host: number; role: string };

function fitting(row: FacadeRowV345, native: boolean, u: number, v: number,
  width: number, height: number, depth: number, tone: number): number[] {
  const [x,y,z,w,,d,yaw]=row;
  if(native) {
    const alongZ=w<d;
    return [x+(alongZ?0:u),y+v,z+(alongZ?u:0),alongZ?depth:width,height,
      alongZ?width:depth,0,tone];
  }
  return [x+Math.cos(yaw)*u,y+v,z-Math.sin(yaw)*u,width,height,depth,yaw,tone];
}

export function arcadenFacadeDetailV345(native: boolean, rows: readonly FacadeRowV345[]): FacadeMemberV345[] {
  const result: FacadeMemberV345[]=[];
  rows.forEach((row,host)=>{
    const [x,y,z,w,h,d,yaw,tone]=row;
    if(tone!==0x5e7278||x<3940||x>4125||z<4135||z>4240||h<1.2||
      (native?Math.min(w,d):d)>.08||native&&yaw!==0)return;
    const width=native?Math.max(w,d):w;
    const emit=(u:number,v:number,bw:number,bh:number,depth:number,tint:number,role:string)=>
      result.push({row:fitting(row,native,u,v,bw,bh,depth,tint),host,role});
    // Dark horizontal transoms and slender aluminium subdivisions are visible
    // on the curved Karl-Marx-Straße glazing, also at the low entrance frontage.
    for(const sign of [-1,1]) {
      emit(sign*width*.32,0,.055,h,.11,0x9ca8a8,"arcaden-aluminium-mullion");
      emit(0,sign*h*.44,width,.075,.12,0x35484d,"arcaden-dark-transom");
    }
    // The upper facade's closely spaced metal screen differs from the clear
    // lower glazing. Its divisions stop at each existing measured panel.
    if(y>20)for(let i=1;i<6;i++)emit((i/6-.5)*width,0,.025,h,.10,
      0x9ca7a6,"arcaden-upper-screen-rib");
  });
  return result;
}

export function neukoellnPlacesDetailV345(native: boolean, source: readonly (readonly (number|string)[])[]): FacadeMemberV345[] {
  const result: FacadeMemberV345[]=[];
  source.forEach((input,host)=>{
    const role=input[native?7:8],owner=input[native?8:9];
    const row=(native?[...input.slice(0,6),0,input[6]]:input.slice(0,8)) as number[];
    if(row.length!==8||!row.every(Number.isFinite))return;
    const [,, ,w,h,d]=row,width=native?Math.max(w,d):w;
    const emit=(u:number,v:number,bw:number,bh:number,depth:number,tone:number,name:string)=>
      result.push({row:fitting(row,native,u,v,bw,bh,depth,tone),host,role:name});
    if(owner==="DEBE02YY40001IT3"&&["store-window","store-central-glass"].includes(String(role))) {
      // The surviving postwar department store: fine metal divisions and
      // broad stone reveals, never the unbuilt historic twin-tower proposal.
      emit(0,0,.055,h,Math.max(.16,Math.min(w,d)+.035),0xc8c8bb,"hermannplatz-window-divider");
      for(const sign of [-1,1])emit(sign*width*.43,0,.065,h,
        Math.max(.17,Math.min(w,d)+.045),0xbebaa9,"hermannplatz-stone-reveal");
    }
    if(role==="smithy-green-shutter"&&String(owner).startsWith("DEBE08YYF0000")) {
      for(let i=1;i<=6;i++)emit(0,(i/7-.5)*h,width*.84,.055,
        Math.max(.13,Math.min(w,d)+.025),0x314e3d,"richardplatz-shutter-louvre");
      for(const sign of [-1,1])emit(0,sign*h*.32,width*.75,.07,
        Math.max(.14,Math.min(w,d)+.035),0x293d35,"richardplatz-shutter-strap");
    }
  });
  return result;
}

export function estrelHotelDetailV345(native: boolean, source: readonly FacadeRowV345[]): FacadeMemberV345[] {
  const result: FacadeMemberV345[]=[];
  source.forEach((input,host)=>{
    if(input.length!==8||input[7]!==0x506575||input[0]<5800||input[0]>5920||
      input[2]<5070||input[2]>5250||input[3]!==2.35||input[4]!==1.65||input[5]!==.08)return;
    // Match the existing independent Native pane dimensions exactly. The
    // section is added inside this actual predecessor, not a rotated clone.
    const c=Math.abs(Math.cos(input[6])),s=Math.abs(Math.sin(input[6]));
    const row=native?[...input.slice(0,3),Math.max(.16,input[3]*c+input[5]*s),input[4],
      Math.max(.16,input[3]*s+input[5]*c),0,input[7]]:[...input];
    const width=native?Math.max(row[3],row[5]):row[3];
    const depth=native?Math.min(row[3],row[5])+.025:.13;
    for(const sign of [-1,1])result.push({row:fitting(row,native,sign*width*.46,0,.075,row[4],depth,
      0xcfc5b1),host,role:"estrel-pale-stone-window-reveal"});
    result.push({row:fitting(row,native,0,-row[4]*.46,width,.075,depth,0xe0d6c3),host,
      role:"estrel-window-sill"});
    result.push({row:fitting(row,native,0,row[4]*.31,width,.045,depth,0xadb9ba),host,
      role:"estrel-window-opening-light"});
  });
  return result;
}
