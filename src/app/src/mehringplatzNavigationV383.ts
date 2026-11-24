import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import encoded from "./data/mehringplatzV383/navigation.json";

type Solid = [string, string, number, number, number[][][]];
type Style = "drawn" | "native";

const originByCoreId: Record<string, string> = {
  "38799552": "w38799552", "25483580": "w25483580", "15548229": "w315548229",
  "25483631": "w25483631", "16110464": "w16110464",
};

const tables: Partial<Record<Style, Map<string, Solid[]>>> = {};

export function mehringplatzSolidsV383(coreId: string, native: boolean): Solid[] | undefined {
  const source = originByCoreId[coreId];
  if (!source) return;
  const style = native ? "native" : "drawn";
  let bySource = tables[style];
  if (!bySource) {
    const rows: Solid[] = JSON.parse(new TextDecoder().decode(gunzipSync(decodeBase64Bytes(encoded[style]))));
    bySource = new Map();
    for (const row of rows) {
      const solids = bySource.get(row[0]);
      if (solids) solids.push(row);
      else bySource.set(row[0], [row]);
    }
    tables[style] = bySource;
  }
  return bySource.get(source);
}
