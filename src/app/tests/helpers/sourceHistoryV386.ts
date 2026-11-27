import { readSourceHistoryLayer } from "./sourceHistoryLayer";

export const sourceHistoryV386 = readSourceHistoryLayer(
  "v386", "81c372bea1e6df2db96074aa2dc5db97f1158b49",
  new URL("../fixtures/source-history-v386.json", import.meta.url),
  "6b02be848c55fc78b707e8739df40ac249fe8cf87b170018bfa0000cccea07c2",
);
