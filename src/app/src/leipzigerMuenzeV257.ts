import source from "./data/leipzigerMuenzeV257.json";

type Cell = { drawn: number[][]; native: number[][] };

/** Constructor-only rows for an existing v186 spatial cell. Drawn mobile and
 * desktop use the same complete rows; native is independently orthogonal.
 * No geometry/material/texture, retained cache, worker or frame loop is added. */
export function leipzigerMuenzeV257Rows(cell: string, native: boolean): number[][] {
  const rows = (source.cells as Record<string, Cell>)[cell]?.[native ? "native" : "drawn"];
  if (!rows) return [];
  return rows.map(row => [
    ...row.slice(0, 6).map(value => value / 1000),
    ...(native ? [] : [row[6] / 1e6]),
    source.palette[row[row.length - 1]],
  ]);
}

export const LEIPZIGER_MUENZE_V257 = Object.freeze({
  sourceFaces: 36,
  ownerCount: 14,
  drawnRows: 4208,
  nativeRows: 13718,
  correctedSourceOwner: "DEBE01YYK00006oT",
  correctedAuthoredFaces: [4, 7, 20, 25, 33, 110],
  sourceGeometryRetained: true,
  fullStaticDetailOnTouch: true,
  independentNativeGeometry: true,
  references: [
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020051",
    "https://www.alte-muenze-berlin.de/",
    "https://www.berlin.de/ba-mitte/politik-und-verwaltung/bezirksamt/beschluesse-des-bezirksamts/2020/1155-2020-anlage-3-1-gutachtenleipzigerstrasse_textteil.pdf",
    "https://www.wbm.de/fileadmin/user_upload/MITTENDRIN_Q3_2024_Web_barrierefrei.pdf",
  ],
});
