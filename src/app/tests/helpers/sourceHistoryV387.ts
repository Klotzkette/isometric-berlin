import { readSourceHistoryLayer } from "./sourceHistoryLayer";
import { sourceHistoryV388 } from "./sourceHistoryV388";

export const sourceHistoryV387 = readSourceHistoryLayer(
  "v387", "a4e52ba4a801439fb50b67ee9bfa377ab173bc5a",
  new URL("../fixtures/source-history-v387.json", import.meta.url),
  "dfa33f8f44533d0f86e494c1ff0cabb71c8cb26bd8a771b03d843a1c969b3dd8", sourceHistoryV388,
);
