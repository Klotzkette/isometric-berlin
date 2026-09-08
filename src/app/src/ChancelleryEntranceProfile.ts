/** Ehrenhof finish level is sampled from the delivered DGM (5.0–5.1 m).
 * The LoD2 recognition-model anchor (1.554 m) includes lower source parts;
 * it is not the courtyard surface. Detail sizes are photograph estimates. */
export const CHANCELLERY_ENTRANCE_PROFILE = {
  groundWorldY: 5.15,
  fenceHeightM: 3,
  bladePitchM: 0.18,
  bladeThicknessM: 0.055,
  bladeDepthM: 0.28,
  source: "https://commons.wikimedia.org/wiki/File:Bundeskanzleramt_Berlin_2013-05-16.JPG",
  geometryStatus: "DGM-grounded entrance between the office wings; wing limits follow the delivered LoD2 signature, flat steel blades and curved lawn edges are photo-guided display dimensions, not a surveyed fence plan",
} as const;

type OfficeSegment = { width_m: number; depth_m: number; offset_world: readonly number[] };
export function chancelleryFenceLimits(segments?: readonly OfficeSegment[]) {
  const north = segments?.filter(s => s.offset_world[2] < 0).sort((a,b) => b.offset_world[0] - a.offset_world[0])[0];
  const south = segments?.filter(s => s.offset_world[2] > 0).sort((a,b) => b.offset_world[0] - a.offset_world[0])[0];
  return {
    x: north && south ? Math.min(north.offset_world[0] + north.width_m / 2, south.offset_world[0] + south.width_m / 2) - .9 : 170.438,
    z0: north ? north.offset_world[2] + north.depth_m / 2 - .12 : -27.621,
    z1: south ? south.offset_world[2] - south.depth_m / 2 + .12 : 27.6945,
  };
}

/** Ground outlines manually digitised from the public DOP 2025 spring WMS.
 * Only visible ground is traced; the shadowed southern garden is not guessed.
 * Closed rings are in the recognition model's local x/z frame. */
export const CHANCELLERY_LAWN_DOP = {
  url: "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
  layer: "dop_2025", crs: "EPSG:25833",
  bbox: [389330,5820080,389495,5820215], rasterSize: [1650,1350],
  geometryStatus: "Manually traced visible 2025 orthophoto lawn boundaries, rounded to millimetres for stable transforms; accuracy remains approximately 0.5–1 m, not a cadastral survey",
} as const;
export const CHANCELLERY_LAWN_RINGS: readonly (readonly (readonly [number,number])[])[] = [[[98.928,-27.21],[121.622,-27.739],[166.526,-28.087],[164.092,-25.23],[157.782,-21.281],[146.132,-19.009],[126.163,-17.443],[117.977,-16.751],[113.994,-20.259],[101.653,-21.872]],[[170.497,-33.681],[173.979,-34.463],[176.707,-33.326],[175.544,-31.699],[172.301,-29.222],[170.206,-28.973]],[[170.137,-27.671],[173.438,-27.648],[172.899,-25.035],[173.129,-23.74],[175.743,-23.201],[175.582,-21.497],[172.732,-19.33],[169.147,-18.646],[166.624,-19.587],[168.775,-21.738],[169.709,-24.56]],[[168.896,-12.238],[176.555,-14.117],[180.672,-13.413],[179.124,-11.177],[176.569,-9.216],[172.103,-7.712],[169.397,-7.949],[167.555,-9.706]],[[162.899,-3.496],[166.663,-5.084],[170.545,-5.875],[172.761,-5.226],[176.465,-5.113],[178.025,-2.549],[175.27,-0.584],[172.487,0.181],[168.081,-0.016],[164.059,-0.922]],[[165.811,9.84],[169.289,8.858],[172.314,9.888],[173.955,11.65],[172.593,13.283],[169.301,13.659],[166.571,12.423]],[[169.596,13.452],[172.4,13.587],[174.139,15.247],[177.057,15.979],[177.697,17.665],[174.207,18.146],[171.08,17.019],[167.764,16.396]],[[173.811,9.753],[176.698,9.186],[179.633,10.618],[181.495,13.275],[179.312,14.026],[175.885,12.906]],[[170.201,22.241],[172.519,22.987],[175.084,25.728],[175.519,27.218],[172.629,27.686],[170.092,26.144]],[[169.732,27.853],[172.362,29.092],[176.014,31.308],[176.942,32.486],[174.657,33.14],[171.73,32.008],[169.99,30.348]]];

export function chancelleryLawnContains(ring: readonly (readonly [number,number])[],x:number,z:number): boolean {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [ax,az]=ring[i], [bx,bz]=ring[j];
    if((az>z)!==(bz>z) && x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
  }
  return inside;
}
