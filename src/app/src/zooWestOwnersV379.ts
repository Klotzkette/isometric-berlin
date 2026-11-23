import replacement from "./data/zooWestV379Ownership.json";

interface Prism {id?: string; ring?: number[][]; holes?: number[][][]; y0_dm?: number; h_dm?: number; class?: number; roof?: number; tone?: number[]}
function fingerprint(p: Prism) {
  return JSON.stringify([p.id,p.ring,p.holes,p.y0_dm,p.h_dm,p.class,p.roof,p.tone]);
}
const owners = new Map(replacement.previousPrisms.map(p => [p.id, fingerprint(p)]));
const neighbours = new Map(replacement.neighbours.map(p => [p.id, fingerprint(p)]));
export function isZooWestSourceV379(raw: unknown): boolean {
  const record = raw as Prism | undefined;
  if (!record?.id) return false;
  const expected = owners.get(record.id);
  return expected !== undefined && expected === fingerprint(record);
}

/** Exact former column masks belong only to these cadastre-matched replacement houses. */
export function createZooWestColumnTesterV379(source: readonly unknown[] | undefined, cell: number) {
  const no = (_x: number, _z: number, _y: number, _top: number, _kind: number) => false;
  if (cell !== replacement.cell || !source) return no;
  const seen = new Set<string>();
  const changed: number[][] = [];
  const [x0,z0,x1,z1] = replacement.bounds;
  for (const raw of source) {
    const prism = raw as Prism | undefined;
    if (!prism?.id || !Array.isArray(prism.ring) || !prism.ring.length) continue;
    if (owners.has(prism.id)) {
      if (!isZooWestSourceV379(prism) || seen.has(prism.id)) return no;
      seen.add(prism.id);
      continue;
    }
    let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
    for (const [x,z] of prism.ring) {
      if (x<minX) minX=x;
      if (x>maxX) maxX=x;
      if (z<minZ) minZ=z;
      if (z>maxZ) maxZ=z;
    }
    if (maxX/10<x0-cell || minX/10>x1+cell || maxZ/10<z0-cell || minZ/10>z1+cell) continue;
    if (neighbours.get(prism.id) !== fingerprint(prism)) changed.push([minX/10,minZ/10,maxX/10,maxZ/10]);
  }
  if (seen.size !== owners.size) return no;
  const allowed = new Set(replacement.columns.filter(([x,z]) =>
    !changed.some(b => x*cell<=b[2] && (x+1)*cell>=b[0] && z*cell<=b[3] && (z+1)*cell>=b[1])
  ).map(tuple=>tuple.join("/")));
  const xMin=Math.floor(x0/cell), xMax=Math.floor(x1/cell), zMin=Math.floor(z0/cell), zMax=Math.floor(z1/cell);
  return (x: number,z: number,low: number,high: number,kind: number) => x>=xMin && x<=xMax &&
    z>=zMin && z<=zMax && allowed.has([x,z,low,high,kind].join("/"));
}
