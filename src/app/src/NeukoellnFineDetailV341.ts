import profile from "./data/neukoellnLandmarksV305Profile.json";

/** Thin fittings supplement the actual V305 windows without replacing their
 * complete wall/roof/glass rows. Dimensions remain photograph-based estimates.
 * Native members borrow the independently built existing cardinal panes. */
export function neukoellnFineDetailV341(native: boolean, sourceRows: readonly number[][]) {
  const rows: number[][] = [];
  let historicWindowBars = 0, arcadenPanelBars = 0, lanternWindows = 0;
  for (const row of sourceRows) {
    const [x,y,z,w,h,d,yaw,tint] = row;
    const historic = tint === 0x536b6b;
    const arcaden = tint === 0x5e7278 && y > 8;
    if (!historic && !arcaden) continue;
    if (h < 1.2 || (native ? Math.min(w,d) : d) > .08) continue;
    // The photographed town-hall windows have several opening lights. The
    // Arcaden have fine horizontal subdivisions across their metal/glass skin.
    for (const sign of [-1,1]) {
      const depth = historic ? .16 : .13;
      const width = native && w < d ? depth : w;
      const thickness = native && w < d ? d : depth;
      rows.push([x,y+sign*h*(historic?.29:.18),z,width,.045,thickness,yaw,
        historic?0xddd8c8:0xaab4b5]);
      if(historic)historicWindowBars++;else arcadenPanelBars++;
    }
  }
  // The existing reference tower's upper stone lantern was previously blank.
  // The district photograph shows three small openings on each visible face.
  const [x,z] = profile.tower.anchor;
  const yaw = -Math.atan2(.766,.643), dx=Math.cos(yaw), dz=-Math.sin(yaw);
  const nx=-dz,nz=dx;
  const lantern = native ? sourceRows.filter(r=>r[1]===61&&r[4]===3.5&&r[7]===0xa49f8c) : [];
  const emit=(u:number,v:number,width:number,depth:number,normalX:number,normalZ:number) => {
    if (!native) rows.push([x+dx*u+nx*v,60.8,z+dz*u+nz*v,width,.65,depth,yaw,0x334442]);
    else {
      // Borrow the exposed surface of the actual independently constructed
      // native lantern; a rotated small-window clone could sink into its steps.
      const axis=Math.abs(normalX)>Math.abs(normalZ)?0:2,other=axis===0?2:0;
      const sign=(axis===0?normalX:normalZ)>0?1:-1;
      const point=[x+dx*u+nx*v,60.8,z+dz*u+nz*v];
      const candidates=lantern.filter(r=>Math.abs(r[other]-point[other])<r[other+3]/2+.26);
      if(!candidates.length)return;
      const planes=candidates.map(r=>r[axis]+sign*r[axis+3]/2);
      point[axis]=(sign>0?Math.max(...planes):Math.min(...planes))+sign*.065;
      rows.push([...point,axis===0?.12:.52,.65,axis===0?.52:.12,0,0x334442]);
    }
  };
  for(const side of [-1,1])for(const u of [-2.05,0,2.05]){
    emit(u,side*3.44,.52,.12,nx*side,nz*side);
    emit(side*3.44,u,.12,.52,dx*side,dz*side);
    lanternWindows+=2;
  }
  return {rows,counts:{historicWindowBars,arcadenPanelBars,lanternWindows}};
}
