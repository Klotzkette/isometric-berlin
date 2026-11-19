// The local axes follow the north front of LoD2 building part DEBE3DZuPJnvKibt.
// The portico and oriel project in front of that measured wall. Their individual
// mouldings and openings are interpreted from the court's public street photograph.
interface CourtPlan {
  box(x: number, y: number, z: number, width: number, height: number, depth: number,
      yaw: number, colour: number, role: string): void;
}
const cx = -1178.027, cz = -857.9315;
const ux = 0.995131192, uz = -0.098559174;
const yaw = Math.atan2(-uz, ux);
const limestone = 0xb8aa8b, carving = 0xd2c5a6, reveal = 0x665d50, glass = 0x596668;

export function addMoabitCourtFrontV366(plan: CourtPlan): void {
  const box = (u: number, y: number, v: number, w: number, h: number, d: number, colour: number, role: string) =>
    plan.box(cx + ux*u + uz*v, y, cz + uz*u - ux*v, w, h, d, yaw, colour, 'moabit:' + role);
  // A matched pair of giant-order pilasters frames the projecting pavilion.
  for (const side of [-1, 1]) {
    const u = side * 10.9;
    box(u, 16.55, 7.52, 1.13, 16.9, .69, limestone, 'portal-pilaster');
    for (const [y,w,h] of [[8.3,1.85,.62],[9.1,1.47,.24],[24.73,1.45,.38],[25.2,1.86,.46]]) {
      box(u,y,7.67,w,h,.91,carving,'pilaster-capital-and-base');
    }
    for (const y of [13.6, 19.6]) {
      const bay = side*7.55;
      box(bay,y,7.39,2.33,3.56,.24,reveal,'pavilion-window-reveal');
      box(bay,y,7.56,1.95,3.17,.14,glass,'pavilion-window');
      box(bay,y,7.69,.12,3.17,.10,carving,'pavilion-mullion');
      box(bay,y+.33,7.69,1.95,.12,.10,carving,'pavilion-transom');
      box(bay,y-1.85,7.64,2.62,.22,.47,carving,'pavilion-sill');
    }
  }
  // One recessed opening with a masonry arch beneath the bow window.
  // Strips follow the same semicircle on both the glazing and the voussoirs.
  for (let i=0;i<19;i++) {
    const w=6.1/19, u=(i+.5)*w-3.05;
    const top=8.65+2.58*Math.sqrt(1-(u/3.05)**2);
    box(u,(5.25+top)/2,8.43,w,top-5.25,.22,0x4c463c,'arched-public-door');
    box(u,top+.24,8.59,w,.48,.36,carving,'portal-arch');
  }
  for (const side of [-1,1]) box(side*3.28,7.05,8.56,.42,3.59,.38,carving,'portal-jamb');
  box(0,7.72,8.60,.16,4.9,.11,limestone,'door-centre');
  box(0,8.6,8.60,6.02,.18,.11,limestone,'door-transom');
  // Tall faceted bow with recessed glass above a stone apron. Its centre is
  // further over the portal than either return at the sides.
  for (let i=-2;i<=2;i++) {
    const u=i*1.32, v=8.01+1.09*Math.sqrt(1-(u/3.5)**2);
    box(u,18.65,v,1.33,13.38,.40,limestone,'oriel-body');
    for(const [y,h] of [[16.0,4.28],[21.95,4.22]]) {
      box(u,y,v+.25,1.07,h,.14,glass,'oriel-window');
      box(u,y+.70,v+.38,1.06,.11,.10,carving,'oriel-transom');
      box(u,y,v+.37,.07,h,.1,carving,'oriel-mullion');
    }
    for(const y of [12.02,18.54,25.29])box(u,y,v+.12,1.34,.34,.64,carving,'oriel-cornice');
  }
  // Solid triangular stone tympanum, kept below the retained roof ridge,
  // with a dark arched attic light and raised raking cornices.
  for(let i=0;i<51;i++) {
    const w=24.8/51, u=(i+.5)*w-12.4, rise=(1-Math.abs(u)/12.4)*5.32;
    box(u,26.26+rise/2,7.46,w,rise,.43,limestone,'stone-pediment');
    box(u,26.31+rise,7.76,w,.29,.65,carving,'pediment-rake');
    if(Math.abs(u)<1.05){
      const h=.94+Math.sqrt(1-(u/1.05)**2);
      box(u,27.16+h/2,7.84,w,h,.16,reveal,'pediment-arched-light');
    }
  }
  box(0,26.05,7.58,25.0,.42,.89,carving,'pediment-entablature');
}
