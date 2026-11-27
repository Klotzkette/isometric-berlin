import { readSourceHistoryLayer } from "./sourceHistoryLayer";
import { sourceHistoryV389 } from "./sourceHistoryV389";

export const sourceHistoryV388 = readSourceHistoryLayer(
  "v388", "91095ff0b820e7373b4e3e867e647721c76833d3",
  new URL("../fixtures/source-history-v388.json", import.meta.url),
  "3333f67dc040d175c6736fce590c2b316a4b76c328cfde7dba064b8bf9e2e8fb", sourceHistoryV389,
);
