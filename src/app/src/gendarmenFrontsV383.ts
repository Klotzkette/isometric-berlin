import fronts from "./data/gendarmenFrontAxesV383.json";
import { GendarmenmarktFacadeBuilder, perimeterEdgeLength, type PerimeterFacadeEdge } from "./GendarmenmarktFacadeBuilder";

type Edge = PerimeterFacadeEdge & { partId: string; surfaceIndex: number };
const profiles = new Map(fronts.map(front => [`${front.part}/${front.index}`, front]));
export const additionalGendarmenFrontsV383 = fronts.flatMap(front => front.edge ? [front.edge] : []);

/** Subdivide this particular photographed wall. The previously unselected
 * west faces are literal Friedrichstraße WallSurfaces in the retained envelope. */
export function fitGendarmenFrontV383(b: GendarmenmarktFacadeBuilder, edge: Edge) {
  const source = profiles.get(`${edge.partId}/${edge.surfaceIndex}`);
  if (!source) return false;
  const {axes, levels, finish} = source;
  const length = perimeterEdgeLength(edge), mid=length/2, base=edge.wallBaseY;
  const height=edge.wallTopY-base, ungers=finish==='ungers', ribbon=finish==='ribbon';
  const paint=ungers?0xcabc9f:ribbon?0xd6d1bf:finish==='stucco'?0xe2d7c6:0xd3cabe;
  const trim=ungers?0xdccfb1:ribbon?0xe5ddce:0xeee4d2;
  const shade=ungers?0x373f40:0x626760, glass=ungers?0x43555b:ribbon?0x586c73:0x697579;
  b.face(edge,mid,base+height/2,length,height,.09,paint,.20);
  const band=(dy:number, thick:number, color:number, depth=.19)=>b.face(edge,mid,base+dy,length,thick,depth,color,.34);
  band(.24,.44,0xa59e8d); band(height-.27,.22,trim,.35);
  for (const level of levels) {
    const nominalWidth=ungers?2.32:ribbon?1.45:1.51;
    for (const u of axes) {
      // Even the short facets at a slight change of bearing retain their own end jamb.
      const width=Math.min(nominalWidth,2*(Math.min(u,length-u)-.17));
      if (width<=.40) continue;
      const h=Math.min(ungers?2.36:ribbon?2.5:2.58,2*(height-level-.10));
      if (h<=.65) continue;
      const y=base+level;
      b.window(edge,u,y,width,h,trim,shade,glass,false,.40);
      if (ungers) {
        // Ungers's square openings are divided horizontally and vertically into four lights.
        b.face(edge,u,y,width,.078,.11,shade,.51);
      } else if (finish==='stucco') {
        b.face(edge,u,y+h/2+.21,width+.43,.17,.32,trim,.42);
      }
    }
    if(ribbon) band(level-1.59,.37,trim,.29);
  }
  if (ungers || ribbon) {
    if (base < 6) band(6.89,.20,trim);
    for (const u of source.shopAxes) {
      const width=Math.min(ungers?4.80:4.05,2*(Math.min(u,length-u)-.19));
      if(width<.55) continue;
      b.face(edge,u,base+3.30,width,5.89,.12,glass,.37,'glass');
      b.face(edge,u,base+4.99,width,.17,.20,shade,.53);
      b.face(edge,u,base+3.30,.10,5.82,.12,shade,.54);
      if (ungers) b.face(edge,u,base+6.55,width+.24,.21,.31,trim,.41);
    }
  } else {
    band(3.40,.32,trim,.36);
    // The classical northwest facades have a low, rusticated base below the windows.
    for (const u of axes) {
      const width=Math.min(1.36,1.75*Math.min(u,length-u));
      b.face(edge,u,base+1.64,width,1.22,.14,0x5e6060,.35,'glass');
    }
  }
  return true;
}
