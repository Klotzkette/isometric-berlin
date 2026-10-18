import type { VoxelBuildingColumn } from "../../src/MinecraftVoxelWorld";

type Prism = { id: string; ring: number[][]; holes: number[][][] };
const directions = [[1,0],[-1,0],[0,1],[0,-1]] as const;
const key = ([x,z]: readonly number[]) => `${x},${z}`;

// Independent source-ring crossing; deliberately do not use the runtime mask.
function inside(x: number, z: number, ring: number[][]): boolean {
  let hit = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if ((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) hit=!hit;
  }
  return hit;
}

/** The voxel payload predates LoD2 roof refinement: preserve its exact tuples,
 * rather than silently coercing their 4/8 m courses to the later prism height. */
export function auditHansaLibraryNativeDeltaV237(columns: VoxelBuildingColumn[], cell: number, prisms: Prism[]) {
  const byPrism=prisms.map(prism=>({id:prism.id,columns:columns.filter(([x,z])=>{
    const px=(x+.5)*cell*10,pz=(z+.5)*cell*10;
    return inside(px,pz,prism.ring)&&!prism.holes.some(h=>inside(px,pz,h));
  })}));
  const owned=new Set(byPrism.flatMap(p=>p.columns.map(key)));
  const removedColumns=columns.filter(c=>owned.has(key(c)));
  const affected=new Set(owned);
  for(const [x,z] of removedColumns) for(const [dx,dz] of directions) affected.add(key([x+dx,z+dz]));
  const halo=new Set(affected);
  for(const k of affected) {
    const [x,z]=k.split(',').map(Number);
    for(const [dx,dz] of directions) halo.add(key([x+dx,z+dz]));
  }
  const localColumns=columns.filter(c=>halo.has(key(c)));
  const retainedNeighbourColumns=localColumns.filter(c=>!owned.has(key(c)));
  const panes=(source: VoxelBuildingColumn[])=>{
    const tops=new Map<string,number>();
    for(const c of source) tops.set(key(c),Math.max(tops.get(key(c))??-Infinity,c[3]/10));
    const faces=new Set<string>();
    for(const [x,z,lo,hi] of source) if(affected.has(key([x,z])))
      for(const [dx,dz] of directions)
        for(let y=Math.ceil((lo/10+2)/cell)*cell;y+1.2<=hi/10;y+=cell)
          if((tops.get(key([x+dx,z+dz]))??-Infinity)<y+1) faces.add([x,z,dx,dz,y].join(','));
    return faces;
  };
  const before=panes(localColumns),after=panes(retainedNeighbourColumns);
  const removed=[...before].filter(v=>!after.has(v)).length,exposed=[...after].filter(v=>!before.has(v)).length;
  return {
    removedColumns,localColumns,retainedNeighbourColumns,
    sourceColumnsByPrism:byPrism.map(({id,columns})=>({id,count:columns.length,
      sha256:new Bun.CryptoHasher('sha256').update(JSON.stringify(columns)).digest('hex')})),
    panes:{removed,exposed,netRemoved:removed-exposed},
    removedColumnInstances:{full:removedColumns.reduce((sum,[,,lo,hi])=>{
      const height=Math.max(cell,(hi-lo)/10);return sum+1+Number(height>5)+Number(height>8);
    },0),mobile:removedColumns.length},
  };
}
