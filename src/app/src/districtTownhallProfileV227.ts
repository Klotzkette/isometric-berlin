/** Architectural families checked against the district/heritage records listed
 * in townhall-identities-v227.json. Dimensions of small fittings are explicit
 * display estimates; source wall planes and silhouettes remain authoritative. */
export type TownhallRecipeV227 = {
  wall: number; roof: number; trim: number; glass: number;
  family: "brick-gothic" | "civic-stone" | "plain-brick" | "modern-bands" | "modern-grid";
  floor: number; pitch: number; opening: number; clock: boolean;
};
const recipe = (family: TownhallRecipeV227["family"], wall: number, roof: number,
  trim: number, glass: number, floor: number, pitch: number, opening: number,
  clock = false): TownhallRecipeV227 => ({ family, wall, roof, trim, glass, floor, pitch, opening, clock });

export const DISTRICT_TOWNHALL_RECIPES_V227: Record<string, TownhallRecipeV227> = {
  mitte: recipe("modern-bands", 0x8295a5, 0x66747b, 0xd5dcd9, 0x638494, 3.5, 2.9, .76),
  tiergarten: recipe("civic-stone", 0xc5b89f, 0x756a57, 0xd8c9ad, 0x63716d, 3.8, 3.0, .46),
  wedding: recipe("plain-brick", 0xa66c51, 0x696e68, 0xd8d3c0, 0x6b7a7d, 3.5, 3.1, .59),
  friedrichshain: recipe("modern-grid", 0xd0cdc1, 0x707875, 0xe1dfd2, 0x667f85, 3.3, 3.1, .67),
  kreuzberg: recipe("modern-grid", 0xc7c8ba, 0x7e8580, 0xe0dfce, 0x708b90, 3.3, 3.1, .68),
  pankow: recipe("plain-brick", 0xa36a4b, 0x65706a, 0xc9b798, 0x677f7a, 4.1, 3.9, .47, true),
  "prenzlauer-berg": recipe("plain-brick", 0xb88d69, 0x986c56, 0xd9c7a7, 0x627875, 4.0, 3.4, .49),
  weissensee: recipe("modern-grid", 0xc4b89d, 0x7d7869, 0xdad3bc, 0x6e7c79, 3.6, 3.6, .58),
  charlottenburg: recipe("civic-stone", 0xbfa77f, 0x986449, 0xd4bf99, 0x5f777a, 4.5, 4.1, .46, true),
  wilmersdorf: recipe("civic-stone", 0xc5c9bd, 0x6e7976, 0xdedfd0, 0x6d8b92, 4.0, 3.5, .49),
  spandau: recipe("civic-stone", 0xb9ae99, 0x82705b, 0xd4c7aa, 0x687f7c, 4.2, 3.8, .46, true),
  steglitz: recipe("brick-gothic", 0xaf7050, 0x485b56, 0xc79e74, 0x617776, 4.1, 3.8, .46, true),
  zehlendorf: recipe("civic-stone", 0xd0c5ac, 0x8d6850, 0xe0d6bd, 0x70847c, 3.8, 3.5, .49),
  schoeneberg: recipe("civic-stone", 0xd2c6aa, 0x8c6f55, 0xe1d2b6, 0x697e79, 4.2, 3.9, .45, true),
  tempelhof: recipe("civic-stone", 0xc2b496, 0x87694f, 0xd7c9aa, 0x667c77, 3.8, 3.3, .45),
  neukoelln: recipe("civic-stone", 0xd0bd99, 0x99654d, 0xe3cfa9, 0x657972, 4.1, 3.7, .45, true),
  treptow: recipe("civic-stone", 0xd6c7a8, 0x95715a, 0xe1d5b9, 0x637a79, 4.2, 3.8, .47),
  koepenick: recipe("brick-gothic", 0xac6c46, 0x6e6555, 0xd6b58c, 0x5e7773, 4.1, 3.5, .43, true),
  marzahn: recipe("modern-grid", 0xb79478, 0x777b73, 0xd5c7ae, 0x6f8587, 3.2, 3.1, .63),
  hellersdorf: recipe("modern-bands", 0xcbd0c6, 0x6d7d7c, 0xe1dfcd, 0x6d8f96, 3.2, 2.8, .74),
  lichtenberg: recipe("brick-gothic", 0xae6847, 0x645e52, 0xd3b08a, 0x637c79, 4.2, 3.7, .46),
  hohenschoenhausen: recipe("modern-grid", 0xd0c6ac, 0x697777, 0xe1dcc9, 0x6b8992, 3.25, 3.1, .68),
  reinickendorf: recipe("plain-brick", 0xa66348, 0x856652, 0xd7c3a1, 0x6a8179, 4.1, 3.7, .48, true),
};

export type TownhallEdgeV227 = {
  a: number[]; b: number[]; base: number; eave: number; normal?: number[];
};
export type TownhallPartV227 = {
  id: string; parentId?: string; ground_y_m: number; top_y_m: number;
  ring: number[][]; holes: number[][][]; wallEdges: TownhallEdgeV227[];
};
export type TownhallSiteV227 = {
  key: string; name: string; anchor: number[]; parts: TownhallPartV227[];
  entrancePoints?: number[][]; existingOwnership?: { family?: string; ids?: string[]; rigidYOffset?: number };
};
