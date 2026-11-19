import { BufferGeometry, Color, Float32BufferAttribute, Uint8BufferAttribute } from "three";

export const FRITZ_COURSE_PAINT = [0xac745e, 0xb6836b, 0xb4aa98] as const;
export function isFritzCourseV366(id: string): boolean {
  return id === "157606017:0" || id === "1299563542:0";
}

// Repartition the existing terrain-draped ribbon. Its two narrow flush stone
// edges and its running surface share boundaries, so no coincident top faces remain.
export function paintFritzCourseV366(ribbon: BufferGeometry, compacted: boolean): void {
  const source = ribbon.getAttribute("position"), uv = ribbon.getAttribute("uv");
  const vertices: number[] = [], texels: number[] = [], colours: number[] = [], index: number[] = [];
  const paint = FRITZ_COURSE_PAINT.map(hex => new Color(hex).toArray().map(c => Math.round(255*c)));
  for (let i=0;i<source.count;i+=2) {
    const edge = Math.min(.15, .095 / Math.max(.01, uv.getY(i+1)-uv.getY(i)));
    const row = [0, edge, edge, 1-edge, 1-edge, 1];
    for (let k=0; k<row.length; k++) {
      const t=row[k], s=1-t;
      vertices.push(s*source.getX(i)+t*source.getX(i+1),s*source.getY(i)+t*source.getY(i+1),s*source.getZ(i)+t*source.getZ(i+1));
      texels.push(uv.getX(i),s*uv.getY(i)+t*uv.getY(i+1));
      colours.push(...paint[k===2||k===3 ? Number(compacted) : 2]);
    }
    if (i+2<source.count) for (const k of [0,2,4]) {
      const left = i*3+k, next = left+6;
      index.push(left,left+1,next+1,left,next+1,next);
    }
  }
  ribbon.setAttribute("position",new Float32BufferAttribute(vertices,3));
  ribbon.setAttribute("uv",new Float32BufferAttribute(texels,2));
  ribbon.setAttribute("color",new Uint8BufferAttribute(colours,3,true));
  ribbon.deleteAttribute("normal");
  ribbon.setIndex(index);
  ribbon.computeVertexNormals();
}
